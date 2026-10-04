const express = require('express');

module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();

    // In-Memory store fallback for WhatsApp module data
    if (!memStore.whatsapp_conversas) {
        memStore.whatsapp_conversas = [
            {
                id: '5511999990001',
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
                remetente: 'cliente',
                remetente_nome: 'Metais Brasil Ltda',
                mensagem: 'Olá, gostaria de receber a tabela de preços atualizada de alumínio e cobre.',
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: null,
                criado_em: new Date().toISOString()
            },
            {
                id: 2,
                conversa_id: '5519988880002',
                remetente: 'sistema',
                remetente_nome: 'Atendente Maria',
                mensagem: 'Recebido o relatório de amostragem de sucata. Obrigado!',
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: 'Atendente Maria',
                criado_em: new Date(Date.now() - 3600000).toISOString()
            }
        ];
    }

    // 1. Status da Instância WhatsApp
    router.get('/status', (req, res) => {
        res.json({
            status: 'conectado',
            instancia: 'WA-AKG Multi-Device Admin',
            modulo: 'WA-AKG (devjohnnydev/WA-AKG)',
            restauracao_tag: 'before-whatsapp',
            restauracao_commit: 'dab8553',
            qr_code_disponivel: false,
            instancias_ativas: 1,
            ultima_sincronizacao: new Date().toISOString()
        });
    });

    // 2. Listar Conversas (com suporte a filtro por atendente e busca)
    router.get('/conversas', (req, res) => {
        try {
            const { busca, atendente_id } = req.query;
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

            res.json({ success: true, conversas });
        } catch (err) {
            console.error('[WhatsApp API] Erro ao buscar conversas:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 3. Obter Histórico de Mensagens de uma Conversa
    router.get('/conversas/:id/mensagens', (req, res) => {
        try {
            const conversaId = req.params.id;
            const mensagens = (memStore.whatsapp_mensagens || []).filter(m => m.conversa_id === conversaId);
            res.json({ success: true, mensagens });
        } catch (err) {
            console.error('[WhatsApp API] Erro ao buscar mensagens:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 4. Enviar Mensagem de Texto Simples
    router.post('/enviar-mensagem', (req, res) => {
        try {
            const { conversa_id, mensagem, usuario_nome } = req.body;
            if (!conversa_id || !mensagem) {
                return res.status(400).json({ error: 'conversa_id e mensagem são obrigatórios' });
            }

            const novaMensagem = {
                id: Date.now(),
                conversa_id: String(conversa_id),
                remetente: 'atendente',
                remetente_nome: usuario_nome || 'Funcionário Apex',
                mensagem: mensagem,
                tipo: 'texto',
                anexo_url: null,
                tabela_tipo: null,
                enviado_por: usuario_nome || 'Funcionário Apex',
                criado_em: new Date().toISOString()
            };

            memStore.whatsapp_mensagens.push(novaMensagem);

            // Atualiza última mensagem na conversa
            const conv = memStore.whatsapp_conversas.find(c => c.id === String(conversa_id));
            if (conv) {
                conv.ultima_mensagem = mensagem;
                conv.atualizado_em = new Date().toISOString();
            }

            res.json({ success: true, mensagem: novaMensagem });
        } catch (err) {
            console.error('[WhatsApp API] Erro ao enviar mensagem:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 5. Enviar Tabela / Relatório do Sistema via WhatsApp
    router.post('/enviar-tabela', (req, res) => {
        try {
            const { conversa_id, tabela_tipo, titulo_personalizado, observacoes, usuario_nome } = req.body;
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
                remetente: 'sistema_tabela',
                remetente_nome: usuario_nome || 'Funcionário Apex',
                mensagem: msgEnv,
                tipo: 'tabela_sistema',
                anexo_url: null,
                tabela_tipo: tabela_tipo,
                enviado_por: usuario_nome || 'Funcionário Apex',
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

    // 6. Auditoria ADM: Visualizar todas as conversas e logs de mensagens de funcionários
    router.get('/auditoria', (req, res) => {
        try {
            const mensagens = memStore.whatsapp_mensagens || [];
            const conversas = memStore.whatsapp_conversas || [];

            const resumo = conversas.map(c => {
                const msgs = mensagens.filter(m => m.conversa_id === c.id);
                return {
                    conversa_id: c.id,
                    contato_nome: c.contato_nome,
                    telefone: c.telefone,
                    atendente: c.atendente_nome,
                    total_mensagens: msgs.length,
                    ultima_interacao: c.atualizado_em
                };
            });

            res.json({
                success: true,
                total_conversas: conversas.length,
                total_mensagens: mensagens.length,
                resumo_conversas: resumo,
                mensagens_recentes: mensagens.slice(-50)
            });
        } catch (err) {
            console.error('[WhatsApp API] Erro na auditoria:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
