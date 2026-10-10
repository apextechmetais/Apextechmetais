const request = require('supertest');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { app, pool } = require('../server.js');

// Tokens compartilhados pelo arquivo: o login tem limite de 5 tentativas por IP
const tokens = {};

describe('Amostras: permissões personalizadas por perfil', () => {
    const como = (perfil, req) => req.set('Authorization', `Bearer ${tokens[perfil]}`);
    let amostraId = null;

    const salvarMatriz = async (alteracoes) => {
        const atual = await como('diretoria', request(app).get('/api/settings'));
        const matriz = { ...JSON.parse(atual.body.role_permissions), ...alteracoes };
        return como('diretoria', request(app).put('/api/settings')).send({ role_permissions: JSON.stringify(matriz) });
    };

    beforeAll(async () => {
        const login = async (user, pass) => (await request(app).post('/api/login').send({ user, pass })).body.token;
        tokens.admin = await login('admin', 'apex2026');
        tokens.lab = await login('lab', 'lab123');
        // Usuários de teste para os perfis Diretoria e Compras
        for (const u of [{ user: 'dir_teste', perfil: 'Diretoria' }, { user: 'compras_teste', perfil: 'Compras' }]) {
            const criado = await como('admin', request(app).post('/api/usuarios')).send({ ...u, pass: 'senha-teste-123', nome: u.user });
            expect(criado.statusCode).toBe(200);
        }
        tokens.diretoria = await login('dir_teste', 'senha-teste-123');
        tokens.compras = await login('compras_teste', 'senha-teste-123');
    });

    it('1. Padrão: Laboratório vê e cadastra amostras; Compras não tem acesso', async () => {
        expect((await como('lab', request(app).get('/api/amostras'))).statusCode).toBe(200);
        const nova = await como('lab', request(app).post('/api/amostras')).send({
            numero_amostra: 'AM-TESTE-1', nome_material: 'Fio misto', data: '2026-10-09', fornecedor_id: 1, responsavel: 'Teste', peso_inicial: 10
        });
        expect(nova.statusCode).toBe(200);
        amostraId = nova.body.id;

        const compras = await como('compras', request(app).get('/api/amostras'));
        expect(compras.statusCode).toBe(403);
        expect(compras.body.error).toMatch(/Compras/);
    });

    it('2. Laboratório NÃO aprova compra, mesmo enviando outro perfil no corpo da requisição', async () => {
        const res = await como('lab', request(app).patch(`/api/amostras/${amostraId}/decisao`))
            .send({ decisao_diretoria: 'Aprovado', preco_compra_entregar: 10, user_perfil: 'Diretoria', user_nome: 'Falso' });
        expect(res.statusCode).toBe(403);
    });

    it('3. Laboratório NÃO aprova pela rota de status nem exclui amostra forjando o perfil na URL', async () => {
        const status = await como('lab', request(app).patch(`/api/amostras/${amostraId}/status`)).send({ status: 'Aprovado - Compra Autorizada' });
        expect(status.statusCode).toBe(403);
        const exclusao = await como('lab', request(app).delete(`/api/amostras/${amostraId}?user_perfil=Diretoria`));
        expect(exclusao.statusCode).toBe(403);
        expect((await como('lab', request(app).get(`/api/amostras/${amostraId}`))).statusCode).toBe(200);
    });

    it('4. Laboratório lança o status de análise; Diretoria passa pela permissão de decisão', async () => {
        const analise = await como('lab', request(app).patch(`/api/amostras/${amostraId}/status`)).send({ status: 'Aguardando Decisão de Compra' });
        expect(analise.statusCode).toBe(200);
        // Sem componentes o servidor recusa por regra de negócio (400), não por permissão (403)
        const decisao = await como('diretoria', request(app).patch(`/api/amostras/${amostraId}/decisao`)).send({ decisao_diretoria: 'Aprovado' });
        expect(decisao.statusCode).toBe(400);
        const invalida = await como('diretoria', request(app).patch(`/api/amostras/${amostraId}/decisao`)).send({ decisao_diretoria: 'Talvez' });
        expect(invalida.statusCode).toBe(400);
    });

    it('5. /api/me/permissoes devolve as ações do perfil logado', async () => {
        const lab = await como('lab', request(app).get('/api/me/permissoes'));
        expect(lab.body.amostras).toEqual(expect.arrayContaining(['amostras_ver', 'amostras_cadastrar', 'amostras_analisar']));
        expect(lab.body.amostras).not.toContain('amostras_decidir');
        expect(lab.body.amostras).not.toContain('amostras_excluir');
        const admin = await como('admin', request(app).get('/api/me/permissoes'));
        expect(admin.body.amostras).toHaveLength(6);
        expect((await como('compras', request(app).get('/api/me/permissoes'))).body.amostras).toEqual([]);
    });

    it('6. Só Diretoria/Administrador consultam e alteram a matriz de permissões', async () => {
        expect((await como('lab', request(app).get('/api/permissoes/amostras'))).statusCode).toBe(403);
        const consulta = await como('diretoria', request(app).get('/api/permissoes/amostras'));
        expect(consulta.statusCode).toBe(200);
        expect(consulta.body.perfis['Laboratório'].personalizado).toBe(false);

        const tentativa = await como('lab', request(app).put('/api/settings')).send({ role_permissions: JSON.stringify({ 'Laboratório': ['amostras_cfg', 'amostras_decidir'] }) });
        expect(tentativa.statusCode).toBe(403);
        expect((await como('lab', request(app).get('/api/me/permissoes'))).body.amostras).not.toContain('amostras_decidir');

        const invalida = await como('diretoria', request(app).put('/api/settings')).send({ role_permissions: '{"Laboratório": "tudo"}' });
        expect(invalida.statusCode).toBe(400);
    });

    it('7. Personalização vale na hora: restringir o Laboratório e liberar Compras', async () => {
        const salvo = await salvarMatriz({
            'Laboratório': ['view_laboratorio', 'amostras_cfg', 'amostras_ver'],
            'Compras': ['view_lme', 'amostras_cfg', 'amostras_ver']
        });
        expect(salvo.statusCode).toBe(200);

        expect((await como('lab', request(app).get('/api/amostras'))).statusCode).toBe(200);
        const cadastro = await como('lab', request(app).post('/api/amostras')).send({ numero_amostra: 'AM-TESTE-2', data: '2026-10-09', fornecedor_id: 1, responsavel: 'T', peso_inicial: 1 });
        expect(cadastro.statusCode).toBe(403);
        expect((await como('lab', request(app).patch(`/api/amostras/${amostraId}/status`)).send({ status: 'Em Análise' })).statusCode).toBe(403);

        expect((await como('compras', request(app).get('/api/amostras'))).statusCode).toBe(200);
        expect((await como('compras', request(app).post('/api/amostras')).send({ numero_amostra: 'X' })).statusCode).toBe(403);

        const consulta = await como('diretoria', request(app).get('/api/permissoes/amostras'));
        expect(consulta.body.perfis['Laboratório']).toEqual({ acoes: ['amostras_ver'], personalizado: true });
    });

    it('8. Perfil personalizado sem nenhuma ação perde o acesso; Administrador nunca perde', async () => {
        await salvarMatriz({ 'Laboratório': ['amostras_cfg'], 'Administrador': ['amostras_cfg'] });
        expect((await como('lab', request(app).get('/api/amostras'))).statusCode).toBe(403);
        expect((await como('admin', request(app).get('/api/amostras'))).statusCode).toBe(200);
        expect((await como('admin', request(app).delete(`/api/amostras/${amostraId}`))).statusCode).toBe(200);
    });
});

