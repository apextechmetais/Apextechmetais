// ─── CALCULADORA FIDC ────────────────────────────────────────────────────────
    // Cache de precos para o painel
    let fidcPrecosCache = [];

    // Chamado ao abrir o desmonte e ao alterar componentes
    window.recalcularFIDC = async function() {
        const fidcTbody = document.getElementById('fidc-tbody');
        if (!fidcTbody) return;

        // Buscar tabela de precos se cache vazio
        if (fidcPrecosCache.length === 0) {
            try {
                const pr = await fetch('/api/tabela-precos', { cache: 'no-store' });
                fidcPrecosCache = await pr.json();
            } catch(e) { fidcPrecosCache = []; }
        }

        const margem     = parseFloat(document.getElementById('fidc-margem')?.value || 100) / 100;
        const difBonus   = parseFloat(document.getElementById('fidc-dificuldade')?.value || 0) / 100;
        const margemTot  = margem + difBonus;

        if (componentesActivos.length === 0) {
            fidcTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:15px;color:#666;">Adicione componentes para calcular</td></tr>';
            setFidcTotals(0, margemTot);
            return;
        }

        let valorBruto = 0;
        let semPreco   = false;
        fidcTbody.innerHTML = '';

        for (const c of componentesActivos) {
            const mat   = localMateriais.find(m => m.id === c.material_id);
            const preco = fidcPrecosCache.find(p => p.material_id === c.material_id);
            const pct   = c.percentual;
            const precoEntregar = preco ? parseFloat(preco.preco_entregar) : null;

            const valorComp = precoEntregar !== null ? (pct / 100) * precoEntregar : null;
            if (valorComp !== null) valorBruto += valorComp;
            if (precoEntregar === null) semPreco = true;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #222';
            tr.innerHTML = `
                <td style="padding:8px 10px;">${mat ? mat.nome : 'Desconhecido'}</td>
                <td style="padding:8px 10px;text-align:right;">${fmtBRL(pct)}%</td>
                <td style="padding:8px 10px;text-align:right;color:${precoEntregar!==null?'#2AD07A':'#f0b800'}">
                    ${precoEntregar!==null ? 'R$ ' + fmtBRL(precoEntregar) : '<i class="fa-solid fa-triangle-exclamation"></i> Sem preco'}
                </td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;color:#fff;">
                    ${valorComp!==null ? 'R$ ' + valorComp.toFixed(4) : '---'}
                </td>
                <td style="padding:8px 10px;text-align:center;">
                    ${precoEntregar!==null
                        ? '<span style="color:#2AD07A;font-size:0.75rem;"><i class="fa-solid fa-check-circle"></i> OK</span>'
                        : '<span style="color:#f0b800;font-size:0.75rem;"><i class="fa-solid fa-circle-exclamation"></i> Sem tabela</span>'}
                </td>`;
            fidcTbody.appendChild(tr);
        }

        const avisoEl = document.getElementById('fidc-aviso-sem-preco');
        if (avisoEl) avisoEl.style.display = semPreco ? 'block' : 'none';
        setFidcTotals(valorBruto, margemTot);
    };

    function setFidcTotals(valorBruto, margemTot) {
        const precoSugEntregar = valorBruto / (1 + margemTot);
        const descLogistica = parseFloat(document.getElementById('fidc-logistica')?.value || 4) / 100;
        const precoSugColetar  = precoSugEntregar * (1 - descLogistica);
        const margemPct        = Math.round(margemTot * 100);

        const fmt = (v) => 'R$ ' + fmtBRL(v);
        const el  = (id) => document.getElementById(id);

        if (el('fidc-valor-bruto'))              el('fidc-valor-bruto').innerHTML              = fmt(valorBruto) + '<span style="font-size:0.7rem;color:#777;">/kg</span>';
        if (el('fidc-margem-display'))            el('fidc-margem-display').textContent          = margemPct + '%';
        if (el('fidc-preco-sugerido-entregar'))   el('fidc-preco-sugerido-entregar').innerHTML  = fmt(precoSugEntregar) + '<span style="font-size:0.7rem;color:#777;">/kg</span>';
        if (el('fidc-preco-sugerido-coletar'))    el('fidc-preco-sugerido-coletar').innerHTML   = fmt(precoSugColetar)  + '<span style="font-size:0.7rem;color:#777;">/kg</span>';
    }

    