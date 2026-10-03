const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migratePasswords() {
    try {
        const result = await pool.query('SELECT id, pass FROM usuarios');
        console.log(`Encontrados ${result.rows.length} usuarios para processar.`);

        for (const user of result.rows) {
            if (!user.pass.startsWith('$2a$') && !user.pass.startsWith('$2b$')) {
                const salt = await bcrypt.genSalt(10);
                const hashed = await bcrypt.hash(user.pass, salt);
                await pool.query('UPDATE usuarios SET pass = $1 WHERE id = $2', [hashed, user.id]);
                console.log(`Senha atualizada para usuario ID ${user.id}`);
            } else {
                console.log(`Usuario ID ${user.id} já possui hash.`);
            }
        }
        console.log('Migração concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Erro na migração:', err);
        process.exit(1);
    }
}

migratePasswords();
