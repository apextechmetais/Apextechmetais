const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const pgFormat = require('pg-format');
const { normalizeCliente } = require('../lib/normalizeCliente');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const EXCEL_PATH = process.argv[2] || path.join(__dirname, '../DADOS CLIENTES.xlsx');
const BACKUPS_DIR = path.join(__dirname, '../backups');
const LOGS_DIR = path.join(__dirname, '../logs');

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR);
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
const logFile = path.join(LOGS_DIR, 'import-clientes-' + timestamp + '.log');

function logMsg(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function runImport() {
    let client;
    try {
        logMsg('[INFO] Iniciando importação. Arquivo: ' + EXCEL_PATH);
        
        if (!fs.existsSync(EXCEL_PATH)) {
            throw new Error('Arquivo não encontrado: ' + EXCEL_PATH);
        }

        logMsg('[INFO] Lendo arquivo Excel...');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_PATH);
        const worksheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
        
        if (!worksheet) {
            throw new Error('Nenhuma aba encontrada no Excel.');
        }

        const rawRows = [];
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // pular cabeçalho
            
            // Lendo colunas explicitamente por índice para evitar conflitos de nomes duplicados
            const mappedRow = {
                codigo: row.getCell(1).value,
                cliente: row.getCell(2).value,
                telefone1: row.getCell(3).value,
                telefone2: row.getCell(4).value,
                dias: row.getCell(5).value,
                ultima_sai: row.getCell(6).value,
                endereco: row.getCell(7).value,
                numero: row.getCell(8).value,
                bairro: row.getCell(9).value,
                cidade: row.getCell(10).value,
                uf: row.getCell(11).value,
                pais: row.getCell(12).value,
                cep: row.getCell(13).value,
                cnpj: row.getCell(14).value,
                ie: row.getCell(15).value,
                cpf: row.getCell(16).value,
                rg: row.getCell(17).value,
                tipo_cliente: row.getCell(18).value,
                fantasia: row.getCell(19).value,
                contato_comercial: row.getCell(20).value,
                contato_financeiro: row.getCell(21).value,
                status: row.getCell(22).value,
                email: row.getCell(23).value,
                usuario_cadastro: row.getCell(24).value,
                ultimo_alterou: row.getCell(25).value,
                vendedor: row.getCell(26).value,
                atualizado: row.getCell(27).value,
                filial: row.getCell(28).value
            };
            rawRows.push(mappedRow);
        });

        logMsg('[INFO] Linhas lidas do Excel: ' + rawRows.length);
        if (rawRows.length === 0) {
            throw new Error('Nenhuma linha encontrada no Excel após o cabeçalho.');
        }

        const validRows = [];
        const ignoredRows = [];

        rawRows.forEach((row, idx) => {
            const res = normalizeCliente(row);
            if (res.valid) {
                validRows.push(res.data);
            } else {
                ignoredRows.push({ rowIndex: idx + 2, reason: res.reason, codigo: row.codigo });
            }
        });

        logMsg('[INFO] Linhas válidas: ' + validRows.length);
        logMsg('[INFO] Linhas ignoradas: ' + ignoredRows.length);
        ignoredRows.forEach(ig => {
            logMsg('  -> Ignorado Linha ' + ig.rowIndex + ' | Codigo: ' + ig.codigo + ' | Motivo: ' + ig.reason);
        });

        if (validRows.length < (rawRows.length * 0.9)) {
            throw new Error('Menos de 90% das linhas são válidas. Abortando por segurança.');
        }

        client = await pool.connect();

        logMsg('[INFO] Fazendo backup da tabela atual...');
        try {
            const backupData = await client.query('SELECT * FROM clientes');
            const backupPath = path.join(BACKUPS_DIR, 'clientes_backup_' + timestamp + '.json');
            fs.writeFileSync(backupPath, JSON.stringify(backupData.rows, null, 2));
            logMsg('[INFO] Backup salvo em: ' + backupPath + ' com ' + backupData.rows.length + ' registros.');
        } catch (err) {
            logMsg('[WARN] Erro ao fazer backup (tabela pode não existir ainda): ' + err.message);
        }

        logMsg('[INFO] Iniciando transação no banco (BEGIN)...');
        await client.query('BEGIN');

        logMsg('[INFO] Limpando tabela (TRUNCATE)...');
        // Usar DELETE FROM ou TRUNCATE. TRUNCATE CASCADE apaga tabelas relacionadas.
        await client.query('TRUNCATE TABLE clientes RESTART IDENTITY CASCADE');

        if (validRows.length > 0) {
            logMsg('[INFO] Inserindo ' + validRows.length + ' registros...');
            const insertValues = validRows.map(r => [
                r.codigo, r.nome, r.fantasia, r.telefone1, r.telefone2, r.dias, r.ultima_saida,
                r.endereco, r.numero, r.bairro, r.cidade, r.uf, r.pais, r.cep, r.cnpj, r.ie, r.cpf, r.rg,
                r.tipo_cliente, r.contato_comercial, r.contato_financeiro, r.status, r.email,
                r.usuario_cadastro, r.ultimo_alterou, r.vendedor, r.atualizado, r.filial
            ]);

            const queryText = pgFormat(
                "INSERT INTO clientes (codigo, nome, fantasia, telefone1, telefone2, dias, ultima_saida, endereco, numero, bairro, cidade, uf, pais, cep, cnpj, ie, cpf, rg, tipo_cliente, contato_comercial, contato_financeiro, status, email, usuario_cadastro, ultimo_alterou, vendedor, atualizado, filial) VALUES %L",
                insertValues
            );

            await client.query(queryText);
        }

        const countRes = await client.query('SELECT COUNT(*) FROM clientes');
        const dbCount = parseInt(countRes.rows[0].count, 10);
        logMsg('[INFO] Contagem no banco após inserção: ' + dbCount);

        if (dbCount === validRows.length) {
            logMsg('[INFO] Contagem bateu! Realizando COMMIT.');
            await client.query('COMMIT');
            logMsg('[SUCCESS] Importação finalizada com sucesso!');
        } else {
            logMsg('[ERROR] Contagem não bate! Esperado: ' + validRows.length + ', Encontrado: ' + dbCount);
            logMsg('[INFO] Realizando ROLLBACK...');
            await client.query('ROLLBACK');
            process.exit(1);
        }

    } catch (error) {
        logMsg('[FATAL] Erro durante a importação: ' + error.message);
        if (error.stack) logMsg(error.stack);
        if (client) {
            logMsg('[INFO] Realizando ROLLBACK por erro...');
            try { await client.query('ROLLBACK'); } catch (e) {}
        }
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

runImport();
