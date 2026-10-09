import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

endpoints = ['tabela-precos-residuos', 'tabela-precos-ligas', 'tabela-precos-volume', 'tabela-precos-fundicao']

for ep in endpoints:
    # We want to find app.post, app.put, app.delete for these endpoints
    pattern = r"(app\.(?:post|put|delete)\('/api/" + ep + r"(?:-validade|/:id)?', async \(req, res\) => \{[\s\S]*?\n\s*\})"
    
    def replacer(match):
        block = match.group(1)
        # Add await atualizarDataUltimaModificacaoPrecos() before return res.json or res.json, unless already there
        lines = block.split('\n')
        new_lines = []
        for line in lines:
            if ('res.json(' in line or 'return res.json(' in line) and 'await atualizarDataUltimaModificacaoPrecos()' not in line:
                indent = len(line) - len(line.lstrip())
                new_lines.append(' '*indent + 'await atualizarDataUltimaModificacaoPrecos();')
            new_lines.append(line)
        return '\n'.join(new_lines)
        
    content = re.sub(pattern, replacer, content)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated server.js')
