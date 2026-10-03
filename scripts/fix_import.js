const fs = require('fs');
const content = `const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const pgFormat = require('pg-format');
const { normalizeFornecedor } = require('../lib/normalizeFornecedor');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const EXCEL_PATH = process.argv[2] || path.join(__dirname, '../DADOS FORNECEDORES.xlsx');
const BACKUPS_DIR = path.join(__dirname, '../backups');
const LOGS_DIR = path.join(__dirname, '../logs');

// Garante que os diretórios existam
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR);
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
const logFile = path.join(LOGS_DIR, \\\`import-fornecedores-\${timestamp}.log\\\`);

function logMsg(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\\n');
}

async function runImport() {
    let client;
    try {
        logMsg(\\\`[INFO] Iniciando importação. Arquivo: \${EXCEL_PATH}\\\`);
        
        if (!fs.existsSync(EXCEL_PATH)) {
            throw new Error(\\\`Arquivo não encontrado: \${EXCEL_PATH}\\\`);
        }

        // 1. Ler o Excel
        logMsg('[INFO] Lendo arquivo Excel...');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_PATH);
        const worksheet = workbook.getWorksheet('Sheet1');
        
        if (!worksheet) {
            throw new Error('Aba "Sheet1" não encontrada no Excel.');
        }

        const rawRows = [];
        // Mapear headers
        const headers = {};
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value.toString().trim().toLowerCase().replace(/[\\s.]/g, '_');
        });

        // Caso os headers venham ligeiramente diferentes
        const getColName = (c) => headers[c] || \\\`col_\${c}\\\`;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // pular cabeçalho
            const rowData = {};
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                rowData[getColName(colNumber)] = cell.value;
            });
            
            const mappedRow = {
                codfor: row.getCell(1).value,
                fornecedor: row.getCell(2).value,
                fone1: row.getCell(3).value,
                fone2: row.getCell(4).value,
                whatsapp: row.getCell(5).value,
                celular: row.getCell(6).value,
                apelido: row.getCell(7).value,
                tabela: row.getCell(8).value,
                concorrente: row.getCell(9).value,
                ok: row.getCell(10).value,
                dias: row.getCell(11).value,
                ultima_ent: row.getCell(12).value,
                tp: row.getCell(13).value,
                data_cad: row.getCell(14).value,
                endereco: row.getCell(15).value,
                numero: row.getCell(16).value,
                complemento: row.getCell(17).value,
                bairro: row.getCell(18).value,
                cidade: row.getCell(19).value,
                uf: row.getCell(20).value,
                cep: row.getCell(21).value,
                cnpj: row.getCell(22).value,
                ie: row.getCell(23).value,
                im: row.getCell(24).value,
                rg: row.getCell(25).value,
                emissor: row.getCell(26).value,
                cpf: row.getCell(27).value,
                comprador: row.getCell(28).value,
                email: row.getCell(29).value,
                condicao: row.getCell(30).value,
                usuario_que_cadastrou: row.getCell(31).value,
                ultimo_a_alterar: row.getCell(32).value,
                dias_em_atraso: row.getCell(33).value,
                dias_de_previsao: row.getCell(34).value,
                filial: row.getCell(35).value
            };
            rawRows.push(mappedRow);
        });

        logMsg(\\\`[INFO] Linhas lidas do Excel: \${rawRows.length}\\\`);
        if (rawRows.length === 0) {
            throw new Error('Nenhuma linha encontrada no Excel após o cabeçalho.');
        }

        // 2. Normalizar
        const validRows = [];
        const ignoredRows = [];

        rawRows.forEach((row, idx) => {
            const res = normalizeFornecedor(row);
            if (res.valid) {
                validRows.push(res.data);
            } else {
                ignoredRows.push({ rowIndex: idx + 2, reason: res.reason, codfor: row.codfor });
            }
        });

        logMsg(\\\`[INFO] Linhas válidas: \${validRows.length}\\\`);
        logMsg(\\\`[INFO] Linhas ignoradas: \${ignoredRows.length}\\\`);
        ignoredRows.forEach(ig => {
            logMsg(\\\`  -> Ignorado Linha \${ig.rowIndex} | Codfor: \${ig.codfor} | Motivo: \${ig.reason}\\\`);
        });

        if (validRows.length < (rawRows.length * 0.9)) {
            throw new Error('Menos de 90% das linhas são válidas. Abortando por segurança.');
        }

        client = await pool.connect();

        // 3. Backup
        logMsg('[INFO] Fazendo backup da tabela atual...');
        try {
            const backupData = await client.query('SELECT * FROM fornecedores');
            const backupPath = path.join(BACKUPS_DIR, \\\`fornecedores_backup_\${timestamp}.json\\\`);
            fs.writeFileSync(backupPath, JSON.stringify(backupData.rows, null, 2));
            logMsg(\\\`[INFO] Backup salvo em: \${backupPath} com \${backupData.rows.length} registros.\\\`);
        } catch (err) {
            logMsg(\\\`[WARN] Erro ao fazer backup (tabela pode não existir ainda): \${err.message}\\\`);
        }

        // 4. Iniciar Transação
        logMsg('[INFO] Iniciando transação no banco (BEGIN)...');
        await client.query('BEGIN');

        // 5. Truncate
        logMsg('[INFO] Limpando tabela (TRUNCATE)...');
        await client.query('TRUNCATE TABLE fornecedores RESTART IDENTITY CASCADE');

        // 6. Inserir em lote
        if (validRows.length > 0) {
            logMsg(\\\`[INFO] Inserindo \${validRows.length} registros...\\\`);
            const insertValues = validRows.map(r => [
                r.codfor, r.nome, r.apelido, r.fone1, r.fone2, r.whatsapp, r.celular, r.tabela, r.concorrente, r.status_ok, r.dias,
                r.ultima_entrega, r.tipo_pessoa, r.data_cadastro, r.endereco, r.numero, r.complemento, r.bairro, r.cidade, r.uf,
                r.cep, r.cnpj, r.ie, r.im, r.rg, r.emissor, r.cpf, r.comprador, r.email, r.condicao_pagamento, r.usuario_cadastro,
                r.ultimo_alterou, r.dias_atraso, r.dias_previsao, r.filial
            ]);

            const queryText = pgFormat(
                \`INSERT INTO fornecedores (
                    codfor, nome, apelido, fone1, fone2, whatsapp, celular, tabela, concorrente, status_ok, dias,
                    ultima_entrega, tipo_pessoa, data_cadastro, endereco, numero, complemento, bairro, cidade, uf,
                    cep, cnpj, ie, im, rg, emissor, cpf, comprador, email, condicao_pagamento, usuario_cadastro,
                    ultimo_alterou, dias_atraso, dias_previsao, filial
                ) VALUES %L\`,
                insertValues
            );

            await client.query(queryText);
        }

        // 7. Validar Contagem
        const countRes = await client.query('SELECT COUNT(*) FROM fornecedores');
        const dbCount = parseInt(countRes.rows[0].count, 10);
        logMsg(\\\`[INFO] Contagem no banco após inserção: \${dbCount}\\\`);

        if (dbCount === validRows.length) {
            logMsg('[INFO] Contagem bateu! Realizando COMMIT.');
            await client.query('COMMIT');
            logMsg('[SUCCESS] Importação finalizada com sucesso!');
        } else {
            logMsg(\\\`[ERROR] Contagem não bate! Esperado: \${validRows.length}, Encontrado: \${dbCount}\\\`);
            logMsg('[INFO] Realizando ROLLBACK...');
            await client.query('ROLLBACK');
            process.exit(1);
        }

    } catch (error) {
        logMsg(\\\`[FATAL] Erro durante a importação: \${error.message}\\\`);
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
`;
fs.writeFileSync('c:/Users/Professor/Desktop/ApexAmostra/apextech/scripts/import-fornecedores.js', content);
