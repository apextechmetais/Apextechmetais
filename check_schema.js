const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'fornecedores'
        `);
        console.log('Colunas de fornecedores:', res.rows);
        
        const res2 = await pool.query('SELECT COUNT(*) FROM fornecedores');
        console.log('Total registros:', res2.rows[0].count);
        
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
