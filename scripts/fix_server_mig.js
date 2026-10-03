const fs = require('fs');

let c = fs.readFileSync('../server.js', 'utf8');

const migrationEndpoint = `
app.get('/api/admin/run-migrations', (req, res) => {
    const { exec } = require('child_process');
    exec('node scripts/force-migrations.js', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).send('<pre>ERRO:\\n' + stderr + '\\n\\nSTDOUT:\\n' + stdout + '</pre>');
        }
        res.send('<pre>SUCESSO:\\n' + stdout + '\\n\\nAVISOS:\\n' + stderr + '</pre>');
    });
});

app.get('/api/admin/run-import-clientes',
`;

c = c.replace("app.get('/api/admin/run-import-clientes',", migrationEndpoint.trim());

fs.writeFileSync('../server.js', c);
