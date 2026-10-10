const express = require('express');

/**
 * Consulta da trilha de auditoria.
 * `dbAvailable` pode ser um booleano ou uma função. O servidor passa uma função: com o booleano, a rota
 * lia sempre a memória, enquanto os registros eram gravados no banco, e a trilha aparecia vazia.
 */
module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();
    const usarBanco = () => !!pool && (typeof dbAvailable === 'function' ? !!dbAvailable() : !!dbAvailable);
    const LIMITE_MAX = 5000;

    function lerFiltros(q) {
        const limite = Math.min(LIMITE_MAX, Math.max(1, parseInt(q.limite, 10) || 100));
        const pagina = Math.max(1, parseInt(q.pagina, 10) || 1);
        const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
        return {
            limite, pagina,
            busca: String(q.busca || '').trim().toLowerCase().slice(0, 100),
            usuario: String(q.usuario || '').trim().slice(0, 100),
            acao: String(q.acao || '').trim().slice(0, 60),
            de: data(q.de), ate: data(q.ate),
            somenteFalhas: q.falhas === '1'
        };
    }

    router.get('/', async (req, res) => {
        try {
            const f = lerFiltros(req.query);
            const inicio = (f.pagina - 1) * f.limite;

            if (usarBanco()) {
                const cond = [], params = [];
                const add = (sql, valor) => { params.push(valor); cond.push(sql.replace('?', '$' + params.length)); };
                if (f.busca) {
                    params.push('%' + f.busca + '%');
                    const n = '$' + params.length;
                    cond.push(`(LOWER(COALESCE(detalhe, '')) LIKE ${n} OR LOWER(COALESCE(usuario, '')) LIKE ${n} OR LOWER(acao) LIKE ${n} OR LOWER(COALESCE(ip, '')) LIKE ${n})`);
                }
                if (f.usuario) add('usuario = ?', f.usuario);
                if (f.acao) add('acao = ?', f.acao);
                if (f.de) add('criado_em >= ?', f.de + ' 00:00:00');
                if (f.ate) add('criado_em <= ?', f.ate + ' 23:59:59');
                if (f.somenteFalhas) cond.push(`(detalhe LIKE '%acesso negado%' OR detalhe LIKE '%recusad%' OR detalhe LIKE '%— erro%' OR detalhe LIKE '%não encontrado%')`);
                const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

                const total = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
                const linhas = await pool.query(
                    `SELECT id, usuario, acao, detalhe, amostra_id, ip, criado_em FROM audit_logs ${where} ORDER BY criado_em DESC, id DESC LIMIT ${f.limite} OFFSET ${inicio}`, params);
                const acoes = await pool.query('SELECT DISTINCT acao FROM audit_logs ORDER BY acao ASC');
                const usuarios = await pool.query('SELECT DISTINCT usuario FROM audit_logs ORDER BY usuario ASC');
                return res.json({
                    registros: linhas.rows, total: parseInt(total.rows[0].total, 10) || 0, pagina: f.pagina, limite: f.limite,
                    acoes: acoes.rows.map(r => r.acao).filter(Boolean), usuarios: usuarios.rows.map(r => r.usuario).filter(Boolean)
                });
            }

            const todos = (memStore.audit_logs || []).slice().reverse();
            const falha = /acesso negado|recusad|— erro|não encontrado/;
            const filtrados = todos.filter(l => {
                const dia = String(l.criado_em || '').slice(0, 10);
                if (f.busca && !`${l.detalhe || ''} ${l.usuario || ''} ${l.acao || ''} ${l.ip || ''}`.toLowerCase().includes(f.busca)) return false;
                if (f.usuario && l.usuario !== f.usuario) return false;
                if (f.acao && l.acao !== f.acao) return false;
                if (f.de && dia < f.de) return false;
                if (f.ate && dia > f.ate) return false;
                if (f.somenteFalhas && !falha.test(l.detalhe || '')) return false;
                return true;
            });
            const distintos = (campo) => [...new Set(todos.map(l => l[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            res.json({ registros: filtrados.slice(inicio, inicio + f.limite), total: filtrados.length, pagina: f.pagina, limite: f.limite, acoes: distintos('acao'), usuarios: distintos('usuario') });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
