const express = require('express');

module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();

    function ensurePcpMemStore() {
        if (!memStore.pcp_planejamentos) memStore.pcp_planejamentos = [];
        if (!memStore.pcp_linhas) memStore.pcp_linhas = [];
        if (!memStore.pcp_mix) memStore.pcp_mix = [];
        if (!memStore.pcp_plano_diario) memStore.pcp_plano_diario = [];
        if (!memStore.pcp_producao_real) memStore.pcp_producao_real = [];

        if (memStore.pcp_planejamentos.length === 0) {
            const planId = 1;
            memStore.pcp_planejamentos.push({
                id: planId,
                ano: 2026,
                mes: 10,
                meta_mensal: 450000,
                dias_trabalhados: 22,
                qtd_linhas: 4,
                observacoes: 'Planejamento de Produção e Carga de Fábrica',
                criado_por: 'Eng. Roberto'
            });
            for (let i = 1; i <= 4; i++) {
                memStore.pcp_linhas.push({
                    id: i,
                    planejamento_id: planId,
                    numero_linha: i,
                    meta_mensal: 112500,
                    meta_diaria: 5113.63,
                    percentual_carga: 0.25
                });
            }
            const mats = memStore.materiais_catalogo || [];
            const m1 = mats[0] ? mats[0].id : 1;
            const m2 = mats[1] ? mats[1].id : 2;
            memStore.pcp_mix.push(
                { id: 1, planejamento_id: planId, material_id: m1, numero_linha: 1, volume_total: 120000, percentual_volume: 0.266, meta_dia: 5454.54, material_nome: mats[0]?.nome || 'Sucata de Cobre 1' },
                { id: 2, planejamento_id: planId, material_id: m2, numero_linha: 2, volume_total: 110000, percentual_volume: 0.244, meta_dia: 5000.00, material_nome: mats[1]?.nome || 'Sucata de Alumínio' }
            );
            for (let d = 1; d <= 22; d++) {
                const dateStr = `2026-10-${String(d).padStart(2, '0')}`;
                const pdId = d;
                memStore.pcp_plano_diario.push({
                    id: pdId,
                    planejamento_id: planId,
                    data: dateStr,
                    is_dia_produtivo: true,
                    meta_l1: 1363.63,
                    meta_l2: 1250.00,
                    meta_l3: 1250.00,
                    meta_l4: 1250.00,
                    meta_total_dia: 5113.63,
                    prod_id: pdId,
                    real_l1: d <= 4 ? 1400 : 0,
                    real_l2: d <= 4 ? 1200 : 0,
                    real_l3: d <= 4 ? 1250 : 0,
                    real_l4: d <= 4 ? 1300 : 0,
                    real_total: d <= 4 ? 5150 : 0,
                    observacao: d <= 4 ? 'Turno ok' : ''
                });
                memStore.pcp_producao_real.push({
                    id: pdId,
                    plano_diario_id: pdId,
                    real_l1: d <= 4 ? 1400 : 0,
                    real_l2: d <= 4 ? 1200 : 0,
                    real_l3: d <= 4 ? 1250 : 0,
                    real_l4: d <= 4 ? 1300 : 0,
                    real_total: d <= 4 ? 5150 : 0,
                    observacao: d <= 4 ? 'Turno ok' : ''
                });
            }
        }
    }

    // Lista todos os planejamentos
    router.get('/', async (req, res) => {
        try {
            if (dbAvailable && pool) {
                const { rows } = await pool.query('SELECT * FROM pcp_planejamentos ORDER BY id DESC');
                return res.json(rows);
            }
            ensurePcpMemStore();
            res.json(memStore.pcp_planejamentos);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Cria novo planejamento
    router.post('/', async (req, res) => {
        try {
            const { ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por } = req.body;
            
            if (dbAvailable && pool) {
                await pool.query('BEGIN');
                const pResult = await pool.query(
                    `INSERT INTO pcp_planejamentos (ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por]
                );
                const planId = pResult.rows[0].id;
                for (let i = 1; i <= qtd_linhas; i++) {
                    await pool.query(
                        `INSERT INTO pcp_linhas (planejamento_id, numero_linha, meta_mensal, meta_diaria, percentual_carga) 
                         VALUES ($1, $2, 0, 0, 0) RETURNING id`,
                        [planId, i]
                    );
                }
                let daysGenerated = 0;
                let currentDay = new Date(ano, mes - 1, 1);
                while (daysGenerated < dias_trabalhados) {
                    if (currentDay.getMonth() !== (mes - 1)) break;
                    const d = currentDay.getDate();
                    const dw = currentDay.getDay();
                    if (dw !== 0 && dw !== 6 && !(d === 30 && parseInt(mes) === 9)) {
                        const strDate = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const pdRes = await pool.query(
                            `INSERT INTO pcp_plano_diario (planejamento_id, data, is_dia_produtivo) VALUES ($1, $2, true) RETURNING id`,
                            [planId, strDate]
                        );
                        await pool.query(
                            `INSERT INTO pcp_producao_real (plano_diario_id) VALUES ($1)`,
                            [pdRes.rows[0].id]
                        );
                        daysGenerated++;
                    }
                    currentDay.setDate(currentDay.getDate() + 1);
                }
                await pool.query('COMMIT');
                return res.json({ id: planId, message: 'Planejamento criado com sucesso.' });
            }

            ensurePcpMemStore();
            const planId = memStore.pcp_planejamentos.length + 1;
            const newPlan = {
                id: planId, ano: parseInt(ano), mes: parseInt(mes),
                meta_mensal: parseFloat(meta_mensal), dias_trabalhados: parseInt(dias_trabalhados),
                qtd_linhas: parseInt(qtd_linhas), observacoes: observacoes || '', criado_por: criado_por || 'User'
            };
            memStore.pcp_planejamentos.unshift(newPlan);
            res.json({ id: planId, message: 'Planejamento criado com sucesso em memória.' });
        } catch (e) {
            if (dbAvailable && pool) await pool.query('ROLLBACK').catch(()=>{});
            res.status(500).json({ error: e.message });
        }
    });

    // Carrega um planejamento completo
    router.get('/:id', async (req, res) => {
        try {
            const planId = parseInt(req.params.id);
            if (dbAvailable && pool) {
                const pRes = await pool.query('SELECT * FROM pcp_planejamentos WHERE id = $1', [planId]);
                if (pRes.rowCount === 0) return res.status(404).json({ error: 'Planejamento não encontrado' });
                const plan = pRes.rows[0];
                const lRes = await pool.query('SELECT * FROM pcp_linhas WHERE planejamento_id = $1 ORDER BY numero_linha ASC', [planId]);
                const mRes = await pool.query(`
                    SELECT m.*, mc.nome as material_nome 
                    FROM pcp_mix m
                    JOIN materiais_catalogo mc ON m.material_id = mc.id
                    WHERE m.planejamento_id = $1 ORDER BY m.id ASC
                `, [planId]);
                const dRes = await pool.query(`
                    SELECT pd.*, pr.id as prod_id, pr.real_l1, pr.real_l2, pr.real_l3, pr.real_l4, pr.real_total, pr.observacao 
                    FROM pcp_plano_diario pd
                    JOIN pcp_producao_real pr ON pr.plano_diario_id = pd.id
                    WHERE pd.planejamento_id = $1 
                    ORDER BY pd.data ASC
                `, [planId]);
                return res.json({ ...plan, linhas: lRes.rows, mix: mRes.rows, diario: dRes.rows });
            }

            ensurePcpMemStore();
            const plan = memStore.pcp_planejamentos.find(x => x.id === planId);
            if (!plan) return res.status(404).json({ error: 'Planejamento não encontrado' });
            const linhas = memStore.pcp_linhas.filter(x => x.planejamento_id === planId);
            const mix = memStore.pcp_mix.filter(x => x.planejamento_id === planId);
            const diario = memStore.pcp_plano_diario.filter(x => x.planejamento_id === planId);
            res.json({ ...plan, linhas, mix, diario });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Atualiza o Mix e recalcula tudo
    router.put('/:id/mix', async (req, res) => {
        try {
            const planId = parseInt(req.params.id);
            const { mix } = req.body; 
            
            if (dbAvailable && pool) {
                await pool.query('BEGIN');
                const pRes = await pool.query('SELECT * FROM pcp_planejamentos WHERE id = $1', [planId]);
                if (pRes.rowCount === 0) throw new Error("Plan not found");
                const plan = pRes.rows[0];
                await pool.query('DELETE FROM pcp_mix WHERE planejamento_id = $1', [planId]);
                const lineTotals = {};
                for (const item of mix) {
                    const vol = parseFloat(item.volume_total) || 0;
                    const perc = vol / plan.meta_mensal;
                    const meta_dia = vol / plan.dias_trabalhados;
                    await pool.query(`
                        INSERT INTO pcp_mix (planejamento_id, material_id, linha_id, numero_linha, volume_total, percentual_volume, meta_dia)
                        VALUES ($1, $2, (SELECT id FROM pcp_linhas WHERE planejamento_id = $1 AND numero_linha = $4 LIMIT 1), $4, $5, $6, $7)
                    `, [planId, item.material_id, null, item.numero_linha, vol, perc, meta_dia]);
                    if (!lineTotals[item.numero_linha]) lineTotals[item.numero_linha] = 0;
                    lineTotals[item.numero_linha] += vol;
                }
                for (let i = 1; i <= plan.qtd_linhas; i++) {
                    const lVol = lineTotals[i] || 0;
                    const lPerc = lVol / plan.meta_mensal;
                    const lMetaDia = lVol / plan.dias_trabalhados;
                    await pool.query(`
                        UPDATE pcp_linhas 
                        SET meta_mensal = $1, meta_diaria = $2, percentual_carga = $3
                        WHERE planejamento_id = $4 AND numero_linha = $5
                    `, [lVol, lMetaDia, lPerc, planId, i]);
                }
                const l1_dia = (lineTotals[1] || 0) / plan.dias_trabalhados;
                const l2_dia = (lineTotals[2] || 0) / plan.dias_trabalhados;
                const l3_dia = (lineTotals[3] || 0) / plan.dias_trabalhados;
                const l4_dia = (lineTotals[4] || 0) / plan.dias_trabalhados;
                const total_dia = l1_dia + l2_dia + l3_dia + l4_dia;
                await pool.query(`
                    UPDATE pcp_plano_diario 
                    SET meta_l1 = $1, meta_l2 = $2, meta_l3 = $3, meta_l4 = $4, meta_total_dia = $5
                    WHERE planejamento_id = $6
                `, [l1_dia, l2_dia, l3_dia, l4_dia, total_dia, planId]);
                await pool.query('COMMIT');
                return res.json({ success: true });
            }

            ensurePcpMemStore();
            const plan = memStore.pcp_planejamentos.find(x => x.id === planId);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            memStore.pcp_mix = memStore.pcp_mix.filter(x => x.planejamento_id !== planId);
            const lineTotals = {};
            const mats = memStore.materiais_catalogo || [];
            let nextMixId = memStore.pcp_mix.length + 1;
            for (const item of mix) {
                const vol = parseFloat(item.volume_total) || 0;
                const perc = vol / plan.meta_mensal;
                const meta_dia = vol / plan.dias_trabalhados;
                const mc = mats.find(m => m.id == item.material_id);
                memStore.pcp_mix.push({
                    id: nextMixId++,
                    planejamento_id: planId,
                    material_id: parseInt(item.material_id),
                    numero_linha: parseInt(item.numero_linha),
                    volume_total: vol,
                    percentual_volume: perc,
                    meta_dia: meta_dia,
                    material_nome: mc ? mc.nome : 'Material ' + item.material_id
                });
                if (!lineTotals[item.numero_linha]) lineTotals[item.numero_linha] = 0;
                lineTotals[item.numero_linha] += vol;
            }
            res.json({ success: true });
        } catch (e) {
            if (dbAvailable && pool) await pool.query('ROLLBACK').catch(()=>{});
            res.status(500).json({ error: e.message });
        }
    });

    // Atualiza a produção real de um dia
    router.put('/producao/:plano_diario_id', async (req, res) => {
        try {
            const pdId = parseInt(req.params.plano_diario_id);
            const { real_l1, real_l2, real_l3, real_l4, observacao, atualizado_por } = req.body;
            
            const r1 = parseFloat(real_l1) || 0;
            const r2 = parseFloat(real_l2) || 0;
            const r3 = parseFloat(real_l3) || 0;
            const r4 = parseFloat(real_l4) || 0;
            const total = r1 + r2 + r3 + r4;

            if (dbAvailable && pool) {
                await pool.query(`
                    UPDATE pcp_producao_real 
                    SET real_l1 = $1, real_l2 = $2, real_l3 = $3, real_l4 = $4, real_total = $5, observacao = $6, atualizado_em = NOW(), atualizado_por = $7
                    WHERE plano_diario_id = $8
                `, [r1, r2, r3, r4, total, observacao, atualizado_por, pdId]);
                return res.json({ success: true, real_total: total });
            }

            ensurePcpMemStore();
            const pr = memStore.pcp_producao_real.find(x => x.plano_diario_id === pdId);
            if (pr) {
                pr.real_l1 = r1;
                pr.real_l2 = r2;
                pr.real_l3 = r3;
                pr.real_l4 = r4;
                pr.real_total = total;
                pr.observacao = observacao || '';
                pr.atualizado_por = atualizado_por || 'User';
                pr.atualizado_em = new Date().toISOString();
            }
            const pd = memStore.pcp_plano_diario.find(x => x.id === pdId);
            if (pd) {
                pd.real_l1 = r1; pd.real_l2 = r2; pd.real_l3 = r3; pd.real_l4 = r4; pd.real_total = total;
                pd.observacao = observacao || '';
            }
            res.json({ success: true, real_total: total });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
