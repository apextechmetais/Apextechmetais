const fs = require('fs');

function findParenImbalance(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let parens = 0;
    let inString = false, strChar = '', inLineComment = false, inComment = false;
    let lineNum = 1;
    let i = 0;
    const openParenStack = []; // tracks line numbers of unclosed (
    
    while (i < content.length) {
        const c = content[i];
        const prev = i > 0 ? content[i - 1] : '';
        
        if (c === '\n') lineNum++;
        
        if (inLineComment) {
            if (c === '\n') inLineComment = false;
            i++; continue;
        }
        if (inComment) {
            if (c === '/' && prev === '*') inComment = false;
            i++; continue;
        }
        if (inString) {
            if (c === strChar && prev !== '\\') inString = false;
            i++; continue;
        }
        if (c === '/' && content[i+1] === '/') { inLineComment = true; i++; continue; }
        if (c === '/' && content[i+1] === '*') { inComment = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = true; strChar = c; i++; continue; }
        
        if (c === '(') {
            openParenStack.push(lineNum);
            parens++;
        } else if (c === ')') {
            parens--;
            if (openParenStack.length > 0) openParenStack.pop();
            if (parens < 0) {
                console.log(`  Extra ) at line ${lineNum}: ${lines[lineNum-1].trim().substring(0, 80)}`);
                parens = 0;
            }
        }
        i++;
    }
    
    if (parens !== 0) {
        console.log(`  Final balance: ${parens} unclosed '('`);
        // Show last few unclosed
        const lastUnclosed = openParenStack.slice(-5);
        lastUnclosed.forEach(ln => {
            console.log(`  Unclosed ( near line ${ln}: ${lines[ln-1].trim().substring(0, 80)}`);
        });
    } else {
        console.log(`  Parens balanced OK`);
    }
}

console.log('\n=== admin.js ===');
findParenImbalance('admin.js');

console.log('\n=== admin_auditoria.js ===');
findParenImbalance('assets/js/modules/admin_auditoria.js');
