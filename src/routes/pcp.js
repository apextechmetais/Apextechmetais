const express = require('express');

/**
 * PCP — Planejamento e Controle da Produção.
 *
 * `dbAvailable` pode ser um booleano ou uma função. O servidor passa uma função, porque o banco só fica
 * disponível depois que as rotas já foram montadas; com o booleano, o PCP trabalhava sempre em memória.
 */
module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();
    const MAX_LINHAS = 4; // o esquema guarda meta_l1..l4 e real_l1..l4

    const usarBanco = () => !!pool && (typeof dbAvailable === 'function' ? !!dbAvailable() : !!dbAvailable);
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
    const inteiro = (v) => { const n = parseInt(v, 10); return Number.isInteger(n) ? n : NaN; };
    const arred = (v, casas = 4) => Number(num(v).toFixed(casas));
    // Colunas DATE chegam do driver como objeto Date: à meia-noite local (node-postgres) ou à meia-noite UTC.
    // Lê-se a data no fuso em que ela é meia-noite, para o dia não "voltar um" conforme o fuso do servidor.
    const dataIso = (d) => {
        if (d instanceof Date) {
            const utc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
            const [a, m, dia] = utc ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()] : [d.getFullYear(), d.getMonth() + 1, d.getDate()];
            return `${a}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }
        return String(d || '').slice(0, 10);
    };
    const nomeUsuario = (req) => (req.user && (req.user.nome || req.user.user)) || 'Usuário';
    const podeExcluir = (req) => ['administrador', 'diretoria', 'produção'].includes(String((req.user && req.user.perfil) || '').trim().toLowerCase());

    async function comTransacao(fn) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const r = await fn(client);
            await client.query('COMMIT');
            return r;
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            client.release();
        }
    }

    /** Dias úteis (segunda a sexta) do mês, até o limite pedido. */
    function diasUteisDoMes(ano, mes, limite) {
        const dias = [];
        const d = new Date(ano, mes - 1, 1);
        while (d.getMonth() === mes - 1 && dias.length < limite) {
            if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(dataIso(d));
            d.setDate(d.getDate() + 1);
        }
        return dias;
    }

    /** Metas por linha a partir do mix: quanto cada linha produz no mês e por dia. */
    function calcularLinhas(mix, plano) {
        const totais = {};
        mix.forEach(i => { totais[i.numero_linha] = (totais[i.numero_linha] || 0) + i.volume_total; });
        const linhas = [];
        for (let n = 1; n <= plano.qtd_linhas; n++) {
            const vol = totais[n] || 0;
            linhas.push({
                numero_linha: n,
                meta_mensal: arred(vol),
                meta_diaria: arred(plano.dias_trabalhados > 0 ? vol / plano.dias_trabalhados : 0),
                percentual_carga: arred(plano.meta_mensal > 0 ? vol / plano.meta_mensal : 0)
            });
        }
        return linhas;
    }

    function validarPlano(body) {
        const ano = inteiro(body.ano), mes = inteiro(body.mes), dias = inteiro(body.dias_trabalhados), linhas = inteiro(body.qtd_linhas);
        const meta = parseFloat(body.meta_mensal);
        if (!(ano >= 2020 && ano <= 2100)) return { erro: 'Informe um ano válido.' };
        if (!(mes >= 1 && mes <= 12)) return { erro: 'Informe um mês entre 1 e 12.' };
        if (!(meta > 0)) return { erro: 'A meta do mês deve ser maior que zero.' };
        if (!(dias >= 1 && dias <= 31)) return { erro: 'Informe os dias trabalhados (1 a 31).' };
        if (!(linhas >= 1 && linhas <= MAX_LINHAS)) return { erro: `Informe de 1 a ${MAX_LINHAS} linhas de produção.` };
        return { plano: { ano, mes, meta_mensal: meta, dias_trabalhados: dias, qtd_linhas: linhas, observacoes: String(body.observacoes || '').slice(0, 500) } };
    }

    function validarMix(itens, plano) {
        if (!Array.isArray(itens)) return { erro: 'O mix é inválido.' };
        const mix = [];
        for (const item of itens) {
            const material_id = inteiro(item && item.material_id), numero_linha = inteiro(item && item.numero_linha);
            const volume_total = parseFloat(item && item.volume_total);
            if (!Number.isInteger(material_id)) return { erro: 'Escolha o material de todos os itens do mix.' };
            if (!(numero_linha >= 1 && numero_linha <= plano.qtd_linhas)) return { erro: `A linha deve ficar entre 1 e ${plano.qtd_linhas}.` };
            if (!(volume_total >= 0)) return { erro: 'O volume de cada item deve ser zero ou maior.' };
            mix.push({ material_id, numero_linha, volume_total });
        }
        return { mix };
    }

    const normalizarPlano = (p) => ({
        id: p.id, ano: inteiro(p.ano), mes: inteiro(p.mes), meta_mensal: num(p.meta_mensal), dias_trabalhados: inteiro(p.dias_trabalhados),
        qtd_linhas: inteiro(p.qtd_linhas), status: p.status || 'RASCUNHO', observacoes: p.observacoes || '', criado_por: p.criado_por || '', criado_em: p.criado_em || null
    });
    const normalizarLinha = (l) => ({ numero_linha: inteiro(l.numero_linha), meta_mensal: num(l.meta_mensal), meta_diaria: num(l.meta_diaria), percentual_carga: num(l.percentual_carga) });
    const normalizarMix = (m) => ({ id: m.id, material_id: inteiro(m.material_id), material_nome: m.material_nome || ('Material ' + m.material_id), numero_linha: inteiro(m.numero_linha), volume_total: num(m.volume_total), percentual_volume: num(m.percentual_volume), meta_dia: num(m.meta_dia) });
    const normalizarDia = (d) => ({
        id: d.id, data: dataIso(d.data),
        meta_l1: num(d.meta_l1), meta_l2: num(d.meta_l2), meta_l3: num(d.meta_l3), meta_l4: num(d.meta_l4), meta_total_dia: num(d.meta_total_dia),
        real_l1: num(d.real_l1), real_l2: num(d.real_l2), real_l3: num(d.real_l3), real_l4: num(d.real_l4), real_total: num(d.real_total),
        observacao: d.observacao || '', atualizado_por: d.atualizado_por || '', atualizado_em: d.atualizado_em || null
    });

    // ─── Modo memória (sem banco): usado em desenvolvimento e nos testes ───
    function memoria() {
        if (!memStore.pcp_planejamentos) memStore.pcp_planejamentos = [];
        if (!memStore.pcp_linhas) memStore.pcp_linhas = [];
        if (!memStore.pcp_mix) memStore.pcp_mix = [];
        if (!memStore.pcp_plano_diario) memStore.pcp_plano_diario = [];
        if (!memStore._pcpSeq) memStore._pcpSeq = 1;
        return memStore;
    }
    const proximoId = () => memoria()._pcpSeq++;

    // ─── Lista de planejamentos ───
    router.get('/', async (req, res) => {
        try {
            if (usarBanco()) {
                const r = await pool.query('SELECT * FROM pcp_planejamentos ORDER BY ano DESC, id DESC');
                const planos = r.rows.map(normalizarPlano).sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes) || (b.id - a.id));
                return res.json(planos);
            }
            const planos = memoria().pcp_planejamentos.map(normalizarPlano).sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes) || (b.id - a.id));
            res.json(planos);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─── Novo planejamento: cria o plano, as linhas e os dias úteis do mês ───
    router.post('/', async (req, res) => {
        const { erro, plano } = validarPlano(req.body || {});
        if (erro) return res.status(400).json({ error: erro });
        const dias = diasUteisDoMes(plano.ano, plano.mes, plano.dias_trabalhados);
        if (dias.length === 0) return res.status(400).json({ error: 'Não há dias úteis neste mês.' });
        // se o mês tem menos dias úteis do que o pedido, vale o que o calendário permite
        plano.dias_trabalhados = dias.length;
        const criadoPor = nomeUsuario(req);
        try {
            if (usarBanco()) {
                const id = await comTransacao(async (c) => {
                    const p = await c.query(
                        `INSERT INTO pcp_planejamentos (ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por)
                         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                        [plano.ano, String(plano.mes), plano.meta_mensal, plano.dias_trabalhados, plano.qtd_linhas, plano.observacoes, criadoPor]
                    );
                    const planId = p.rows[0].id;
                    for (let n = 1; n <= plano.qtd_linhas; n++) {
                        await c.query('INSERT INTO pcp_linhas (planejamento_id, numero_linha, meta_mensal, meta_diaria, percentual_carga) VALUES ($1, $2, 0, 0, 0)', [planId, n]);
                    }
                    for (const data of dias) {
                        const pd = await c.query('INSERT INTO pcp_plano_diario (planejamento_id, data, is_dia_produtivo) VALUES ($1, $2, true) RETURNING id', [planId, data]);
                        await c.query('INSERT INTO pcp_producao_real (plano_diario_id) VALUES ($1)', [pd.rows[0].id]);
                    }
                    return planId;
                });
                return res.json({ id, dias_gerados: dias.length, message: 'Planejamento criado com sucesso.' });
            }

            const m = memoria();
            const id = proximoId();
            m.pcp_planejamentos.push({ id, ...plano, status: 'RASCUNHO', criado_por: criadoPor, criado_em: new Date().toISOString() });
            for (let n = 1; n <= plano.qtd_linhas; n++) m.pcp_linhas.push({ id: proximoId(), planejamento_id: id, numero_linha: n, meta_mensal: 0, meta_diaria: 0, percentual_carga: 0 });
            dias.forEach(data => m.pcp_plano_diario.push({
                id: proximoId(), planejamento_id: id, data, meta_l1: 0, meta_l2: 0, meta_l3: 0, meta_l4: 0, meta_total_dia: 0,
                real_l1: 0, real_l2: 0, real_l3: 0, real_l4: 0, real_total: 0, observacao: ''
            }));
            res.json({ id, dias_gerados: dias.length, message: 'Planejamento criado com sucesso.' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─── Planejamento completo: plano, linhas, mix e os dias com o realizado ───
    router.get('/:id', async (req, res) => {
        try {
            const planId = inteiro(req.params.id);
            if (usarBanco()) {
                const p = await pool.query('SELECT * FROM pcp_planejamentos WHERE id = $1', [planId]);
                if (p.rows.length === 0) return res.status(404).json({ error: 'Planejamento não encontrado' });
                const linhas = await pool.query('SELECT * FROM pcp_linhas WHERE planejamento_id = $1 ORDER BY numero_linha ASC', [planId]);
                const mix = await pool.query(
                    `SELECT m.id, m.material_id, m.numero_linha, m.volume_total, m.percentual_volume, m.meta_dia, mc.nome AS material_nome
                     FROM pcp_mix m JOIN materiais_catalogo mc ON mc.id = m.material_id
                     WHERE m.planejamento_id = $1 ORDER BY m.id ASC`, [planId]);
                const dias = await pool.query(
                    `SELECT pd.id, pd.data, pd.meta_l1, pd.meta_l2, pd.meta_l3, pd.meta_l4, pd.meta_total_dia,
                            pr.real_l1, pr.real_l2, pr.real_l3, pr.real_l4, pr.real_total, pr.observacao, pr.atualizado_por, pr.atualizado_em
                     FROM pcp_plano_diario pd JOIN pcp_producao_real pr ON pr.plano_diario_id = pd.id
                     WHERE pd.planejamento_id = $1 ORDER BY pd.data ASC`, [planId]);
                return res.json({ ...normalizarPlano(p.rows[0]), linhas: linhas.rows.map(normalizarLinha), mix: mix.rows.map(normalizarMix), diario: dias.rows.map(normalizarDia) });
            }

            const m = memoria();
            const plano = m.pcp_planejamentos.find(x => x.id === planId);
            if (!plano) return res.status(404).json({ error: 'Planejamento não encontrado' });
            const materiais = memStore.materiais_catalogo || [];
            res.json({
                ...normalizarPlano(plano),
                linhas: m.pcp_linhas.filter(x => x.planejamento_id === planId).map(normalizarLinha).sort((a, b) => a.numero_linha - b.numero_linha),
                mix: m.pcp_mix.filter(x => x.planejamento_id === planId).map(x => normalizarMix({ ...x, material_nome: (materiais.find(mc => mc.id == x.material_id) || {}).nome })),
                diario: m.pcp_plano_diario.filter(x => x.planejamento_id === planId).map(normalizarDia).sort((a, b) => a.data.localeCompare(b.data))
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─── Mix: grava os itens e recalcula as metas de cada linha e de cada dia ───
    router.put('/:id/mix', async (req, res) => {
        try {
            const planId = inteiro(req.params.id);
            let plano;
            if (usarBanco()) {
                const p = await pool.query('SELECT * FROM pcp_planejamentos WHERE id = $1', [planId]);
                if (p.rows.length === 0) return res.status(404).json({ error: 'Planejamento não encontrado' });
                plano = normalizarPlano(p.rows[0]);
            } else {
                const achado = memoria().pcp_planejamentos.find(x => x.id === planId);
                if (!achado) return res.status(404).json({ error: 'Planejamento não encontrado' });
                plano = normalizarPlano(achado);
            }
            const { erro, mix } = validarMix((req.body || {}).mix, plano);
            if (erro) return res.status(400).json({ error: erro });

            const linhas = calcularLinhas(mix, plano);
            const metaDia = [1, 2, 3, 4].map(n => (linhas.find(l => l.numero_linha === n) || { meta_diaria: 0 }).meta_diaria);
            const totalDia = arred(metaDia.reduce((t, v) => t + v, 0));
            const itens = mix.map(i => ({
                ...i,
                percentual_volume: arred(plano.meta_mensal > 0 ? i.volume_total / plano.meta_mensal : 0),
                meta_dia: arred(plano.dias_trabalhados > 0 ? i.volume_total / plano.dias_trabalhados : 0)
            }));

            if (usarBanco()) {
                await comTransacao(async (c) => {
                    await c.query('DELETE FROM pcp_mix WHERE planejamento_id = $1', [planId]);
                    for (const i of itens) {
                        await c.query(
                            `INSERT INTO pcp_mix (planejamento_id, material_id, numero_linha, volume_total, percentual_volume, meta_dia)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [planId, i.material_id, i.numero_linha, i.volume_total, i.percentual_volume, i.meta_dia]);
                    }
                    for (const l of linhas) {
                        await c.query('UPDATE pcp_linhas SET meta_mensal = $1, meta_diaria = $2, percentual_carga = $3 WHERE planejamento_id = $4 AND numero_linha = $5',
                            [l.meta_mensal, l.meta_diaria, l.percentual_carga, planId, l.numero_linha]);
                    }
                    await c.query('UPDATE pcp_plano_diario SET meta_l1 = $1, meta_l2 = $2, meta_l3 = $3, meta_l4 = $4, meta_total_dia = $5 WHERE planejamento_id = $6',
                        [metaDia[0], metaDia[1], metaDia[2], metaDia[3], totalDia, planId]);
                });
                return res.json({ success: true });
            }

            const m = memoria();
            m.pcp_mix = m.pcp_mix.filter(x => x.planejamento_id !== planId);
            itens.forEach(i => m.pcp_mix.push({ id: proximoId(), planejamento_id: planId, ...i }));
            m.pcp_linhas.filter(x => x.planejamento_id === planId).forEach(l => Object.assign(l, linhas.find(n => n.numero_linha === l.numero_linha) || {}));
            m.pcp_plano_diario.filter(x => x.planejamento_id === planId).forEach(d => Object.assign(d, { meta_l1: metaDia[0], meta_l2: metaDia[1], meta_l3: metaDia[2], meta_l4: metaDia[3], meta_total_dia: totalDia }));
            res.json({ success: true });
        } catch (e) {
            const referencia = /foreign key|violates|materiais_catalogo/i.test(e.message);
            res.status(referencia ? 400 : 500).json({ error: referencia ? 'Um dos materiais do mix não existe no catálogo.' : e.message });
        }
    });

    // ─── Apontamento: produção realizada de um dia ───
    router.put('/producao/:plano_diario_id', async (req, res) => {
        try {
            const pdId = inteiro(req.params.plano_diario_id);
            const b = req.body || {};
            const reais = [b.real_l1, b.real_l2, b.real_l3, b.real_l4].map(v => (v === '' || v === null || v === undefined ? 0 : parseFloat(v)));
            if (reais.some(v => !Number.isFinite(v) || v < 0)) return res.status(400).json({ error: 'A produção de cada linha deve ser zero ou maior.' });
            const total = arred(reais.reduce((t, v) => t + v, 0));
            const observacao = String(b.observacao || '').slice(0, 500);
            const por = nomeUsuario(req);

            if (usarBanco()) {
                const r = await pool.query(
                    `UPDATE pcp_producao_real SET real_l1 = $1, real_l2 = $2, real_l3 = $3, real_l4 = $4, real_total = $5, observacao = $6, atualizado_em = NOW(), atualizado_por = $7
                     WHERE plano_diario_id = $8`,
                    [reais[0], reais[1], reais[2], reais[3], total, observacao, por, pdId]);
                if (r.rowCount === 0) return res.status(404).json({ error: 'Dia não encontrado neste planejamento.' });
                return res.json({ success: true, real_total: total });
            }

            const dia = memoria().pcp_plano_diario.find(x => x.id === pdId);
            if (!dia) return res.status(404).json({ error: 'Dia não encontrado neste planejamento.' });
            Object.assign(dia, { real_l1: reais[0], real_l2: reais[1], real_l3: reais[2], real_l4: reais[3], real_total: total, observacao, atualizado_por: por, atualizado_em: new Date().toISOString() });
            res.json({ success: true, real_total: total });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─── Excluir planejamento (com linhas, mix, dias e apontamentos) ───
    router.delete('/:id', async (req, res) => {
        if (!podeExcluir(req)) return res.status(403).json({ error: 'Seu perfil não pode excluir planejamentos.' });
        try {
            const planId = inteiro(req.params.id);
            if (usarBanco()) {
                const r = await pool.query('DELETE FROM pcp_planejamentos WHERE id = $1', [planId]);
                if (r.rowCount === 0) return res.status(404).json({ error: 'Planejamento não encontrado' });
                return res.json({ success: true });
            }
            const m = memoria();
            if (!m.pcp_planejamentos.some(x => x.id === planId)) return res.status(404).json({ error: 'Planejamento não encontrado' });
            m.pcp_planejamentos = m.pcp_planejamentos.filter(x => x.id !== planId);
            m.pcp_linhas = m.pcp_linhas.filter(x => x.planejamento_id !== planId);
            m.pcp_mix = m.pcp_mix.filter(x => x.planejamento_id !== planId);
            m.pcp_plano_diario = m.pcp_plano_diario.filter(x => x.planejamento_id !== planId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
