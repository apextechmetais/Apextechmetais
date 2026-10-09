const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const regex = /(app\.(?:post|put)\('\/api\/tabela-precos-(?:residuos|ligas|volume|fundicao)(?:\/:id)?', async \(req, res\) => \{[\s\S]*?\n\}\);)/g;

content = content.replace(regex, (match) => {
    // We want to add "await atualizarDataUltimaModificacaoPrecos();" right before any "return res.json(" or "res.json(" 
    // IF it's not already there.
    let lines = match.split('\n');
    let newLines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if ((line.includes('return res.json(') || line.includes('res.json(') || line.includes('res.status(404).json(')) && 
            !line.includes('error:') && !line.includes('catch') && !line.includes('atualizarDataUltimaModificacaoPrecos')) {
            let indent = line.match(/^\s*/)[0];
            newLines.push(indent + 'await atualizarDataUltimaModificacaoPrecos();');
        }
        newLines.push(line);
    }
    return newLines.join('\n');
});

fs.writeFileSync('server.js', content, 'utf8');
console.log('Done!');
