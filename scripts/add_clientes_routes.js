const fs = require('fs');

let c = fs.readFileSync('../server.js', 'utf8');

const clientesRoutes = `
// ─── CRUD Clientes ────────────────────────────────────────────────────────────
app.get('/api/clientes', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM clientes ORDER BY nome ASC');
            return res.json(result.rows);
        }
        res.json([]);
    } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        res.status(500).json({ error: 'Erro ao buscar clientes.' });
    }
});

app.get('/api/clientes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });
            return res.json(result.rows[0]);
        }
        res.status(404).json({ error: 'Cliente não encontrado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar cliente.' });
    }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { codigo, nome, fantasia, telefone1, telefone2, cnpj, email, endereco, cidade, uf, status } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO clientes (codigo, nome, fantasia, telefone1, telefone2, cnpj, email, endereco, cidade, uf, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
                [codigo, nome, fantasia, telefone1, telefone2, cnpj, email, endereco, cidade, uf, status || 'ATIVO']
            );
            return res.json(result.rows[0]);
        }
        res.status(503).json({ error: 'Banco de dados indisponível.' });
    } catch (err) {
        console.error('Erro ao criar cliente:', err);
        res.status(500).json({ error: 'Erro ao criar cliente.' });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { codigo, nome, fantasia, telefone1, telefone2, cnpj, email, endereco, cidade, uf, status } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                'UPDATE clientes SET codigo=$1, nome=$2, fantasia=$3, telefone1=$4, telefone2=$5, cnpj=$6, email=$7, endereco=$8, cidade=$9, uf=$10, status=$11 WHERE id=$12 RETURNING *',
                [codigo, nome, fantasia, telefone1, telefone2, cnpj, email, endereco, cidade, uf, status, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });
            return res.json(result.rows[0]);
        }
        res.status(503).json({ error: 'Banco de dados indisponível.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar cliente.' });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
            return res.json({ success: true });
        }
        res.status(503).json({ error: 'Banco de dados indisponível.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar cliente.' });
    }
});

`;

// Insert before the "Iniciar servidor" comment
c = c.replace("// ─── Iniciar servidor ───", clientesRoutes + "// ─── Iniciar servidor ───");

fs.writeFileSync('../server.js', c);
console.log('OK: rotas de clientes adicionadas!');
