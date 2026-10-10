const request = require('supertest');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { app, pool } = require('../server.js');

// PNG válido de 1x1 pixel
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('Imagens do site trocáveis pelo administrador', () => {
    let tokenAdmin = '', tokenLab = '';

    beforeAll(async () => {
        tokenAdmin = (await request(app).post('/api/login').send({ user: 'admin', pass: 'apex2026' })).body.token;
        tokenLab = (await request(app).post('/api/login').send({ user: 'lab', pass: 'lab123' })).body.token;
    });

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    it('1. Sem imagem enviada, a rota pública redireciona para a imagem padrão', async () => {
        const res = await request(app).get('/api/site-imagens/home-compramos');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/assets/img/img-transformando-residuos.webp');
        expect((await request(app).get(res.headers.location)).statusCode).toBe(200);
    });

    it('2. Espaço inexistente devolve 404', async () => {
        expect((await request(app).get('/api/site-imagens/nao-existe')).statusCode).toBe(404);
    });

    it('3. Visitante e perfil comum não listam nem trocam imagens', async () => {
        expect((await request(app).get('/api/site-imagens')).statusCode).toBe(401);
        expect((await request(app).post('/api/site-imagens/home-compramos').attach('imagem', PNG, { filename: 'a.png', contentType: 'image/png' })).statusCode).toBe(401);
        const lab = await request(app).post('/api/site-imagens/home-compramos').set('Authorization', `Bearer ${tokenLab}`).attach('imagem', PNG, { filename: 'a.png', contentType: 'image/png' });
        expect(lab.statusCode).toBe(403);
        expect((await request(app).delete('/api/site-imagens/home-compramos').set('Authorization', `Bearer ${tokenLab}`)).statusCode).toBe(403);
    });

    it('4. Administrador troca a imagem e o site passa a servi-la', async () => {
        const envio = await request(app).post('/api/site-imagens/home-compramos').set('Authorization', `Bearer ${tokenAdmin}`).attach('imagem', PNG, { filename: 'nova.png', contentType: 'image/png' });
        expect(envio.statusCode).toBe(200);

        const publica = await request(app).get('/api/site-imagens/home-compramos');
        expect(publica.statusCode).toBe(200);
        expect(publica.headers['content-type']).toBe('image/png');
        expect(Buffer.compare(publica.body, PNG)).toBe(0);

        const lista = await request(app).get('/api/site-imagens').set('Authorization', `Bearer ${tokenAdmin}`);
        expect(lista.statusCode).toBe(200);
        expect(lista.body.imagens.find(i => i.slot === 'home-compramos').personalizada).toBe(true);
        expect(lista.body.imagens.find(i => i.slot === 'sobre-principal').personalizada).toBe(false);
    });

    it('5. Arquivo que não é imagem, sem arquivo ou em espaço inexistente é recusado', async () => {
        const texto = await request(app).post('/api/site-imagens/sobre-principal').set('Authorization', `Bearer ${tokenAdmin}`).attach('imagem', Buffer.from('oi'), { filename: 'a.txt', contentType: 'text/plain' });
        expect(texto.statusCode).toBe(400);
        const gif = await request(app).post('/api/site-imagens/sobre-principal').set('Authorization', `Bearer ${tokenAdmin}`).attach('imagem', PNG, { filename: 'a.gif', contentType: 'image/gif' });
        expect(gif.statusCode).toBe(400);
        expect((await request(app).post('/api/site-imagens/sobre-principal').set('Authorization', `Bearer ${tokenAdmin}`)).statusCode).toBe(400);
        const inexistente = await request(app).post('/api/site-imagens/outro').set('Authorization', `Bearer ${tokenAdmin}`).attach('imagem', PNG, { filename: 'a.png', contentType: 'image/png' });
        expect(inexistente.statusCode).toBe(404);
        expect((await request(app).get('/api/site-imagens/sobre-principal')).statusCode).toBe(302);
    });

    it('6. Restaurar volta para a imagem padrão', async () => {
        const res = await request(app).delete('/api/site-imagens/home-compramos').set('Authorization', `Bearer ${tokenAdmin}`);
        expect(res.statusCode).toBe(200);
        expect((await request(app).get('/api/site-imagens/home-compramos')).statusCode).toBe(302);
    });
});
