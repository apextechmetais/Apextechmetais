const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const criarRotasPcp = require('../src/routes/pcp');

// As mesmas tabelas que o servidor cria no initDatabase
const ESQUEMA = `
    CREATE TABLE materiais_catalogo (id SERIAL PRIMARY KEY, nome TEXT NOT NULL);
    CREATE TABLE pcp_planejamentos (id SERIAL PRIMARY KEY, ano INTEGER NOT NULL, mes VARCHAR(20) NOT NULL, meta_mensal NUMERIC(14,4) NOT NULL,
        dias_trabalhados INTEGER NOT NULL, qtd_linhas INTEGER NOT NULL, status VARCHAR(50) DEFAULT 'RASCUNHO', observacoes TEXT, criado_em TIMESTAMP DEFAULT NOW(), criado_por VARCHAR(100));
    CREATE TABLE pcp_linhas (id SERIAL PRIMARY KEY, planejamento_id INTEGER NOT NULL REFERENCES pcp_planejamentos(id) ON DELETE CASCADE, numero_linha INTEGER NOT NULL,
        meta_mensal NUMERIC(14,4) NOT NULL, meta_diaria NUMERIC(14,4) NOT NULL, percentual_carga NUMERIC(14,4) NOT NULL);
    CREATE TABLE pcp_mix (id SERIAL PRIMARY KEY, planejamento_id INTEGER NOT NULL REFERENCES pcp_planejamentos(id) ON DELETE CASCADE,
        material_id INTEGER NOT NULL REFERENCES materiais_catalogo(id) ON DELETE RESTRICT, linha_id INTEGER REFERENCES pcp_linhas(id) ON DELETE SET NULL,
        numero_linha INTEGER NOT NULL, volume_total NUMERIC(14,4) NOT NULL, percentual_volume NUMERIC(14,4) NOT NULL, meta_dia NUMERIC(14,4) NOT NULL);
    CREATE TABLE pcp_plano_diario (id SERIAL PRIMARY KEY, planejamento_id INTEGER NOT NULL REFERENCES pcp_planejamentos(id) ON DELETE CASCADE, data DATE NOT NULL,
        is_dia_produtivo BOOLEAN DEFAULT TRUE, meta_l1 NUMERIC(14,4) DEFAULT 0, meta_l2 NUMERIC(14,4) DEFAULT 0, meta_l3 NUMERIC(14,4) DEFAULT 0, meta_l4 NUMERIC(14,4) DEFAULT 0, meta_total_dia NUMERIC(14,4) DEFAULT 0);
    CREATE TABLE pcp_producao_real (id SERIAL PRIMARY KEY, plano_diario_id INTEGER NOT NULL UNIQUE REFERENCES pcp_plano_diario(id) ON DELETE CASCADE,
        real_l1 NUMERIC(14,4) DEFAULT 0, real_l2 NUMERIC(14,4) DEFAULT 0, real_l3 NUMERIC(14,4) DEFAULT 0, real_l4 NUMERIC(14,4) DEFAULT 0, real_total NUMERIC(14,4) DEFAULT 0,
        observacao TEXT, atualizado_em TIMESTAMP DEFAULT NOW(), atualizado_por VARCHAR(100));
    INSERT INTO materiais_catalogo (nome) VALUES ('Sucata de fio misto'), ('Sucata de induzidos');
`;

function montar(modo, perfil = 'Produção') {
    const memStore = { materiais_catalogo: [{ id: 1, nome: 'Sucata de fio misto' }, { id: 2, nome: 'Sucata de induzidos' }] };
    let pool = null;
    if (modo === 'banco') {
        const db = newDb({ noAstCoverageCheck: true });
        db.public.none(ESQUEMA);
        const { Pool } = db.adapters.createPg();
        pool = new Pool();
    }
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = { user: 'carlos', nome: 'Carlos (PCP)', perfil }; next(); });
    // o servidor passa uma função: o banco só fica disponível depois que as rotas são montadas
    app.use('/api/pcp', criarRotasPcp(pool, () => modo === 'banco', memStore));
    return app;
}

