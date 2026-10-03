const fs = require('fs');
const path = require('path');

const ADMIN_PATH = path.join(__dirname, '../admin.js');
const MODULES_DIR = path.join(__dirname, '../assets/js/modules');

let content = fs.readFileSync(ADMIN_PATH, 'utf8');

// The strategy: we search for explicit comment boundaries to extract entire standalone blocks.

const extractions = [
    {
        name: 'admin_cotacoes.js',
        startMarker: '// ─── COTAÇÕES AO VIVO DÓLAR & LME (USD / BRL) ─────────────────────────────',
        endMarker: '// ─── MOTOR DE NOTIFICAÇÕES DO SININHO (DIRETORIA / ADM) ─────────────────────'
    },
    {
        name: 'admin_fidc.js',
        startMarker: '// ─── CALCULADORA FIDC ────────────────────────────────────────────────────────',
        endMarker: '// ─── TRILHA DE AUDITORIA ─────────────────────────────────────────────────────'
    },
    {
        name: 'admin_estrategicov3.js',
        startMarker: '// ─── MÓDULO DE PLANEJAMENTO ESTRATÉGICO V3 (TESTE META FATURAMENTO -> INSUMO) ─────────',
        endMarker: null
    },
    {
        name: 'admin_auditoria.js',
        startMarker: '// ─── TRILHA DE AUDITORIA ─────────────────────────────────────────────────────',
        endMarker: '// ─── PRÉVIA VISUAL DO LAUDO ─────────────────────────────────────────────────'
    },
    {
        name: 'admin_planejamento.js',
        startMarker: '// ─── 5. PLANEJAMENTO MENSAL DE FORNECEDORES & MOTOR PREDITIVO DE CENÁRIOS ───',
        endMarker: '// MODULE_EXTRACTED: // ─── MÓDULO DE PLANEJAMENTO ESTRATÉGICO V3 (TESTE META FATURAMENTO -> INSUMO) ─────────'
    }
];

function extractSection(startMarker, endMarker) {
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
        console.log('Start marker not found: ' + startMarker);
        return null;
    }

    let endIndex = -1;
    if (endMarker) {
        endIndex = content.indexOf(endMarker, startIndex);
    } else {
        // Find the end of the file
        endIndex = content.length;
    }

    if (endIndex === -1) {
        console.log('End marker not found: ' + endMarker);
        return null;
    }

    // Extract
    const section = content.substring(startIndex, endIndex);
    
    // Replace with a loader comment
    content = content.substring(0, startIndex) + '\n// MODULE_EXTRACTED: ' + startMarker + '\n\n' + content.substring(endIndex);
    
    return section;
}

for (let ext of extractions) {
    const sec = extractSection(ext.startMarker, ext.endMarker);
    if (sec) {
        // As long as the modules don't rely on being inside the exact same IIFE instance, 
        // they can be just scripts. Wait! admin_estrategicov3.js needs access to `window.fmtBRL` 
        // which is attached to window, so it's globally available.
        // What about internal `let` declarations? It should be fine.
        fs.writeFileSync(path.join(MODULES_DIR, ext.name), sec);
        console.log('Extracted: ' + ext.name);
    }
}

fs.writeFileSync(ADMIN_PATH, content);
console.log('Refactoring complete.');
