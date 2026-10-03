const fs = require('fs');

let server = fs.readFileSync('../server.js', 'utf8');

// ─── 1. Criar as tabelas de pedidos no initDatabase ───
const pedidosTabelas = `
            CREATE TABLE IF NOT EXISTS pedidos_venda (
                id              SERIAL PRIMARY KEY,
                numero          TEXT NOT NULL UNIQUE,
                cliente_id      INTEGER NOT NULL,
                data_emissao    DATE NOT NULL DEFAULT CURRENT_DATE,
                data_entrega    DATE,
                status          TEXT NOT NULL DEFAULT 'Rascunho',
                condicao_pagamento TEXT,
                observacoes     TEXT,
                desconto_pct    NUMERIC(5,2) DEFAULT 0.00,
                frete           NUMERIC(10,2) DEFAULT 0.00,
                total_itens     NUMERIC(14,2) DEFAULT 0.00,
                total_geral     NUMERIC(14,2) DEFAULT 0.00,
                criado_por      TEXT,
                criado_em       TIMESTAMP DEFAULT NOW(),
                atualizado_em   TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS pedidos_venda_itens (
                id              SERIAL PRIMARY KEY,
                pedido_id       INTEGER NOT NULL REFERENCES pedidos_venda(id) ON DELETE CASCADE,
                material_id     INTEGER,
                descricao       TEXT NOT NULL,
                unidade         TEXT DEFAULT 'kg',
                quantidade      NUMERIC(12,3) NOT NULL,
                preco_unitario  NUMERIC(10,4) NOT NULL,
                desconto_item   NUMERIC(5,2) DEFAULT 0.00,
                total_item      NUMERIC(14,2) NOT NULL
            );
`;

// Insert tables right before the fornecedores table creation
server = server.replace(
    'CREATE TABLE IF NOT EXISTS fornecedores (',
    pedidosTabelas + '\n            CREATE TABLE IF NOT EXISTS fornecedores ('
);

// ─── 2. Adicionar as rotas de Pedidos de Venda ───
const pedidosRoutes = `
// ══════════════════════════════════════════════════════════════
// PEDIDOS DE VENDA
// ══════════════════════════════════════════════════════════════

// Buscar próximo número de pedido
app.get('/api/pedidos-venda/proximo-numero', async (req, res) => {
    try {
        if (!dbAvailable) return res.json({ numero: 'PV-0001' });
        const r = await pool.query("SELECT numero FROM pedidos_venda ORDER BY id DESC LIMIT 1");
        if (r.rows.length === 0) return res.json({ numero: 'PV-0001' });
        const last = parseInt(r.rows[0].numero.replace('PV-', '')) || 0;
        const next = 'PV-' + String(last + 1).padStart(4, '0');
        return res.json({ numero: next });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar todos os pedidos
app.get('/api/pedidos-venda', async (req, res) => {
    try {
        if (!dbAvailable) return res.json([]);
        const r = await pool.query(\`
            SELECT pv.*, c.nome AS cliente_nome, c.cnpj AS cliente_cnpj, c.cidade AS cliente_cidade, c.uf AS cliente_uf
            FROM pedidos_venda pv
            LEFT JOIN clientes c ON c.id = pv.cliente_id
            ORDER BY pv.id DESC
        \`);
        return res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar pedido por ID com itens
app.get('/api/pedidos-venda/:id', async (req, res) => {
    try {
        if (!dbAvailable) return res.status(404).json({ error: 'Banco indisponível' });
        const id = parseInt(req.params.id);
        const pedido = await pool.query(\`
            SELECT pv.*, c.nome AS cliente_nome, c.cnpj AS cliente_cnpj, c.telefone1 AS cliente_telefone,
                   c.email AS cliente_email, c.endereco AS cliente_endereco, c.cidade AS cliente_cidade, c.uf AS cliente_uf
            FROM pedidos_venda pv
            LEFT JOIN clientes c ON c.id = pv.cliente_id
            WHERE pv.id = $1
        \`, [id]);
        if (pedido.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
        const itens = await pool.query('SELECT * FROM pedidos_venda_itens WHERE pedido_id = $1 ORDER BY id', [id]);
        return res.json({ ...pedido.rows[0], itens: itens.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Criar pedido
app.post('/api/pedidos-venda', async (req, res) => {
    const client = await pool.connect();
    try {
        const { numero, cliente_id, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, itens, criado_por } = req.body;
        if (!cliente_id || !itens || itens.length === 0) {
            return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' });
        }
        const total_itens = itens.reduce((s, i) => s + parseFloat(i.total_item || 0), 0);
        const desc = parseFloat(desconto_pct || 0);
        const fr = parseFloat(frete || 0);
        const total_geral = total_itens * (1 - desc / 100) + fr;

        await client.query('BEGIN');
        const pedido = await client.query(\`
            INSERT INTO pedidos_venda (numero, cliente_id, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, total_itens, total_geral, criado_por)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
        \`, [numero, cliente_id, data_emissao || new Date().toISOString().split('T')[0],
             data_entrega, status || 'Rascunho', condicao_pagamento, observacoes,
             desc, fr, total_itens, total_geral, criado_por]);

        const pedidoId = pedido.rows[0].id;
        for (const item of itens) {
            await client.query(\`
                INSERT INTO pedidos_venda_itens (pedido_id, material_id, descricao, unidade, quantidade, preco_unitario, desconto_item, total_item)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            \`, [pedidoId, item.material_id || null, item.descricao, item.unidade || 'kg',
                 item.quantidade, item.preco_unitario, item.desconto_item || 0, item.total_item]);
        }

        await client.query('COMMIT');
        res.json(pedido.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar pedido:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Atualizar pedido
app.put('/api/pedidos-venda/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const id = parseInt(req.params.id);
        const { cliente_id, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, itens } = req.body;
        const total_itens = itens.reduce((s, i) => s + parseFloat(i.total_item || 0), 0);
        const desc = parseFloat(desconto_pct || 0);
        const fr = parseFloat(frete || 0);
        const total_geral = total_itens * (1 - desc / 100) + fr;

        await client.query('BEGIN');
        await client.query(\`
            UPDATE pedidos_venda SET cliente_id=$1, data_emissao=$2, data_entrega=$3, status=$4,
                condicao_pagamento=$5, observacoes=$6, desconto_pct=$7, frete=$8,
                total_itens=$9, total_geral=$10, atualizado_em=NOW()
            WHERE id=$11
        \`, [cliente_id, data_emissao, data_entrega, status, condicao_pagamento,
             observacoes, desc, fr, total_itens, total_geral, id]);
        await client.query('DELETE FROM pedidos_venda_itens WHERE pedido_id = $1', [id]);
        for (const item of itens) {
            await client.query(\`
                INSERT INTO pedidos_venda_itens (pedido_id, material_id, descricao, unidade, quantidade, preco_unitario, desconto_item, total_item)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            \`, [id, item.material_id || null, item.descricao, item.unidade || 'kg',
                 item.quantidade, item.preco_unitario, item.desconto_item || 0, item.total_item]);
        }
        await client.query('COMMIT');
        const updated = await pool.query('SELECT * FROM pedidos_venda WHERE id=$1', [id]);
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Deletar pedido
app.delete('/api/pedidos-venda/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) return res.status(503).json({ error: 'Banco indisponível' });
        await pool.query('DELETE FROM pedidos_venda WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

`;

server = server.replace('// ─── Iniciar servidor ───', pedidosRoutes + '// ─── Iniciar servidor ───');

fs.writeFileSync('../server.js', server);
console.log('OK: tabelas e rotas de pedidos de venda adicionadas!');