describe('Configurações: segredo e chaves restritas', () => {
    it('9. A chave do Resend não sai na rota pública nem para perfis comuns', async () => {
        const publico = await request(app).get('/api/settings');
        expect(publico.statusCode).toBe(200);
        expect(publico.body).not.toHaveProperty('lme_resend_api_key');
        expect(publico.body).toHaveProperty('show_sobre');

        const lab = await request(app).get('/api/settings').set('Authorization', `Bearer ${tokens.lab}`);
        expect(lab.body).not.toHaveProperty('lme_resend_api_key');

        const admin = await request(app).get('/api/settings').set('Authorization', `Bearer ${tokens.admin}`);
        expect(admin.body).toHaveProperty('lme_resend_api_key');
    });

    it('10. Perfil comum salva configurações comuns, mas as restritas são ignoradas', async () => {
        const res = await request(app).put('/api/settings').set('Authorization', `Bearer ${tokens.lab}`)
            .send({ chave_teste_comum: 'ok', lme_resend_api_key: 'chave-falsa' });
        expect(res.statusCode).toBe(200);
        expect(res.body.ignoradas).toEqual(['lme_resend_api_key']);

        const admin = await request(app).get('/api/settings').set('Authorization', `Bearer ${tokens.admin}`);
        expect(admin.body.chave_teste_comum).toBe('ok');
        expect(admin.body.lme_resend_api_key).not.toBe('chave-falsa');
    });
});

afterAll(async () => {
    if (pool) {
        await pool.end();
    }
});
