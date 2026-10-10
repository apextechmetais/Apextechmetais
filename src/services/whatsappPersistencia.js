/**
 * Persistência do CRM de WhatsApp (contatos, conversas e mensagens) no PostgreSQL.
 *
 * O módulo de WhatsApp trabalha sobre listas em memória (memStore), alteradas em vários pontos:
 * rotas de envio, espelhamento do celular, ressincronização. Em vez de interceptar cada um desses
 * pontos, esta camada carrega as listas do banco ao iniciar e, a cada poucos segundos, grava o que
 * é novo ou mudou. Se o processo cair, perde-se no máximo o intervalo de gravação.
 */
const crypto = require('crypto');

module.exports = function criarPersistenciaWhatsapp(pool, memStore, opcoes = {}) {
    const intervaloMs = opcoes.intervaloMs || 4000;
    const limiteCarga = opcoes.limiteCarga || 50000;   // mensagens mais recentes trazidas para a memória
    const lotePorCiclo = opcoes.lotePorCiclo || 500;   // mensagens gravadas por ciclo
    const log = opcoes.log || ((msg) => console.error('[WhatsApp Persistência] ' + msg));

    const mensagensSalvas = new WeakSet();   // objetos de mensagem que já estão no banco
    const assinaturaConversa = new Map();    // id da conversa -> último estado gravado
    const assinaturaContato = new Map();     // chave do contato -> último estado gravado
    let tabelas = null;
    let gravando = false;
    let timer = null;

    const garantirTabelas = () => tabelas || (tabelas = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_contatos (
                chave      TEXT PRIMARY KEY,
                id_origem  BIGINT,
                nome       TEXT,
                telefone   TEXT,
                empresa    TEXT,
                categoria  TEXT,
                cidade     TEXT
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_conversas (
                id              TEXT PRIMARY KEY,
                instancia_id    TEXT,
                instancia_nome  TEXT,
                contato_nome    TEXT,
                telefone        TEXT,
                atendente_nome  TEXT,
                nao_lidas       INTEGER DEFAULT 0,
                ultima_mensagem TEXT,
                atualizado_em   TIMESTAMPTZ
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
                pid            TEXT PRIMARY KEY,
                id_origem      BIGINT,
                conversa_id    TEXT NOT NULL,
                instancia_id   TEXT,
                remetente      TEXT,
                remetente_nome TEXT,
                mensagem       TEXT,
                tipo           TEXT,
                anexo_url      TEXT,
                tabela_tipo    TEXT,
                enviado_por    TEXT,
                criado_em      TIMESTAMPTZ NOT NULL
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_data ON whatsapp_mensagens (criado_em)');
    })().catch(err => { tabelas = null; throw err; }));

    const paraIso = (v) => {
        const d = v instanceof Date ? v : new Date(v || Date.now());
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    };
    const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
    const chaveContato = (c) => {
        const fone = String(c.telefone || '').replace(/\D/g, '');
        return fone || ('id:' + c.id);
    };
    const estadoConversa = (c) => JSON.stringify([c.instancia_id, c.instancia_nome, c.contato_nome, c.telefone, c.atendente_nome, parseInt(c.nao_lidas) || 0, c.ultima_mensagem, paraIso(c.atualizado_em)]);
    const estadoContato = (c) => JSON.stringify([c.nome, c.telefone, c.empresa, c.categoria, c.cidade]);

    /** Traz do banco o que foi gravado antes do reinício. O que já estiver na memória é mantido. */
    async function carregar() {
        if (!pool) return { contatos: 0, conversas: 0, mensagens: 0 };
        await garantirTabelas();
        if (!memStore.whatsapp_contatos) memStore.whatsapp_contatos = [];
        if (!memStore.whatsapp_conversas) memStore.whatsapp_conversas = [];
        if (!memStore.whatsapp_mensagens) memStore.whatsapp_mensagens = [];

        const contatos = await pool.query('SELECT * FROM whatsapp_contatos');
        const chavesNaMemoria = new Set(memStore.whatsapp_contatos.map(chaveContato));
        contatos.rows.forEach(r => {
            const c = { id: numero(r.id_origem) || Date.now(), nome: r.nome || '', telefone: r.telefone || '', empresa: r.empresa || '', categoria: r.categoria || '', cidade: r.cidade || '' };
            if (!chavesNaMemoria.has(r.chave)) memStore.whatsapp_contatos.push(c);
            assinaturaContato.set(r.chave, estadoContato(c));
        });

        const conversas = await pool.query('SELECT * FROM whatsapp_conversas ORDER BY atualizado_em DESC');
        const idsNaMemoria = new Set(memStore.whatsapp_conversas.map(c => String(c.id)));
        conversas.rows.forEach(r => {
            const c = {
                id: String(r.id), instancia_id: r.instancia_id, instancia_nome: r.instancia_nome, contato_nome: r.contato_nome || '',
                telefone: r.telefone || '', atendente_id: null, atendente_nome: r.atendente_nome || '', nao_lidas: parseInt(r.nao_lidas) || 0,
                ultima_mensagem: r.ultima_mensagem || '', atualizado_em: paraIso(r.atualizado_em)
            };
            if (!idsNaMemoria.has(c.id)) memStore.whatsapp_conversas.push(c);
            assinaturaConversa.set(c.id, estadoConversa(c));
        });

        const mensagens = await pool.query('SELECT * FROM whatsapp_mensagens ORDER BY criado_em DESC LIMIT $1', [limiteCarga]);
        const carregadas = mensagens.rows.reverse().map(r => {
            const m = {
                id: numero(r.id_origem) || 0, conversa_id: String(r.conversa_id), instancia_id: r.instancia_id, remetente: r.remetente,
                remetente_nome: r.remetente_nome, mensagem: r.mensagem || '', tipo: r.tipo || 'texto', anexo_url: r.anexo_url || null,
                tabela_tipo: r.tabela_tipo || null, enviado_por: r.enviado_por || null, criado_em: paraIso(r.criado_em)
            };
            mensagensSalvas.add(m);
            return m;
        });
        memStore.whatsapp_mensagens = carregadas.concat(memStore.whatsapp_mensagens);

        return { contatos: contatos.rows.length, conversas: conversas.rows.length, mensagens: carregadas.length };
    }

    /** Grava o que é novo ou mudou desde o último ciclo. */
    async function gravar() {
        if (!pool || gravando) return { contatos: 0, conversas: 0, mensagens: 0 };
        gravando = true;
        const feito = { contatos: 0, conversas: 0, mensagens: 0 };
        try {
            await garantirTabelas();

            for (const c of (memStore.whatsapp_contatos || [])) {
                const chave = chaveContato(c), estado = estadoContato(c);
                if (assinaturaContato.get(chave) === estado) continue;
                await pool.query(`
                    INSERT INTO whatsapp_contatos (chave, id_origem, nome, telefone, empresa, categoria, cidade) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (chave) DO UPDATE SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, empresa = EXCLUDED.empresa, categoria = EXCLUDED.categoria, cidade = EXCLUDED.cidade
                `, [chave, numero(c.id), c.nome || '', c.telefone || '', c.empresa || '', c.categoria || '', c.cidade || '']);
                assinaturaContato.set(chave, estado);
                feito.contatos++;
            }

            for (const c of (memStore.whatsapp_conversas || [])) {
                const id = String(c.id), estado = estadoConversa(c);
                if (assinaturaConversa.get(id) === estado) continue;
                await pool.query(`
                    INSERT INTO whatsapp_conversas (id, instancia_id, instancia_nome, contato_nome, telefone, atendente_nome, nao_lidas, ultima_mensagem, atualizado_em)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO UPDATE SET instancia_id = EXCLUDED.instancia_id, instancia_nome = EXCLUDED.instancia_nome, contato_nome = EXCLUDED.contato_nome,
                        telefone = EXCLUDED.telefone, atendente_nome = EXCLUDED.atendente_nome, nao_lidas = EXCLUDED.nao_lidas, ultima_mensagem = EXCLUDED.ultima_mensagem, atualizado_em = EXCLUDED.atualizado_em
                `, [id, c.instancia_id || null, c.instancia_nome || null, c.contato_nome || '', c.telefone || '', c.atendente_nome || '', parseInt(c.nao_lidas) || 0, c.ultima_mensagem || '', paraIso(c.atualizado_em)]);
                assinaturaConversa.set(id, estado);
                feito.conversas++;
            }

            for (const m of (memStore.whatsapp_mensagens || [])) {
                if (mensagensSalvas.has(m)) continue;
                if (feito.mensagens >= lotePorCiclo) break; // o restante vai no próximo ciclo
                await pool.query(`
                    INSERT INTO whatsapp_mensagens (pid, id_origem, conversa_id, instancia_id, remetente, remetente_nome, mensagem, tipo, anexo_url, tabela_tipo, enviado_por, criado_em)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (pid) DO NOTHING
                `, [crypto.randomUUID(), numero(m.id), String(m.conversa_id), m.instancia_id || null, m.remetente || null, m.remetente_nome || null,
                    m.mensagem == null ? '' : String(m.mensagem), m.tipo || 'texto', m.anexo_url || null, m.tabela_tipo || null, m.enviado_por || null, paraIso(m.criado_em)]);
                mensagensSalvas.add(m);
                feito.mensagens++;
            }
        } finally {
            gravando = false;
        }
        return feito;
    }

    /** Carrega o histórico e liga a gravação periódica. Devolve a promessa da carga. */
    function iniciar() {
        if (!pool) return Promise.resolve(null);
        return carregar()
            .then(r => { console.log(`[WhatsApp Persistência] Histórico carregado: ${r.conversas} conversas, ${r.mensagens} mensagens, ${r.contatos} contatos.`); return r; })
            .catch(err => { log('não foi possível carregar o histórico: ' + err.message); return null; })
            .finally(() => {
                timer = setInterval(() => { gravar().catch(err => log('falha ao gravar: ' + err.message)); }, intervaloMs);
                if (timer.unref) timer.unref();
            });
    }

    function parar() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    return { carregar, gravar, iniciar, parar };
};
