const fs = require('fs');

let c = fs.readFileSync('../server.js', 'utf8');

// 1. Remove that broken line completely
c = c.replace(/app\.get\('\/api\/admin\/run-import-clientes', \(req, res\) => \{\\n.*initDatabase\(\)\.then\(\(\) => \{/, 'initDatabase().then(() => {');

// Add the endpoints back cleanly using proper newlines
const cleanEndpoints = `
app.get('/api/admin/run-import-clientes', (req, res) => {
    const { exec } = require('child_process');
    exec('npm run import:clientes', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).send('<pre>ERRO:\\n' + stderr + '\\n\\nSTDOUT:\\n' + stdout + '</pre>');
        }
        res.send('<pre>SUCESSO:\\n' + stdout + '\\n\\nAVISOS:\\n' + stderr + '</pre>');
    });
});

app.get('/api/admin/run-import-fornecedores', (req, res) => {
    const { exec } = require('child_process');
    exec('npm run import:fornecedores', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).send('<pre>ERRO:\\n' + stderr + '\\n\\nSTDOUT:\\n' + stdout + '</pre>');
        }
        res.send('<pre>SUCESSO:\\n' + stdout + '\\n\\nAVISOS:\\n' + stderr + '</pre>');
    });
});

initDatabase().then(() => {
`;

c = c.replace('initDatabase().then(() => {', cleanEndpoints.trim());

// 2. Fix the `fornecedores` table creation in initDatabase
// It's currently:
// CREATE TABLE IF NOT EXISTS fornecedores (
//    id            SERIAL PRIMARY KEY,
//    razao_social  TEXT NOT NULL,
//    ...
//    criado_em     TIMESTAMP DEFAULT NOW()
// );
// We will just let it be, but change it to the new schema just in case:
c = c.replace(/CREATE TABLE IF NOT EXISTS fornecedores \([\s\S]*?criado_em     TIMESTAMP DEFAULT NOW\(\)\n            \);/, 
`CREATE TABLE IF NOT EXISTS fornecedores (
                id            SERIAL PRIMARY KEY,
                codfor        INTEGER UNIQUE,
                nome          VARCHAR(255) NOT NULL,
                apelido       VARCHAR(255),
                cnpj          VARCHAR(18),
                comprador     VARCHAR(150),
                fone1         VARCHAR(20),
                email         VARCHAR(150),
                endereco      VARCHAR(255),
                complemento   TEXT,
                criado_em     TIMESTAMP DEFAULT NOW()
            );`);

// 3. Fix the `INSERT INTO fornecedores` seed inside initDatabase
c = c.replace(/INSERT INTO fornecedores \(razao_social, nome_fantasia, cnpj, contato, telefone, email, endereco, \n?observacoes\)/g, 
'INSERT INTO fornecedores (nome, apelido, cnpj, comprador, fone1, email, endereco, complemento)');

c = c.replace(/INSERT INTO fornecedores \(razao_social, nome_fantasia, cnpj, contato, telefone, email, endereco, observacoes\)/g, 
'INSERT INTO fornecedores (nome, apelido, cnpj, comprador, fone1, email, endereco, complemento)');


// 4. Fix `SELECT * FROM fornecedores ORDER BY razao_social ASC` -> aliasing columns
c = c.replace(/SELECT \* FROM fornecedores ORDER BY razao_social ASC/g, 
'SELECT id, nome AS razao_social, apelido AS nome_fantasia, cnpj, comprador AS contato, fone1 AS telefone, email, endereco, complemento AS observacoes FROM fornecedores ORDER BY nome ASC');


// 5. Fix `UPDATE fornecedores SET razao_social=$1...`
c = c.replace(/UPDATE fornecedores SET razao_social=\$1, nome_fantasia=\$2, cnpj=\$3, contato=\$4, telefone=\$5, \n?email=\$6, endereco=\$7, observacoes=\$8/g, 
'UPDATE fornecedores SET nome=$1, apelido=$2, cnpj=$3, comprador=$4, fone1=$5, email=$6, endereco=$7, complemento=$8');

fs.writeFileSync('../server.js', c);
