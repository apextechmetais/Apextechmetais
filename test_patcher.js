/**
 * Auto-patcher: adds Array.isArray guard to all identified unsafe .json() assignments.
 * Run once, applies all fixes, prints diff summary.
 */

const fs = require('fs');

// ── PATCHES ──────────────────────────────────────────────────────────────────
// Format: { file, search, replace }
// Each patch wraps the const assignment with an Array.isArray guard

const patches = [

    // ── admin.js ──────────────────────────────────────────────────────────────

    // L304: mesesDisponiveis
    {
        file: 'admin.js',
        search: `                    const mesesDisponiveis = await resMeses.json();`,
        replace: `                    const mesesDisponiveis = Array.isArray(await resMeses.json()) ? await (await fetch('/api/lme/meses')).json() : [];`
    },

    // L1892: items (galeria)
    {
        file: 'admin.js',
        search: `            const items = await res.json();\n\n            if (!items.length) {\n                grid.innerHTML = '<p style="color:#555;grid-column:1/-1;padding:30px;text-align:center;"><i class="fa-solid fa-image" style="font-size:2rem;display:block;margin-bottom:10px;"></i>Nenhuma foto cadastrada. Adicione a primeira!</p>';\n                return;\n            }\n\n            grid.innerHTML = items.map(item =>`,
        replace: `            const _galeItemsRaw = await res.json();\n            const items = Array.isArray(_galeItemsRaw) ? _galeItemsRaw : [];\n\n            if (!items.length) {\n                grid.innerHTML = '<p style="color:#555;grid-column:1/-1;padding:30px;text-align:center;"><i class="fa-solid fa-image" style="font-size:2rem;display:block;margin-bottom:10px;"></i>Nenhuma foto cadastrada. Adicione a primeira!</p>';\n                return;\n            }\n\n            grid.innerHTML = items.map(item =>`
    },

    // L1938: mats (materiais)
    {
        file: 'admin.js',
        search: `                const res  = await fetch('/api/materiais');\n                const mats = await res.json();\n                listContainer.innerHTML = '';\n\n                if (!mats.length)`,
        replace: `                const res  = await fetch('/api/materiais');\n                const _matsRaw = await res.json();\n                const mats = Array.isArray(_matsRaw) ? _matsRaw : [];\n                listContainer.innerHTML = '';\n\n                if (!mats.length)`
    },

    // L4717: resultados (NCM search)
    {
        file: 'admin.js',
        search: `            const resultados = await res.json();`,
        replace: `            const _resRaw = await res.json();\n            const resultados = Array.isArray(_resRaw) ? _resRaw : (_resRaw?.resultados || []);`
    },

    // L6783: fotos
    {
        file: 'admin.js',
        search: `            const fotos = await fotosRes.json();`,
        replace: `            const _fotosRaw = await fotosRes.json();\n            const fotos = Array.isArray(_fotosRaw) ? _fotosRaw : [];`
    },

    // ── admin_estrategicov3.js ─────────────────────────────────────────────────

    // L1479: data (planos) - renderPlanejamentosAtivosV3
    {
        file: 'assets/js/modules/admin_estrategicov3.js',
        search: `            const res = await fetch('/api/estrategiav3_planos');\n            if(!res.ok) throw new Error('Falha ao buscar planos');\n            const data = await res.json();\n            if(!data.success) throw new Error(data.error);\n\n            if(!data.planos || data.planos.length === 0) {`,
        replace: `            const res = await fetch('/api/estrategiav3_planos');\n            if(!res.ok) throw new Error('Falha ao buscar planos');\n            const data = await res.json();\n            if(!data || !data.success) throw new Error((data && data.error) || 'Resposta inválida da API');\n\n            if(!data.planos || data.planos.length === 0) {`
    },

    // ── admin_planejamento.js ─────────────────────────────────────────────────

    // L5061: planejamentos.forEach
    {
        file: 'assets/js/modules/admin_planejamento.js',
        search: `                const planejamentos = await res.json();\n                planejamentos.forEach`,
        replace: `                const _planRaw5061 = await res.json();\n                const planejamentos = Array.isArray(_planRaw5061) ? _planRaw5061 : [];\n                planejamentos.forEach`
    },

    // L5591: data.slice
    {
        file: 'assets/js/modules/admin_planejamento.js',
        search: `                const data = await res.json();\n                const last = data.slice(-12);`,
        replace: `                const _dataRaw5591 = await res.json();\n                const data = Array.isArray(_dataRaw5591) ? _dataRaw5591 : [];\n                const last = data.slice(-12);`
    },

    // ── admin_planejamento_v4.js ─────────────────────────────────────────────

    // L5061: planejamentos.forEach (same as v4 mirror)
    {
        file: 'assets/js/modules/admin_planejamento_v4.js',
        search: `                const planejamentos = await res.json();\n                planejamentos.forEach`,
        replace: `                const _planRaw5061 = await res.json();\n                const planejamentos = Array.isArray(_planRaw5061) ? _planRaw5061 : [];\n                planejamentos.forEach`
    },

    // L5591: data.slice (same as v4 mirror)
    {
        file: 'assets/js/modules/admin_planejamento_v4.js',
        search: `                const data = await res.json();\n                const last = data.slice(-12);`,
        replace: `                const _dataRaw5591 = await res.json();\n                const data = Array.isArray(_dataRaw5591) ? _dataRaw5591 : [];\n                const last = data.slice(-12);`
    },
];

// Remaining L2039,L2145,L2275,L2434 are all "items" in solucoes/noticias/etc.
// They share a common pattern - collect them here
const itemsPatches = [
    { file: 'admin.js', api: '/api/solucoes' },
    { file: 'admin.js', api: '/api/noticias' },
    { file: 'admin.js', api: '/api/clientes' },
];
// These use a generic approach
const genericItemsSearch = (api) => `                const res   = await fetch('${api}');\n                const items = await res.json();`;
const genericItemsReplace = (api) => `                const res   = await fetch('${api}');\n                const _itemsRaw = await res.json();\n                const items = Array.isArray(_itemsRaw) ? _itemsRaw : [];`;

itemsPatches.forEach(p => {
    patches.push({
        file: p.file,
        search: genericItemsSearch(p.api),
        replace: genericItemsReplace(p.api)
    });
});

// ── APPLY PATCHES ────────────────────────────────────────────────────────────
let applied = 0, failed = 0;

for (const patch of patches) {
    const content = fs.readFileSync(patch.file, 'utf8');
    if (content.includes(patch.search)) {
        const newContent = content.replace(patch.search, patch.replace);
        fs.writeFileSync(patch.file, newContent, 'utf8');
        console.log(`✅ Patched: ${patch.file} — "${patch.search.substring(0, 60).replace(/\n/g, '↵')}..."`);
        applied++;
    } else {
        console.log(`⚠️  NOT FOUND: ${patch.file} — "${patch.search.substring(0, 60).replace(/\n/g, '↵')}..."`);
        failed++;
    }
}

console.log(`\nDone: ${applied} applied, ${failed} not found.`);
