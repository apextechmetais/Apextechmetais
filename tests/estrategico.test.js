const request = require('supertest');
jest.mock('puppeteer', () => ({})); // Mock do puppeteer para evitar erros de ESM no Jest
const { app, pool } = require('../server.js');
const Engine = require('../lib/calculationEngine.js');

describe('Módulo Estratégico: motor de cálculo (ApexEngine)', () => {
    const cobre = { material_id: 1, venda_ref: 50, preco_entregar: 40, preco_coletar: 38, comissao: 2, pis_cofins: 0, fidc: 2, icms: 0, frete_coleta: 1 };

    it('1. Margem líquida desconta comissão, PIS/COFINS, FIDC e ICMS do preço de venda', () => {
        const m = Engine.calcularMargemMaterial(cobre, { operacao: 'entrega' });
        expect(m.vendaLiquida).toBeCloseTo(48);
        expect(m.lucroLiquidoKg).toBeCloseTo(8);
        expect(m.margemLiquidaPct).toBeCloseTo(16);
        expect(m.margemBrutaPct).toBeCloseTo(20);
    });

    it('2. Frete de coleta só entra quando a compra é por coleta', () => {
        expect(Engine.calcularMargemMaterial(cobre, { operacao: 'entrega' }).freteKg).toBe(0);
        const coleta = Engine.calcularMargemMaterial(cobre, { operacao: 'coleta' });
        expect(coleta.freteKg).toBe(1);
        expect(coleta.lucroLiquidoKg).toBeCloseTo(48 - 38 - 1);
    });

    it('3. Aceita os nomes de campo alternativos das tabelas de preço', () => {
        const alt = { preco_venda: 50, preco_compra_entregar: 40, comissao: 2, fidc: 2 };
        expect(Engine.calcularMargemMaterial(alt).lucroLiquidoKg).toBeCloseTo(8);
    });

    it('4. Mix sem perda: volume, investimento, margens e ponto de equilíbrio', () => {
        const r = Engine.calcularMixEstrategico({ metaFaturamento: 100000, itens: [{ material_id: 1, fracaoPct: 100 }], tabelaPrecos: [cobre] });
        expect(r.totalKg).toBeCloseTo(2000);
        expect(r.totalInvestimento).toBeCloseTo(80000);
        expect(r.lucroBruto).toBeCloseTo(20000);
        expect(r.lucroLiquido).toBeCloseTo(16000);
        expect(r.margemLiquidaPct).toBeCloseTo(16);
        expect(r.pontoEquilibrioFat).toBeCloseTo(80000 / 0.96);
    });

    it('5. Rendimento menor que 100% aumenta a compra e o investimento', () => {
        const r = Engine.calcularMixEstrategico({ metaFaturamento: 100000, itens: [{ material_id: 1, fracaoPct: 100, rendimentoPct: 80 }], tabelaPrecos: [cobre] });
        expect(r.totalKg).toBeCloseTo(2000);
        expect(r.totalKgCompra).toBeCloseTo(2500);
        expect(r.totalInvestimento).toBeCloseTo(100000);
        expect(r.lucroLiquido).toBeCloseTo(96000 - 100000);
    });

    it('6. Choque de preço mantém os volumes e recalcula receita e lucro', () => {
        const base = Engine.calcularMixEstrategico({ metaFaturamento: 100000, itens: [{ material_id: 1, fracaoPct: 100 }], tabelaPrecos: [cobre] });
        const queda = Engine.calcularMixEstrategico({ metaFaturamento: 100000, itens: [{ material_id: 1, fracaoPct: 100 }], tabelaPrecos: [cobre], choqueVendaPct: -5 });
        expect(queda.totalKg).toBeCloseTo(base.totalKg);
        expect(queda.receita).toBeCloseTo(95000);
        expect(queda.lucroLiquido).toBeCloseTo(95000 * 0.96 - 80000);
        const compraCara = Engine.calcularMixEstrategico({ metaFaturamento: 100000, itens: [{ material_id: 1, fracaoPct: 100 }], tabelaPrecos: [cobre], choqueCompraPct: 10 });
        expect(compraCara.custoCompra).toBeCloseTo(88000);
    });

    it('7. Mix com dois produtos soma frações e totais; material sem preço não quebra', () => {
        const zinco = { material_id: 2, venda_ref: 20, preco_entregar: 15 };
        const r = Engine.calcularMixEstrategico({
            metaFaturamento: 100000,
            itens: [{ material_id: 1, fracaoPct: 60 }, { material_id: 2, fracaoPct: 30 }, { material_id: 99, fracaoPct: 10 }],
            tabelaPrecos: [cobre, zinco]
        });
        expect(r.totalPct).toBeCloseTo(100);
        expect(r.linhas[0].volumeKg).toBeCloseTo(1200);
        expect(r.linhas[1].volumeKg).toBeCloseTo(1500);
        expect(r.linhas[2].volumeKg).toBe(0);
        expect(r.totalInvestimento).toBeCloseTo(1200 * 40 + 1500 * 15);
    });
});

