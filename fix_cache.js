const fs = require('fs');
let content = fs.readFileSync('admin.js', 'utf8');
content = content.replace(/fetch\('\/api\/tabela-precos'\)/g, "fetch('/api/tabela-precos', { cache: 'no-store' })");
fs.writeFileSync('admin.js', content);