describe.each(['banco', 'memoria'])('PCP no modo %s', (modo) => {
    const app = montar(modo);
    let id = null;

    it('1. Começa sem planejamentos (sem dados fictícios)', async () => {
        const res = await request(app).get('/api/pcp');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('2. Recusa planejamento inválido', async () => {
        for (const corpo of [{}, { ano: 2026, mes: 13, meta_mensal: 1000, dias_trabalhados: 20, qtd_linhas: 2 }, { ano: 2026, mes: 10, meta_mensal: 0, dias_trabalhados: 20, qtd_linhas: 2 }, { ano: 2026, mes: 10, meta_mensal: 1000, dias_trabalhados: 20, qtd_linhas: 5 }]) {
            const res = await request(app).post('/api/pcp').send(corpo);
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBeTruthy();
        }
    });

    it('3. Cria o planejamento com linhas e dias úteis do mês', async () => {
        const res = await request(app).post('/api/pcp').send({ ano: 2026, mes: 10, meta_mensal: 440000, dias_trabalhados: 22, qtd_linhas: 2, observacoes: 'Outubro' });
        expect(res.statusCode).toBe(200);
        id = res.body.id;
        expect(res.body.dias_gerados).toBe(22);

        const plano = (await request(app).get(`/api/pcp/${id}`)).body;
        expect(plano).toMatchObject({ ano: 2026, mes: 10, meta_mensal: 440000, dias_trabalhados: 22, qtd_linhas: 2, criado_por: 'Carlos (PCP)' });
        expect(plano.linhas.map(l => l.numero_linha)).toEqual([1, 2]);
        expect(plano.diario).toHaveLength(22);
        expect(plano.diario[0].data).toBe('2026-10-01');
        // sábados e domingos não entram
        expect(plano.diario.some(d => [0, 6].includes(new Date(d.data + 'T12:00:00').getDay()))).toBe(false);
        expect(plano.mix).toEqual([]);
        expect((await request(app).get('/api/pcp')).body.map(p => p.id)).toEqual([id]);
    });

    it('4. Salvar o mix recalcula as metas das linhas e de cada dia', async () => {
        const res = await request(app).put(`/api/pcp/${id}/mix`).send({ mix: [
            { material_id: 1, numero_linha: 1, volume_total: 220000 },
            { material_id: 2, numero_linha: 2, volume_total: 110000 },
            { material_id: 1, numero_linha: 2, volume_total: 110000 }
        ] });
        expect(res.statusCode).toBe(200);
        const plano = (await request(app).get(`/api/pcp/${id}`)).body;
        expect(plano.mix).toHaveLength(3);
        expect(plano.mix[0]).toMatchObject({ material_nome: 'Sucata de fio misto', numero_linha: 1, volume_total: 220000, percentual_volume: 0.5, meta_dia: 10000 });
        expect(plano.linhas).toEqual([
            { numero_linha: 1, meta_mensal: 220000, meta_diaria: 10000, percentual_carga: 0.5 },
            { numero_linha: 2, meta_mensal: 220000, meta_diaria: 10000, percentual_carga: 0.5 }
        ]);
        expect(plano.diario.every(d => d.meta_l1 === 10000 && d.meta_l2 === 10000 && d.meta_l3 === 0 && d.meta_total_dia === 20000)).toBe(true);
    });

    it('5. Recusa mix com linha inexistente, volume negativo ou sem material', async () => {
        for (const mix of [[{ material_id: 1, numero_linha: 3, volume_total: 10 }], [{ material_id: 1, numero_linha: 1, volume_total: -5 }], [{ numero_linha: 1, volume_total: 5 }], 'x']) {
            expect((await request(app).put(`/api/pcp/${id}/mix`).send({ mix })).statusCode).toBe(400);
        }
        // o mix anterior continua intacto
        expect((await request(app).get(`/api/pcp/${id}`)).body.mix).toHaveLength(3);
    });

    it('6. Aponta a produção de um dia e registra quem apontou', async () => {
        const plano = (await request(app).get(`/api/pcp/${id}`)).body;
        const dia = plano.diario[0];
        const res = await request(app).put(`/api/pcp/producao/${dia.id}`).send({ real_l1: '10500.5', real_l2: 9800, real_l3: '', observacao: 'Turno ok' });
        expect(res.statusCode).toBe(200);
        expect(res.body.real_total).toBe(20300.5);
        const depois = (await request(app).get(`/api/pcp/${id}`)).body.diario[0];
        expect(depois).toMatchObject({ real_l1: 10500.5, real_l2: 9800, real_l3: 0, real_total: 20300.5, observacao: 'Turno ok', atualizado_por: 'Carlos (PCP)' });

        expect((await request(app).put(`/api/pcp/producao/${dia.id}`).send({ real_l1: -1 })).statusCode).toBe(400);
        expect((await request(app).put('/api/pcp/producao/999999').send({ real_l1: 1 })).statusCode).toBe(404);
    });

    it('7. Mês com menos dias úteis do que o pedido usa o que o calendário permite', async () => {
        const res = await request(app).post('/api/pcp').send({ ano: 2026, mes: 2, meta_mensal: 1000, dias_trabalhados: 31, qtd_linhas: 1 });
        expect(res.statusCode).toBe(200);
        expect(res.body.dias_gerados).toBe(20); // fevereiro de 2026 tem 20 dias úteis
        const plano = (await request(app).get(`/api/pcp/${res.body.id}`)).body;
        expect(plano.dias_trabalhados).toBe(20);
        expect((await request(app).delete(`/api/pcp/${res.body.id}`)).statusCode).toBe(200);
    });

    it('8. Excluir remove o planejamento e tudo o que depende dele', async () => {
        expect((await request(app).delete(`/api/pcp/${id}`)).statusCode).toBe(200);
        expect((await request(app).get(`/api/pcp/${id}`)).statusCode).toBe(404);
        expect((await request(app).get('/api/pcp')).body).toEqual([]);
        expect((await request(app).delete(`/api/pcp/${id}`)).statusCode).toBe(404);
    });
});

describe('PCP: permissão de exclusão', () => {
    it('Perfil sem permissão não exclui planejamento', async () => {
        const app = montar('memoria', 'Laboratório');
        const criado = await request(app).post('/api/pcp').send({ ano: 2026, mes: 10, meta_mensal: 1000, dias_trabalhados: 5, qtd_linhas: 1 });
        expect((await request(app).delete(`/api/pcp/${criado.body.id}`)).statusCode).toBe(403);
    });
});