describe('Módulo Estratégico: API de planos', () => {
    let token = '';
    let planoId = null;
    const auth = (req) => req.set('Authorization', `Bearer ${token}`);
    const planoValido = () => ({
        titulo: 'Plano Teste',
        data_inicial: '2026-10-01',
        data_final: '2026-10-31',
        frente: 'venda',
        meta_faturamento: 100000,
        mix: [
            { material_id: 1, fracao_pct: 60, rendimento_pct: 90, volume_necessario: 1200, faturamento_alvo: 60000, investimento_necessario: 53333.33 },
            { material_id: 2, fracao_pct: 40, volume_necessario: 2000, faturamento_alvo: 40000, investimento_necessario: 30000 }
        ]
    });

    beforeAll(async () => {
        const login = await request(app).post('/api/login').send({ user: 'admin', pass: 'apex2026' });
        token = login.body.token;
    });

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    it('8. Cria um plano válido e devolve o mix com o rendimento', async () => {
        const res = await auth(request(app).post('/api/estrategiav3_planos')).send(planoValido());
        expect(res.statusCode).toBe(200);
        planoId = res.body.plano_id;

        const lista = await auth(request(app).get('/api/estrategiav3_planos'));
        const plano = lista.body.planos.find(p => p.id === planoId);
        expect(plano.status).toBe('EM ANDAMENTO');
        expect(plano.itens).toHaveLength(2);
        expect(plano.itens[0].rendimento_pct).toBe(90);
        expect(plano.itens[1].rendimento_pct).toBe(100);
    });

    it('9. Rejeita plano sem título, com datas invertidas, mix acima de 100% ou rendimento inválido', async () => {
        const casos = [
            { ...planoValido(), titulo: '' },
            { ...planoValido(), data_inicial: '2026-11-01' },
            { ...planoValido(), mix: [{ material_id: 1, fracao_pct: 70 }, { material_id: 2, fracao_pct: 50 }] },
            { ...planoValido(), mix: [{ material_id: 1, fracao_pct: 100, rendimento_pct: 0 }] },
            { ...planoValido(), mix: [{ fracao_pct: 100 }] },
            { ...planoValido(), meta_faturamento: 'abc' }
        ];
        for (const corpo of casos) {
            const res = await auth(request(app).post('/api/estrategiav3_planos')).send(corpo);
            expect([JSON.stringify(corpo).slice(0, 60), res.statusCode]).toEqual([JSON.stringify(corpo).slice(0, 60), 400]);
            expect(res.body.error).toBeTruthy();
        }
    });

    it('10. Aceita o formato do "Plano Personalizado" (nome, data_inicio, data_fim, itens)', async () => {
        const res = await auth(request(app).post('/api/estrategiav3_planos')).send({
            nome: 'Plano Personalizado - Cobre',
            data_inicio: '2026-10-01',
            data_fim: '2026-10-31',
            itens: [{ material_id: 1, fracao_pct: 100, faturamento_alvo: 50000 }]
        });
        expect(res.statusCode).toBe(200);
    });

    it('11. Status do plano só aceita valores conhecidos', async () => {
        const invalido = await auth(request(app).put(`/api/estrategiav3_planos/${planoId}/status`)).send({ status: 'qualquer coisa' });
        expect(invalido.statusCode).toBe(400);
        const valido = await auth(request(app).put(`/api/estrategiav3_planos/${planoId}/status`)).send({ status: 'FINALIZADO' });
        expect(valido.statusCode).toBe(200);
    });

    it('12. Realizado automático devolve planejado e realizado por material do mix', async () => {
        const res = await auth(request(app).get(`/api/estrategiav3_planos/${planoId}/realizado-pedidos`));
        expect(res.statusCode).toBe(200);
        expect(res.body.itens).toHaveLength(2);
        expect(res.body.itens[0]).toMatchObject({ material_id: 1, faturamento_alvo: 60000, volume_planejado_kg: 1200 });
        expect(res.body.totais).toEqual(expect.objectContaining({ faturamento_realizado: expect.any(Number), investimento_realizado: expect.any(Number) }));

        const inexistente = await auth(request(app).get('/api/estrategiav3_planos/999999/realizado-pedidos'));
        expect(inexistente.statusCode).toBe(404);
    });

    it('13. Resultado real rejeita valores inválidos e conclui o plano com valores válidos', async () => {
        const invalido = await auth(request(app).put(`/api/estrategiav3_planos/${planoId}/resultado_real`)).send({ faturamento_realizado: -1, investimento_realizado: 10 });
        expect(invalido.statusCode).toBe(400);
        const valido = await auth(request(app).put(`/api/estrategiav3_planos/${planoId}/resultado_real`)).send({ faturamento_realizado: 90000, investimento_realizado: 70000, volume_realizado: 3000, observacoes: 'teste' });
        expect(valido.statusCode).toBe(200);
        const lista = await auth(request(app).get('/api/estrategiav3_planos'));
        expect(lista.body.planos.find(p => p.id === planoId).status).toBe('CONCLUIDO');
    });

    it('14. Perfil sem permissão não cria plano; rotas exigem login', async () => {
        const semLogin = await request(app).get(`/api/estrategiav3_planos/${planoId}/realizado-pedidos`);
        expect(semLogin.statusCode).toBe(401);
        const lab = await request(app).post('/api/login').send({ user: 'lab', pass: 'lab123' });
        const res = await request(app).post('/api/estrategiav3_planos').set('Authorization', `Bearer ${lab.body.token}`).send(planoValido());
        expect(res.statusCode).toBe(403);
    });

    it('15. Forecast devolve margem líquida, margem bruta e lucro líquido por kg', async () => {
        const res = await auth(request(app).get('/api/planejamento/compras/forecast'));
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            expect(res.body[0]).toEqual(expect.objectContaining({
                margem_pct: expect.any(Number),
                margem_bruta_pct: expect.any(Number),
                lucro_liquido_kg: expect.any(Number)
            }));
            expect(res.body[0].margem_pct).toBeLessThanOrEqual(res.body[0].margem_bruta_pct);
        }
    });
});
