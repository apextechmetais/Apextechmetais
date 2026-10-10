const express = require('express');
const whatsappManager = require('../services/whatsappManager');

module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();

    whatsappManager.setMemStore(memStore);

    // ─── ESTRUTURAS DE MEMÓRIA (INSTÂNCIAS, CONTATOS, CONVERSAS E MENSAGENS) ───
    if (!memStore.whatsapp_instancias) {
        memStore.whatsapp_instancias = [
            {
                id: 'inst_1',
                nome: 'WhatsApp Geral Empresa',
                numero: '+55 11 99999-0000',
                responsavel: 'Administração Apex',
                status: 'desconectado',
                qr_code: null,
                criado_em: new Date().toISOString()
            },
            {
                id: 'inst_2',
                nome: 'Celular Vendas 01',
                numero: '+55 11 99999-0001',
                responsavel: 'Vendedor João',
                status: 'desconectado',
                qr_code: null,
                criado_em: new Date().toISOString()
            },
            {
                id: 'inst_3',
                nome: 'Celular Compras 02',
                numero: '+55 19 98888-0002',
                responsavel: 'Atendente Maria',
                status: 'desconectado',
                qr_code: null,
                criado_em: new Date().toISOString()
            }
        ];
    }

    if (!memStore.whatsapp_contatos) {
        memStore.whatsapp_contatos = [
            { id: 1, nome: 'Metais Brasil Ltda', telefone: '+55 11 99999-0001', empresa: 'Metais Brasil', categoria: 'Cliente', cidade: 'São Paulo/SP' },
            { id: 2, nome: 'Fundição Indaiatuba', telefone: '+55 19 98888-0002', empresa: 'Fundição Indaiatuba', categoria: 'Fornecedor', cidade: 'Indaiatuba/SP' },
            { id: 3, nome: 'Reciclagem Sul S/A', telefone: '+55 47 97777-0003', empresa: 'Reciclagem Sul', categoria: 'Cliente', cidade: 'Joinville/SC' },
            { id: 4, nome: 'Copper & Alloys Ltd', telefone: '+55 11 96666-0004', empresa: 'Copper Alloys', categoria: 'Comercial', cidade: 'Campinas/SP' }
        ];
    }

    if (!memStore.whatsapp_conversas) {
        memStore.whatsapp_conversas = [
            {
                id: '5511999990001',
                instancia_id: 'inst_2',
                instancia_nome: 'Celular Vendas 01',
                contato_nome: 'Metais Brasil Ltda',
                telefone: '+55 11 99999-0001',
                atendente_id: 1,
                atendente_nome: 'Vendedor João',
                nao_lidas: 1,
                ultima_mensagem: 'Olá, gostaria de receber a tabela de preços atualizada de alumínio e cobre.',
                atualizado_em: new Date().toISOString()
            },
            {
                id: '5519988880002',
                instancia_id: 'inst_3',
                instancia_nome: 'Celular Compras 02',
                contato_nome: 'Fundição Indaiatuba',
                telefone: '+55 19 98888-0002',
                atendente_id: 2,
                atendente_nome: 'Atendente Maria',
                nao_lidas: 0,
                ultima_mensagem: 'Recebido o relatório de amostragem de sucata. Obrigado!',
                atualizado_em: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: '5547977770003',
                instancia_id: 'inst_2',
                instancia_nome: 'Celular Vendas 01',
                contato_nome: 'Reciclagem Sul S/A',
                telefone: '+55 47 97777-0003',
                atendente_id: 1,
                atendente_nome: 'Vendedor João',
                nao_lidas: 0,
                ultima_mensagem: 'Confirma o envio do pedido #1042 amanhã?',
                atualizado_em: new Date(Date.now() - 86400000).toISOString()
            }
        ];
    }

    if (!memStore.whatsapp_mensagens) {
        memStore.whatsapp_mensagens = [
            {
                id: 1,
                conversa_id: '5511999990001',
                instancia_id: 'inst_2',
                remetente: 'cliente',
                remetente_nome: 'Metais Brasil Ltda',
                mensagem: 'Olá, gostaria de receber a tabela de preços atualizada de alumínio e cobre.',
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: null,
                criado_em: new Date(Date.now() - 300000).toISOString()
            },
            {
                id: 2,
                conversa_id: '5511999990001',
                instancia_id: 'inst_2',
                remetente: 'atendente',
                remetente_nome: 'Administrador',
                mensagem: 'olá',
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: 'Administrador',
                criado_em: new Date().toISOString()
            }
        ];
    }

    // Com banco de dados (produção) o CRM começa vazio: os dados de demonstração acima servem só ao modo memória
    if (pool && !memStore._waSemDemo) {
        memStore._waSemDemo = true;
        memStore.whatsapp_instancias = memStore.whatsapp_instancias.filter(i => !['inst_1', 'inst_2', 'inst_3'].includes(i.id));
        memStore.whatsapp_contatos = [];
        memStore.whatsapp_conversas = [];
        memStore.whatsapp_mensagens = [];
    }

    // ─── EQUIPE: cada WhatsApp pertence a um usuário do sistema ───
    // Diretoria e Administrador enxergam e gerenciam todos; os demais só o próprio celular e as próprias conversas.
    const ehGestor = (req) => ['administrador', 'diretoria'].includes(String((req.user && req.user.perfil) || '').trim().toLowerCase());
    const loginDe = (req) => String((req.user && req.user.user) || '');
    const nomeAtendente = (req) => (req.user && (req.user.nome || req.user.user)) || 'Administrador';
    const statusDe = (inst) => whatsappManager.statuses.get(inst.id) || inst.status || 'desconectado';
    const instanciasVisiveis = (req) => (memStore.whatsapp_instancias || []).filter(i => ehGestor(req) || (i.usuario && i.usuario === loginDe(req)));
    const idsVisiveis = (req) => new Set(instanciasVisiveis(req).map(i => i.id));

    /** Conta que o usuário vai usar para enviar: a pedida (se for dele) ou a própria que estiver conectada. */
    function resolverInstancia(req, res, pedida) {
        const visiveis = instanciasVisiveis(req);
        const alvo = pedida
            ? visiveis.find(i => i.id === pedida)
            : (visiveis.find(i => statusDe(i) === 'conectado') || visiveis[0]);
        if (!alvo) {
            res.status(pedida ? 403 : 409).json({ error: pedida ? 'Este WhatsApp pertence a outro usuário.' : 'Você ainda não tem um WhatsApp cadastrado. Conecte o seu em "Contas / Celulares".' });
            return null;
        }
        return alvo.id;
    }

    // As contas ficam gravadas no banco para a equipe não precisar ser recadastrada a cada reinício
    let tabelaInstancias = null;
    const garantirTabelaInstancias = () => tabelaInstancias || (tabelaInstancias = pool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_instancias (
            id          TEXT PRIMARY KEY,
            nome        TEXT NOT NULL,
            numero      TEXT,
            responsavel TEXT,
            usuario     TEXT,
            criado_em   TIMESTAMP DEFAULT NOW()
        )
    `).catch(err => { tabelaInstancias = null; throw err; }));

    async function salvarInstanciaBanco(inst) {
        if (!pool) return;
        try {
            await garantirTabelaInstancias();
            await pool.query(`
                INSERT INTO whatsapp_instancias (id, nome, numero, responsavel, usuario) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, numero = EXCLUDED.numero, responsavel = EXCLUDED.responsavel, usuario = EXCLUDED.usuario
            `, [inst.id, inst.nome, inst.numero || null, inst.responsavel || null, inst.usuario || null]);
        } catch (err) {
            console.error('[WhatsApp] Não foi possível gravar a conta no banco:', err.message);
        }
    }
    async function removerInstanciaBanco(id) {
        if (!pool) return;
        try {
            await garantirTabelaInstancias();
            await pool.query('DELETE FROM whatsapp_instancias WHERE id = $1', [id]);
        } catch (err) {
            console.error('[WhatsApp] Não foi possível remover a conta do banco:', err.message);
        }
    }
    (async function carregarInstanciasBanco() {
        if (!pool) return;
        try {
            await garantirTabelaInstancias();
            const r = await pool.query('SELECT * FROM whatsapp_instancias ORDER BY criado_em ASC');
            r.rows.forEach(row => {
                const atual = memStore.whatsapp_instancias.find(i => i.id === row.id);
                if (atual) {
                    Object.assign(atual, { nome: row.nome, responsavel: row.responsavel, usuario: row.usuario });
                } else {
                    memStore.whatsapp_instancias.push({
                        id: row.id, nome: row.nome, numero: row.numero || 'Pendente', responsavel: row.responsavel || '', usuario: row.usuario || null,
                        status: whatsappManager.statuses.get(row.id) || 'desconectado', qr_code: null, criado_em: row.criado_em
                    });
                }
            });
        } catch (err) {
            console.error('[WhatsApp] Não foi possível carregar as contas do banco:', err.message);
        }
    })();

    // Conversas, mensagens e contatos ficam gravados no banco: carrega o histórico e grava o que muda a cada poucos segundos
    const persistencia = require('../services/whatsappPersistencia')(pool, memStore);
    persistencia.iniciar().then(() => {
        (memStore.whatsapp_contatos || []).forEach(c => {
            const fone = String(c.telefone || '').replace(/\D/g, '');
            if (fone && c.nome && !String(c.nome).startsWith('+') && whatsappManager.contatosMap) whatsappManager.contatosMap.set(fone, c.nome);
        });
    });

    // Guarda geral: ninguém mexe na conta de outro usuário; ações de gestão só para gestores
    router.use((req, res, next) => {
        const m = req.path.match(/^\/instancias\/([^/]+)/);
        if (m) {
            const id = decodeURIComponent(m[1]);
            if (!idsVisiveis(req).has(id)) {
                const existe = (memStore.whatsapp_instancias || []).some(i => i.id === id);
                return res.status(existe ? 403 : 404).json({ error: existe ? 'Este WhatsApp pertence a outro usuário.' : 'Instância não encontrada' });
            }
        }
        if (['/disparo-massa', '/equipe'].includes(req.path) && !ehGestor(req)) {
            return res.status(403).json({ error: 'Apenas Diretoria ou Administrador podem usar este recurso.' });
        }
        next();
    });

    // Painel da equipe (gestores): quem está conectado, quantas conversas e quem ainda não tem WhatsApp
    router.get('/equipe', async (req, res) => {
        try {
            const conversas = memStore.whatsapp_conversas || [];
            const mensagens = memStore.whatsapp_mensagens || [];
            const hoje = new Date().toISOString().slice(0, 10);
            const contas = (memStore.whatsapp_instancias || []).map(i => {
                const convs = conversas.filter(c => c.instancia_id === i.id);
                const datas = convs.map(c => c.atualizado_em).filter(Boolean).sort();
                return {
                    id: i.id, nome: i.nome, numero: i.numero, responsavel: i.responsavel, usuario: i.usuario || null,
                    status: statusDe(i),
                    conversas: convs.length,
                    nao_lidas: convs.reduce((t, c) => t + (parseInt(c.nao_lidas) || 0), 0),
                    enviadas_hoje: mensagens.filter(m => m.instancia_id === i.id && m.remetente === 'atendente' && String(m.criado_em).slice(0, 10) === hoje).length,
                    ultima_atividade: datas.length ? datas[datas.length - 1] : null
                };
            });
            let usuarios = [];
            try {
                usuarios = pool
                    ? (await pool.query('SELECT "user", nome, perfil FROM usuarios ORDER BY nome ASC')).rows
                    : (memStore.usuarios || []).map(u => ({ user: u.user, nome: u.nome, perfil: u.perfil }));
            } catch (e) {
                usuarios = (memStore.usuarios || []).map(u => ({ user: u.user, nome: u.nome, perfil: u.perfil }));
            }
            const comConta = new Set(contas.map(c => c.usuario).filter(Boolean));
            res.json({
                success: true,
                contas,
                usuarios,
                sem_whatsapp: usuarios.filter(u => !comConta.has(u.user)),
                totais: { contas: contas.length, conectadas: contas.filter(c => c.status === 'conectado').length, nao_lidas: contas.reduce((t, c) => t + c.nao_lidas, 0) }
            });
        } catch (err) {
            console.error('[WhatsApp API] Erro equipe:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── 1. STATUS E GESTÃO DE INSTÂNCIAS (CONTAS / CELULARES) ───
    router.get('/status', (req, res) => {
        const instancias = instanciasVisiveis(req);
        const ativas = instancias.filter(i => i.status === 'conectado').length;
        res.json({
            status: ativas > 0 ? 'conectado' : 'desconectado',
            instancias_totais: instancias.length,
            instancias_ativas: ativas,
            instancias: instancias,
            restauracao_tag: 'before-whatsapp',
            restauracao_commit: 'dab8553'
        });
    });

    router.get('/instancias', (req, res) => {
        const list = instanciasVisiveis(req).map(inst => {
            const st = whatsappManager.statuses.get(inst.id);
            if (st) inst.status = st;
            return inst;
        });
        res.json({ success: true, instancias: list, gestor: ehGestor(req), usuario: loginDe(req), nome: nomeAtendente(req) });
    });

    router.post('/resincronizar', async (req, res) => {
        // A ressincronização geral mexe em todas as contas: só gestores a disparam
        if (!ehGestor(req)) return res.json({ success: true, ignorado: true });
        try {
            const data = await whatsappManager.resincronizarTudo();
            res.json({ success: true, ...data });
        } catch (e) {
            console.error('[WhatsApp API] Erro ao resincronizar:', e);
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/instancias', async (req, res) => {
        const { nome, numero, responsavel, usuario } = req.body || {};
        const gestor = ehGestor(req);
        // Gestor pode cadastrar o celular de qualquer usuário; os demais cadastram só o próprio
        const dono = gestor ? (String(usuario || '').trim() || loginDe(req)) : loginDe(req);
        if (!gestor && (memStore.whatsapp_instancias || []).some(i => i.usuario === dono)) {
            return res.status(409).json({ error: 'Você já tem um WhatsApp cadastrado. Use "Escanear QR Code" para reconectá-lo.' });
        }
        const nomeConta = String(nome || '').trim() || `WhatsApp de ${gestor && usuario ? usuario : nomeAtendente(req)}`;

        const id = 'inst_' + Date.now();
        const novaInstancia = {
            id,
            nome: nomeConta.slice(0, 80),
            numero: numero || 'Pendente',
            responsavel: String(responsavel || '').trim() || (dono === loginDe(req) ? nomeAtendente(req) : dono),
            usuario: dono,
            status: 'desconectado',
            qr_code: null,
            criado_em: new Date().toISOString()
        };

        memStore.whatsapp_instancias.push(novaInstancia);
        await salvarInstanciaBanco(novaInstancia);
        await whatsappManager.iniciarInstancia(id);
        res.json({ success: true, instancia: novaInstancia });
    });

    // Gestor troca o nome, o responsável ou o usuário dono de uma conta
    router.put('/instancias/:id', async (req, res) => {
        if (!ehGestor(req)) return res.status(403).json({ error: 'Apenas Diretoria ou Administrador podem alterar uma conta.' });
        const inst = memStore.whatsapp_instancias.find(i => i.id === req.params.id);
        const { nome, responsavel, usuario } = req.body || {};
        if (nome !== undefined && String(nome).trim()) inst.nome = String(nome).trim().slice(0, 80);
        if (responsavel !== undefined) inst.responsavel = String(responsavel).trim();
        if (usuario !== undefined) inst.usuario = String(usuario).trim() || null;
        await salvarInstanciaBanco(inst);
        res.json({ success: true, instancia: inst });
    });

    router.get('/instancias/:id/qr', async (req, res) => {
        try {
            const id = req.params.id;
            const info = await whatsappManager.obterQrCode(id);
            const inst = memStore.whatsapp_instancias.find(i => i.id === id);
            res.json({
                success: true,
                status: info.status || (inst ? inst.status : 'desconectado'),
                qr: info.qr || (inst ? inst.qr_code : null)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/instancias/:id/conectar', async (req, res) => {
        try {
            const id = req.params.id;
            const inst = memStore.whatsapp_instancias.find(i => i.id === id);
            if (!inst) return res.status(404).json({ error: 'Instância não encontrada' });

            const info = await whatsappManager.iniciarInstancia(id);
            res.json({ success: true, status: info.status, qr: info.qr, instancia: inst });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/instancias/:id', async (req, res) => {
        const id = req.params.id;
        await whatsappManager.desconectar(id);
        memStore.whatsapp_instancias = (memStore.whatsapp_instancias || []).filter(i => i.id !== id);
        await removerInstanciaBanco(id);
        res.json({ success: true });
    });

    // ─── 2. GESTÃO E IMPORTAÇÃO DE CONTATOS ───
    router.get('/contatos', (req, res) => {
        res.json({ success: true, contatos: memStore.whatsapp_contatos || [] });
    });

    router.post('/contatos', (req, res) => {
        const { nome, telefone, empresa, categoria } = req.body;
        if (!nome || !telefone) return res.status(400).json({ error: 'Nome e Telefone são obrigatórios' });

        const novoContato = {
            id: Date.now(),
            nome,
            telefone,
            empresa: empresa || '',
            categoria: categoria || 'Geral',
            cidade: ''
        };

        memStore.whatsapp_contatos.push(novoContato);
        res.json({ success: true, contato: novoContato });
    });

    router.post('/contatos/importar', (req, res) => {
        const { texto_csv } = req.body;
        if (!texto_csv) return res.status(400).json({ error: 'Texto para importação vazio.' });

        const linhas = texto_csv.split('\n');
        let adicionados = 0;

        linhas.forEach(linha => {
            const partes = linha.split(/[,;\t]/);
            if (partes.length >= 2) {
                const nome = partes[0].trim();
                const telefone = partes[1].trim();
                const empresa = partes[2] ? partes[2].trim() : '';

                if (nome && telefone) {
                    memStore.whatsapp_contatos.push({
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        nome,
                        telefone,
                        empresa,
                        categoria: 'Importado',
                        cidade: ''
                    });
                    adicionados++;
                }
            }
        });

        res.json({ success: true, adicionados, total: memStore.whatsapp_contatos.length });
    });

    // ─── 3. LISTAGEM DE CONVERSAS (SUPORTA FILTRO POR INSTÂNCIA / CONTA) ───
    router.get('/conversas', (req, res) => {
        try {
            const { busca, atendente_id, instancia_id } = req.query;
            const visiveis = idsVisiveis(req);
            let conversas = (memStore.whatsapp_conversas || []).filter(c => visiveis.has(c.instancia_id));

            // Resolve nomes reais dos contatos
            conversas.forEach(c => {
                const cleanNum = c.telefone ? c.telefone.replace(/\D/g, '') : c.id;
                const matchContato = (memStore.whatsapp_contatos || []).find(ct => ct.telefone && ct.telefone.replace(/\D/g, '') === cleanNum);
                const nomeManager = whatsappManager.contatosMap ? whatsappManager.contatosMap.get(cleanNum) : null;

                if (matchContato && matchContato.nome && !matchContato.nome.startsWith('+') && matchContato.nome !== 'Funcionário') {
                    c.contato_nome = matchContato.nome;
                } else if (nomeManager) {
                    c.contato_nome = nomeManager;
                } else if (c.contato_nome === 'Funcionário' || !c.contato_nome) {
                    c.contato_nome = `Contato +${cleanNum}`;
                }
            });

            if (busca) {
                const term = busca.toLowerCase();
                conversas = conversas.filter(c => 
                    (c.contato_nome && c.contato_nome.toLowerCase().includes(term)) ||
                    (c.telefone && c.telefone.includes(term)) ||
                    (c.ultima_mensagem && c.ultima_mensagem.toLowerCase().includes(term))
                );
            }

            if (atendente_id) {
                conversas = conversas.filter(c => c.atendente_id == atendente_id);
            }

            if (instancia_id) {
                conversas = conversas.filter(c => c.instancia_id === instancia_id);
            }

            res.json({ success: true, conversas });
        } catch (err) {
            console.error('[WhatsApp API] Erro conversas:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/conversas/:id/nome', (req, res) => {
        try {
            const id = req.params.id;
            const { novo_nome } = req.body;
            if (!novo_nome) return res.status(400).json({ error: 'novo_nome é obrigatório' });

            const cleanNum = id.replace(/\D/g, '');
            const conv = (memStore.whatsapp_conversas || []).find(c => String(c.id) === String(id) || String(c.id) === String(cleanNum));
            if (conv && !idsVisiveis(req).has(conv.instancia_id)) {
                return res.status(403).json({ error: 'Esta conversa pertence a outro usuário.' });
            }
            if (conv) {
                conv.contato_nome = novo_nome;
            }

            let cont = (memStore.whatsapp_contatos || []).find(c => c.telefone && c.telefone.replace(/\D/g, '') === cleanNum);
            if (cont) {
                cont.nome = novo_nome;
            } else {
                memStore.whatsapp_contatos.push({
                    id: Date.now(),
                    nome: novo_nome,
                    telefone: `+${cleanNum}`,
                    empresa: '',
                    categoria: 'Geral',
                    cidade: ''
                });
            }

            if (whatsappManager.contatosMap) {
                whatsappManager.contatosMap.set(cleanNum, novo_nome);
            }

            res.json({ success: true, contato_nome: novo_nome });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/conversas/:id/mensagens', (req, res) => {
        try {
            const conversaId = req.params.id;
            const visiveis = idsVisiveis(req);
            const conv = (memStore.whatsapp_conversas || []).find(c => String(c.id) === String(conversaId));
            if (conv && !visiveis.has(conv.instancia_id)) {
                return res.status(403).json({ error: 'Esta conversa pertence a outro usuário.' });
            }
            const mensagens = (memStore.whatsapp_mensagens || []).filter(m => m.conversa_id === conversaId && (ehGestor(req) || visiveis.has(m.instancia_id)));
            res.json({ success: true, mensagens });
        } catch (err) {
            console.error('[WhatsApp API] Erro mensagens:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/enviar-mensagem', async (req, res) => {
        try {
            const { conversa_id, mensagem, usuario_nome, instancia_id } = req.body;
            if (!conversa_id || !mensagem) {
                return res.status(400).json({ error: 'conversa_id e mensagem são obrigatórios' });
            }

            const instId = resolverInstancia(req, res, instancia_id);
            if (!instId) return;
            const conv = memStore.whatsapp_conversas.find(c => c.id === String(conversa_id));
            const telefoneDestino = conv ? conv.telefone : conversa_id;

            // Envia pelo celular conectado. Se não sair, avisa: antes a mensagem aparecia como enviada mesmo sem ter ido.
            try {
                await whatsappManager.enviarMensagem(instId, telefoneDestino, mensagem);
            } catch (e) {
                console.log(`[WhatsApp Real Send] Socket (${instId}): ${e.message}`);
                return res.status(409).json({ error: 'Mensagem não enviada: este WhatsApp não está conectado. Escaneie o QR Code em "Contas / Celulares".' });
            }

            const novaMensagem = {
                id: Date.now(),
                conversa_id: String(conversa_id),
                instancia_id: instId,
                remetente: 'atendente',
                remetente_nome: nomeAtendente(req),
                mensagem: mensagem,
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: nomeAtendente(req),
                criado_em: new Date().toISOString()
            };

            memStore.whatsapp_mensagens.push(novaMensagem);

            if (conv) {
                conv.ultima_mensagem = mensagem;
                conv.atualizado_em = new Date().toISOString();
            } else {
                // Cria conversa automaticamente se não existir
                const cont = memStore.whatsapp_contatos.find(k => k.telefone.includes(conversa_id)) || { nome: 'Contato ' + conversa_id, telefone: conversa_id };
                memStore.whatsapp_conversas.push({
                    id: String(conversa_id),
                    instancia_id: instId,
                    instancia_nome: 'WhatsApp Geral',
                    contato_nome: cont.nome,
                    telefone: cont.telefone,
                    atendente_id: 1,
                    atendente_nome: nomeAtendente(req),
                    nao_lidas: 0,
                    ultima_mensagem: mensagem,
                    atualizado_em: new Date().toISOString()
                });
            }

            res.json({ success: true, mensagem: novaMensagem });
        } catch (err) {
            console.error('[WhatsApp API] Erro ao enviar mensagem:', err);
            res.status(500).json({ error: err.message });
        }
    });

    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

    router.post('/enviar-media', upload.single('arquivo'), async (req, res) => {
        try {
            const { conversa_id, legenda, usuario_nome, instancia_id } = req.body;
            if (!conversa_id || !req.file) {
                return res.status(400).json({ error: 'conversa_id e arquivo são obrigatórios' });
            }

            const instId = resolverInstancia(req, res, instancia_id);
            if (!instId) return;
            const conv = memStore.whatsapp_conversas.find(c => c.id === String(conversa_id));
            const telefoneDestino = conv ? conv.telefone : conversa_id;

            const isImg = req.file.mimetype.startsWith('image/');
            const isDoc = !isImg && !req.file.mimetype.startsWith('audio/') && !req.file.mimetype.startsWith('video/');
            const ext = path.extname(req.file.originalname) || (isImg ? '.jpg' : '.pdf');
            const filename = `out_media_${Date.now()}_${Math.floor(Math.random()*10000)}${ext}`;
            const mediaDir = path.join(__dirname, '../../data/whatsapp_media');
            const mediaPath = path.join(mediaDir, filename);
            
            if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
            fs.writeFileSync(mediaPath, req.file.buffer);

            const anexoUrl = `/whatsapp-media/${filename}`;
            const msgTipo = isImg ? 'imagem' : isDoc ? 'documento' : 'video';

            // Transmite foto/arquivo pelo celular via Baileys no WhatsApp real
            try {
                await whatsappManager.enviarMedia(instId, telefoneDestino, req.file.buffer, req.file.originalname, req.file.mimetype, legenda);
            } catch (e) {
                console.log(`[WhatsApp Real Send Media] Socket (${instId}): ${e.message}`);
            }

            const novaMensagem = {
                id: Date.now(),
                conversa_id: String(conversa_id),
                instancia_id: instId,
                remetente: 'atendente',
                remetente_nome: nomeAtendente(req),
                mensagem: legenda || `[${isImg ? 'Imagem' : 'Documento'}: ${req.file.originalname}]`,
                tipo: msgTipo,
                anexo_url: anexoUrl,
                enviado_por: nomeAtendente(req),
                criado_em: new Date().toISOString()
            };

            memStore.whatsapp_mensagens.push(novaMensagem);

            if (conv) {
                conv.ultima_mensagem = legenda || `[Mídia: ${req.file.originalname}]`;
                conv.atualizado_em = new Date().toISOString();
            }

            res.json({ success: true, mensagem: novaMensagem });
        } catch (err) {
            console.error('[WhatsApp API] Erro ao enviar mídia:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── 5. DISPARAR TABELA / RELATÓRIO DO SISTEMA ───
    router.post('/enviar-tabela', (req, res) => {
        try {
            const { conversa_id, tabela_tipo, titulo_personalizado, observacoes, usuario_nome, instancia_id } = req.body;
            const instId = resolverInstancia(req, res, instancia_id);
            if (!instId) return;
            if (!conversa_id || !tabela_tipo) {
                return res.status(400).json({ error: 'conversa_id e tabela_tipo são obrigatórios' });
            }

            let textoTabela = '';
            const dataAtual = new Date().toLocaleDateString('pt-BR');

            if (tabela_tipo === 'precos_venda') {
                textoTabela = `📊 *TABELA DE PREÇOS APEX TECH METAIS* (${dataAtual})\n\n` +
                    `• *Sucata Cobre Mel*: R$ 42,50/kg\n` +
                    `• *Sucata Fio Misto*: R$ 28,30/kg\n` +
                    `• *Sucata Alumínio Bloco*: R$ 12,80/kg\n` +
                    `• *Sucata Latão Estamparia*: R$ 24,90/kg\n\n` +
                    `*Validade*: Sujeito a alteração LME diário.\n` +
                    (observacoes ? `\n_Obs_: ${observacoes}` : '');
            } else if (tabela_tipo === 'lme_boletim') {
                textoTabela = `📈 *BOLETIM OFICIAL LME - APEX TECH* (${dataAtual})\n\n` +
                    `• *Cobre Cash*: US$ 9.850,00 / ton\n` +
                    `• *Alumínio Cash*: US$ 2.450,00 / ton\n` +
                    `• *Dólar PTAX*: R$ 5,6200\n\n` +
                    (observacoes ? `\n_Obs_: ${observacoes}` : '');
            } else if (tabela_tipo === 'pcp_producao') {
                textoTabela = `🏭 *RELATÓRIO DE PRODUÇÃO PCP APEX* (${dataAtual})\n\n` +
                    `• *Meta Mensal*: 100.000,0 kg\n` +
                    `• *Realizado*: 87.450,0 kg\n` +
                    `• *Atingimento*: 87,45%\n` +
                    `• *Status*: Em dia com a programação.\n\n` +
                    (observacoes ? `\n_Obs_: ${observacoes}` : '');
            } else {
                textoTabela = `📋 *RELATÓRIO DO SISTEMA APEX* (${dataAtual})\n\n${observacoes || 'Segue tabela solicitada.'}`;
            }

            const msgEnv = `${titulo_personalizado ? '*' + titulo_personalizado + '*\n\n' : ''}${textoTabela}`;

            const novaMensagem = {
                id: Date.now(),
                conversa_id: String(conversa_id),
                instancia_id: instId,
                remetente: 'sistema_tabela',
                remetente_nome: nomeAtendente(req),
                mensagem: msgEnv,
                tipo: 'tabela_sistema',
                anexo_url: null,
                tabela_tipo: tabela_tipo,
                enviado_por: nomeAtendente(req),
                criado_em: new Date().toISOString()
            };

            memStore.whatsapp_mensagens.push(novaMensagem);

            const conv = memStore.whatsapp_conversas.find(c => c.id === String(conversa_id));
            if (conv) {
                conv.ultima_mensagem = `[Tabela Enviada: ${tabela_tipo}]`;
                conv.atualizado_em = new Date().toISOString();
            }

            res.json({ success: true, mensagem: novaMensagem });
        } catch (err) {
            console.error('[WhatsApp API] Erro ao enviar tabela:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── 6. DISPARO EM MASSA (BROADCAST PARA TODOS OS CONTATOS) ───
    router.post('/disparo-massa', (req, res) => {
        try {
            const { mensagem, tabela_tipo, contatos_ids, usuario_nome, instancia_id } = req.body;
            const instId = resolverInstancia(req, res, instancia_id);
            if (!instId) return;
            let contatosAlvo = memStore.whatsapp_contatos || [];

            if (contatos_ids && Array.isArray(contatos_ids) && contatos_ids.length > 0) {
                contatosAlvo = contatosAlvo.filter(c => contatos_ids.includes(c.id));
            }

            let disparados = 0;
            contatosAlvo.forEach(contato => {
                const convId = contato.telefone.replace(/\D/g, '');
                
                let msgTexto = mensagem;
                if (tabela_tipo) {
                    msgTexto += `\n\n📊 *Transmissão de Tabela Apex Tech* (${tabela_tipo})`;
                }

                memStore.whatsapp_mensagens.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    conversa_id: convId,
                    instancia_id: instId,
                    remetente: 'disparo_massa',
                    remetente_nome: nomeAtendente(req),
                    mensagem: msgTexto,
                    tipo: 'disparo_massa',
                    anexo_url: null,
                    tabela_tipo: tabela_tipo || null,
                    enviado_por: nomeAtendente(req),
                    criado_em: new Date().toISOString()
                });

                // Atualiza ou cria a conversa
                let conv = memStore.whatsapp_conversas.find(c => c.id === convId);
                if (conv) {
                    conv.ultima_mensagem = `[Disparo em Massa: ${msgTexto.slice(0, 30)}...]`;
                    conv.atualizado_em = new Date().toISOString();
                } else {
                    memStore.whatsapp_conversas.push({
                        id: convId,
                        instancia_id: instId,
                        instancia_nome: 'Disparo em Massa',
                        contato_nome: contato.nome,
                        telefone: contato.telefone,
                        atendente_id: 1,
                        atendente_nome: nomeAtendente(req),
                        nao_lidas: 0,
                        ultima_mensagem: msgTexto,
                        atualizado_em: new Date().toISOString()
                    });
                }
                disparados++;
            });

            res.json({ success: true, disparados, total_contatos: contatosAlvo.length });
        } catch (err) {
            console.error('[WhatsApp API] Erro no disparo em massa:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── 7. AUDITORIA SUPERVISORA ADM ───
    router.get('/auditoria', (req, res) => {
        try {
            const visiveis = idsVisiveis(req);
            const mensagens = (memStore.whatsapp_mensagens || []).filter(m => visiveis.has(m.instancia_id));
            const conversas = (memStore.whatsapp_conversas || []).filter(c => visiveis.has(c.instancia_id));

            const resumo = conversas.map(c => {
                const msgs = mensagens.filter(m => m.conversa_id === c.id);
                return {
                    conversa_id: c.id,
                    instancia_nome: c.instancia_nome || 'Principal',
                    contato_nome: c.contato_nome,
                    telefone: c.telefone,
                    atendente: c.atendente_nome,
                    total_mensagens: msgs.length,
                    ultima_interacao: c.atualizado_em
                };
            });

            res.json({
                success: true,
                total_instancias: visiveis.size,
                total_conversas: conversas.length,
                total_mensagens: mensagens.length,
                resumo_conversas: resumo,
                mensagens_recentes: mensagens.slice(-50)
            });
        } catch (err) {
            console.error('[WhatsApp API] Erro auditoria:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
