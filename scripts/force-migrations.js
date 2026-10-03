const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    let client;
    try {
        client = await pool.connect();
        
        console.log('Dropando tabelas antigas...');
        await client.query('DROP TABLE IF EXISTS fornecedores CASCADE;');
        await client.query('DROP TABLE IF EXISTS clientes CASCADE;');
        
        console.log('Lendo migrations...');
        const sqlFornecedores = fs.readFileSync(path.join(__dirname, '../migrations/001_create_fornecedores.sql'), 'utf8');
        const sqlClientes = fs.readFileSync(path.join(__dirname, '../migrations/002_create_clientes.sql'), 'utf8');
        
        console.log('Executando 001_create_fornecedores.sql...');
        await client.query(sqlFornecedores);
        
        console.log('Executando 002_create_clientes.sql...');
        await client.query(sqlClientes);
        
        console.log('Restaurando Foreign Key em amostras...');
        try {
            await client.query('ALTER TABLE amostras ADD CONSTRAINT amostras_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id);');
        } catch (e) {
            console.log('Aviso (amostras FK):', e.message);
        }

        try {
            await client.query('ALTER TABLE lotes_compra ADD CONSTRAINT lotes_compra_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id);');
        } catch (e) {
            console.log('Aviso (lotes_compra FK):', e.message);
        }
        
        console.log('Migrations concluídas com sucesso!');
    } catch (err) {
        console.error('Erro nas migrations:', err);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
