const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query('SELECT * FROM usuarios');
        console.log("Usuários no DB:", res.rows);
    } catch(e) {
        console.log("Erro:", e);
    } finally {
        pool.end();
    }
}
run();
