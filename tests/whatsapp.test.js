const request = require('supertest');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { app, pool } = require('../server.js');

describe('WhatsApp da equipe: cada usuário com o próprio celular, gestor vê todos', () => {
    let admin = '', lab = '';
    const como = (token, req) => req.set('Authorization', `Bearer ${token}`);
    let contaLab = null;

    beforeAll(async () => {
        admin = (await request(app).post('/api/login').send({ user: 'admin', pass: 'apex2026' })).body.token;
        lab = (await request(app).post('/api/login').send({ user: 'lab', pass: 'lab123' })).body.token;
    });

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    it('1. Gestor vê todas as contas; usuário comum começa sem nenhuma', async () => {
        const a = await como(admin, request(app).get('/api/whatsapp/instancias'));
        expect(a.statusCode).toBe(200);
        expect(a.body.gestor).toBe(true);
        expect(a.body.instancias.length).toBeGreaterThanOrEqual(3);

        const l = await como(lab, request(app).get('/api/whatsapp/instancias'));
        expect(l.body.gestor).toBe(false);
        expect(l.body.instancias).toEqual([]);
        expect((await como(lab, request(app).get('/api/whatsapp/conversas'))).body.conversas).toEqual([]);
    });

    it('2. Usuário comum cadastra o próprio WhatsApp, e só um', async () => {
        const res = await como(lab, request(app).post('/api/whatsapp/instancias')).send({ nome: 'Celular do laboratório', usuario: 'admin' });
        expect(res.statusCode).toBe(200);
        contaLab = res.body.instancia;
        expect(contaLab.usuario).toBe('lab'); // não consegue cadastrar em nome de outro
        expect((await como(lab, request(app).get('/api/whatsapp/instancias'))).body.instancias.map(i => i.id)).toEqual([contaLab.id]);

        const segunda = await como(lab, request(app).post('/api/whatsapp/instancias')).send({ nome: 'Outro' });
        expect(segunda.statusCode).toBe(409);
    });

    it('3. Usuário comum não acessa a conta nem as conversas de outro', async () => {
        expect((await como(lab, request(app).get('/api/whatsapp/instancias/inst_1/qr'))).statusCode).toBe(403);
        expect((await como(lab, request(app).post('/api/whatsapp/instancias/inst_2/conectar'))).statusCode).toBe(403);
        expect((await como(lab, request(app).delete('/api/whatsapp/instancias/inst_1'))).statusCode).toBe(403);
        expect((await como(lab, request(app).get('/api/whatsapp/instancias/nao-existe/qr'))).statusCode).toBe(404);
        expect((await como(lab, request(app).get('/api/whatsapp/conversas/5511999990001/mensagens'))).statusCode).toBe(403);
        expect((await como(lab, request(app).post('/api/whatsapp/conversas/5511999990001/nome')).send({ novo_nome: 'X' })).statusCode).toBe(403);
        // a conta inst_1 continua existindo para o gestor
        expect((await como(admin, request(app).get('/api/whatsapp/instancias'))).body.instancias.some(i => i.id === 'inst_1')).toBe(true);
    });

    it('4. Envio usa a conta do próprio usuário e avisa quando o celular não está conectado', async () => {
        const deOutro = await como(lab, request(app).post('/api/whatsapp/enviar-mensagem')).send({ conversa_id: '5511999990001', mensagem: 'oi', instancia_id: 'inst_2' });
        expect(deOutro.statusCode).toBe(403);
        const propria = await como(lab, request(app).post('/api/whatsapp/enviar-mensagem')).send({ conversa_id: '5511888887777', mensagem: 'oi' });
        expect(propria.statusCode).toBe(409);
        expect(propria.body.error).toMatch(/não está conectado/i);
        // nada foi registrado como enviado
        const msgs = await como(admin, request(app).get('/api/whatsapp/conversas/5511888887777/mensagens'));
        expect(msgs.body.mensagens).toEqual([]);
    });

    it('5. Recursos de gestão só para Diretoria/Administrador', async () => {
        expect((await como(lab, request(app).get('/api/whatsapp/equipe'))).statusCode).toBe(403);
        expect((await como(lab, request(app).post('/api/whatsapp/disparo-massa')).send({ mensagem: 'x' })).statusCode).toBe(403);
        expect((await como(lab, request(app).put(`/api/whatsapp/instancias/${contaLab.id}`)).send({ usuario: 'admin' })).statusCode).toBe(403);
        const resync = await como(lab, request(app).post('/api/whatsapp/resincronizar'));
        expect(resync.body).toEqual({ success: true, ignorado: true });

        const equipe = await como(admin, request(app).get('/api/whatsapp/equipe'));
        expect(equipe.statusCode).toBe(200);
        expect(equipe.body.contas.find(c => c.id === contaLab.id)).toMatchObject({ usuario: 'lab', status: expect.any(String), conversas: 0 });
        expect(equipe.body.sem_whatsapp.some(u => u.user === 'compras')).toBe(true);
        expect(equipe.body.sem_whatsapp.some(u => u.user === 'lab')).toBe(false);
    });

    it('6. Gestor atribui uma conta a um usuário, que passa a enxergá-la com as conversas', async () => {
        const res = await como(admin, request(app).put('/api/whatsapp/instancias/inst_2')).send({ usuario: 'lab', responsavel: 'Dr. Marcos' });
        expect(res.statusCode).toBe(200);
        const contas = (await como(lab, request(app).get('/api/whatsapp/instancias'))).body.instancias.map(i => i.id);
        expect(contas).toEqual(expect.arrayContaining(['inst_2', contaLab.id]));
        const conversas = (await como(lab, request(app).get('/api/whatsapp/conversas'))).body.conversas;
        expect(conversas.length).toBeGreaterThan(0);
        expect(conversas.every(c => c.instancia_id === 'inst_2')).toBe(true);
        expect((await como(lab, request(app).get('/api/whatsapp/conversas/5511999990001/mensagens'))).statusCode).toBe(200);
    });

    it('7. Dono remove a própria conta; as rotas exigem login', async () => {
        expect((await request(app).get('/api/whatsapp/instancias')).statusCode).toBe(401);
        expect((await como(lab, request(app).delete(`/api/whatsapp/instancias/${contaLab.id}`))).statusCode).toBe(200);
        expect((await como(lab, request(app).get('/api/whatsapp/instancias'))).body.instancias.map(i => i.id)).toEqual(['inst_2']);
    });
});
