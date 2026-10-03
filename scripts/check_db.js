const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/Professor/Desktop/ApexAmostra/apextech/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fornecedores'");
        console.log("Columns:", res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}
run();
