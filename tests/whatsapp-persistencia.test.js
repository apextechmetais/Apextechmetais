const { newDb } = require('pg-mem');
const criarPersistencia = require('../src/services/whatsappPersistencia');

// Banco PostgreSQL emulado em memória: o mesmo "banco" sobrevive entre as instâncias do módulo,
// o que permite simular o reinício do servidor.
function novoBanco() {
    // o emulador reclama de trechos de SQL que ele analisa mas não usa (ex.: IF NOT EXISTS); isso é limite dele, não do SQL
    const db = newDb({ noAstCoverageCheck: true });
    const { Pool } = db.adapters.createPg();
    return new Pool();
}
const novaMemoria = () => ({ whatsapp_contatos: [], whatsapp_conversas: [], whatsapp_mensagens: [] });

describe('WhatsApp: conversas gravadas no banco', () => {
    it('1. Grava contatos, conversas e mensagens e os recupera depois de reiniciar', async () => {
        const pool = novoBanco();
        const memoria = novaMemoria();
        const p1 = criarPersistencia(pool, memoria);
        await p1.carregar();

        memoria.whatsapp_contatos.push({ id: 1, nome: 'Metais Brasil', telefone: '+55 11 99999-0001', empresa: 'Metais Brasil', categoria: 'Cliente', cidade: 'São Paulo/SP' });
        memoria.whatsapp_conversas.push({ id: '5511999990001', instancia_id: 'inst_a', instancia_nome: 'Celular da Ana', contato_nome: 'Metais Brasil', telefone: '+55 11 99999-0001', atendente_nome: 'Ana', nao_lidas: 2, ultima_mensagem: 'Bom dia', atualizado_em: '2026-10-09T12:00:00.000Z' });
        memoria.whatsapp_mensagens.push(
            { id: 111, conversa_id: '5511999990001', instancia_id: 'inst_a', remetente: 'cliente', remetente_nome: 'Metais Brasil', mensagem: 'Bom dia', tipo: 'texto', anexo_url: null, criado_em: '2026-10-09T11:59:00.000Z' },
            { id: 111, conversa_id: '5511999990001', instancia_id: 'inst_a', remetente: 'atendente', remetente_nome: 'Ana', mensagem: 'Olá! Segue a tabela "de preços" com acento: ação', tipo: 'texto', anexo_url: '/whatsapp-media/a.pdf', tabela_tipo: 'precos', enviado_por: 'Ana', criado_em: '2026-10-09T12:00:00.000Z' }
        );
        expect(await p1.gravar()).toEqual({ contatos: 1, conversas: 1, mensagens: 2 });
        // nada mudou: o ciclo seguinte não grava nada
        expect(await p1.gravar()).toEqual({ contatos: 0, conversas: 0, mensagens: 0 });

        // "reinício": memória zerada, mesmo banco
        const depois = novaMemoria();
        const p2 = criarPersistencia(pool, depois);
        expect(await p2.carregar()).toEqual({ contatos: 1, conversas: 1, mensagens: 2 });
        expect(depois.whatsapp_contatos[0]).toMatchObject({ nome: 'Metais Brasil', telefone: '+55 11 99999-0001', cidade: 'São Paulo/SP' });
        expect(depois.whatsapp_conversas[0]).toMatchObject({ id: '5511999990001', instancia_id: 'inst_a', nao_lidas: 2, ultima_mensagem: 'Bom dia', atualizado_em: '2026-10-09T12:00:00.000Z' });
        // duas mensagens com o mesmo id de origem (acontece em rajadas) são preservadas, em ordem de data
        expect(depois.whatsapp_mensagens.map(m => m.mensagem)).toEqual(['Bom dia', 'Olá! Segue a tabela "de preços" com acento: ação']);
        expect(depois.whatsapp_mensagens[1]).toMatchObject({ remetente: 'atendente', anexo_url: '/whatsapp-media/a.pdf', tabela_tipo: 'precos', enviado_por: 'Ana', criado_em: '2026-10-09T12:00:00.000Z' });
        // o que veio do banco não é gravado de novo
        expect(await p2.gravar()).toEqual({ contatos: 0, conversas: 0, mensagens: 0 });
    });

    it('2. Atualiza conversa e contato quando mudam, sem duplicar', async () => {
        const pool = novoBanco();
        const memoria = novaMemoria();
        const p = criarPersistencia(pool, memoria);
        await p.carregar();
        const conversa = { id: '5511888880000', instancia_id: 'inst_a', contato_nome: '+5511888880000', telefone: '+5511888880000', nao_lidas: 0, ultima_mensagem: 'oi', atualizado_em: '2026-10-09T10:00:00.000Z' };
        const contato = { id: 5, nome: '+5511888880000', telefone: '+5511888880000' };
        memoria.whatsapp_conversas.push(conversa);
        memoria.whatsapp_contatos.push(contato);
        await p.gravar();

        conversa.contato_nome = 'Fundição Indaiatuba'; conversa.nao_lidas = 3; conversa.ultima_mensagem = 'Confirma?'; conversa.atualizado_em = '2026-10-09T10:05:00.000Z';
        contato.nome = 'Fundição Indaiatuba';
        expect(await p.gravar()).toEqual({ contatos: 1, conversas: 1, mensagens: 0 });

        const depois = novaMemoria();
        await criarPersistencia(pool, depois).carregar();
        expect(depois.whatsapp_conversas).toHaveLength(1);
        expect(depois.whatsapp_conversas[0]).toMatchObject({ contato_nome: 'Fundição Indaiatuba', nao_lidas: 3, ultima_mensagem: 'Confirma?' });
        expect(depois.whatsapp_contatos).toHaveLength(1);
        expect(depois.whatsapp_contatos[0].nome).toBe('Fundição Indaiatuba');
    });

    it('3. Histórico grande é gravado em lotes e a carga traz as mensagens mais recentes', async () => {
        const pool = novoBanco();
        const memoria = novaMemoria();
        const p = criarPersistencia(pool, memoria, { lotePorCiclo: 40 });
        await p.carregar();
        for (let i = 0; i < 100; i++) {
            memoria.whatsapp_mensagens.push({ id: 1000 + i, conversa_id: 'c1', instancia_id: 'inst_a', remetente: 'cliente', mensagem: 'm' + i, criado_em: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString() });
        }
        expect((await p.gravar()).mensagens).toBe(40);
        expect((await p.gravar()).mensagens).toBe(40);
        expect((await p.gravar()).mensagens).toBe(20);
        expect((await p.gravar()).mensagens).toBe(0);

        const depois = novaMemoria();
        expect((await criarPersistencia(pool, depois, { limiteCarga: 30 }).carregar()).mensagens).toBe(30);
        expect(depois.whatsapp_mensagens[0].mensagem).toBe('m70');
        expect(depois.whatsapp_mensagens[29].mensagem).toBe('m99');
    });

    it('4. O que já está na memória ao carregar é mantido e depois gravado', async () => {
        const pool = novoBanco();
        const primeira = novaMemoria();
        const p1 = criarPersistencia(pool, primeira);
        await p1.carregar();
        primeira.whatsapp_conversas.push({ id: 'c1', instancia_id: 'inst_a', contato_nome: 'Antigo', telefone: '+551100000001', atualizado_em: '2026-10-01T00:00:00.000Z' });
        primeira.whatsapp_mensagens.push({ id: 1, conversa_id: 'c1', instancia_id: 'inst_a', remetente: 'cliente', mensagem: 'antiga', criado_em: '2026-10-01T00:00:00.000Z' });
        await p1.gravar();

        // o celular reconectou e espelhou uma mensagem antes de a carga terminar
        const segunda = novaMemoria();
        segunda.whatsapp_mensagens.push({ id: 2, conversa_id: 'c1', instancia_id: 'inst_a', remetente: 'cliente', mensagem: 'nova', criado_em: '2026-10-09T00:00:00.000Z' });
        const p2 = criarPersistencia(pool, segunda);
        await p2.carregar();
        expect(segunda.whatsapp_mensagens.map(m => m.mensagem)).toEqual(['antiga', 'nova']);
        expect((await p2.gravar()).mensagens).toBe(1);
    });

    it('5. Sem banco de dados, não faz nada e não quebra', async () => {
        const memoria = novaMemoria();
        const p = criarPersistencia(null, memoria);
        expect(await p.carregar()).toEqual({ contatos: 0, conversas: 0, mensagens: 0 });
        expect(await p.gravar()).toEqual({ contatos: 0, conversas: 0, mensagens: 0 });
        expect(await p.iniciar()).toBeNull();
    });
});
