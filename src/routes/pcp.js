const express = require('express');

module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();

    // Utilitário simples para executar query apenas se tiver banco (fallback ignorado no PCP pois é módulo novo e exige DB)
    const runQuery = async (sql, params = []) => {
        if (!pool) throw new Error("O módulo PCP requer conexão com o banco de dados (PostgreSQL não configurado).");
        return await pool.query(sql, params);
    };

    // Lista todos os planejamentos
    router.get('/', async (req, res) => {
        try {
            const { rows } = await runQuery('SELECT * FROM pcp_planejamentos ORDER BY id DESC');
            res.json(rows);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Cria novo planejamento
    router.post('/', async (req, res) => {
        try {
            const { ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por } = req.body;
            
            await runQuery('BEGIN');

            const pResult = await runQuery(
                `INSERT INTO pcp_planejamentos (ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [ano, mes, meta_mensal, dias_trabalhados, qtd_linhas, observacoes, criado_por]
            );
            const planId = pResult.rows[0].id;

            // Criar Linhas vazias
            for (let i = 1; i <= qtd_linhas; i++) {
                const lr = await runQuery(
                    `INSERT INTO pcp_linhas (planejamento_id, numero_linha, meta_mensal, meta_diaria, percentual_carga) 
                     VALUES ($1, $2, 0, 0, 0) RETURNING id`,
                    [planId, i]
                );
            }

            // Gerar dias no calendário (excluindo FDS e 30/09)
            let daysGenerated = 0;
            let currentDay = new Date(ano, mes - 1, 1);
            
            while (daysGenerated < dias_trabalhados) {
                if (currentDay.getMonth() !== (mes - 1)) break;
                
                const d = currentDay.getDate();
                const dw = currentDay.getDay(); 
                
                if (dw !== 0 && dw !== 6 && !(d === 30 && parseInt(mes) === 9)) {
                    const strDate = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const pdRes = await runQuery(
                        `INSERT INTO pcp_plano_diario (planejamento_id, data, is_dia_produtivo) VALUES ($1, $2, true) RETURNING id`,
                        [planId, strDate]
                    );
                    
                    await runQuery(
                        `INSERT INTO pcp_producao_real (plano_diario_id) VALUES ($1)`,
                        [pdRes.rows[0].id]
                    );
                    daysGenerated++;
                }
                currentDay.setDate(currentDay.getDate() + 1);
            }

            await runQuery('COMMIT');
            res.json({ id: planId, message: 'Planejamento criado com sucesso.' });
        } catch (e) {
            await runQuery('ROLLBACK').catch(()=>{});
            res.status(500).json({ error: e.message });
        }
    });

    // Carrega um planejamento completo
    router.get('/:id', async (req, res) => {
        try {
            const planId = req.params.id;
            const pRes = await runQuery('SELECT * FROM pcp_planejamentos WHERE id = $1', [planId]);
            if (pRes.rowCount === 0) return res.status(404).json({ error: 'Planejamento não encontrado' });
            
            const plan = pRes.rows[0];
            const lRes = await runQuery('SELECT * FROM pcp_linhas WHERE planejamento_id = $1 ORDER BY numero_linha ASC', [planId]);
            const mRes = await runQuery(`
                SELECT m.*, mc.nome as material_nome 
                FROM pcp_mix m
                JOIN materiais_catalogo mc ON m.material_id = mc.id
                WHERE m.planejamento_id = $1 ORDER BY m.id ASC
            `, [planId]);
            const dRes = await runQuery(`
                SELECT pd.*, pr.id as prod_id, pr.real_l1, pr.real_l2, pr.real_l3, pr.real_l4, pr.real_total, pr.observacao 
                FROM pcp_plano_diario pd
                JOIN pcp_producao_real pr ON pr.plano_diario_id = pd.id
                WHERE pd.planejamento_id = $1 
                ORDER BY pd.data ASC
            `, [planId]);

            res.json({ ...plan, linhas: lRes.rows, mix: mRes.rows, diario: dRes.rows });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Atualiza o Mix e recalcula tudo
    router.put('/:id/mix', async (req, res) => {
        try {
            const planId = req.params.id;
            const { mix } = req.body; 
            
            await runQuery('BEGIN');

            const pRes = await runQuery('SELECT * FROM pcp_planejamentos WHERE id = $1', [planId]);
            if (pRes.rowCount === 0) throw new Error("Plan not found");
            const plan = pRes.rows[0];
            
            await runQuery('DELETE FROM pcp_mix WHERE planejamento_id = $1', [planId]);

            const lineTotals = {};

            for (const item of mix) {
                const vol = parseFloat(item.volume_total) || 0;
                const perc = vol / plan.meta_mensal;
                const meta_dia = vol / plan.dias_trabalhados;
                
                await runQuery(`
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
                
                await runQuery(`
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

            await runQuery(`
                UPDATE pcp_plano_diario 
                SET meta_l1 = $1, meta_l2 = $2, meta_l3 = $3, meta_l4 = $4, meta_total_dia = $5
                WHERE planejamento_id = $6
            `, [l1_dia, l2_dia, l3_dia, l4_dia, total_dia, planId]);

            await runQuery('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await runQuery('ROLLBACK').catch(()=>{});
            res.status(500).json({ error: e.message });
        }
    });

    // Atualiza a produção real de um dia
    router.put('/producao/:plano_diario_id', async (req, res) => {
        try {
            const pdId = req.params.plano_diario_id;
            const { real_l1, real_l2, real_l3, real_l4, observacao, atualizado_por } = req.body;
            
            const r1 = parseFloat(real_l1) || 0;
            const r2 = parseFloat(real_l2) || 0;
            const r3 = parseFloat(real_l3) || 0;
            const r4 = parseFloat(real_l4) || 0;
            const total = r1 + r2 + r3 + r4;

            await runQuery(`
                UPDATE pcp_producao_real 
                SET real_l1 = $1, real_l2 = $2, real_l3 = $3, real_l4 = $4, real_total = $5, observacao = $6, atualizado_em = NOW(), atualizado_por = $7
                WHERE plano_diario_id = $8
            `, [r1, r2, r3, r4, total, observacao, atualizado_por, pdId]);

            res.json({ success: true, real_total: total });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
