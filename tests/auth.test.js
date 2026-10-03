const request = require('supertest');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { app, pool } = require('../server.js'); // Modificamos o server.js para exportar o app

describe('Fase 3 & 5: Autenticação e RBAC', () => {
    
    // Fechar a conexão com o banco após todos os testes para que o Jest consiga encerrar o processo
    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    let tokenAdmin = '';
    let tokenLab = '';

    it('1. Deve bloquear requisições para rotas protegidas sem Token', async () => {
        const response = await request(app).get('/api/usuarios');
        expect(response.statusCode).toBe(401);
        expect(response.body.error).toMatch(/Token não fornecido/i);
    });

    it('2. Deve permitir Login do Administrador e retornar um Token JWT', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({ user: 'admin', pass: 'apex2026' });
        
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        
        tokenAdmin = response.body.token; // Salva o token para os próximos testes
    });

    it('3. Deve permitir Login do Laboratório e retornar um Token JWT', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({ user: 'lab', pass: 'lab123' });
        
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        
        tokenLab = response.body.token; // Salva o token para os próximos testes
    });

    it('4. Deve bloquear Login com credenciais incorretas', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({ user: 'admin', pass: 'senhaerrada' });
        
        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    it('5. RBAC: Administrador deve conseguir acessar /api/usuarios', async () => {
        const response = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${tokenAdmin}`);
        
        expect(response.statusCode).toBe(200);
        // Garante que é um array
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('6. RBAC: Laboratório NÃO deve conseguir acessar /api/tabela-precos', async () => {
        const response = await request(app)
            .get('/api/tabela-precos')
            .set('Authorization', `Bearer ${tokenLab}`);
        
        expect(response.statusCode).toBe(403);
        expect(response.body.error).toMatch(/Acesso negado/i);
    });

    it('7. RBAC: Laboratório DEVE conseguir acessar /api/amostras', async () => {
        const response = await request(app)
            .get('/api/amostras')
            .set('Authorization', `Bearer ${tokenLab}`);
        
        expect(response.statusCode).toBe(200);
    });
});
