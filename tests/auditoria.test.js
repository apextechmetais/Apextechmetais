const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { resumirRequisicao, corpoSeguro, ipDaRequisicao } = require('../src/services/auditoria');
const criarRotaAuditoria = require('../src/routes/auditLogs');

describe('Auditoria: como cada requisição vira um registro', () => {
    it('1. Só registra o que altera dados e ignora chamadas automáticas', () => {
        expect(resumirRequisicao({ metodo: 'GET', caminho: '/amostras', status: 200 })).toBeNull();
        expect(resumirRequisicao({ metodo: 'POST', caminho: '/whatsapp/resincronizar', status: 200 })).toBeNull();
        expect(resumirRequisicao({ metodo: 'PATCH', caminho: '/amostras/12/decisao', corpo: { decisao_diretoria: 'Aprovado' }, usuario: 'diretoria', status: 200 }))
            .toMatchObject({ usuario: 'diretoria', acao: 'AMOSTRAS', amostraId: 12, detalhe: expect.stringContaining('Alterou em /amostras/12/decisao — sucesso') });
    });

    it('2. Guarda o resultado: sucesso, acesso negado, recusado ou erro', () => {
        const d = (status) => resumirRequisicao({ metodo: 'DELETE', caminho: '/amostras/3', usuario: 'lab', status }).detalhe;
        expect(d(200)).toMatch(/— sucesso$/);
        expect(d(403)).toMatch(/— acesso negado \(403\)$/);
        expect(d(400)).toMatch(/— recusado \(400\)$/);
        expect(d(500)).toMatch(/— erro \(500\)$/);
    });

    it('3. Login registra quem tentou e se entrou, sem a senha', () => {
        const ok = resumirRequisicao({ metodo: 'POST', caminho: '/login', corpo: { user: 'admin', pass: 'segredo123' }, status: 200 });
        expect(ok).toMatchObject({ usuario: 'admin', acao: 'LOGIN', detalhe: 'Entrou no sistema' });
        const falha = resumirRequisicao({ metodo: 'POST', caminho: '/login', corpo: { user: 'admin', pass: 'errada' }, status: 401 });
        expect(falha.detalhe).toBe('Tentativa de login recusada (401)');
        expect(JSON.stringify([ok, falha])).not.toMatch(/segredo123|errada/);
    });

    it('4. Senhas, chaves, tokens e fotos nunca entram no registro', () => {
        const r = resumirRequisicao({ metodo: 'PUT', caminho: '/settings', usuario: 'admin', status: 200,
            corpo: { lme_resend_api_key: 're_ABC123', lme_envio_horario: '14:00', pass: 'x', token: 'y', foto_original: 'data:image/png;base64,AAAA', aninhado: { senha: 'z', nome: 'ok' } } });
        expect(r.acao).toBe('CONFIGURAÇÕES');
        expect(r.detalhe).not.toMatch(/re_ABC123|AAAA|"x"|"y"|"z"/);
        expect(r.detalhe).toContain('"lme_envio_horario":"14:00"');
        expect(corpoSeguro({ texto: 'a'.repeat(200) }).texto.length).toBeLessThan(90);
    });

    it('5. Classifica as áreas do sistema e lê o IP por trás do proxy', () => {
        const area = (caminho) => resumirRequisicao({ metodo: 'POST', caminho, status: 200 }).acao;
        expect(['/usuarios', '/pedidos-compra', '/pcp/3/mix', '/whatsapp/enviar-mensagem', '/tabela-precos', '/site-imagens/home-compramos', '/qualquer-coisa'].map(area))
            .toEqual(['USUÁRIOS', 'PEDIDOS DE COMPRA', 'PCP', 'WHATSAPP', 'PREÇOS', 'SITE', 'SISTEMA']);
        expect(ipDaRequisicao({ headers: { 'x-forwarded-for': '201.10.20.30, 10.0.0.1' }, socket: {} })).toBe('201.10.20.30');
        expect(ipDaRequisicao({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1');
    });
});

const REGISTROS = [
    ['admin', 'LOGIN', 'Entrou no sistema', '201.1.1.1', '2026-10-08 09:00:00'],
    ['lab', 'AMOSTRAS', 'Incluiu em /amostras — sucesso | Dados: {"numero_amostra":"AM-9"}', '201.1.1.2', '2026-10-09 10:00:00'],
    ['lab', 'AMOSTRAS', 'Alterou em /amostras/9/decisao — acesso negado (403)', '201.1.1.2', '2026-10-09 10:05:00'],
    ['diretoria', 'AMOSTRAS', 'Alterou em /amostras/9/decisao — sucesso', '201.1.1.3', '2026-10-09 11:00:00'],
    ['admin', 'PCP', 'Alterou em /pcp/1/mix — sucesso', '201.1.1.1', '2026-10-10 08:00:00']
];

function montarRota(modo) {
    const memStore = { audit_logs: [] };
    let pool = null;
    if (modo === 'banco') {
        const db = newDb({ noAstCoverageCheck: true });
        db.public.none(`CREATE TABLE audit_logs (id SERIAL PRIMARY KEY, usuario TEXT DEFAULT 'Sistema', acao TEXT NOT NULL, detalhe TEXT, amostra_id INTEGER, ip TEXT, criado_em TIMESTAMP DEFAULT NOW());`);
        REGISTROS.forEach(([u, a, d, ip, em]) => db.public.none(`INSERT INTO audit_logs (usuario, acao, detalhe, ip, criado_em) VALUES ('${u}', '${a}', '${d.replace(/'/g, "''")}', '${ip}', '${em}')`));
        const { Pool } = db.adapters.createPg();
        pool = new Pool();
    } else {
        REGISTROS.forEach(([usuario, acao, detalhe, ip, em], i) => memStore.audit_logs.push({ id: i + 1, usuario, acao, detalhe, ip, criado_em: em.replace(' ', 'T') + '.000Z' }));
    }
    const app = express();
    app.use('/api/audit-logs', criarRotaAuditoria(pool, () => modo === 'banco', memStore));
    return app;
}

describe.each(['banco', 'memoria'])('Auditoria: consulta no modo %s', (modo) => {
    const app = montarRota(modo);
    const consultar = async (qs = '') => (await request(app).get('/api/audit-logs' + qs)).body;

    it('6. Lista do mais recente para o mais antigo, com total e opções de filtro', async () => {
        const r = await consultar();
        expect(r.total).toBe(5);
        expect(r.registros.map(l => l.acao)).toEqual(['PCP', 'AMOSTRAS', 'AMOSTRAS', 'AMOSTRAS', 'LOGIN']);
        expect(r.acoes).toEqual(['AMOSTRAS', 'LOGIN', 'PCP']);
        expect(r.usuarios).toEqual(['admin', 'diretoria', 'lab']);
    });

    it('7. Filtra por área, usuário, texto, período e falhas', async () => {
        expect((await consultar('?acao=AMOSTRAS')).total).toBe(3);
        expect((await consultar('?usuario=lab')).total).toBe(2);
        expect((await consultar('?busca=AM-9')).total).toBe(1);
        expect((await consultar('?busca=DECISAO')).total).toBe(2);
        expect((await consultar('?de=2026-10-09&ate=2026-10-09')).total).toBe(3);
        expect((await consultar('?de=2026-10-10')).total).toBe(1);
        const falhas = await consultar('?falhas=1');
        expect(falhas.total).toBe(1);
        expect(falhas.registros[0].usuario).toBe('lab');
        expect((await consultar('?acao=AMOSTRAS&usuario=diretoria')).total).toBe(1);
        expect((await consultar('?busca=nada-disso')).registros).toEqual([]);
    });

    it('8. Pagina os resultados', async () => {
        const p1 = await consultar('?limite=2&pagina=1'), p3 = await consultar('?limite=2&pagina=3');
        expect(p1.registros).toHaveLength(2);
        expect(p1.total).toBe(5);
        expect(p3.registros.map(l => l.acao)).toEqual(['LOGIN']);
    });
});

describe('Auditoria: ponta a ponta no servidor', () => {
    const { app, pool } = require('../server.js');
    let admin = '', lab = '';
    const esperar = (ms) => new Promise(r => setTimeout(r, ms));

    beforeAll(async () => {
        admin = (await request(app).post('/api/login').send({ user: 'admin', pass: 'apex2026' })).body.token;
        lab = (await request(app).post('/api/login').send({ user: 'lab', pass: 'lab123' })).body.token;
        await request(app).post('/api/login').send({ user: 'admin', pass: 'senha-errada-xyz' });
    });
    afterAll(async () => { if (pool) await pool.end(); });

    it('9. Ações reais aparecem na trilha, com resultado e sem segredos', async () => {
        await request(app).post('/api/usuarios').set('Authorization', `Bearer ${lab}`).send({ user: 'x', pass: 'senhaSecreta9', perfil: 'Diretoria', nome: 'X' });
        await request(app).put('/api/settings').set('Authorization', `Bearer ${admin}`).send({ lme_resend_api_key: 're_NUNCA_APARECE', lme_envio_horario: '15:00' });
        await esperar(150);

        const semLogin = await request(app).get('/api/audit-logs');
        expect(semLogin.statusCode).toBe(401);
        expect((await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${lab}`)).statusCode).toBe(403);

        const r = (await request(app).get('/api/audit-logs?limite=50').set('Authorization', `Bearer ${admin}`)).body;
        const textos = r.registros.map(l => `${l.usuario}|${l.acao}|${l.detalhe}`);
        expect(textos).toEqual(expect.arrayContaining([
            'admin|LOGIN|Entrou no sistema',
            'lab|LOGIN|Entrou no sistema',
            'admin|LOGIN|Tentativa de login recusada (401)'
        ]));
        expect(textos.some(t => t.startsWith('lab|USUÁRIOS|Incluiu em /usuarios — acesso negado (403)'))).toBe(true);
        expect(textos.some(t => t.startsWith('admin|CONFIGURAÇÕES|Alterou em /settings — sucesso'))).toBe(true);
        expect(JSON.stringify(r)).not.toMatch(/re_NUNCA_APARECE|senhaSecreta9|senha-errada-xyz|apex2026/);

        const falhas = (await request(app).get('/api/audit-logs?falhas=1').set('Authorization', `Bearer ${admin}`)).body;
        expect(falhas.registros.every(l => /acesso negado|recusad|erro|não encontrado/.test(l.detalhe))).toBe(true);
        expect(falhas.total).toBeGreaterThanOrEqual(1);
    });
});
