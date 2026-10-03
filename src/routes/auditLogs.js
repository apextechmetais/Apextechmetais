const express = require('express');

module.exports = function(pool, dbAvailable, memStore) {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            if (dbAvailable) {
                const result = await pool.query('SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT 100');
                return res.json(result.rows);
            }
            res.json((memStore.audit_logs || []).slice(-100).reverse());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
