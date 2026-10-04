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

    // ─── 1. STATUS E GESTÃO DE INSTÂNCIAS (CONTAS / CELULARES) ───
    router.get('/status', (req, res) => {
        const instancias = memStore.whatsapp_instancias || [];
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
        res.json({ success: true, instancias: memStore.whatsapp_instancias || [] });
    });

    router.post('/instancias', async (req, res) => {
        const { nome, numero, responsavel } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome da conta/celular é obrigatório' });

        const id = 'inst_' + Date.now();
        const novaInstancia = {
            id,
            nome: nome,
            numero: numero || 'Pendente',
            responsavel: responsavel || 'Funcionário',
            status: 'desconectado',
            qr_code: null,
            criado_em: new Date().toISOString()
        };

        memStore.whatsapp_instancias.push(novaInstancia);
        await whatsappManager.iniciarInstancia(id);
        res.json({ success: true, instancia: novaInstancia });
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
            let conversas = memStore.whatsapp_conversas || [];

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

    router.get('/conversas/:id/mensagens', (req, res) => {
        try {
            const conversaId = req.params.id;
            const mensagens = (memStore.whatsapp_mensagens || []).filter(m => m.conversa_id === conversaId);
            res.json({ success: true, mensagens });
        } catch (err) {
            console.error('[WhatsApp API] Erro mensagens:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── 4. ENVIAR MENSAGEM (COM OPÇÃO DE ESCOLHER A CONTA/INSTÂNCIA QUE RESPONDE) ───
    router.post('/enviar-mensagem', (req, res) => {
        try {
            const { conversa_id, mensagem, usuario_nome, instancia_id } = req.body;
            if (!conversa_id || !mensagem) {
                return res.status(400).json({ error: 'conversa_id e mensagem são obrigatórios' });
            }

            const novaMensagem = {
                id: Date.now(),
                conversa_id: String(conversa_id),
                instancia_id: instancia_id || 'inst_1',
                remetente: 'atendente',
                remetente_nome: usuario_nome || 'Administrador',
                mensagem: mensagem,
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: usuario_nome || 'Administrador',
                criado_em: new Date().toISOString()
            };

            memStore.whatsapp_mensagens.push(novaMensagem);

            const conv = memStore.whatsapp_conversas.find(c => c.id === String(conversa_id));
            if (conv) {
                conv.ultima_mensagem = mensagem;
                conv.atualizado_em = new Date().toISOString();
            } else {
                // Cria conversa automaticamente se não existir
                const cont = memStore.whatsapp_contatos.find(k => k.telefone.includes(conversa_id)) || { nome: 'Contato ' + conversa_id, telefone: conversa_id };
                memStore.whatsapp_conversas.push({
                    id: String(conversa_id),
                    instancia_id: instancia_id || 'inst_1',
                    instancia_nome: 'WhatsApp Geral',
                    contato_nome: cont.nome,
                    telefone: cont.telefone,
                    atendente_id: 1,
                    atendente_nome: usuario_nome || 'Administrador',
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

    // ─── 5. DISPARAR TABELA / RELATÓRIO DO SISTEMA ───
    router.post('/enviar-tabela', (req, res) => {
        try {
            const { conversa_id, tabela_tipo, titulo_personalizado, observacoes, usuario_nome, instancia_id } = req.body;
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
                instancia_id: instancia_id || 'inst_1',
                remetente: 'sistema_tabela',
                remetente_nome: usuario_nome || 'Administrador',
                mensagem: msgEnv,
                tipo: 'tabela_sistema',
                anexo_url: null,
                tabela_tipo: tabela_tipo,
                enviado_por: usuario_nome || 'Administrador',
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
                    instancia_id: instancia_id || 'inst_1',
                    remetente: 'disparo_massa',
                    remetente_nome: usuario_nome || 'Administrador',
                    mensagem: msgTexto,
                    tipo: 'disparo_massa',
                    anexo_url: null,
                    tabela_tipo: tabela_tipo || null,
                    enviado_por: usuario_nome || 'Administrador',
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
                        instancia_id: instancia_id || 'inst_1',
                        instancia_nome: 'Disparo em Massa',
                        contato_nome: contato.nome,
                        telefone: contato.telefone,
                        atendente_id: 1,
                        atendente_nome: usuario_nome || 'Administrador',
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
            const mensagens = memStore.whatsapp_mensagens || [];
            const conversas = memStore.whatsapp_conversas || [];

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
                total_instancias: (memStore.whatsapp_instancias || []).length,
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
