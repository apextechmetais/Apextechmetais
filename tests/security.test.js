const request = require('supertest');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { app, pool } = require('../server.js');

describe('Segurança: arquivos estáticos e rotas administrativas', () => {

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    it('1. Deve servir as páginas e assets públicos do front-end', async () => {
        for (const url of ['/', '/index.html', '/admin.html', '/style.css', '/admin.js', '/lib/calculationEngine.js', '/assets/img/apexlogo.png']) {
            const response = await request(app).get(url);
            expect([url, response.statusCode]).toEqual([url, 200]);
        }
    });

    it('2. NÃO deve servir código do servidor, planilhas, logs ou scripts', async () => {
        const privados = [
            '/server.js', '/DADOS%20CLIENTES.xlsx', '/DADOS%20FORNECEDORES.xlsx',
            '/docker-compose.yml', '/logs/error.log', '/scripts/hash_passwords.js',
            '/src/routes/whatsapp.js', '/migrations/001_create_fornecedores.sql',
            '/config/logger.js', '/tests/auth.test.js', '/lib/normalizeCliente.js',
            '/assets/excel/LME%20(version%201)%20(version%201).xlsx',
            '/assets/../server.js', '/assets/%2e%2e/server.js', '/SERVER.JS'
        ];
        for (const url of privados) {
            const response = await request(app).get(url);
            expect([url, [403, 404].includes(response.statusCode)]).toEqual([url, true]);
        }
    });

    it('3. Rotas de setup, migração, importação e diagnóstico exigem login', async () => {
        const rotas = [
            '/api/admin/setup-db', '/api/admin/run-migrations',
            '/api/admin/run-import-clientes', '/api/admin/run-import-fornecedores',
            '/api/debug-logs', '/api/db-test'
        ];
        for (const url of rotas) {
            const response = await request(app).get(url);
            expect([url, response.statusCode]).toEqual([url, 401]);
        }
    });

    it('4. Perfil sem permissão não acessa rotas administrativas', async () => {
        const login = await request(app).post('/api/login').send({ user: 'lab', pass: 'lab123' });
        const response = await request(app)
            .get('/api/debug-logs')
            .set('Authorization', `Bearer ${login.body.token}`);
        expect(response.statusCode).toBe(403);
    });

    it('5. Respostas trazem os headers de segurança do Helmet', async () => {
        const response = await request(app).get('/index.html');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-powered-by']).toBeUndefined();
    });
});
