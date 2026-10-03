const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const files = [
    'admin.js',
    'assets/js/modules/admin_auditoria.js',
    'assets/js/modules/admin_auth_interceptor.js',
    'assets/js/modules/admin_auth_interceptor_v4.js',
    'assets/js/modules/admin_cotacoes.js',
    'assets/js/modules/admin_estrategicov3.js',
    'assets/js/modules/admin_fidc.js',
    'assets/js/modules/admin_planejamento.js',
    'assets/js/modules/admin_planejamento_v4.js',
    'server.js',
];

const allResults = {};

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const fileResult = {
        arraySafetyIssues: [],   // forEach without Array.isArray
        silentCatches: [],       // empty/silent catch blocks
        duplicateFns: [],        // duplicate window.* definitions
    };

    // 1. Array safety issues - find all const X = await Y.json() followed by X.forEach
    lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) return;

        // Pattern: const VAR = await EXPR.json()
        const jsonAssign = t.match(/const\s+(\w+)\s*=\s*await\s+.+\.json\(\)/);
        if (jsonAssign) {
            const varName = jsonAssign[1];
            const next20 = lines.slice(i+1, i+25).join('\n');
            const hasForEach = new RegExp(`\\b${varName}\\b.*\\.forEach\\(`).test(next20);
            const hasMap = new RegExp(`\\b${varName}\\b.*\\.map\\(`).test(next20);
            const hasFilter = new RegExp(`\\b${varName}\\b.*\\.filter\\(`).test(next20);
            const hasSlice = new RegExp(`\\b${varName}\\b.*\\.slice\\(`).test(next20);
            const hasLength = new RegExp(`\\b${varName}\\b\\.length`).test(next20);
            const hasGuard = new RegExp(`Array\\.isArray\\(${varName}\\)`).test(next20) || 
                             new RegExp(`Array\\.isArray\\(${varName}\\)`).test(lines.slice(Math.max(0,i-3), i+1).join('\n'));

            if ((hasForEach || hasMap || hasFilter || hasSlice || hasLength) && !hasGuard) {
                const methods = [hasForEach && 'forEach', hasMap && 'map', hasFilter && 'filter', hasSlice && 'slice', hasLength && '.length'].filter(Boolean);
                fileResult.arraySafetyIssues.push({
                    line: i + 1,
                    varName,
                    methods,
                    code: t
                });
            }
        }
    });

    // 2. Silent catch blocks
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (/\}\s*catch\s*\(/.test(t) || /catch\s*\(\w+\)\s*\{/.test(t)) {
            // Look at the catch body (next 5 lines)
            const bodyLines = lines.slice(i + 1, i + 6).map(l => l.trim()).filter(l => l && !l.startsWith('//'));
            const hasLog = bodyLines.some(l => /console\.(error|warn|log)|_apexNotify|throw|return\s+/.test(l));
            const isEmpty = bodyLines.every(l => l === '}' || l === '' || l.startsWith('//'));
            
            if (!hasLog || isEmpty) {
                const context = lines.slice(Math.max(0, i-2), i+7).map((l, idx) => `  ${i-1+idx}: ${l}`).join('\n');
                fileResult.silentCatches.push({ line: i + 1, context: context.substring(0, 300) });
            }
        }
    }

    // 3. Duplicate window.* definitions
    const windowDefs = {};
    lines.forEach((line, i) => {
        const m = line.match(/window\.(\w+)\s*=\s*(?:async\s+)?function/);
        if (m) {
            const name = m[1];
            if (windowDefs[name] !== undefined) {
                fileResult.duplicateFns.push({
                    name,
                    firstLine: windowDefs[name],
                    secondLine: i + 1
                });
            } else {
                windowDefs[name] = i + 1;
            }
        }
    });

    allResults[file] = fileResult;
}

// ── OUTPUT REPORT ──────────────────────────────────────────────────────────────
let totalArrayIssues = 0, totalSilentCatches = 0, totalDuplicates = 0;

for (const [file, r] of Object.entries(allResults)) {
    const hasIssues = r.arraySafetyIssues.length > 0 || r.silentCatches.length > 0 || r.duplicateFns.length > 0;
    if (!hasIssues) {
        process.stdout.write(`✅ ${file}\n`);
        continue;
    }

    process.stdout.write(`\n📄 ${file}\n`);

    if (r.arraySafetyIssues.length > 0) {
        totalArrayIssues += r.arraySafetyIssues.length;
        process.stdout.write(`  [Array Safety — ${r.arraySafetyIssues.length} issues]\n`);
        r.arraySafetyIssues.forEach(iss => {
            process.stdout.write(`    L${iss.line}: '${iss.varName}' → uses [${iss.methods.join(', ')}] without Array.isArray guard\n`);
        });
    }

    if (r.duplicateFns.length > 0) {
        totalDuplicates += r.duplicateFns.length;
        process.stdout.write(`  [Duplicates — ${r.duplicateFns.length} issues]\n`);
        r.duplicateFns.forEach(d => {
            process.stdout.write(`    window.${d.name} — L${d.firstLine} (first) overridden at L${d.secondLine}\n`);
        });
    }

    if (r.silentCatches.length > 0) {
        totalSilentCatches += r.silentCatches.length;
        process.stdout.write(`  [Silent Catches — ${r.silentCatches.length} issues]\n`);
        r.silentCatches.slice(0, 5).forEach(s => {
            process.stdout.write(`    L${s.line}: catch block with no error log/throw\n`);
        });
        if (r.silentCatches.length > 5) {
            process.stdout.write(`    ... and ${r.silentCatches.length - 5} more silent catches\n`);
        }
    }
}

process.stdout.write(`\n${'='.repeat(60)}\n`);
process.stdout.write(`SUMMARY:\n`);
process.stdout.write(`  Array Safety issues: ${totalArrayIssues}\n`);
process.stdout.write(`  Silent catch blocks: ${totalSilentCatches}\n`);
process.stdout.write(`  Duplicate window.* fns: ${totalDuplicates}\n`);
process.stdout.write(`  TOTAL: ${totalArrayIssues + totalSilentCatches + totalDuplicates}\n`);
