// ─── MÓDULO DE PLANEJAMENTO ESTRATÉGICO V3 (TESTE META FATURAMENTO -> INSUMO) ─────────
(function() {
    let _listMetasV3 = [];
    let _chartEstrategicoV3 = null;
    let _mesV3Ativo = null; // null = visão de 12 meses
    let _mixSimulacaoV3 = []; // Mix de produtos para simulação: [{ material_id, fracaoPct }]
    let _listTabelaPrecosEstrategica = [];
    window._listTabelaPrecosEstrategica = _listTabelaPrecosEstrategica;

    window.carregarPlanejamentoEstrategicov3 = async function() {
        try {
            console.log("[Estrategico] Buscando tabelas de preços...");
            
            const endpoints = [
                '/api/tabela-precos',
                '/api/tabela-precos-residuos',
                '/api/tabela-precos-ligas',
                '/api/tabela-precos-volume',
                '/api/tabela-precos-fundicao'
            ];
            
            let todosMateriais = [];
            
            for (const ep of endpoints) {
                try {
                    const res = await fetch(ep, { cache: 'no-store' });
                    const raw = await res.json();
                    if (Array.isArray(raw)) {
                        todosMateriais = todosMateriais.concat(raw);
                    }
                } catch (err) {
                    console.warn(`[Estrategico] Falha ao buscar ${ep}:`, err);
                }
            }
            
            _listTabelaPrecosEstrategica = todosMateriais;
            window._listTabelaPrecosEstrategica = _listTabelaPrecosEstrategica;
            console.log("[Estrategico] Total de materiais carregados:", _listTabelaPrecosEstrategica.length);
            
            // Popula os selects de material (Consulta Rápida + Simulador)
            if (window.popularSelectsProdutoEstrategicov3) window.popularSelectsProdutoEstrategicov3();

            // Renderiza o Dashboard de Margens (gráficos de top/worst)
            window.renderDashboardVisuaisEstrategicoV3();

            // Carrega os Planos Ativos
            if (window.renderPlanejamentosAtivosV3) window.renderPlanejamentosAtivosV3();
        } catch (e) {
            console.error('Erro ao carregar planejamento V3:', e);
            _apexNotify('Erro', 'Não foi possível carregar os dados estratégicos V3.', 'error');
        }
    };

    window.renderDashboardVisuaisEstrategicoV3 = function() {
        if (!_listTabelaPrecosEstrategica || _listTabelaPrecosEstrategica.length === 0) return;

        let totalMargem = 0;
        let produtosValidos = 0;
        
        const dadosGrafico = _listTabelaPrecosEstrategica.map(tp => {
            const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const pCompra = parseFloat(tp.preco_entregar || tp.preco_compra || tp.preco_compra_coletar || 0);
            let margem = 0;
            if (pVenda > 0) {
                margem = ((pVenda - pCompra) / pVenda) * 100;
                totalMargem += margem;
                produtosValidos++;
            }
            return {
                nome: tp.material_nome || 'Produto ' + tp.material_id,
                margem: margem,
                pVenda: pVenda,
                pCompra: pCompra
            };
        }).filter(p => p.pVenda > 0);

        dadosGrafico.sort((a, b) => b.margem - a.margem);

        const margemMedia = produtosValidos > 0 ? (totalMargem / produtosValidos) : 0;
        document.getElementById('dash-margem-media').textContent = margemMedia.toFixed(1) + '%';
        document.getElementById('dash-margem-total-produtos').textContent = dadosGrafico.length;

        if (dadosGrafico.length > 0) {
            const melhor = dadosGrafico[0];
            document.getElementById('dash-margem-maior-val').textContent = melhor.margem.toFixed(1) + '%';
            document.getElementById('dash-margem-maior-nome').textContent = melhor.nome;
            
            const pior = dadosGrafico[dadosGrafico.length - 1];
            document.getElementById('dash-margem-menor-val').textContent = pior.margem.toFixed(1) + '%';
            document.getElementById('dash-margem-menor-nome').textContent = pior.nome;
        }

        const top10 = dadosGrafico.slice(0, 10);
        const worst10 = [...dadosGrafico].reverse().slice(0, 10);

        renderChartMargem('chart-margin-top10', top10, '#2AD07A', 'Maiores Margens Brutas (%)');
        renderChartMargem('chart-margin-worst10', worst10, '#ff4d4d', 'Menores Margens Brutas (%)');
    };

    let chartMarginTop10Instance = null;
    let chartMarginWorst10Instance = null;

    function renderChartMargem(canvasId, dados, cor, labelStr) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const labels = dados.map(d => d.nome);
        const values = dados.map(d => parseFloat(d.margem.toFixed(1)));

        if (canvasId === 'chart-margin-top10' && chartMarginTop10Instance) chartMarginTop10Instance.destroy();
        if (canvasId === 'chart-margin-worst10' && chartMarginWorst10Instance) chartMarginWorst10Instance.destroy();

        const chartConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: labelStr,
                    data: values,
                    backgroundColor: cor,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#1a2e3f' },
                        ticks: { color: '#8eaabf', callback: function(value) { return value + '%' } } 
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#8eaabf', maxRotation: 45, minRotation: 45 } 
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) { return ctx.raw + '%'; }
                        }
                    }
                }
            }
        };

        if (canvasId === 'chart-margin-top10') chartMarginTop10Instance = new Chart(ctx, chartConfig);
        if (canvasId === 'chart-margin-worst10') chartMarginWorst10Instance = new Chart(ctx, chartConfig);
    }

    window.popularSelectsProdutoEstrategicov3 = function() {
        const selectProd = document.getElementById('plestv3-select-produto');
        const selectConsulta = document.getElementById('plestv3-consulta-material');
        const selectModal = document.getElementById('metaestv3-material-id');

        const currentValProd = selectProd ? selectProd.value : '';
        const currentValConsulta = selectConsulta ? selectConsulta.value : '';
        const currentValModal = selectModal ? selectModal.value : '';

        if (selectProd) selectProd.innerHTML = '<option value="">-- Selecione um Produto --</option>';
        if (selectConsulta) selectConsulta.innerHTML = '<option value="">-- Selecione um Material --</option>';
        if (selectModal) selectModal.innerHTML = '<option value="">-- Selecione um Produto --</option>';

        _listTabelaPrecosEstrategica.forEach(tp => {
            const label = tp.material_nome + ' (' + tp.material_categoria + ')';
            if (selectProd) {
                const opt = document.createElement('option');
                opt.value = tp.material_id;
                opt.textContent = label;
                selectProd.appendChild(opt);
            }
            if (selectConsulta) {
                const opt = document.createElement('option');
                opt.value = tp.material_id;
                opt.textContent = label;
                selectConsulta.appendChild(opt);
            }
            if (selectModal) {
                const opt = document.createElement('option');
                opt.value = tp.material_id;
                opt.textContent = label;
                selectModal.appendChild(opt);
            }
        });

        if (selectProd && currentValProd) selectProd.value = currentValProd;
        if (selectConsulta && currentValConsulta) selectConsulta.value = currentValConsulta;
        if (selectModal && currentValModal) selectModal.value = currentValModal;
    }

    window.onChangeConsultaMaterialV3 = function() {
        const selectConsulta = document.getElementById('plestv3-consulta-material');
        const tbody = document.getElementById('plestv3-consulta-tbody');
        if (!selectConsulta || !tbody) return;

        const matId = parseInt(selectConsulta.value);
        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);

        if (!tp) {
            tbody.innerHTML = `
                <tr id="plestv3-consulta-row" style="background:#101a24; color:#fff;">
                    <td colspan="14" style="text-align:center; padding:12px; color:#aaa;">Selecione um material no seletor acima para ver as taxas e margens.</td>
                </tr>
            `;
            return;
        }

        const comissao = parseFloat(tp.comissao || 0);
        const pisCofins = parseFloat(tp.pis_cofins || 0);
        const fidc = parseFloat(tp.fidc || 0);
        const icms = parseFloat(tp.icms || 0);
        const freteColeta = parseFloat(tp.frete_coleta || 0);

        const totalDedPct = comissao + pisCofins + fidc + icms;
        const valDeducoes = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) * (totalDedPct / 100);
        const vendaLiquida = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) - valDeducoes;

        const lucroEnt = vendaLiquida - (parseFloat(tp.preco_entregar || tp.preco_compra || 0));
        const margemEnt = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroEnt / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

        const lucroCol = vendaLiquida - (parseFloat(tp.preco_coletar || tp.preco_compra || 0)) - freteColeta;
        const margemCol = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroCol / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

        tbody.innerHTML = `
            <tr style="background:#101a24; color:#fff;">
                <td style="padding:10px; font-weight:bold; color:#00e5ff;">R$ ${window.fmtBRL(tp.preco_entregar)}</td>
                <td style="padding:10px; font-weight:bold; color:#ffb74d;">R$ ${window.fmtBRL(tp.preco_coletar)}</td>
                <td style="padding:10px; font-weight:bold; color:#ffeb3b;">R$ ${window.fmtBRL(tp.preco_venda || tp.venda_ref)}</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(comissao)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(pisCofins)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(fidc)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(icms)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">R$ ${window.fmtBRL(freteColeta)}</td>
                <td style="padding:10px; font-weight:bold; color:#4fc3f7;">R$ ${window.fmtBRL(vendaLiquida)}</td>
                <td style="padding:10px; color:${lucroEnt >= 0 ? '#2AD07A' : '#ff4d4d'};">R$ ${window.fmtBRL(lucroEnt)}</td>
                <td style="padding:10px; font-weight:bold; color:${margemEnt >= 0 ? '#2AD07A' : '#ff4d4d'};">${(margemEnt).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                <td style="padding:10px; color:${lucroCol >= 0 ? '#3e7cb1' : '#ff4d4d'};">R$ ${window.fmtBRL(lucroCol)}</td>
                <td style="padding:10px; font-weight:bold; color:${margemCol >= 0 ? '#3e7cb1' : '#ff4d4d'};">${(margemCol).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                <td style="padding:10px; font-weight:bold;">${tp.material_ncm || '-'}</td>
            </tr>
        `;
    };

    window.adicionarMaterialSimulacaoV3 = function() {
        const selectConsulta = document.getElementById('plestv3-consulta-material');
        if (!selectConsulta) return;
        const matId = parseInt(selectConsulta.value);
        if (!matId) {
            _apexNotify('Aviso', 'Selecione um material primeiro no seletor de consulta.', 'warning');
            return;
        }

        let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (!tp) {
            const materialNome = document.querySelector(`#plestv3-consulta-material option[value="${matId}"]`)?.textContent || 'Produto sem preço';
            tp = { material_id: matId, material_nome: materialNome, preco_venda: 0, preco_compra: 0 };
        }

        if (_mixSimulacaoV3.some(x => x.material_id === matId)) {
            _apexNotify('Aviso', 'Este produto já está incluído no mix de simulação.', 'warning');
            return;
        }

        // Adiciona com fração padrão dividindo igualmente
        const count = _mixSimulacaoV3.length + 1;
        const defaultFracao = parseFloat((100 / count).toFixed(1));
        _mixSimulacaoV3.push({ material_id: matId, fracaoPct: defaultFracao });

        // Redistribui se for o caso
        let sum = _mixSimulacaoV3.reduce((acc, x) => acc + x.fracaoPct, 0);
        if (Math.abs(sum - 100) > 2) {
            _mixSimulacaoV3.forEach(x => { x.fracaoPct = parseFloat((100 / count).toFixed(1)); });
        }

        window.recalcularSimulacaoV3();
    };

    window.removerMaterialSimulacaoV3 = function(matId) {
        _mixSimulacaoV3 = _mixSimulacaoV3.filter(x => x.material_id !== matId);
        window.recalcularSimulacaoV3();
    };

    window.onChangeFracaoSimulacaoV3 = function(matId, val) {
        const parsed = parseFloat(val) || 0;
        const item = _mixSimulacaoV3.find(x => x.material_id === matId);
        if (item) {
            item.fracaoPct = parsed;
        }

        // Recalcular totais sem travar para dar flexibilidade ao usuário
        let sum = _mixSimulacaoV3.reduce((acc, x) => acc + x.fracaoPct, 0);
        const lblPct = document.getElementById('plestv3-mix-total-pct');
        if (lblPct) {
            lblPct.textContent = `${sum.toFixed(1)}%`;
            lblPct.style.color = Math.abs(sum - 100) < 0.1 ? '#2AD07A' : '#ff4d4d';
        }

        // Recalcula volumes e totais
        window.recalcularSimulacaoV3(false);
    };

    window.recalcularSimulacaoV3 = function(redesenharTabela = true) {
        const inputFat = document.getElementById('plestv3-sim-meta-faturamento');
        const selectFrente = document.getElementById('plestv3-sim-frente');
        const mixTbody = document.getElementById('plestv3-mix-tbody');
        const rankingTbody = document.getElementById('plestv3-ranking-tbody');

        if (!inputFat || !selectFrente || !mixTbody || !rankingTbody) return;

        let valLimpo = inputFat.value.replace(/\./g, '').replace(',', '.');
        const fatTotalAlvo = parseFloat(valLimpo) || 0;
        const frente = selectFrente.value; // 'venda' ou 'compra'

        // 1. Renderizar o ranking de melhores margens
        const listPrecosSorted = [..._listTabelaPrecosEstrategica].map(tp => {
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);
            const totalDedPct = comissao + pisCofins + fidc + icms;
            const valDeducoes = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) * (totalDedPct / 100);
            const vendaLiquida = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) - valDeducoes;

            const lucroEnt = vendaLiquida - (parseFloat(tp.preco_entregar || tp.preco_compra || 0));
            const margemEnt = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroEnt / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

            const lucroCol = vendaLiquida - (parseFloat(tp.preco_coletar || tp.preco_compra || 0)) - freteColeta;
            const margemCol = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroCol / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

            return {
                nome: tp.material_nome,
                margemEnt,
                margemCol
            };
        }).sort((a, b) => Math.max(b.margemEnt, b.margemCol) - Math.max(a.margemEnt, a.margemCol));

        rankingTbody.innerHTML = listPrecosSorted.slice(0, 10).map((x, idx) => `
            <tr style="border-bottom:1px solid #1a2e3f;">
                <td style="padding:6px 4px; color:#fff;"><strong>#${idx+1}</strong> ${x.nome}</td>
                <td style="padding:6px 4px; text-align:right; color:#2AD07A; font-weight:bold;">${x.margemEnt.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                <td style="padding:6px 4px; text-align:right; color:#3e7cb1; font-weight:bold;">${x.margemCol.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
            </tr>
        `).join('');

        // 2. Renderizar e Calcular Mix de Simulação
        if (redesenharTabela) {
            mixTbody.innerHTML = '';
        }

        let totalKgCalculado = 0;
        let totalPctAlocado = 0;
        let totalInvestimentoNecessario = 0;

        _mixSimulacaoV3.forEach((mixItem) => {
            let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === mixItem.material_id);
            if (!tp) {
                const materialNome = document.querySelector(`#plestv3-consulta-material option[value="${mixItem.material_id}"]`)?.textContent || 'Produto Indefinido';
                tp = { material_id: mixItem.material_id, material_nome: materialNome, preco_venda: 0, preco_compra: 0 };
            }

            const faturamentoAlvoProduto = fatTotalAlvo * (mixItem.fracaoPct / 100);

            // Preço de venda (referência para calcular volume)
            const pRef = frente === 'venda'
                ? parseFloat(tp.preco_venda || tp.venda_ref || 0)
                : parseFloat(tp.preco_entregar || tp.preco_compra || 0);

            // Preço de compra (quanto investe para adquirir o material)
            const pCompra = frente === 'venda'
                ? parseFloat(tp.preco_entregar || tp.preco_compra || 0)
                : parseFloat(tp.preco_coletar || tp.preco_compra || 0);

            // Volume necessário em kg (baseado no preço de venda)
            const volumeKg = pRef > 0 ? (faturamentoAlvoProduto / pRef) : 0;

            // Investimento necessário para comprar essa quantidade
            const investimentoProduto = volumeKg * pCompra;

            totalKgCalculado += volumeKg;
            totalPctAlocado += mixItem.fracaoPct;
            totalInvestimentoNecessario += investimentoProduto;

            if (redesenharTabela) {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #223547';
                tr.innerHTML = `
                    <td style="padding:6px 4px; color:#fff;"><strong>${tp.material_nome}</strong></td>
                    <td style="padding:6px 4px; text-align:center;">
                        <input type="number" class="noble-input" value="${mixItem.fracaoPct}" style="width:70px; text-align:center; padding:3px; font-size:0.75rem; margin:0;" oninput="window.onChangeFracaoSimulacaoV3(${mixItem.material_id}, this.value)">
                    </td>
                    <td style="padding:6px 4px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${faturamentoAlvoProduto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding:6px 4px; text-align:right; color:#ccc;">R$ ${window.fmtBRL(pRef)}</td>
                    <td style="padding:6px 4px; text-align:right; font-weight:bold; color:#2AD07A;" id="plestv3-mix-kg-${mixItem.material_id}">
                        ${volumeKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})} kg
                    </td>
                    <td style="padding:6px 4px; text-align:right; color:#ffb74d;" id="plestv3-mix-pcompra-${mixItem.material_id}">R$ ${window.fmtBRL(pCompra)}</td>
                    <td style="padding:6px 4px; text-align:right; font-weight:bold; color:#ff9800;" id="plestv3-mix-invest-${mixItem.material_id}">
                        R$ ${investimentoProduto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td style="padding:6px 4px; text-align:center;">
                        <button onclick="window.removerMaterialSimulacaoV3(${mixItem.material_id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer;" title="Remover"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                mixTbody.appendChild(tr);
            } else {
                // Atualização dinâmica sem redesenhar toda a tabela
                const lblKg = document.getElementById(`plestv3-mix-kg-${mixItem.material_id}`);
                if (lblKg) lblKg.textContent = `${volumeKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})} kg`;
                const lblInvest = document.getElementById(`plestv3-mix-invest-${mixItem.material_id}`);
                if (lblInvest) lblInvest.textContent = `R$ ${investimentoProduto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            }
        });

        if (_mixSimulacaoV3.length === 0) {
            mixTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:15px; color:#aaa;">Nenhum produto adicionado ao mix. Selecione acima e clique em "Adicionar ao Mix".</td></tr>`;
        }

        // 3. Atualizar rodapés (tfoot com Totais e Médias), totais e indicadores estratégicos
        const lblPct    = document.getElementById('plestv3-mix-total-pct');
        const lblKg     = document.getElementById('plestv3-mix-total-kg');
        const lblInvest = document.getElementById('plestv3-mix-total-investimento');
        const lblFeed   = document.getElementById('plestv3-mix-feedback');

        const countItems = _mixSimulacaoV3.length || 1;
        let totalVendaLiquidaCalculada = 0;

        _mixSimulacaoV3.forEach((mixItem) => {
            let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === mixItem.material_id);
            if (!tp) tp = { preco_venda: 0, preco_compra: 0 };
            const faturamentoAlvoProduto = fatTotalAlvo * (mixItem.fracaoPct / 100);
            const pRef = frente === 'venda'
                ? parseFloat(tp.preco_venda || tp.venda_ref || 0)
                : parseFloat(tp.preco_entregar || tp.preco_compra || 0);
            const volumeKg = pRef > 0 ? (faturamentoAlvoProduto / pRef) : 0;
            
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);
            const totalDedPct = comissao + pisCofins + fidc + icms;
            const valDeducoesUnit = pRef * (totalDedPct / 100);
            const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);
            
            totalVendaLiquidaCalculada += (volumeKg * vendaLiquidaUnit);
        });

        const pVendaMedioPonderado = totalKgCalculado > 0 ? (fatTotalAlvo / totalKgCalculado) : 0;
        const pCompraMedioPonderado = totalKgCalculado > 0 ? (totalInvestimentoNecessario / totalKgCalculado) : 0;

        const medFracaoPct = totalPctAlocado / countItems;
        const medFatAlvo = fatTotalAlvo / countItems;
        const medVolKg = totalKgCalculado / countItems;
        const medInvestimento = totalInvestimentoNecessario / countItems;

        const lucroBruto = fatTotalAlvo - totalInvestimentoNecessario;
        const margemBrutaPct = fatTotalAlvo > 0 ? (lucroBruto / fatTotalAlvo) * 100 : 0;

        const lucroLiquido = totalVendaLiquidaCalculada - totalInvestimentoNecessario;
        const margemLiquidaPct = fatTotalAlvo > 0 ? (lucroLiquido / fatTotalAlvo) * 100 : 0;

        const taxaVendaLiquida = fatTotalAlvo > 0 ? (totalVendaLiquidaCalculada / fatTotalAlvo) : 1;
        const pontoEquilibrioFat = taxaVendaLiquida > 0 ? (totalInvestimentoNecessario / taxaVendaLiquida) : totalInvestimentoNecessario;
        const pontoEquilibrioKg = pVendaMedioPonderado > 0 ? (pontoEquilibrioFat / pVendaMedioPonderado) : 0;

        if (lblPct) {
            lblPct.textContent = `${totalPctAlocado.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;
            lblPct.style.color = Math.abs(totalPctAlocado - 100) < 0.1 ? '#2AD07A' : '#ff4d4d';
        }
        if (lblKg) {
            lblKg.textContent = `${totalKgCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})} kg`;
        }
        if (lblInvest) {
            lblInvest.textContent = `R$ ${totalInvestimentoNecessario.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        // Atualizar TFOOT - Linha de TOTAIS
        const ftTotPct = document.getElementById('plestv3-tfoot-tot-pct');
        const ftTotFat = document.getElementById('plestv3-tfoot-tot-fat');
        const ftTotPVenda = document.getElementById('plestv3-tfoot-tot-pvenda');
        const ftTotVol = document.getElementById('plestv3-tfoot-tot-vol');
        const ftTotPCompra = document.getElementById('plestv3-tfoot-tot-pcompra');
        const ftTotInvest = document.getElementById('plestv3-tfoot-tot-invest');

        if (ftTotPct) ftTotPct.textContent = `${totalPctAlocado.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
        if (ftTotFat) ftTotFat.textContent = `R$ ${fatTotalAlvo.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        if (ftTotPVenda) ftTotPVenda.textContent = '—';
        if (ftTotVol) ftTotVol.textContent = `${totalKgCalculado.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})} kg`;
        if (ftTotPCompra) ftTotPCompra.textContent = '—';
        if (ftTotInvest) ftTotInvest.textContent = `R$ ${totalInvestimentoNecessario.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // Atualizar TFOOT - Linha de MÉDIAS
        const ftMedPct = document.getElementById('plestv3-tfoot-med-pct');
        const ftMedFat = document.getElementById('plestv3-tfoot-med-fat');
        const ftMedPVenda = document.getElementById('plestv3-tfoot-med-pvenda');
        const ftMedVol = document.getElementById('plestv3-tfoot-med-vol');
        const ftMedPCompra = document.getElementById('plestv3-tfoot-med-pcompra');
        const ftMedInvest = document.getElementById('plestv3-tfoot-med-invest');

        if (ftMedPct) ftMedPct.textContent = `${medFracaoPct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
        if (ftMedFat) ftMedFat.textContent = `R$ ${medFatAlvo.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        if (ftMedPVenda) ftMedPVenda.textContent = `R$ ${window.fmtBRL(pVendaMedioPonderado)}`;
        if (ftMedVol) ftMedVol.textContent = `${medVolKg.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})} kg`;
        if (ftMedPCompra) ftMedPCompra.textContent = `R$ ${window.fmtBRL(pCompraMedioPonderado)}`;
        if (ftMedInvest) ftMedInvest.textContent = `R$ ${medInvestimento.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // Atualizar Card de Indicadores (Margem Bruta, Margem Líquida, Ponto de Equilíbrio)
        const indBruta = document.getElementById('plestv3-ind-margem-bruta');
        const indLiquida = document.getElementById('plestv3-ind-margem-liquida');
        const indEquilibrio = document.getElementById('plestv3-ind-ponto-equilibrio');

        if (indBruta) indBruta.textContent = `R$ ${lucroBruto.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} (${margemBrutaPct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%)`;
        if (indLiquida) indLiquida.textContent = `R$ ${lucroLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} (${margemLiquidaPct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%)`;
        if (indEquilibrio) indEquilibrio.textContent = `R$ ${pontoEquilibrioFat.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} (${pontoEquilibrioKg.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})} kg)`;

        // Feedback visual de alocação
        if (lblFeed && _mixSimulacaoV3.length > 0) {
            lblFeed.style.display = 'block';
            const diff = totalPctAlocado - 100;
            if (Math.abs(diff) < 0.1) {
                lblFeed.style.background = 'rgba(42, 208, 122, 0.12)';
                lblFeed.style.border = '1px solid rgba(42, 208, 122, 0.4)';
                lblFeed.style.color = '#2AD07A';
                lblFeed.innerHTML = `✅ Mix 100% alocado! Para atingir sua meta de <strong>R$ ${fatTotalAlvo.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>, você precisa investir <strong>R$ ${totalInvestimentoNecessario.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong> em compras e adquirir <strong>${totalKgCalculado.toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</strong> de material.`;
            } else if (diff < 0) {
                lblFeed.style.background = 'rgba(255, 184, 0, 0.1)';
                lblFeed.style.border = '1px solid rgba(255, 184, 0, 0.4)';
                lblFeed.style.color = '#ffb74d';
                const faltando = fatTotalAlvo * (Math.abs(diff) / 100);
                lblFeed.innerHTML = `⚠️ Ainda faltam <strong>${Math.abs(diff).toLocaleString('pt-BR', {minimumFractionDigits:1})}%</strong> para atingir 100% do mix — equivale a <strong>R$ ${faltando.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong> de faturamento não coberto. Adicione mais produtos.`;
            } else {
                lblFeed.style.background = 'rgba(255, 77, 77, 0.1)';
                lblFeed.style.border = '1px solid rgba(255, 77, 77, 0.4)';
                lblFeed.style.color = '#ff4d4d';
                lblFeed.innerHTML = `❌ Mix ultrapassou 100% em <strong>${diff.toLocaleString('pt-BR', {minimumFractionDigits:1})}%</strong>. Reduza as frações para não exceder a meta.`;
            }
        } else if (lblFeed) {
            lblFeed.style.display = 'none';
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  CICLOS DE SIMULAÇÃO V3 — Salvar / Lançar Resultado Real
    // ═══════════════════════════════════════════════════════════════

    // Removido _getCiclos e _saveCiclos do localStorage (agora usa DB)

    // Sincroniza o campo "Investimento Simulado" com o valor calculado no mix
    function _syncInvestimentoSimuladoCiclo() {
        const el = document.getElementById('plestv3-ciclo-investimento-sim');
        const lblInvest = document.getElementById('plestv3-mix-total-investimento');
        if (el && lblInvest) {
            // Pega o valor numérico do span de total investimento
            const raw = lblInvest.textContent.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
            const val = parseFloat(raw) || 0;
            el.value = val > 0 ? val : '';
        }
    }

    window.salvarCicloSimulacaoV3 = async function() {
        const dataInicio = document.getElementById('plestv3-ciclo-data-inicio')?.value;
        const dataFim    = document.getElementById('plestv3-ciclo-data-fim')?.value;
        const metaFatEl  = document.getElementById('plestv3-ciclo-meta-fat');
        let   metaFat    = window.parseCurrencyV3(metaFatEl?.value) || 0;

        if (!metaFat) {
            const elFat = document.getElementById('plestv3-fat-alvo');
            metaFat = parseFloat(elFat?.value) || 0;
        }

        if (!dataInicio || !dataFim) {
            (window._apexNotify ? window._apexNotify('Notificação', 'Informe a Data de Início e a Data de Fim do ciclo.', 'info') : alert('Informe a Data de Início e a Data de Fim do ciclo.'));
            return;
        }
        if (new Date(dataFim) < new Date(dataInicio)) {
            (window._apexNotify ? window._apexNotify('Notificação', 'A Data de Fim deve ser posterior à Data de Início.', 'info') : alert('A Data de Fim deve ser posterior à Data de Início.'));
            return;
        }
        if (!metaFat || metaFat <= 0) {
            (window._apexNotify ? window._apexNotify('Notificação', 'Informe a Meta de Faturamento do ciclo.', 'info') : alert('Informe a Meta de Faturamento do ciclo.'));
            return;
        }

        _syncInvestimentoSimuladoCiclo();
        const investSimulado = window.parseCurrencyV3(document.getElementById('plestv3-ciclo-investimento-sim')?.value) || 0;

        const mixSnapshot = _mixSimulacaoV3.map(item => {
            const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === item.material_id);
            return { material_id: item.material_id, nome: tp?.material_nome || `ID ${item.material_id}`, fracaoPct: item.fracaoPct };
        });

        const titulo = `Simulação ${new Date().toLocaleDateString('pt-BR')}`;
        const payload = {
            titulo,
            data_inicial: dataInicio,
            data_final: dataFim,
            frente: document.getElementById('plestv3-frente')?.value || 'venda',
            meta_faturamento: metaFat,
            cenario_conservador_pct: parseFloat(document.getElementById('plestv3-cenario-conservador')?.value) || 80,
            cenario_moderado_pct: parseFloat(document.getElementById('plestv3-cenario-moderado')?.value) || 100,
            cenario_agressivo_pct: parseFloat(document.getElementById('plestv3-cenario-agressivo')?.value) || 120,
            mix: _mixSimulacaoV3.map(m => ({ material_id: m.material_id, fracao_pct: m.fracaoPct }))
        };

        try {
            const res = await fetch('/api/estrategiav3_planos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Falha ao salvar ciclo no banco');
            
            const nota = document.getElementById('plestv3-ciclo-nota-salvo');
            if (nota) nota.style.display = 'block';

            _renderizarCiclosV3();
            if (window._apexNotify) {
                window._apexNotify('Notificação', `✅ Ciclo salvo no banco! Período: ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`, 'success');
            } else {
                alert(`✅ Ciclo salvo no banco! Período: ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`);
            }
        } catch (e) {
            console.error(e);
            (window._apexNotify ? window._apexNotify('Notificação', 'Erro ao salvar ciclo.', 'info') : alert('Erro ao salvar ciclo.'));
        }
    };

    window.abrirModalResultadoRealV3 = async function(cicloId) {
        const modal = document.getElementById('modal-resultado-real-v3');
        if (!modal) return;

        let id = cicloId;
        if (!id) {
            try {
                const res = await fetch('/api/estrategiav3_planos');
                const data = await res.json();
                const planos = data.planos || [];
                const pendente = planos.find(p => p.status !== 'CONCLUIDO');
                if (!pendente) { (window._apexNotify ? window._apexNotify('Notificação', 'Nenhum ciclo pendente no banco. Salve um novo planejamento.', 'info') : alert('Nenhum ciclo pendente no banco. Salve um novo planejamento.')); return; }
                id = pendente.id;
            } catch(e) {
                (window._apexNotify ? window._apexNotify('Notificação', 'Erro ao buscar planos.', 'info') : alert('Erro ao buscar planos.')); return;
            }
        }

        document.getElementById('modal-rr-ciclo-id').value = id;
        document.getElementById('modal-rr-fat-real').value = '';
        document.getElementById('modal-rr-invest-real').value = '';
        document.getElementById('modal-rr-volume-real').value = '';
        document.getElementById('modal-rr-obs').value = '';
        modal.style.display = 'flex';
    };

    window.fecharModalResultadoRealV3 = function() {
        const modal = document.getElementById('modal-resultado-real-v3');
        if (modal) modal.style.display = 'none';
    };

    window.confirmarResultadoRealV3 = async function() {
    const cicloId  = parseInt(document.getElementById('modal-rr-ciclo-id')?.value);
    const fatReal  = window.parseCurrencyV3(document.getElementById('modal-rr-fat-real')?.value);
    const invReal  = window.parseCurrencyV3(document.getElementById('modal-rr-invest-real')?.value);
    const volReal  = window.parseCurrencyV3(document.getElementById('modal-rr-volume-real')?.value) || null;
    const obs      = document.getElementById('modal-rr-obs')?.value?.trim() || '';

    if (!fatReal || fatReal <= 0) { (window._apexNotify ? window._apexNotify('Notificação', 'Informe o Faturamento Real alcançado.', 'info') : alert('Informe o Faturamento Real alcançado.')); return; }
    if (!invReal || invReal <= 0) { (window._apexNotify ? window._apexNotify('Notificação', 'Informe o Investimento Real realizado em compras.', 'info') : alert('Informe o Investimento Real realizado em compras.')); return; }

    try {
        const res = await fetch('/api/estrategiav3_planos/' + cicloId + '/resultado_real', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faturamento_realizado: fatReal,
                investimento_realizado: invReal,
                volume_realizado: volReal,
                observacoes: obs
            })
        });
        if (!res.ok) throw new Error('Erro ao salvar resultado real');
        
        window.fecharModalResultadoRealV3();
        _renderizarCiclosV3();
        _apexNotify('Sucesso', 'Resultado real do ciclo registrado!', 'success');
    } catch(e) {
        console.error(e);
        (window._apexNotify ? window._apexNotify('Notificação', 'Erro ao registrar resultado real.', 'info') : alert('Erro ao registrar resultado real.'));
    }
};

window.excluirCicloV3 = async function(cicloId) {
    if (!confirm('Excluir este ciclo? Esta ação não pode ser desfeita.')) return;
    try {
        await fetch('/api/estrategiav3_planos/' + cicloId, { method: 'DELETE' });
        _renderizarCiclosV3();
    } catch(e) { console.error(e); (window._apexNotify ? window._apexNotify('Notificação', 'Erro ao excluir ciclo', 'info') : alert('Erro ao excluir ciclo')); }
};

        async function _renderizarCiclosV3() {
        const tbody = document.getElementById('plestv3-ciclos-tbody');
        if (!tbody) return;

        try {
            const res = await fetch('/api/estrategiav3_planos');
            const data = await res.json();
            const ciclos = data.planos || [];

            if (ciclos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:18px; color:#aaa;">Nenhum ciclo salvo ainda no banco.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            ciclos.forEach(c => {
                const periodo = new Date(c.data_inicio).toLocaleDateString('pt-BR') + ' → ' + new Date(c.data_fim).toLocaleDateString('pt-BR');
                const mixNomes = 'Mix salvo no banco';
                
                let atingimentoHTML = '—';
                let statusHTML = '<span style="color:#ffb74d; font-weight:bold;"><i class="fa-solid fa-clock"></i> Pendente</span>';

                if (c.status === 'CONCLUIDO' && c.faturamento_realizado != null) {
                    const pct = c.meta_faturamento > 0 ? (c.faturamento_realizado / c.meta_faturamento) * 100 : 0;
                    const cor = pct >= 100 ? '#2AD07A' : pct >= 80 ? '#ffb74d' : '#ff4d4d';
                    const icone = pct >= 100 ? '✅' : pct >= 80 ? '⚠️' : '❌';
                    atingimentoHTML = '<span style="color:' + cor + '; font-weight:bold;">' + icone + ' ' + pct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%</span>';
                    statusHTML = '<span style="color:' + cor + '; font-weight:bold;"><i class="fa-solid fa-flag-checkered"></i> Realizado</span>';
                }

                const fatRealStr  = c.faturamento_realizado != null ? 'R$ ' + parseFloat(c.faturamento_realizado).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—';
                const invRealStr  = c.investimento_realizado != null ? 'R$ ' + parseFloat(c.investimento_realizado).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—';

                const acaoReal = c.status !== 'CONCLUIDO'
                    ? '<button onclick="window.abrirModalResultadoRealV3(' + c.id + ')" title="Lançar Resultado Real" style="background:rgba(42,208,122,0.12); border:1px solid #2AD07A; color:#2AD07A; border-radius:4px; padding:3px 8px; cursor:pointer; font-size:0.78rem; margin-right:4px;"><i class="fa-solid fa-flag-checkered"></i> Real</button>'
                    : '';

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #223547';
                tr.innerHTML = `
                    <td style="padding:7px 10px; color:#ccc; white-space:nowrap; font-size:0.8rem;">${periodo}</td>
                    <td style="padding:7px 10px; color:#aaa; font-size:0.76rem; max-width:180px; overflow:hidden; text-overflow:ellipsis;" title="${mixNomes}">${mixNomes}</td>
                    <td style="padding:7px 10px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${parseFloat(c.meta_faturamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:7px 10px; text-align:right; color:#ff9800;">R$ ${parseFloat(c.investimento_simulado||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:7px 10px; text-align:right; color:#2AD07A;">${fatRealStr}</td>
                    <td style="padding:7px 10px; text-align:right; color:#aaa;">${invRealStr}</td>
                    <td style="padding:7px 10px; text-align:center;">${atingimentoHTML}</td>
                    <td style="padding:7px 10px; text-align:center;">${statusHTML}</td>
                    <td style="padding:7px 10px; text-align:center; white-space:nowrap;">
                        ${acaoReal}
                        <button onclick="window.excluirCicloV3(${c.id})" title="Excluir" style="background:none; border:none; color:#ff6b6b; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('Erro ao renderizar ciclos', e);
        }
    }

    // Inicializar ciclos ao carregar a seção
    function _initCiclosV3() {
        _syncInvestimentoSimuladoCiclo();
        _renderizarCiclosV3();
        // Pré-preenche datas com mês corrente
        const hoje = new Date();
        const dInicio = document.getElementById('plestv3-ciclo-data-inicio');
        const dFim    = document.getElementById('plestv3-ciclo-data-fim');
        if (dInicio && !dInicio.value) {
            dInicio.value = hoje.toISOString().slice(0, 7) + '-01';
        }
        if (dFim && !dFim.value) {
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            dFim.value = ultimoDia.toISOString().slice(0, 10);
        }
    }

    window.detalharMesEstrategicov3 = function(mes) {
        _mesV3Ativo = mes;
        const divDet = document.getElementById('plestv3-view-detalhes-mes');
        if (divDet) divDet.style.display = 'block';
        
        const textAtivo = document.getElementById('plestv3-txt-mes-ativo');
        if (textAtivo) {
            textAtivo.innerHTML = `<i class="fa-solid fa-calendar-days" style="color:#00e5ff;"></i> Planejamento Estratégico V3 — ${formatarMesAnoLabel(mes)}`;
        }
        
        const selectProd = document.getElementById('plestv3-select-produto');
        if (selectProd && !selectProd.value && _listTabelaPrecosEstrategica.length > 0) {
            selectProd.value = _listTabelaPrecosEstrategica[0].material_id;
        }

        renderDashboardEstrategov3();
    };

    window.onSelectProdutoEstrategicov3 = function() {
        if (_mesV3Ativo) renderDashboardEstrategov3();
    };

    function renderDashboardEstrategov3() {
        if (!_mesV3Ativo) return;
        const mes = _mesV3Ativo;
        const targetMatId = parseInt(document.getElementById('plestv3-select-produto').value) || null;

        const metasMes = _listMetasV3.filter(m => m.mes === mes);

        // Agregadores para o Dashboard
        let totalFaturamentoProjetado = 0;
        let totalFaturamentoReal = 0;
        let totalReservaCompra = 0;
        let totalMetaCompra = 0;
        let totalRealizado = 0;
        let totalCustoReal = 0;
        let count = 0;
        let somaMargemProj = 0;

        const tableBody = document.getElementById('plestv3-geral-table-body');
        if (tableBody) tableBody.innerHTML = '';

        _listTabelaPrecosEstrategica.forEach(tp => {
            const meta = metasMes.find(m => m.material_id === tp.material_id);
            if (meta || tp.material_id === targetMatId) {
                const mFat = meta ? parseFloat(meta.meta_faturamento || 0) : 0;
                const mMargem = meta ? parseFloat(meta.margem_desejada || 0) : 0;
                const op = meta ? meta.operacao : 'entrega';
                const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;
                const valVendaReal = meta ? parseFloat(meta.valor_venda_realizado || 0) : 0;

                const pInsumo = op === 'retirada' 
                    ? parseFloat(tp.preco_coletar || tp.preco_compra || 0)
                    : parseFloat(tp.preco_entregar || tp.preco_coletar || 0);
                const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);

                const tetoCusto = mFat * (1 - mMargem/100);
                const qPlan = pInsumo > 0 ? (tetoCusto / pInsumo) : 0;

                const fatProj = mFat;
                const fatReal = valVendaReal > 0 ? valVendaReal : (qReal * pVenda);
                const custoReal = qReal * pInsumo;

                totalFaturamentoProjetado += fatProj;
                totalFaturamentoReal += fatReal;
                totalReservaCompra += tetoCusto;
                totalMetaCompra += qPlan;
                totalRealizado += qReal;
                totalCustoReal += custoReal;

                if (mFat > 0) {
                    somaMargemProj += mMargem;
                    count++;
                }

                const atingimentoPct = qPlan > 0 ? (qReal / qPlan) * 100 : 0;
                const saldo = qPlan - qReal;

                // Detectar prejuízo (se o preço de venda da tabela for menor que o de insumo)
                const isPrejuizo = (pVenda - pInsumo) < 0;

                if (tableBody && meta) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding:8px;">
                            <strong>${tp.material_nome}</strong>
                            ${isPrejuizo ? '<span style="background:#ff4d4d; color:#fff; font-size:0.65rem; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">PREJUÍZO</span>' : ''}
                        </td>
                        <td style="padding:8px; text-align:center; text-transform:capitalize; color:#aaa;">${op}</td>
                        <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${mFat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px; text-align:center; font-weight:bold; color:#3e7cb1;">${mMargem.toLocaleString('pt-BR',{minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                        <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${tetoCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px; text-align:right; color:#aaa;">R$ ${window.fmtBRL(pInsumo)}</td>
                        <td style="padding:8px; text-align:right; font-weight:bold;">${qPlan.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</td>
                        <td style="padding:8px; text-align:right; color:#fff;">${qReal.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</td>
                        <td style="padding:8px; text-align:center; font-weight:bold; color:${atingimentoPct >= 100 ? '#2AD07A' : '#ffb74d'};">${atingimentoPct.toLocaleString('pt-BR',{minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                        <td style="padding:8px; text-align:center; font-weight:bold; color:${atingimentoPct >= 100 ? '#2AD07A' : '#ffb74d'};">${atingimentoPct >= 100 ? 'CONCLUÍDO' : 'PENDENTE'}</td>
                        <td style="padding:8px; text-align:center;">
                            <button onclick="editarMetaEstrategicav3Rapido(${tp.material_id}, '${mes}', ${mFat}, ${mMargem}, '${op}', ${qReal}, ${valVendaReal})" class="btn-primary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#00e5ff; color:#0d1826;" title="Editar"><i class="fa-solid fa-edit"></i></button>
                            <button onclick="deletarMetaEstrategicav3(${meta.id})" style="background:none; border:none; color:#ff6b6b; margin-left:8px; cursor:pointer;" title="Remover Meta"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                }
            }
        });

        if (tableBody && tableBody.children.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:20px; color:#aaa;">Nenhuma meta cadastrada para este mês. Clique em "Configurar Meta do Mês" no topo para planejar.</td></tr>`;
        }

        // Renderizar Cards de KPIs do topo V3
        const margemBrutaPonderada = totalFaturamentoReal > 0 
            ? ((totalFaturamentoReal - totalCustoReal) / totalFaturamentoReal) * 100
            : (count > 0 ? (somaMargemProj / count) : 0);

        const eficienciaVendas = totalFaturamentoProjetado > 0 ? (totalFaturamentoReal / totalFaturamentoProjetado) * 100 : 0;

        document.getElementById('estv3-kpi-fat-projetado').textContent = 'R$ ' + totalFaturamentoProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('estv3-kpi-fat-real').textContent = 'R$ ' + totalFaturamentoReal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('estv3-kpi-reserva').textContent = 'R$ ' + totalReservaCompra.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('estv3-kpi-margem-bruta').textContent = margemBrutaPonderada.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';
        document.getElementById('estv3-kpi-meta-compra').textContent = totalMetaCompra.toLocaleString('pt-BR', {minimumFractionDigits:1}) + ' kg';
        document.getElementById('estv3-kpi-eficiencia').textContent = eficienciaVendas.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';

        // Detalhes do produto reativo ativo
        renderDetalhesProdutoSelecionadov3(targetMatId, mes);

        // Atualizar insights textuais
        gerarInsightsIAEstrategicosv3(metasMes);
    }

    function renderDetalhesProdutoSelecionadov3(matId, mes) {
        const container = document.getElementById('plestv3-produto-detalhes-container');
        const cenBody = document.getElementById('plestv3-cenarios-tbody');
        const prBody = document.getElementById('plestv3-planejado-realizado-tbody');
        if (!container || !cenBody || !prBody) return;

        const preco = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        const meta = _listMetasV3.find(m => m.material_id === matId && m.mes === mes);

        if (!preco) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:15px; color:#aaa; font-size:0.85rem;">Selecione um produto acima para calcular faturamento, custos e volumes consolidados.</div>`;
            cenBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto.</td></tr>`;
            prBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto.</td></tr>`;
            if (_chartEstrategicoV3) { _chartEstrategicoV3.destroy(); _chartEstrategicoV3 = null; }
            return;
        }

        const op = meta ? meta.operacao : 'entrega';
        const pInsumo = op === 'retirada' 
            ? parseFloat(preco.preco_coletar || preco.preco_compra || 0)
            : parseFloat(preco.preco_entregar || preco.preco_coletar || 0);
        const pVenda = parseFloat(preco.preco_venda || preco.venda_ref || 0);

        const metaFatVal = meta ? parseFloat(meta.meta_faturamento || 0) : 100000; // default para simular se vazio
        const margemDesejadaVal = meta ? parseFloat(meta.margem_desejada || 0) : 40;
        const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;
        const valVendaReal = meta ? parseFloat(meta.valor_venda_realizado || 0) : 0;

        const tetoCusto = metaFatVal * (1 - margemDesejadaVal/100);
        const qPlan = pInsumo > 0 ? (tetoCusto / pInsumo) : 0;

        container.innerHTML = `
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Operação ativa</small>
                <div style="font-weight:bold; color:#00e5ff; margin-top:2px; text-transform:capitalize;">${op}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Preço Insumo</small>
                <div style="font-weight:bold; color:#ffb74d; margin-top:2px;">R$ ${window.fmtBRL(pInsumo)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Faturamento Alvo</small>
                <div style="font-weight:bold; color:#2AD07A; margin-top:2px;">R$ ${metaFatVal.toLocaleString('pt-BR')}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Qtd Planejada</small>
                <div style="font-weight:bold; color:#fff; margin-top:2px;">${qPlan.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg</div>
            </div>
        `;

        // Cenários de Projeção (Conservador 80% / Moderado 100% / Agressivo 120%)
        const fillCenarioRow = (nome, pct, cor) => {
            const fat = metaFatVal * (pct / 100);
            const custo = fat * (1 - margemDesejadaVal/100);
            const volume = pInsumo > 0 ? (custo / pInsumo) : 0;
            return `
                <tr>
                    <td style="padding:8px; font-weight:bold; color:${cor};">${nome} (${pct}%)</td>
                    <td style="padding:8px; text-align:right; color:#fff;">R$ ${fat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:center; color:#3e7cb1;">${margemDesejadaVal.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${custo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#fff;">${volume.toLocaleString('pt-BR',{maximumFractionDigits:1})} kg</td>
                </tr>
            `;
        };

        cenBody.innerHTML = `
            ${fillCenarioRow('Conservador', 80, '#ffeb3b')}
            ${fillCenarioRow('Moderado (Alvo)', 100, '#00e5ff')}
            ${fillCenarioRow('Agressivo', 120, '#ff4d4d')}
        `;

        // Comparativo Planejado vs Realizado
        const fatReal = valVendaReal > 0 ? valVendaReal : (qReal * pVenda);
        const custoPlan = tetoCusto;
        const custoReal = qReal * pInsumo;
        const lucroPlan = metaFatVal - custoPlan;
        const lucroReal = fatReal - custoReal;

        const compRowV3 = (nome, planVal, realVal, unit, isMoney) => {
            const diff = planVal - realVal;
            const pct = planVal > 0 ? (realVal / planVal) * 100 : 0;
            const fmt = (v) => isMoney ? 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2}) : v.toLocaleString('pt-BR') + ' ' + unit;
            return `
                <tr>
                    <td style="padding:8px; font-weight:600; color:#fff;">${nome}</td>
                    <td style="padding:8px; text-align:right; color:#aaa;">${fmt(planVal)}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#fff;">${fmt(realVal)}</td>
                    <td style="padding:8px; text-align:right; color:${diff <= 0 ? '#2AD07A' : '#ff4d4d'};">${diff <= 0 ? 'Meta Atingida' : fmt(diff) + ' restante'}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:${pct >= 100 ? '#2AD07A' : (pct >= 80 ? '#ffb74d' : '#ff4d4d')};">${pct.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                </tr>
            `;
        };

        prBody.innerHTML = `
            ${compRowV3('Meta de Faturamento (Venda)', metaFatVal, fatReal, '', true)}
            ${compRowV3('Reserva de Compra (Investimento)', custoPlan, custoReal, '', true)}
            ${compRowV3('Volume Necessário (Compra)', qPlan, qReal, 'kg', false)}
            ${compRowV3('Lucro Projetado', lucroPlan, lucroReal, '', true)}
        `;

        // Renderizar gráfico reativo do atingimento V3
        const consVol = pInsumo > 0 ? ((metaFatVal * 0.8 * (1 - margemDesejadaVal/100)) / pInsumo) : 0;
        const agrVol = pInsumo > 0 ? ((metaFatVal * 1.2 * (1 - margemDesejadaVal/100)) / pInsumo) : 0;

        renderGraficoCenariosEstrategicosv3(consVol, qPlan, agrVol, qReal, preco.material_nome);
    }

    function renderGraficoCenariosEstrategicosv3(cons, mod, agr, real, produtoNome) {
        const ctx = document.getElementById('plestv3-chart-cenarios');
        if (!ctx) return;

        if (_chartEstrategicoV3) {
            _chartEstrategicoV3.destroy();
        }

        _chartEstrategicoV3 = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Conservador', 'Moderado', 'Agressivo', 'Realizado'],
                datasets: [{
                    label: 'Volume Insumo (kg) - ' + produtoNome,
                    data: [cons, mod, agr, real],
                    backgroundColor: ['rgba(255, 235, 59, 0.4)', 'rgba(0, 229, 255, 0.4)', 'rgba(255, 77, 77, 0.4)', 'rgba(42, 208, 122, 0.5)'],
                    borderColor: ['#ffeb3b', '#00e5ff', '#ff4d4d', '#2AD07A'],
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8eaabf', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8eaabf', font: { size: 9 } } }
                }
            }
        });
    }

    function gerarInsightsIAEstrategicosv3(metasMes) {
        const insightsContainer = document.getElementById('plestv3-ia-insights');
        if (!insightsContainer) return;

        let html = `<ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:6px;">`;

        if (metasMes.length === 0) {
            html += `<li>Defina uma meta de faturamento e margem no botão acima para simular e avaliar os insumos necessários.</li>`;
        } else {
            metasMes.forEach(m => {
                const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === m.material_id);
                if (tp) {
                    const pInsumo = m.operacao === 'retirada' 
                        ? parseFloat(tp.preco_compra_coletar || tp.preco_compra || 0)
                        : parseFloat(tp.preco_compra_entregar || tp.preco_compra_coletar || 0);

                    const metaFat = parseFloat(m.meta_faturamento || 0);
                    const margem = parseFloat(m.margem_desejada || 0);
                    const teto = metaFat * (1 - margem/100);
                    const qPlan = pInsumo > 0 ? (teto / pInsumo) : 0;
                    const real = parseFloat(m.qtd_realizado || 0);

                    if (real >= qPlan && qPlan > 0) {
                        html += `<li>🏆 <strong>Meta Superada</strong>: O insumo <strong>${tp.material_nome}</strong> atingiu 100% da meta de compra com <strong>${real.toLocaleString('pt-BR')} kg</strong> realizados.</li>`;
                    } else if (qPlan > 0) {
                        const falta = qPlan - real;
                        html += `<li>🕒 <strong>Acompanhamento</strong>: Faltam comprar <strong>${falta.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg</strong> de <strong>${tp.material_nome}</strong> para cobrir a meta comercial.</li>`;
                    }
                }
            });
        }

        html += `</ul>`;
        insightsContainer.innerHTML = html;
    }

    window.abrirModalPlanejamentosSalvosV3 = async function() {
        // Remove any existing modal to ensure clean state
        let existing = document.getElementById('modal-estrategiav3-planos');
        if (existing) {
            existing.remove();
        }
        
        let modal = document.createElement('div');
        modal.id = 'modal-estrategiav3-planos';
        // Completely inline CSS to avoid any stylesheet interference
        modal.style.cssText = 'display:flex; align-items:center; justify-content:center; z-index:9999999; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); font-family:sans-serif; backdrop-filter:blur(5px);';
        modal.innerHTML = `
            <div style="width:90%; max-width:900px; max-height:90vh; overflow-y:auto; position:relative; background:#0d1826; border:1px solid #2AD07A; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,1); padding:20px;">
                <button onclick="document.getElementById('modal-estrategiav3-planos').remove()" style="position:absolute; top:15px; right:15px; background:transparent; border:none; color:#ff4d4d; font-size:1.5rem; cursor:pointer; font-weight:bold;">X</button>
                <h2 style="margin:0 0 20px 0; color:#fff; border-bottom:1px solid #1a2e3f; padding-bottom:10px;">Planejamentos Salvos</h2>
                <div id="lista-estrategiav3-planos">
                    <div style="color:#00e5ff; text-align:center; padding:30px; font-size:1.2rem; font-weight:bold;">Sincronizando com o banco de dados...</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const lista = document.getElementById('lista-estrategiav3-planos');

        try {
            const res = await fetch('/api/estrategiav3_planos');
            if (!res.ok) throw new Error('Erro do servidor: ' + res.status);
            const planos = await res.json();
            
            if (!Array.isArray(planos)) throw new Error('A resposta da API não é um array válido.');

            if (planos.length === 0) {
                lista.innerHTML = '<div style="color:#aaa; text-align:center; padding:30px; font-size:1.2rem;">Nenhum planejamento salvo ainda. Você precisa salvar um planejamento primeiro!</div>';
                return;
            }

            lista.innerHTML = planos.map(p => {
                const itensArray = Array.isArray(p.itens) ? p.itens : [];
                return `
                    <div style="background:#162433; border:1px solid #1c2e3d; border-radius:8px; padding:15px; margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                            <div>
                                <h3 style="margin:0; color:#2AD07A; font-size:1.1rem;">${p.titulo || 'Sem Título'}</h3>
                                <small style="color:#aaa;">Período: ${window.fmtD(p.data_inicial)} até ${window.fmtD(p.data_final)}</small>
                            </div>
                            <button onclick="window.gerarPdfEstrategiaV3(${p.id})" style="background:#2AD07A; color:#0d1826; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">GERAR PDF</button>
                        </div>
                        <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:10px;">
                            <div style="background:#0d1826; padding:10px; border-radius:6px; flex:1; min-width:180px;">
                                <span style="display:block; color:#aaa; font-size:0.8rem; margin-bottom:4px;">Estratégia Principal</span>
                                <span style="display:block; color:#fff; font-weight:bold;">${p.frente === 'venda' ? 'Foco em Venda' : 'Foco em Compra'}</span>
                            </div>
                            <div style="background:#0d1826; padding:10px; border-radius:6px; flex:1; min-width:180px;">
                                <span style="display:block; color:#aaa; font-size:0.8rem; margin-bottom:4px;">Objetivo (R$)</span>
                                <span style="display:block; color:#00e5ff; font-weight:bold; font-size:1.1rem;">Meta Total: R$ ${window.fmtBRL(p.meta_faturamento)}</span>
                            </div>
                        </div>
                        <h4 style="margin:0 0 10px 0; color:#fff; font-size:0.9rem; border-bottom:1px solid #1c2e3d; padding-bottom:5px;">Composição do Mix</h4>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:0.8rem; min-width:500px;">
                                <thead>
                                    <tr style="background:#0d1826; color:#aaa; text-align:left;">
                                        <th style="padding:6px;">Produto</th>
                                        <th style="padding:6px; text-align:right;">Fração</th>
                                        <th style="padding:6px; text-align:right;">Meta (R$)</th>
                                        <th style="padding:6px; text-align:right;">Realizado (R$)</th>
                                        <th style="padding:6px; text-align:center;">Progresso</th>
                                        <th style="padding:6px; text-align:center;">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                ${itensArray.map(it => {
                                    const tp = window._listTabelaPrecosEstrategica && window._listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
                                    const mNome = tp ? tp.material_nome : 'Material ' + it.material_id;
                                    const atingidoPct = it.faturamento_alvo > 0 ? ((it.faturamento_realizado / it.faturamento_alvo) * 100) : 0;
                                    return `
                                        <tr style="border-bottom:1px solid #1c2e3d;">
                                            <td style="padding:6px; color:#fff;">${mNome}</td>
                                            <td style="padding:6px; color:#fff; text-align:right;">${it.fracao_pct}%</td>
                                            <td style="padding:6px; color:#2AD07A; text-align:right;">R$ ${window.fmtBRL(it.faturamento_alvo)}</td>
                                            <td style="padding:6px; color:#00e5ff; text-align:right;">
                                                <input type="text" id="plestv3-realizado-${it.id}" value="${window.fmtBRL(it.faturamento_realizado)}" style="width:90px; text-align:right; padding:4px; margin:0; background:#0d1826; color:#fff; border:1px solid #1c2e3d; border-radius:4px;" oninput="window.maskCurrencyV3(this)">
                                            </td>
                                            <td style="padding:6px; text-align:center;">
                                                <div style="background:#162433; border-radius:10px; width:100%; height:8px; position:relative; overflow:hidden;">
                                                    <div style="position:absolute; top:0; left:0; height:100%; width:${Math.min(atingidoPct, 100)}%; background:${atingidoPct >= 100 ? '#2AD07A' : '#00e5ff'};"></div>
                                                </div>
                                                <small style="color:#aaa;">${atingidoPct.toFixed(1)}%</small>
                                            </td>
                                            <td style="padding:6px; text-align:center;">
                                                <button type="button" onclick="window.salvarRealizadoV3(${it.id})" style="background:#00e5ff; color:#0d1826; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.7rem;">Salvar Realizado</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('');
            
            window._planosV3Cache = planos;

        } catch(e) {
            console.error('ERRO ABRIR MODAL:', e);
            (window._apexNotify ? window._apexNotify('Notificação', 'Aviso: ' + e.message, 'info') : alert('Aviso: ' + e.message));
            if (lista) {
                lista.innerHTML = `<div style="color:#ff4d4d; text-align:center; padding: 20px;">
                    <b>Erro ao carregar dados do servidor.</b><br><br>
                    ${e.message}
                </div>`;
            }
        }
    };

    // Modal Handlers V3
    window.abrirModalMetaEstrategicav3 = function() {
        const modal = document.getElementById('modal-meta-estrategicav3');
        if (modal) {
            const mesInput = document.getElementById('metaestv3-mes');
            if (mesInput) {
                if (_mesV3Ativo) {
                    mesInput.value = _mesV3Ativo;
                } else {
                    const today = new Date();
                    mesInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
                }
            }
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        }
    };

    window.fecharModalMetaEstrategicav3 = function() {
        const modal = document.getElementById('modal-meta-estrategicav3');
        if (modal) modal.style.display = 'none';
        document.getElementById('form-meta-estrategicav3').reset();
    };

    window.onSelectModalMaterialv3 = function() {
        const matId = parseInt(document.getElementById('metaestv3-material-id').value);
        const op = document.getElementById('metaestv3-operacao').value;
        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (tp) {
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);

            const totalDedPct = comissao + pisCofins + fidc + icms;
            const vendaRef = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const valDeducoes = vendaRef * (totalDedPct / 100);
            const vendaLiquida = vendaRef - valDeducoes;

            let margem = 0;
            if (op === 'retirada') {
                const lucroCol = vendaLiquida - (parseFloat(tp.preco_coletar || tp.preco_compra || 0)) - freteColeta;
                margem = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;
            } else {
                const lucroEnt = vendaLiquida - (parseFloat(tp.preco_entregar || tp.preco_compra || 0));
                margem = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;
            }
            document.getElementById('metaestv3-margem-desejada').value = margem.toFixed(2);
        }
        calcularInsumoModalv3();
    };

    window.calcularInsumoModalv3 = function() {
        const matId = parseInt(document.getElementById('metaestv3-material-id').value);
        const metaFat = parseFloat(document.getElementById('metaestv3-meta-faturamento').value || 0);
        const margem = parseFloat(document.getElementById('metaestv3-margem-desejada').value || 0);
        const op = document.getElementById('metaestv3-operacao').value;

        const lblPreco = document.getElementById('metaestv3-lbl-preco-insumo');
        const lblTeto = document.getElementById('metaestv3-lbl-teto-custo');
        const lblQtd = document.getElementById('metaestv3-lbl-qtd-calculada');

        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (tp) {
            const pInsumo = op === 'retirada'
                ? parseFloat(tp.preco_coletar || tp.preco_compra || 0)
                : parseFloat(tp.preco_entregar || tp.preco_coletar || 0);

            const tetoCusto = metaFat * (1 - margem/100);
            const qtdCalculada = pInsumo > 0 ? (tetoCusto / pInsumo) : 0;

            lblPreco.textContent = 'R$ ' + pInsumo.toFixed(2);
            lblTeto.textContent = 'R$ ' + tetoCusto.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            lblQtd.textContent = qtdCalculada.toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' kg';
        } else {
            lblPreco.textContent = 'R$ 0,00';
            lblTeto.textContent = 'R$ 0,00';
            lblQtd.textContent = '0 kg';
        }
    };

    window.editarMetaEstrategicav3Rapido = function(materialId, mes, mFat, mMargem, op, qReal, valVendaReal) {
        document.getElementById('metaestv3-material-id').value = materialId;
        document.getElementById('metaestv3-mes').value = mes;
        document.getElementById('metaestv3-meta-faturamento').value = mFat;
        document.getElementById('metaestv3-margem-desejada').value = mMargem;
        document.getElementById('metaestv3-operacao').value = op;
        document.getElementById('metaestv3-qtd-realizado').value = qReal;
        document.getElementById('metaestv3-valor-venda-realizado').value = valVendaReal || '';

        onSelectModalMaterialv3();
        abrirModalMetaEstrategicav3();
    };

    window.salvarMetaEstrategicav3Form = async function(event) {
        event.preventDefault();
        const material_id = document.getElementById('metaestv3-material-id').value;
        const mes = document.getElementById('metaestv3-mes').value; // YYYY-MM
        const meta_faturamento = document.getElementById('metaestv3-meta-faturamento').value;
        const margem_desejada = document.getElementById('metaestv3-margem-desejada').value;
        const operacao = document.getElementById('metaestv3-operacao').value;
        const qtd_realizado = document.getElementById('metaestv3-qtd-realizado').value;
        const valor_venda_realizado = document.getElementById('metaestv3-valor-venda-realizado').value;
        const criarAtivo = document.getElementById('metaestv3-criar-ativo') ? document.getElementById('metaestv3-criar-ativo').checked : false;

        try {
            // Salvar a meta base
            const res = await fetch('/api/planejamento-estrategicov3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_id, mes, meta_faturamento, margem_desejada, operacao, qtd_realizado, valor_venda_realizado
                })
            });

            if (res.ok) {
                let msgSucesso = 'Planejamento base salvo com sucesso!';
                
                // Se marcou para criar como ativo
                if (criarAtivo) {
                    const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id == material_id)?.material_nome || 'Produto';
                    const fatAlvo = parseFloat(meta_faturamento) || 0;
                    const mg = parseFloat(margem_desejada) || 0;
                    const teto = fatAlvo * (1 - (mg/100));
                    
                    const dataInicio = `${mes}-01`;
                    const [y, m] = mes.split('-');
                    const dataFim = new Date(y, m, 0).toISOString().split('T')[0];

                    const payloadPlano = {
                        nome: `Plano Personalizado - ${mNome}`,
                        data_inicio: dataInicio,
                        data_fim: dataFim,
                        itens: [{
                            material_id: parseInt(material_id),
                            fracao_pct: 100,
                            faturamento_alvo: fatAlvo,
                            faturamento_realizado: parseFloat(valor_venda_realizado) || 0
                        }],
                        cenarios: [{
                            nome: 'PERSONALIZADO (100%)',
                            valor_meta_faturamento: fatAlvo,
                            valor_teto_custo: teto
                        }]
                    };

                    const resAtivo = await fetch('/api/estrategiav3_planos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payloadPlano)
                    });

                    if (resAtivo.ok) {
                        msgSucesso = 'Plano Personalizado salvo e ativado com sucesso!';
                    }
                }

                _apexNotify('Sucesso', msgSucesso, 'success');
                fecharModalMetaEstrategicav3();
                
                // Recarregar conforme a aba visível
                const secAtivos = document.getElementById('subaba-estr-ativos');
                if (secAtivos && secAtivos.style.display === 'block' && window.renderPlanejamentosAtivosV3) {
                    await window.renderPlanejamentosAtivosV3();
                } else if (window.carregarPlanejamentoEstrategicov3) {
                    await window.carregarPlanejamentoEstrategicov3();
                }
            } else {
                throw new Error('Falha ao salvar meta');
            }
        } catch (e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível salvar.', 'error');
        }
    };

    window.deletarMetaEstrategicav3 = async function(id) {
        if (!confirm('Deseja realmente remover esta meta estratégica?')) return;
        try {
            const res = await fetch(`/api/planejamento-estrategicov3/${id}`, { method: 'DELETE' });
            if (res.ok) {
                _apexNotify('Sucesso', 'Meta estratégica V3 excluída.', 'success');
                await carregarPlanejamentoEstrategicov3();
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível excluir.', 'error');
        }
    };

    window.abrirModalPlanejamentosSalvosV3 = async function() {
        const navEstrategico = document.getElementById('nav-planejamento-estrategicov3');
        if (navEstrategico) navEstrategico.click();
        if (window.alternarSubAbaEstrategico) window.alternarSubAbaEstrategico('ativos');
    };

    function formatarMesAnoLabel(mesStr) {
        if (!mesStr) return '';
        const parts = mesStr.split('-');
        if (parts.length !== 2) return mesStr;
        const ano = parts[0];
        const mesIdx = parseInt(parts[1], 10);
        const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return (nomes[mesIdx] || '') + ' / ' + ano;
    }

    window.fmtD = function(d) {
        if (!d || d === 'dd/mm/aaaa') return '-'; 
        try { 
            if (d === 'Invalid Date') return '-';
            let strD = String(d);
            if (strD.includes('T')) strD = strD.split('T')[0];
            if (strD.includes('/')) return strD; 
            const parts = strD.split('-');
            if(parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return strD; 
            return dateObj.toLocaleDateString('pt-BR', {timeZone:'UTC'}); 
        } catch(e){ 
            return String(d); 
        }
    };

    window.maskCurrencyV3 = function(input) {
        let value = input.value;
        value = value.replace(/\D/g, ""); 
        if (!value) { input.value = ""; return; }
        value = (parseInt(value, 10) / 100).toFixed(2) + "";
        value = value.replace(".", ",");
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        input.value = value;
    };

    window.parseCurrencyV3 = function(val) {
        if (!val) return 0;
        return parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;
    };

    window.salvarPlanejamentoV3 = async function() {
        const titulo = document.getElementById('plestv3-sim-titulo')?.value || '';
        const data_inicial = document.getElementById('plestv3-sim-dt-ini')?.value || '';
        const data_final = document.getElementById('plestv3-sim-dt-fim')?.value || '';
        const frente = document.getElementById('plestv3-sim-frente')?.value || 'venda';
        const metaFat = document.getElementById('plestv3-sim-meta-faturamento')?.value || '0';
        
        const cenario_conservador_pct = parseFloat(document.getElementById('plestv3-sim-cenario-conservador')?.value) || 80;
        const cenario_moderado_pct = parseFloat(document.getElementById('plestv3-sim-cenario-moderado')?.value) || 100;
        const cenario_agressivo_pct = parseFloat(document.getElementById('plestv3-sim-cenario-agressivo')?.value) || 120;

        const fatTotalAlvo = parseFloat(metaFat.replace(/\./g, '').replace(',', '.')) || 0;

        if (!titulo || !data_inicial || !data_final || _mixSimulacaoV3.length === 0) {
            _apexNotify('Aviso', 'Preencha o Título, Datas e adicione pelo menos um item ao Mix.', 'warning');
            return;
        }

        const payload = {
            titulo, data_inicial, data_final, frente, meta_faturamento: fatTotalAlvo,
            cenario_conservador_pct, cenario_moderado_pct, cenario_agressivo_pct,
            mix: _mixSimulacaoV3.map(m => {
                const faturamentoAlvo = fatTotalAlvo * (m.fracaoPct / 100);
                let pRef = 0; let pCompra = 0;
                const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === m.material_id);
                if (tp) {
                    pRef = frente === 'venda' ? parseFloat(tp.preco_venda || tp.venda_ref || 0) : parseFloat(tp.preco_entregar || tp.preco_compra || 0);
                    pCompra = frente === 'venda' ? parseFloat(tp.preco_entregar || tp.preco_compra || 0) : parseFloat(tp.preco_coletar || tp.preco_compra || 0);
                }
                const vol = pRef > 0 ? (faturamentoAlvo / pRef) : 0;
                const invest = vol * pCompra;
                return {
                    material_id: m.material_id,
                    fracao_pct: m.fracaoPct,
                    volume_necessario: vol,
                    faturamento_alvo: faturamentoAlvo,
                    investimento_necessario: invest
                };
            })
        };

        try {
            const res = await fetch('/api/estrategiav3_planos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                _apexNotify('Sucesso', 'Estratégia salva com sucesso!', 'success');
                const navEstrategico = document.getElementById('nav-planejamento-estrategicov3');
                if (navEstrategico) navEstrategico.click();
                if (window.alternarSubAbaEstrategico) window.alternarSubAbaEstrategico('ativos');
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível salvar a estratégia.', 'error');
        }
    };



    window.atualizarRealizadoV3 = async function(mixId) {
        const inp = document.getElementById(`plestv3-realizado-${mixId}`);
        if (!inp) return;
        const valLimpo = inp.value.replace(/\./g, '').replace(',', '.');
        const numVal = parseFloat(valLimpo) || 0;
        try {
            const res = await fetch(`/api/estrategiav3_mix/${mixId}/realizado`, {
                method: 'PUT', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ faturamento_realizado: numVal })
            });
            if (res.ok) {
                _apexNotify('Sucesso', 'Realizado salvo!', 'success');
                
                // --- SCENARIO VALIDATION LOGIC ---
                const fetchRes = await fetch('/api/estrategiav3_planos');
                if (fetchRes.ok) {
                    const data = await fetchRes.json();
                    if(data.success && data.planos) {
                        let currentPlan = null;
                        for(let p of data.planos) {
                            if(p.itens.find(i => i.id === mixId)) {
                                currentPlan = p;
                                break;
                            }
                        }
                        
                        if(currentPlan) {
                            let totalReal = 0;
                            currentPlan.itens.forEach(it => { totalReal += parseFloat(it.faturamento_realizado) || 0; });
                            
                            const metaAlvo = parseFloat(currentPlan.meta_faturamento) || 0;
                            const consPct = parseFloat(currentPlan.cenario_conservador_pct) || 80;
                            const modPct = parseFloat(currentPlan.cenario_moderado_pct) || 100;
                            const agrPct = parseFloat(currentPlan.cenario_agressivo_pct) || 120;
                            
                            const tCons = metaAlvo * (consPct / 100);
                            const tMod = metaAlvo * (modPct / 100);
                            const tAgr = metaAlvo * (agrPct / 100);

                            if (metaAlvo > 0) {
                                if (totalReal >= tAgr) {
                                    _apexNotify('Cenário Atingido!', `Parabéns! O Cenário AGRESSIVO (${agrPct}%) foi alcançado na estratégia: ${currentPlan.titulo}.`, 'error');
                                } else if (totalReal >= tMod) {
                                    _apexNotify('Cenário Atingido!', `Ótimo! O Cenário MODERADO (${modPct}%) foi alcançado na estratégia: ${currentPlan.titulo}.`, 'warning');
                                } else if (totalReal >= tCons) {
                                    _apexNotify('Cenário Atingido!', `Muito bem! O Cenário CONSERVADOR (${consPct}%) foi alcançado na estratégia: ${currentPlan.titulo}.`, 'info');
                                }
                            }
                        }
                    }
                }
                
                window.renderPlanejamentosAtivosV3();
            } else {
                throw new Error('Erro PUT');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não salvou o realizado.', 'error');
        }
    };

    window.toggleSimuladorPlanejamento = function() {
        const wrap = document.getElementById('wrapper-simulador-planejamento');
        const icon = document.getElementById('icon-toggle-simulador');
        if (wrap.style.display === 'none' || wrap.style.display === '') {
            wrap.style.display = 'block';
            if (icon) icon.className = 'fa-solid fa-chevron-up';
        } else {
            wrap.style.display = 'none';
            if (icon) icon.className = 'fa-solid fa-chevron-down';
        }
    };

    window.preencherTituloEMesesV3 = function() {
        const selMes = document.getElementById('plestv3-quick-mes');
        const selAno = document.getElementById('plestv3-quick-ano');
        const inputTitulo = document.getElementById('plestv3-sim-titulo');
        const inputDtIni = document.getElementById('plestv3-sim-dt-ini');
        const inputDtFim = document.getElementById('plestv3-sim-dt-fim');

        if (!selMes || !selAno || !inputTitulo) return;
        const valMes = selMes.value;
        const ano = selAno.value || '2027';

        if (!valMes) return;
        const [numMes, nomeMes] = valMes.split('|');

        inputTitulo.value = `${nomeMes} ${ano}`;

        if (numMes && ano) {
            const firstDay = `${ano}-${numMes}-01`;
            const lastDayObj = new Date(parseInt(ano, 10), parseInt(numMes, 10), 0);
            const lastDayNum = String(lastDayObj.getDate()).padStart(2, '0');
            const lastDay = `${ano}-${numMes}-${lastDayNum}`;

            if (inputDtIni) inputDtIni.value = firstDay;
            if (inputDtFim) inputDtFim.value = lastDay;
        }
    };

    window.popularMultiSelectTitulosV3 = function() {
        const containerOpts = document.getElementById('plestv3-multiselect-options');
        const chkCount = document.getElementById('plestv3-chk-count');
        const chkAll = document.getElementById('plestv3-chk-all-titulos');
        if (!containerOpts) return;

        const allPlanos = window._allPlanosAtivosV3 || [];
        containerOpts.innerHTML = '';

        if (allPlanos.length === 0) {
            containerOpts.innerHTML = '<span style="color:#aaa; font-size:0.75rem;">Nenhum planejamento disponível</span>';
            if (chkCount) chkCount.textContent = '0/0';
            return;
        }

        allPlanos.forEach(p => {
            const label = document.createElement('label');
            label.style.cssText = 'color:#fff; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;';
            label.title = p.titulo;

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'plestv3-chk-titulo-item';
            chk.value = p.id;
            chk.checked = true;
            chk.onchange = function() { window.onCheckTituloItemV3(); };

            const textSpan = document.createElement('span');
            textSpan.textContent = p.titulo;

            label.appendChild(chk);
            label.appendChild(textSpan);
            containerOpts.appendChild(label);
        });

        if (chkAll) chkAll.checked = true;
        window.onCheckTituloItemV3();
    };

    window.toggleMultiSelectTitulosV3 = function() {
        const drop = document.getElementById('plestv3-multiselect-dropdown');
        if (!drop) return;
        const isHidden = drop.style.display === 'none' || drop.style.display === '';
        drop.style.display = isHidden ? 'block' : 'none';

        if (isHidden && !window._hasMultiSelectListenerV3) {
            window._hasMultiSelectListenerV3 = true;
            document.addEventListener('click', function(e) {
                const wrapper = document.getElementById('plestv3-multiselect-wrapper');
                if (wrapper && !wrapper.contains(e.target)) {
                    const d = document.getElementById('plestv3-multiselect-dropdown');
                    if (d) d.style.display = 'none';
                }
            });
        }
    };

    window.toggleAllTitulosV3 = function(master) {
        const items = document.querySelectorAll('.plestv3-chk-titulo-item');
        items.forEach(chk => { chk.checked = master.checked; });
        window.onCheckTituloItemV3();
    };

    window.onCheckTituloItemV3 = function() {
        const items = Array.from(document.querySelectorAll('.plestv3-chk-titulo-item'));
        const total = items.length;
        const checked = items.filter(chk => chk.checked);
        const chkCount = document.getElementById('plestv3-chk-count');
        const chkAll = document.getElementById('plestv3-chk-all-titulos');
        const labelBtn = document.getElementById('plestv3-multiselect-label');

        if (chkCount) chkCount.textContent = `${checked.length}/${total}`;
        if (chkAll) chkAll.checked = (total > 0 && checked.length === total);

        if (labelBtn) {
            if (checked.length === 0) {
                labelBtn.innerHTML = `<i class="fa-solid fa-list-check" style="color:#ff4d4d;"></i> Nenhum selecionado`;
            } else if (checked.length === total) {
                labelBtn.innerHTML = `<i class="fa-solid fa-list-check" style="color:#00e5ff;"></i> Todos os Títulos (${total})`;
            } else if (checked.length === 1) {
                const firstPlano = (window._allPlanosAtivosV3 || []).find(p => String(p.id) === checked[0].value);
                const nome = firstPlano ? firstPlano.titulo : '1 Selecionado';
                labelBtn.innerHTML = `<i class="fa-solid fa-list-check" style="color:#2AD07A;"></i> ${nome}`;
            } else {
                labelBtn.innerHTML = `<i class="fa-solid fa-list-check" style="color:#2AD07A;"></i> ${checked.length} Títulos Selecionados`;
            }
        }

        window.filtrarPlanejamentosAtivosV3();
    };

    window.limparFiltrosPlanejamentosV3 = function() {
        const selMes = document.getElementById('plestv3-filtro-mes');
        const selAno = document.getElementById('plestv3-filtro-ano');
        const selStatus = document.getElementById('plestv3-filtro-status');
        const inputBusca = document.getElementById('plestv3-filtro-busca');

        if (selMes) selMes.value = '';
        if (selAno) selAno.value = '';
        if (selStatus) selStatus.value = '';
        if (inputBusca) inputBusca.value = '';

        const items = document.querySelectorAll('.plestv3-chk-titulo-item');
        items.forEach(chk => { chk.checked = true; });
        const chkAll = document.getElementById('plestv3-chk-all-titulos');
        if (chkAll) chkAll.checked = true;

        window.onCheckTituloItemV3();
    };

    function renderCardsPlanosV3(planosArray, container) {
        if (!container) return;
        container.innerHTML = '';
        planosArray.forEach(p => {
            let htmlItens = '';
            let totalAlvo = 0;
            let totalReal = 0;
            let totalInvest = 0;
            let totalVol = 0;
            let totalFracaoPct = 0;
            let totalVendaLiquida = 0;

            p.itens.forEach(it => {
                const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || 'Material ' + it.material_id;
                const fAlvo = parseFloat(it.faturamento_alvo) || 0;
                const fReal = parseFloat(it.faturamento_realizado) || 0;
                const invest = parseFloat(it.investimento_necessario) || 0;
                const vol = parseFloat(it.volume_necessario) || 0;
                const fracao = parseFloat(it.fracao_pct) || 0;

                let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
                const pRef = p.frente === 'venda'
                    ? parseFloat(tp?.preco_venda || tp?.venda_ref || 0)
                    : parseFloat(tp?.preco_entregar || tp?.preco_compra || 0);

                const comissao = parseFloat(tp?.comissao || 0);
                const pisCofins = parseFloat(tp?.pis_cofins || 0);
                const fidc = parseFloat(tp?.fidc || 0);
                const icms = parseFloat(tp?.icms || 0);
                const freteColeta = parseFloat(tp?.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoesUnit = pRef * (totalDedPct / 100);
                const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);

                totalAlvo += fAlvo;
                totalReal += fReal;
                totalInvest += invest;
                totalVol += vol;
                totalFracaoPct += fracao;
                totalVendaLiquida += (vol * vendaLiquidaUnit);

                const progPct = fAlvo > 0 ? ((fReal / fAlvo) * 100).toFixed(1) : 0;
                
                htmlItens += `
                    <tr style="border-bottom:1px solid #1a2e3f;">
                        <td style="padding:10px;">${mNome}</td>
                        <td style="padding:10px;">${it.fracao_pct}%</td>
                        <td style="padding:10px; color:#2AD07A;">R$ ${window.fmtBRL(fAlvo)}</td>
                        <td style="padding:10px;">
                            <input type="text" id="plestv3-realizado-${it.id}" class="noble-input" value="${window.fmtBRL(fReal)}" style="width:100px; padding:4px;" oninput="window.maskCurrencyV3(this)" ${p.status === 'FINALIZADO' ? 'disabled' : ''}>
                        </td>
                        <td style="padding:10px;">
                            <div style="width:100%; background:#0d1826; height:6px; border-radius:3px; margin-top:6px;">
                                <div style="width:${Math.min(progPct, 100)}%; background:${progPct >= 100 ? '#2AD07A' : '#00e5ff'}; height:100%; border-radius:3px;"></div>
                            </div>
                            <small style="color:#aaa; font-size:10px;">${progPct}%</small>
                        </td>
                        <td style="padding:10px;">
                            ${p.status !== 'FINALIZADO' ? `<button onclick="window.atualizarRealizadoV3(${it.id})" style="background:#00e5ff; color:#0d1826; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">Salvar Realizado</button>` : '<span style="color:#aaa; font-size:11px;">Finalizado</span>'}
                        </td>
                    </tr>
                `;
            });

            // Cálculos de Totais, Médias e Indicadores Estratégicos do Plano Ativo
            const countAtivos = p.itens.length || 1;
            const mediaFracaoAtivo = totalFracaoPct / countAtivos;
            const mediaAlvoAtivo = totalAlvo / countAtivos;
            const mediaRealAtivo = totalReal / countAtivos;

            const pVendaMedioAtivo = totalVol > 0 ? (totalAlvo / totalVol) : 0;
            const lucroBrutoAtivo = totalAlvo - totalInvest;
            const margemBrutaPctAtivo = totalAlvo > 0 ? (lucroBrutoAtivo / totalAlvo) * 100 : 0;

            const lucroLiquidoAtivo = totalVendaLiquida - totalInvest;
            const margemLiquidaPctAtivo = totalAlvo > 0 ? (lucroLiquidoAtivo / totalAlvo) * 100 : 0;

            const taxaVendaLiqAtivo = totalAlvo > 0 ? (totalVendaLiquida / totalAlvo) : 1;
            const pontoEquilibrioFatAtivo = taxaVendaLiqAtivo > 0 ? (totalInvest / taxaVendaLiqAtivo) : totalInvest;
            const pontoEquilibrioVolAtivo = pVendaMedioAtivo > 0 ? (pontoEquilibrioFatAtivo / pVendaMedioAtivo) : 0;

            // Scenario Math
            const metaAlvo = parseFloat(p.meta_faturamento) || totalAlvo;
            const consPct = parseFloat(p.cenario_conservador_pct) || 80;
            const modPct = parseFloat(p.cenario_moderado_pct) || 100;
            const agrPct = parseFloat(p.cenario_agressivo_pct) || 120;
            
            const tCons = metaAlvo * (consPct / 100);
            const tMod = metaAlvo * (modPct / 100);
            const tAgr = metaAlvo * (agrPct / 100);
            
            const progressToMod = metaAlvo > 0 ? ((totalReal / tMod) * 100).toFixed(1) : 0;

            const cardHTML = `
                <div style="background:#162433; border:1px solid #1c2e3d; border-radius:10px; padding:16px; position:relative; opacity: ${p.status === 'FINALIZADO' ? '0.7' : '1'}; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 5px 0; color:#2AD07A; display:flex; align-items:center; gap:8px;">
                                ${p.titulo} 
                                ${p.status === 'FINALIZADO' ? '<span style="background:#4a4a4a; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">FINALIZADO</span>' : ''}
                            </h3>
                            <small style="color:#aaa;">Período: ${window.fmtD(p.data_inicial)} até ${window.fmtD(p.data_final)}</small>
                        </div>
                        <div style="display:flex; gap:10px;">
                            ${p.status !== 'FINALIZADO' ? `<button onclick="window.finalizarPlanejamentoV3(${p.id})" style="background:#ffb74d; color:#0d1826; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-flag-checkered"></i> Finalizar</button>` : ''}
                            <button onclick="window.gerarPdfEstrategiaV3(${p.id})" style="background:#2AD07A; color:#0d1826; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <button onclick="window.excluirPlanejamentoV3(${p.id})" style="background:#ff4d4d; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>

                    <!-- Scenarios Row -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:16px;">
                        <div style="background:#0d1826; border:1px solid #2AD07A; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#2AD07A; font-size:12px;">CONSERVADOR (${consPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tCons)}</div>
                            ${totalReal >= tCons ? '<div style="margin-top:5px; background:#2AD07A; color:#0d1826; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                        <div style="background:#0d1826; border:1px solid #f0b800; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#f0b800; font-size:12px;">MODERADO (${modPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tMod)}</div>
                            ${totalReal >= tMod ? '<div style="margin-top:5px; background:#f0b800; color:#0d1826; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                        <div style="background:#0d1826; border:1px solid #ff4d4d; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#ff4d4d; font-size:12px;">AGRESSIVO (${agrPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tAgr)}</div>
                            ${totalReal >= tAgr ? '<div style="margin-top:5px; background:#ff4d4d; color:#fff; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                    </div>

                    <!-- Card de Indicadores Estratégicos para o Plano Ativo -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:16px; padding:10px; background:#0d1826; border:1px solid #1a3a5c; border-radius:8px;">
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #2AD07A;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-chart-line" style="color:#2AD07A;"></i> Margem Bruta</span>
                            <span style="font-size:13px; color:#2AD07A; font-weight:bold;">R$ ${window.fmtBRL(lucroBrutoAtivo)} (${margemBrutaPctAtivo.toFixed(1)}%)</span>
                        </div>
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #00e5ff;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-scale-balanced" style="color:#00e5ff;"></i> Margem Líquida Est.</span>
                            <span style="font-size:13px; color:#00e5ff; font-weight:bold;">R$ ${window.fmtBRL(lucroLiquidoAtivo)} (${margemLiquidaPctAtivo.toFixed(1)}%)</span>
                        </div>
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #ffb74d;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-bullseye" style="color:#ffb74d;"></i> Ponto de Equilíbrio</span>
                            <span style="font-size:13px; color:#ffb74d; font-weight:bold;">R$ ${window.fmtBRL(pontoEquilibrioFatAtivo)} (${pontoEquilibrioVolAtivo.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg)</span>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div style="background:#0d1826; border:1px solid #1a2e3f; padding:12px; border-radius:8px; margin-bottom:16px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="color:#aaa; font-size:12px;">Progresso Total (Base Moderado)</span>
                            <span style="color:#2AD07A; font-weight:bold; font-size:12px;">R$ ${window.fmtBRL(totalReal)} / R$ ${window.fmtBRL(tMod)} (${progressToMod}%)</span>
                        </div>
                        <div style="width:100%; background:#162433; height:10px; border-radius:5px; position:relative; overflow:hidden;">
                            <div style="width:${Math.min(progressToMod, 100)}%; background:linear-gradient(90deg, #00e5ff, #2AD07A); height:100%; border-radius:5px; transition:width 0.5s;"></div>
                        </div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px; color:#fff;">
                        <thead>
                            <tr style="background:#0d1826; border-bottom:1px solid #2a4158;">
                                <th style="padding:10px; color:#aaa;">Produto</th>
                                <th style="padding:10px; color:#aaa;">Fração</th>
                                <th style="padding:10px; color:#aaa;">Meta (R$)</th>
                                <th style="padding:10px; color:#aaa;">Realizado (R$)</th>
                                <th style="padding:10px; color:#aaa;">Progresso</th>
                                <th style="padding:10px; color:#aaa;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlItens}
                        </tbody>
                        <tfoot style="border-top:2px solid #00e5ff; font-weight:bold; background:#0d1826;">
                            <tr style="color:#00e5ff; border-bottom:1px solid #1a2e3f;">
                                <td style="padding:10px;">TOTAL</td>
                                <td style="padding:10px;">${totalFracaoPct.toFixed(1)}%</td>
                                <td style="padding:10px; color:#2AD07A;">R$ ${window.fmtBRL(totalAlvo)}</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(totalReal)}</td>
                                <td style="padding:10px; color:#2AD07A;">${totalAlvo > 0 ? ((totalReal/totalAlvo)*100).toFixed(1) : 0}%</td>
                                <td style="padding:10px;"></td>
                            </tr>
                            <tr style="color:#e0e0e0; background:rgba(0,229,255,0.06);">
                                <td style="padding:10px; color:#00e5ff;"><i class="fa-solid fa-calculator"></i> MÉDIAS</td>
                                <td style="padding:10px;">${mediaFracaoAtivo.toFixed(1)}%</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(mediaAlvoAtivo)}</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(mediaRealAtivo)}</td>
                                <td style="padding:10px; color:#00e5ff;">${mediaAlvoAtivo > 0 ? ((mediaRealAtivo/mediaAlvoAtivo)*100).toFixed(1) : 0}%</td>
                                <td style="padding:10px;"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
            container.innerHTML += cardHTML;
        });
    }

    window.filtrarPlanejamentosAtivosV3 = function() {
        const container = document.getElementById('container-planejamentos-ativos');
        const lblContador = document.getElementById('plestv3-filtro-contador');
        if (!container) return;

        const allPlanos = window._allPlanosAtivosV3 || [];
        if (allPlanos.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center;">Nenhum planejamento ativo encontrado.</p>';
            if (lblContador) lblContador.textContent = '0 encontrados';
            return;
        }

        const mes = document.getElementById('plestv3-filtro-mes')?.value || '';
        const ano = document.getElementById('plestv3-filtro-ano')?.value || '';
        const status = document.getElementById('plestv3-filtro-status')?.value || '';
        const busca = (document.getElementById('plestv3-filtro-busca')?.value || '').toLowerCase().trim();

        const checkedItems = Array.from(document.querySelectorAll('.plestv3-chk-titulo-item:checked')).map(c => parseInt(c.value, 10));

        const monthNamesMap = {
            '01': 'janeiro', '02': 'fevereiro', '03': 'março', '04': 'abril',
            '05': 'maio', '06': 'junho', '07': 'julho', '08': 'agosto',
            '09': 'setembro', '10': 'outubro', '11': 'novembro', '12': 'dezembro'
        };

        const planosFiltrados = allPlanos.filter(p => {
            if (document.querySelectorAll('.plestv3-chk-titulo-item').length > 0) {
                if (!checkedItems.includes(p.id)) return false;
            }

            const tituloLower = (p.titulo || '').toLowerCase();
            const dtIni = (p.data_inicial || '');
            const dtFim = (p.data_final || '');
            const targetMonthName = mes ? monthNamesMap[mes] : null;

            if (mes) {
                const matchDtIni = dtIni.includes(`-${mes}-`) || dtIni.startsWith(`${mes}/`) || dtIni.includes(`/${mes}/`);
                const matchDtFim = dtFim.includes(`-${mes}-`) || dtFim.startsWith(`${mes}/`) || dtFim.includes(`/${mes}/`);
                const matchTituloName = targetMonthName && tituloLower.includes(targetMonthName);
                const matchTituloNum = tituloLower.includes(`/${mes}`) || tituloLower.includes(`-${mes}`);
                if (!matchDtIni && !matchDtFim && !matchTituloName && !matchTituloNum) return false;
            }

            if (ano) {
                const matchDtIni = dtIni.includes(ano);
                const matchDtFim = dtFim.includes(ano);
                const matchTitulo = tituloLower.includes(ano);
                if (!matchDtIni && !matchDtFim && !matchTitulo) return false;
            }

            if (status) {
                if (p.status !== status) return false;
            }

            if (busca) {
                const matchTitulo = tituloLower.includes(busca);
                const matchItens = (p.itens || []).some(it => {
                    const mNome = (_listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || '').toLowerCase();
                    return mNome.includes(busca);
                });
                if (!matchTitulo && !matchItens) return false;
            }

            return true;
        });

        if (lblContador) {
            lblContador.textContent = `${planosFiltrados.length} de ${allPlanos.length} exibidos`;
        }

        if (planosFiltrados.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; background:#162433; border-radius:10px; border:1px dashed #2a4158; color:#aaa;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; color:#ffb74d; margin-bottom:10px; display:block;"></i>
                    Nenhum planejamento encontrado para os filtros selecionados.<br>
                    <small style="color:#666;">Tente alterar a seleção de títulos, Mês, Ano ou termo de busca.</small>
                </div>
            `;
            return;
        }

        renderCardsPlanosV3(planosFiltrados, container);
    };

    window.gerarPdfMultiEstrategiaV3 = function() {
        const allPlanos = window._allPlanosAtivosV3 || [];
        if (allPlanos.length === 0) {
            _apexNotify('Aviso', 'Nenhum planejamento disponível para exportar em PDF.', 'info');
            return;
        }

        const checkedItems = Array.from(document.querySelectorAll('.plestv3-chk-titulo-item:checked')).map(c => parseInt(c.value, 10));
        let planosParaExportar = allPlanos;
        
        if (document.querySelectorAll('.plestv3-chk-titulo-item').length > 0) {
            planosParaExportar = allPlanos.filter(p => checkedItems.includes(p.id));
        }

        if (planosParaExportar.length === 0) {
            _apexNotify('Aviso', 'Por favor, marque pelo menos 1 planejamento no filtro de títulos para baixar em PDF.', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        planosParaExportar.forEach((plano, index) => {
            if (index > 0) doc.addPage();

            doc.setFillColor(13, 36, 51);
            doc.rect(0, 0, 210, 25, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('APEXTECH METAIS', 15, 12);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`RELATÓRIO ESTRATÉGICO DE METAS (${index + 1}/${planosParaExportar.length})`, 15, 18);

            doc.setTextColor(40, 40, 40);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(plano.titulo, 15, 33);

            let totalAlvo = 0;
            let totalReal = 0;
            let totalInvest = 0;
            let totalVol = 0;
            let totalFracao = 0;
            let totalVendaLiquida = 0;

            plano.itens.forEach(it => {
                const alvo = parseFloat(it.faturamento_alvo) || 0;
                const real = parseFloat(it.faturamento_realizado) || 0;
                const invest = parseFloat(it.investimento_necessario) || 0;
                const vol = parseFloat(it.volume_necessario) || 0;
                const fracao = parseFloat(it.fracao_pct) || 0;

                let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
                const pRef = plano.frente === 'venda'
                    ? parseFloat(tp?.preco_venda || tp?.venda_ref || 0)
                    : parseFloat(tp?.preco_entregar || tp?.preco_compra || 0);

                const comissao = parseFloat(tp?.comissao || 0);
                const pisCofins = parseFloat(tp?.pis_cofins || 0);
                const fidc = parseFloat(tp?.fidc || 0);
                const icms = parseFloat(tp?.icms || 0);
                const freteColeta = parseFloat(tp?.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoesUnit = pRef * (totalDedPct / 100);
                const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);

                totalAlvo += alvo;
                totalReal += real;
                totalInvest += invest;
                totalVol += vol;
                totalFracao += fracao;
                totalVendaLiquida += (vol * vendaLiquidaUnit);
            });

            const count = plano.itens.length || 1;
            const mediaAlvo = totalAlvo / count;
            const mediaReal = totalReal / count;
            const mediaInvest = totalInvest / count;
            const mediaVol = totalVol / count;
            const mediaFracao = totalFracao / count;

            const totalFalta = Math.max(0, totalAlvo - totalReal);
            const mediaFalta = Math.max(0, mediaAlvo - mediaReal);

            const totalPct = totalAlvo > 0 ? ((totalReal / totalAlvo) * 100).toFixed(1) : '0.0';
            const mediaPct = mediaAlvo > 0 ? ((mediaReal / mediaAlvo) * 100).toFixed(1) : '0.0';

            const pVendaPond = totalVol > 0 ? (totalAlvo / totalVol) : 0;
            const lucroBruto = totalAlvo - totalInvest;
            const margemBrutaPct = totalAlvo > 0 ? (lucroBruto / totalAlvo) * 100 : 0;

            const lucroLiquido = totalVendaLiquida - totalInvest;
            const margemLiquidaPct = totalAlvo > 0 ? (lucroLiquido / totalAlvo) * 100 : 0;

            const taxaVendaLiquida = totalAlvo > 0 ? (totalVendaLiquida / totalAlvo) : 1;
            const pontoEquilibrioFat = taxaVendaLiquida > 0 ? (totalInvest / taxaVendaLiquida) : totalInvest;
            const pontoEquilibrioVol = pVendaPond > 0 ? (pontoEquilibrioFat / pVendaPond) : 0;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Periodo: ${window.fmtD(plano.data_inicial)} a ${window.fmtD(plano.data_final)}`, 15, 40);
            doc.text(`Estrategia: ${plano.frente === 'venda' ? 'Foco em Venda' : 'Foco em Compra'}`, 15, 45);
            doc.text(`Status: ${plano.status || 'EM ANDAMENTO'}`, 15, 50);

            doc.setFont('helvetica', 'bold');
            doc.text(`Métricas Globais & Financeiras:`, 110, 33);
            doc.setFont('helvetica', 'normal');
            doc.text(`Investimento Previsto: R$ ${window.fmtBRL(totalInvest)}`, 110, 39);
            doc.text(`Meta Global (Alvo): R$ ${window.fmtBRL(totalAlvo)}`, 110, 44);
            doc.text(`Total Realizado: R$ ${window.fmtBRL(totalReal)} (${totalPct}%)`, 110, 49);
            doc.text(`Margem Bruta: R$ ${window.fmtBRL(lucroBruto)} (${margemBrutaPct.toFixed(1)}%)`, 110, 54);
            doc.text(`Margem Liquida Est.: R$ ${window.fmtBRL(lucroLiquido)} (${margemLiquidaPct.toFixed(1)}%)`, 110, 59);
            doc.text(`Ponto de Equilibrio: R$ ${window.fmtBRL(pontoEquilibrioFat)} (${pontoEquilibrioVol.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg)`, 110, 64);

            const headers = [['Produto', 'Mix (%)', 'Vol (kg)', 'Investimento', 'Meta Alvo', 'Realizado', 'Falta', '%']];
            const body = plano.itens.map(it => {
                const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || 'Material ' + it.material_id;
                const vol = parseFloat(it.volume_necessario) || 0;
                const invest = parseFloat(it.investimento_necessario) || 0;
                const alvo = parseFloat(it.faturamento_alvo) || 0;
                const real = parseFloat(it.faturamento_realizado) || 0;
                const falta = Math.max(0, alvo - real);
                const pct = alvo > 0 ? ((real / alvo) * 100).toFixed(1) + '%' : '0%';
                
                return [
                    mNome, 
                    it.fracao_pct + '%', 
                    vol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                    'R$ ' + window.fmtBRL(invest),
                    'R$ ' + window.fmtBRL(alvo), 
                    'R$ ' + window.fmtBRL(real), 
                    'R$ ' + window.fmtBRL(falta),
                    pct
                ];
            });

            const foot = [
                [
                    'TOTAL',
                    totalFracao.toFixed(1) + '%',
                    totalVol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                    'R$ ' + window.fmtBRL(totalInvest),
                    'R$ ' + window.fmtBRL(totalAlvo),
                    'R$ ' + window.fmtBRL(totalReal),
                    'R$ ' + window.fmtBRL(totalFalta),
                    totalPct + '%'
                ],
                [
                    'MEDIAS',
                    mediaFracao.toFixed(1) + '%',
                    mediaVol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                    'R$ ' + window.fmtBRL(mediaInvest),
                    'R$ ' + window.fmtBRL(mediaAlvo),
                    'R$ ' + window.fmtBRL(mediaReal),
                    'R$ ' + window.fmtBRL(mediaFalta),
                    mediaPct + '%'
                ]
            ];

            doc.autoTable({
                startY: 70,
                head: headers,
                body: body,
                foot: foot,
                theme: 'grid',
                headStyles: { fillColor: [22, 36, 51] },
                footStyles: { fillColor: [13, 36, 51], textColor: [0, 229, 255], fontStyle: 'bold' },
                styles: { fontSize: 8 }
            });

            const finalY = doc.lastAutoTable.finalY + 15;
            doc.setFontSize(9);
            doc.text(`Relatorio gerado em: ${new Date().toLocaleString('pt-BR')} — ApexTech Metais`, 15, finalY);
        });

        const nomeArquivo = planosParaExportar.length === 1 
            ? `Planejamento_${planosParaExportar[0].titulo.replace(/\s+/g, '_')}.pdf`
            : `Relatorio_Planejamentos_Selecionados_${new Date().getTime()}.pdf`;

        doc.save(nomeArquivo);
        _apexNotify('Sucesso', `PDF gerado com sucesso para ${planosParaExportar.length} planejamento(s).`, 'success');
    };

    function renderCardsPlanosV3(planosArray, container) {
        if (!container) return;
        container.innerHTML = '';
        planosArray.forEach(p => {
            let htmlItens = '';
            let totalAlvo = 0;
            let totalReal = 0;
            let totalInvest = 0;
            let totalVol = 0;
            let totalFracaoPct = 0;
            let totalVendaLiquida = 0;

            p.itens.forEach(it => {
                const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || 'Material ' + it.material_id;
                const fAlvo = parseFloat(it.faturamento_alvo) || 0;
                const fReal = parseFloat(it.faturamento_realizado) || 0;
                const invest = parseFloat(it.investimento_necessario) || 0;
                const vol = parseFloat(it.volume_necessario) || 0;
                const fracao = parseFloat(it.fracao_pct) || 0;

                let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
                const pRef = p.frente === 'venda'
                    ? parseFloat(tp?.preco_venda || tp?.venda_ref || 0)
                    : parseFloat(tp?.preco_entregar || tp?.preco_compra || 0);

                const comissao = parseFloat(tp?.comissao || 0);
                const pisCofins = parseFloat(tp?.pis_cofins || 0);
                const fidc = parseFloat(tp?.fidc || 0);
                const icms = parseFloat(tp?.icms || 0);
                const freteColeta = parseFloat(tp?.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoesUnit = pRef * (totalDedPct / 100);
                const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);

                totalAlvo += fAlvo;
                totalReal += fReal;
                totalInvest += invest;
                totalVol += vol;
                totalFracaoPct += fracao;
                totalVendaLiquida += (vol * vendaLiquidaUnit);

                const progPct = fAlvo > 0 ? ((fReal / fAlvo) * 100).toFixed(1) : 0;
                
                htmlItens += `
                    <tr style="border-bottom:1px solid #1a2e3f;">
                        <td style="padding:10px;">${mNome}</td>
                        <td style="padding:10px;">${it.fracao_pct}%</td>
                        <td style="padding:10px; color:#2AD07A;">R$ ${window.fmtBRL(fAlvo)}</td>
                        <td style="padding:10px;">
                            <input type="text" id="plestv3-realizado-${it.id}" class="noble-input" value="${window.fmtBRL(fReal)}" style="width:100px; padding:4px;" oninput="window.maskCurrencyV3(this)" ${p.status === 'FINALIZADO' ? 'disabled' : ''}>
                        </td>
                        <td style="padding:10px;">
                            <div style="width:100%; background:#0d1826; height:6px; border-radius:3px; margin-top:6px;">
                                <div style="width:${Math.min(progPct, 100)}%; background:${progPct >= 100 ? '#2AD07A' : '#00e5ff'}; height:100%; border-radius:3px;"></div>
                            </div>
                            <small style="color:#aaa; font-size:10px;">${progPct}%</small>
                        </td>
                        <td style="padding:10px;">
                            ${p.status !== 'FINALIZADO' ? `<button onclick="window.atualizarRealizadoV3(${it.id})" style="background:#00e5ff; color:#0d1826; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">Salvar Realizado</button>` : '<span style="color:#aaa; font-size:11px;">Finalizado</span>'}
                        </td>
                    </tr>
                `;
            });

            // Cálculos de Totais, Médias e Indicadores Estratégicos do Plano Ativo
            const countAtivos = p.itens.length || 1;
            const mediaFracaoAtivo = totalFracaoPct / countAtivos;
            const mediaAlvoAtivo = totalAlvo / countAtivos;
            const mediaRealAtivo = totalReal / countAtivos;

            const pVendaMedioAtivo = totalVol > 0 ? (totalAlvo / totalVol) : 0;
            const lucroBrutoAtivo = totalAlvo - totalInvest;
            const margemBrutaPctAtivo = totalAlvo > 0 ? (lucroBrutoAtivo / totalAlvo) * 100 : 0;

            const lucroLiquidoAtivo = totalVendaLiquida - totalInvest;
            const margemLiquidaPctAtivo = totalAlvo > 0 ? (lucroLiquidoAtivo / totalAlvo) * 100 : 0;

            const taxaVendaLiqAtivo = totalAlvo > 0 ? (totalVendaLiquida / totalAlvo) : 1;
            const pontoEquilibrioFatAtivo = taxaVendaLiqAtivo > 0 ? (totalInvest / taxaVendaLiqAtivo) : totalInvest;
            const pontoEquilibrioVolAtivo = pVendaMedioAtivo > 0 ? (pontoEquilibrioFatAtivo / pVendaMedioAtivo) : 0;

            // Scenario Math
            const metaAlvo = parseFloat(p.meta_faturamento) || totalAlvo;
            const consPct = parseFloat(p.cenario_conservador_pct) || 80;
            const modPct = parseFloat(p.cenario_moderado_pct) || 100;
            const agrPct = parseFloat(p.cenario_agressivo_pct) || 120;
            
            const tCons = metaAlvo * (consPct / 100);
            const tMod = metaAlvo * (modPct / 100);
            const tAgr = metaAlvo * (agrPct / 100);
            
            const progressToMod = metaAlvo > 0 ? ((totalReal / tMod) * 100).toFixed(1) : 0;

            const cardHTML = `
                <div style="background:#162433; border:1px solid #1c2e3d; border-radius:10px; padding:16px; position:relative; opacity: ${p.status === 'FINALIZADO' ? '0.7' : '1'}; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 5px 0; color:#2AD07A; display:flex; align-items:center; gap:8px;">
                                ${p.titulo} 
                                ${p.status === 'FINALIZADO' ? '<span style="background:#4a4a4a; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">FINALIZADO</span>' : ''}
                            </h3>
                            <small style="color:#aaa;">Período: ${window.fmtD(p.data_inicial)} até ${window.fmtD(p.data_final)}</small>
                        </div>
                        <div style="display:flex; gap:10px;">
                            ${p.status !== 'FINALIZADO' ? `<button onclick="window.finalizarPlanejamentoV3(${p.id})" style="background:#ffb74d; color:#0d1826; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-flag-checkered"></i> Finalizar</button>` : ''}
                            <button onclick="window.gerarPdfEstrategiaV3(${p.id})" style="background:#2AD07A; color:#0d1826; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <button onclick="window.excluirPlanejamentoV3(${p.id})" style="background:#ff4d4d; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>

                    <!-- Scenarios Row -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:16px;">
                        <div style="background:#0d1826; border:1px solid #2AD07A; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#2AD07A; font-size:12px;">CONSERVADOR (${consPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tCons)}</div>
                            ${totalReal >= tCons ? '<div style="margin-top:5px; background:#2AD07A; color:#0d1826; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                        <div style="background:#0d1826; border:1px solid #f0b800; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#f0b800; font-size:12px;">MODERADO (${modPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tMod)}</div>
                            ${totalReal >= tMod ? '<div style="margin-top:5px; background:#f0b800; color:#0d1826; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                        <div style="background:#0d1826; border:1px solid #ff4d4d; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#ff4d4d; font-size:12px;">AGRESSIVO (${agrPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tAgr)}</div>
                            ${totalReal >= tAgr ? '<div style="margin-top:5px; background:#ff4d4d; color:#fff; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                    </div>

                    <!-- Card de Indicadores Estratégicos para o Plano Ativo -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:16px; padding:10px; background:#0d1826; border:1px solid #1a3a5c; border-radius:8px;">
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #2AD07A;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-chart-line" style="color:#2AD07A;"></i> Margem Bruta</span>
                            <span style="font-size:13px; color:#2AD07A; font-weight:bold;">R$ ${window.fmtBRL(lucroBrutoAtivo)} (${margemBrutaPctAtivo.toFixed(1)}%)</span>
                        </div>
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #00e5ff;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-scale-balanced" style="color:#00e5ff;"></i> Margem Líquida Est.</span>
                            <span style="font-size:13px; color:#00e5ff; font-weight:bold;">R$ ${window.fmtBRL(lucroLiquidoAtivo)} (${margemLiquidaPctAtivo.toFixed(1)}%)</span>
                        </div>
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #ffb74d;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-bullseye" style="color:#ffb74d;"></i> Ponto de Equilíbrio</span>
                            <span style="font-size:13px; color:#ffb74d; font-weight:bold;">R$ ${window.fmtBRL(pontoEquilibrioFatAtivo)} (${pontoEquilibrioVolAtivo.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg)</span>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div style="background:#0d1826; border:1px solid #1a2e3f; padding:12px; border-radius:8px; margin-bottom:16px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="color:#aaa; font-size:12px;">Progresso Total (Base Moderado)</span>
                            <span style="color:#2AD07A; font-weight:bold; font-size:12px;">R$ ${window.fmtBRL(totalReal)} / R$ ${window.fmtBRL(tMod)} (${progressToMod}%)</span>
                        </div>
                        <div style="width:100%; background:#162433; height:10px; border-radius:5px; position:relative; overflow:hidden;">
                            <div style="width:${Math.min(progressToMod, 100)}%; background:linear-gradient(90deg, #00e5ff, #2AD07A); height:100%; border-radius:5px; transition:width 0.5s;"></div>
                        </div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px; color:#fff;">
                        <thead>
                            <tr style="background:#0d1826; border-bottom:1px solid #2a4158;">
                                <th style="padding:10px; color:#aaa;">Produto</th>
                                <th style="padding:10px; color:#aaa;">Fração</th>
                                <th style="padding:10px; color:#aaa;">Meta (R$)</th>
                                <th style="padding:10px; color:#aaa;">Realizado (R$)</th>
                                <th style="padding:10px; color:#aaa;">Progresso</th>
                                <th style="padding:10px; color:#aaa;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlItens}
                        </tbody>
                        <tfoot style="border-top:2px solid #00e5ff; font-weight:bold; background:#0d1826;">
                            <tr style="color:#00e5ff; border-bottom:1px solid #1a2e3f;">
                                <td style="padding:10px;">TOTAL</td>
                                <td style="padding:10px;">${totalFracaoPct.toFixed(1)}%</td>
                                <td style="padding:10px; color:#2AD07A;">R$ ${window.fmtBRL(totalAlvo)}</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(totalReal)}</td>
                                <td style="padding:10px; color:#2AD07A;">${totalAlvo > 0 ? ((totalReal/totalAlvo)*100).toFixed(1) : 0}%</td>
                                <td style="padding:10px;"></td>
                            </tr>
                            <tr style="color:#e0e0e0; background:rgba(0,229,255,0.06);">
                                <td style="padding:10px; color:#00e5ff;"><i class="fa-solid fa-calculator"></i> MÉDIAS</td>
                                <td style="padding:10px;">${mediaFracaoAtivo.toFixed(1)}%</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(mediaAlvoAtivo)}</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(mediaRealAtivo)}</td>
                                <td style="padding:10px; color:#00e5ff;">${mediaAlvoAtivo > 0 ? ((mediaRealAtivo/mediaAlvoAtivo)*100).toFixed(1) : 0}%</td>
                                <td style="padding:10px;"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
            container.innerHTML += cardHTML;
        });
    }

    window.filtrarPlanejamentosAtivosV3 = function() {
        const container = document.getElementById('container-planejamentos-ativos');
        const lblContador = document.getElementById('plestv3-filtro-contador');
        if (!container) return;

        const allPlanos = window._allPlanosAtivosV3 || [];
        if (allPlanos.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center;">Nenhum planejamento ativo encontrado.</p>';
            if (lblContador) lblContador.textContent = '0 encontrados';
            return;
        }

        const mes = document.getElementById('plestv3-filtro-mes')?.value || '';
        const ano = document.getElementById('plestv3-filtro-ano')?.value || '';
        const status = document.getElementById('plestv3-filtro-status')?.value || '';
        const busca = (document.getElementById('plestv3-filtro-busca')?.value || '').toLowerCase().trim();

        const monthNamesMap = {
            '01': 'janeiro', '02': 'fevereiro', '03': 'março', '04': 'abril',
            '05': 'maio', '06': 'junho', '07': 'julho', '08': 'agosto',
            '09': 'setembro', '10': 'outubro', '11': 'novembro', '12': 'dezembro'
        };

        const planosFiltrados = allPlanos.filter(p => {
            const tituloLower = (p.titulo || '').toLowerCase();
            const dtIni = (p.data_inicial || '');
            const dtFim = (p.data_final || '');
            const targetMonthName = mes ? monthNamesMap[mes] : null;

            if (mes) {
                const matchDtIni = dtIni.includes(`-${mes}-`) || dtIni.startsWith(`${mes}/`) || dtIni.includes(`/${mes}/`);
                const matchDtFim = dtFim.includes(`-${mes}-`) || dtFim.startsWith(`${mes}/`) || dtFim.includes(`/${mes}/`);
                const matchTituloName = targetMonthName && tituloLower.includes(targetMonthName);
                const matchTituloNum = tituloLower.includes(`/${mes}`) || tituloLower.includes(`-${mes}`);
                if (!matchDtIni && !matchDtFim && !matchTituloName && !matchTituloNum) return false;
            }

            if (ano) {
                const matchDtIni = dtIni.includes(ano);
                const matchDtFim = dtFim.includes(ano);
                const matchTitulo = tituloLower.includes(ano);
                if (!matchDtIni && !matchDtFim && !matchTitulo) return false;
            }

            if (status) {
                if (p.status !== status) return false;
            }

            if (busca) {
                const matchTitulo = tituloLower.includes(busca);
                const matchItens = (p.itens || []).some(it => {
                    const mNome = (_listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || '').toLowerCase();
                    return mNome.includes(busca);
                });
                if (!matchTitulo && !matchItens) return false;
            }

            return true;
        });

        if (lblContador) {
            lblContador.textContent = `${planosFiltrados.length} de ${allPlanos.length} exibidos`;
        }

        if (planosFiltrados.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; background:#162433; border-radius:10px; border:1px dashed #2a4158; color:#aaa;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; color:#ffb74d; margin-bottom:10px; display:block;"></i>
                    Nenhum planejamento encontrado para os filtros selecionados.<br>
                    <small style="color:#666;">Tente alterar o Mês, Ano ou termo de busca.</small>
                </div>
            `;
            return;
        }

        renderCardsPlanosV3(planosFiltrados, container);
    };

    window.renderPlanejamentosAtivosV3 = async function() {
        const container = document.getElementById('container-planejamentos-ativos');
        if (!container) return;
        
        container.innerHTML = '<p style="color:#aaa;">Carregando planos ativos...</p>';

        try {
            if (!_listTabelaPrecosEstrategica || _listTabelaPrecosEstrategica.length === 0) {
                // Ao invés de buscar só 1 tabela, chamamos a rotina principal
                if (window.carregarPlanejamentoEstrategicov3) {
                    await window.carregarPlanejamentoEstrategicov3();
                }
            }
            
            const resMetas = await fetch('/api/planejamento-estrategicov3');
            const rawMetas = await resMetas.json();
            _listMetasV3 = Array.isArray(rawMetas) ? rawMetas : [];

            if (window.popularSelectsProdutoEstrategicov3) window.popularSelectsProdutoEstrategicov3();
            if (window.onChangeConsultaMaterialV3) window.onChangeConsultaMaterialV3();
            if (window.recalcularSimulacaoV3) window.recalcularSimulacaoV3();
            
            if (!_mesV3Ativo) {
                const today = new Date();
                _mesV3Ativo = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
            }
            window.detalharMesEstrategicov3(_mesV3Ativo);

            const res = await fetch('/api/estrategiav3_planos');
            if(!res.ok) throw new Error('Falha ao buscar planos');
            const data = await res.json();
            if(!data.success) throw new Error(data.error);

            window._allPlanosAtivosV3 = data.planos || [];
            window._lastPlanosConsultados = data.planos || [];

            if (window.popularMultiSelectTitulosV3) window.popularMultiSelectTitulosV3();
            window.filtrarPlanejamentosAtivosV3();

        } catch(e) {
            console.error(e);
            container.innerHTML = '<p style="color:#ff4d4d;">Erro ao carregar planos.</p>';
        }
    };

    window.excluirPlanejamentoV3 = async function(id) {
        if(!confirm('Tem certeza que deseja excluir este planejamento definitivamente?')) return;
        try {
            const res = await fetch(`/api/estrategiav3_planos/${id}`, { method: 'DELETE' });
            if(res.ok) {
                _apexNotify('Sucesso', 'Planejamento excluído.', 'success');
                window.renderPlanejamentosAtivosV3();
            } else {
                _apexNotify('Erro', 'Não foi possível excluir.', 'error');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Falha na exclusão.', 'error');
        }
    };

    window.finalizarPlanejamentoV3 = async function(id) {
        if(!confirm('Deseja finalizar este planejamento? Você não poderá mais editar os valores realizados.')) return;
        try {
            const res = await fetch(`/api/estrategiav3_planos/${id}/status`, { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'FINALIZADO' })
            });
            if(res.ok) {
                _apexNotify('Sucesso', 'Planejamento finalizado.', 'success');
                window.renderPlanejamentosAtivosV3();
            } else {
                _apexNotify('Erro', 'Não foi possível finalizar.', 'error');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Falha na finalização.', 'error');
        }
    };

    window.alternarSubAbaEstrategico = function(aba) {
        const abas = ['margens', 'radar', 'payback', 'compra', 'venda', 'ativos'];
        
        abas.forEach(nome => {
            const btn = document.getElementById(`tab-btn-estr-${nome}`);
            const sec = document.getElementById(`subaba-estr-${nome}`);
            if (btn) btn.classList.remove('active');
            if (sec) sec.style.display = 'none';
        });

        const btnAtivo = document.getElementById(`tab-btn-estr-${aba}`);
        const secAtiva = document.getElementById(`subaba-estr-${aba}`);

        if (btnAtivo) btnAtivo.classList.add('active');
        if (secAtiva) secAtiva.style.display = 'block';

        if (aba === 'ativos') {
            if (window.carregarPlanejamentoDashboard) window.carregarPlanejamentoDashboard();
            window.renderPlanejamentosAtivosV3();
        } else if (aba === 'radar') {
            if (window.renderRadarOportunidades) window.renderRadarOportunidades();
        } else if (aba === 'payback') {
            if (window.calcularPaybackEROIV3) window.calcularPaybackEROIV3();
        } else if (aba === 'compra') {
            if (window.renderAnaliseComprarV3) window.renderAnaliseComprarV3();
        } else if (aba === 'venda') {
            if (window.renderAnaliseVenderV3) window.renderAnaliseVenderV3();
        }
    };

    window.gerarPdfEstrategiaV3 = function(planoId) {
        if (!window._lastPlanosConsultados) return;
        const plano = window._lastPlanosConsultados.find(p => p.id === planoId);
        if (!plano) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        doc.setFillColor(13, 36, 22);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('APEXTECH METAIS', 15, 12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('ESTRATEGIA DE CRESCIMENTO E METAS (V3)', 15, 18);

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhes do Planejamento', 15, 33);
        
        let totalAlvo = 0;
        let totalReal = 0;
        let totalInvest = 0;
        let totalVol = 0;
        let totalFracao = 0;
        let totalVendaLiquida = 0;

        plano.itens.forEach(it => {
            const alvo = parseFloat(it.faturamento_alvo) || 0;
            const real = parseFloat(it.faturamento_realizado) || 0;
            const invest = parseFloat(it.investimento_necessario) || 0;
            const vol = parseFloat(it.volume_necessario) || 0;
            const fracao = parseFloat(it.fracao_pct) || 0;

            let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
            const pRef = plano.frente === 'venda'
                ? parseFloat(tp?.preco_venda || tp?.venda_ref || 0)
                : parseFloat(tp?.preco_entregar || tp?.preco_compra || 0);

            const comissao = parseFloat(tp?.comissao || 0);
            const pisCofins = parseFloat(tp?.pis_cofins || 0);
            const fidc = parseFloat(tp?.fidc || 0);
            const icms = parseFloat(tp?.icms || 0);
            const freteColeta = parseFloat(tp?.frete_coleta || 0);
            const totalDedPct = comissao + pisCofins + fidc + icms;
            const valDeducoesUnit = pRef * (totalDedPct / 100);
            const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);

            totalAlvo += alvo;
            totalReal += real;
            totalInvest += invest;
            totalVol += vol;
            totalFracao += fracao;
            totalVendaLiquida += (vol * vendaLiquidaUnit);
        });

        const count = plano.itens.length || 1;
        const mediaAlvo = totalAlvo / count;
        const mediaReal = totalReal / count;
        const mediaInvest = totalInvest / count;
        const mediaVol = totalVol / count;
        const mediaFracao = totalFracao / count;

        const totalFalta = Math.max(0, totalAlvo - totalReal);
        const mediaFalta = Math.max(0, mediaAlvo - mediaReal);

        const totalPct = totalAlvo > 0 ? ((totalReal / totalAlvo) * 100).toFixed(1) : '0.0';
        const mediaPct = mediaAlvo > 0 ? ((mediaReal / mediaAlvo) * 100).toFixed(1) : '0.0';

        const pVendaPond = totalVol > 0 ? (totalAlvo / totalVol) : 0;

        const lucroBruto = totalAlvo - totalInvest;
        const margemBrutaPct = totalAlvo > 0 ? (lucroBruto / totalAlvo) * 100 : 0;

        const lucroLiquido = totalVendaLiquida - totalInvest;
        const margemLiquidaPct = totalAlvo > 0 ? (lucroLiquido / totalAlvo) * 100 : 0;

        const taxaVendaLiquida = totalAlvo > 0 ? (totalVendaLiquida / totalAlvo) : 1;
        const pontoEquilibrioFat = taxaVendaLiquida > 0 ? (totalInvest / taxaVendaLiquida) : totalInvest;
        const pontoEquilibrioVol = pVendaPond > 0 ? (pontoEquilibrioFat / pVendaPond) : 0;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Titulo: ${plano.titulo}`, 15, 40);
        doc.text(`Periodo: ${window.fmtD(plano.data_inicial)} a ${window.fmtD(plano.data_final)}`, 15, 45);
        doc.text(`Estrategia: ${plano.frente === 'venda' ? 'Foco em Venda' : 'Foco em Compra'}`, 15, 50);

        doc.setFont('helvetica', 'bold');
        doc.text(`Métricas Globais & Financeiras:`, 110, 33);
        doc.setFont('helvetica', 'normal');
        doc.text(`Investimento Previsto: R$ ${window.fmtBRL(totalInvest)}`, 110, 39);
        doc.text(`Meta Global (Alvo): R$ ${window.fmtBRL(totalAlvo)}`, 110, 44);
        doc.text(`Total Realizado: R$ ${window.fmtBRL(totalReal)} (${totalPct}%)`, 110, 49);
        doc.text(`Margem Bruta: R$ ${window.fmtBRL(lucroBruto)} (${margemBrutaPct.toFixed(1)}%)`, 110, 54);
        doc.text(`Margem Liquida Est.: R$ ${window.fmtBRL(lucroLiquido)} (${margemLiquidaPct.toFixed(1)}%)`, 110, 59);
        doc.text(`Ponto de Equilibrio: R$ ${window.fmtBRL(pontoEquilibrioFat)} (${pontoEquilibrioVol.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg)`, 110, 64);

        const headers = [['Produto', 'Mix (%)', 'Vol (kg)', 'Investimento', 'Meta Alvo', 'Realizado', 'Falta', '%']];
        const body = plano.itens.map(it => {
            const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || 'Material ' + it.material_id;
            const vol = parseFloat(it.volume_necessario) || 0;
            const invest = parseFloat(it.investimento_necessario) || 0;
            const alvo = parseFloat(it.faturamento_alvo) || 0;
            const real = parseFloat(it.faturamento_realizado) || 0;
            const falta = Math.max(0, alvo - real);
            const pct = alvo > 0 ? ((real / alvo) * 100).toFixed(1) + '%' : '0%';
            
            return [
                mNome, 
                it.fracao_pct + '%', 
                vol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                'R$ ' + window.fmtBRL(invest),
                'R$ ' + window.fmtBRL(alvo), 
                'R$ ' + window.fmtBRL(real), 
                'R$ ' + window.fmtBRL(falta),
                pct
            ];
        });

        const foot = [
            [
                'TOTAL',
                totalFracao.toFixed(1) + '%',
                totalVol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                'R$ ' + window.fmtBRL(totalInvest),
                'R$ ' + window.fmtBRL(totalAlvo),
                'R$ ' + window.fmtBRL(totalReal),
                'R$ ' + window.fmtBRL(totalFalta),
                totalPct + '%'
            ],
            [
                'MEDIAS',
                mediaFracao.toFixed(1) + '%',
                mediaVol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                'R$ ' + window.fmtBRL(mediaInvest),
                'R$ ' + window.fmtBRL(mediaAlvo),
                'R$ ' + window.fmtBRL(mediaReal),
                'R$ ' + window.fmtBRL(mediaFalta),
                mediaPct + '%'
            ]
        ];

        doc.autoTable({
            startY: 70,
            head: headers,
            body: body,
            foot: foot,
            theme: 'grid',
            headStyles: { fillColor: [22, 36, 51] },
            footStyles: { fillColor: [13, 36, 51], textColor: [0, 229, 255], fontStyle: 'bold' },
            styles: { fontSize: 8 }
        });

        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(9);
        doc.text(`Relatorio gerado em: ${new Date().toLocaleString('pt-BR')} — ApexTech Metais`, 15, finalY);

        doc.save(`Planejamento_${plano.titulo.replace(/\s+/g, '_')}.pdf`);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LÓGICA DA SUB-ABA PLANEJAMENTO DO MÊS (Dashboard Consolidado)
    // ─────────────────────────────────────────────────────────────────────────
    let _localPlanejamentoEstrategico = [];
    let _mesPlanejamentoEstrategicoSelecionado = 'todos';

    window.onChangeMesPlanejamentoEstrategico = function() {
        const select = document.getElementById('plest-subaba-mes');
        if (select) {
            _mesPlanejamentoEstrategicoSelecionado = select.value;
            window.renderPlanejamentoMesEstrategico();
        }
    };

    window.renderPlanejamentoMesEstrategico = async function() {
        // Garantir que os lotes de compra estao carregados
        if (!_localPlanejamentoEstrategico || _localPlanejamentoEstrategico.length === 0) {
            try {
                const res = await fetch('/api/planejamento-compras');
                if (res.ok) {
                    _localPlanejamentoEstrategico = await res.json();
                }
            } catch(e) {
                console.error("Erro ao buscar localPlanejamento:", e);
            }
        }

        const lotesMes = (_localPlanejamentoEstrategico || []).filter(lc => {
            if (_mesPlanejamentoEstrategicoSelecionado === 'todos') return true;
            if (!lc.mes) return true;
            return lc.mes === _mesPlanejamentoEstrategicoSelecionado;
        });

        // Agrupar por produto
        const mapProdutos = new Map();
        let pesoTotalGeral = 0;
        let totalCompraGeral = 0;
        let pesoMaterialGeral = 0;
        let totalVendaGeral = 0;
        let lucroBrutoGeral = 0;

        lotesMes.forEach(lc => {
            const produtoNome = lc.produto || 'Indefinido';
            if (!mapProdutos.has(produtoNome)) {
                mapProdutos.set(produtoNome, { peso: 0, investimento: 0, vendaLiquidaAcumulada: 0, pesoMaterial: 0, faturamento: 0, lucro: 0 });
            }
            const data = mapProdutos.get(produtoNome);
            
            const totalC = parseFloat(lc.peso_comprado || 0) * parseFloat(lc.preco_compra || 0);
            const pesoMat = parseFloat(lc.peso_comprado || 0) * (parseFloat(lc.percentual_rendimento || 0) / 100);
            const totalV = pesoMat * parseFloat(lc.preco_venda_material || 0);
            const lucroB = totalV - totalC;

            data.peso += parseFloat(lc.peso_comprado || 0);
            data.investimento += totalC;
            data.pesoMaterial += pesoMat;
            data.faturamento += totalV;
            data.lucro += lucroB;
            data.vendaLiquidaAcumulada += (parseFloat(lc.preco_venda_material || 0) * pesoMat);

            pesoTotalGeral += parseFloat(lc.peso_comprado || 0);
            totalCompraGeral += totalC;
            pesoMaterialGeral += pesoMat;
            totalVendaGeral += totalV;
            lucroBrutoGeral += lucroB;
        });

        const fmt = window.fmtBRL || function(v) { return v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); };

        // KPI
        document.getElementById('plest-kpi-inv').textContent = totalCompraGeral.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('plest-kpi-fat').textContent = totalVendaGeral.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('plest-kpi-lucro').textContent = lucroBrutoGeral.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        const pctGeral = totalVendaGeral > 0 ? (lucroBrutoGeral / totalVendaGeral) * 100 : 0;
        document.getElementById('plest-kpi-pct').textContent = fmt(pctGeral) + '%';

        const tbody = document.getElementById('plest-mes-table-body');
        const tfoot = document.getElementById('plest-mes-table-footer');
        if (!tbody || !tfoot) return;

        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        if (mapProdutos.size === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#aaa;">Nenhum planejamento encontrado para este mês.</td></tr>`;
            return;
        }

        const linhas = Array.from(mapProdutos.entries()).map(([produto, data]) => {
            const fracao = pesoTotalGeral > 0 ? (data.peso / pesoTotalGeral) * 100 : 0;
            const precoMedioCompra = data.peso > 0 ? data.investimento / data.peso : 0;
            const vendaLiquidaMedia = data.pesoMaterial > 0 ? data.vendaLiquidaAcumulada / data.pesoMaterial : 0;
            const percBruto = data.faturamento > 0 ? (data.lucro / data.faturamento) * 100 : 0;

            return { produto, fracao, peso: data.peso, precoCompra: precoMedioCompra, investimento: data.investimento, vendaLiquida: vendaLiquidaMedia, faturamento: data.faturamento, lucro: data.lucro, percBruto };
        });

        // Sort descending by weight
        linhas.sort((a, b) => b.peso - a.peso);

        linhas.forEach(linha => {
            const tr = document.createElement('tr');
            tr.style.background = '#ffffff';
            tr.style.color = '#333';
            tr.innerHTML = `
                <td style="padding:8px; border:1px solid #ddd;">${linha.produto}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmt(linha.fracao)}%</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">KGS ${linha.peso.toLocaleString('pt-BR')}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${fmt(linha.precoCompra)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${linha.investimento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${fmt(linha.vendaLiquida)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">KGS ${linha.faturamento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${linha.lucro.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmt(linha.percBruto)}%</td>
            `;
            tbody.appendChild(tr);
        });

        const precoCompraGeral = pesoTotalGeral > 0 ? totalCompraGeral / pesoTotalGeral : 0;
        const vendaLiquidaGeral = pesoMaterialGeral > 0 ? totalVendaGeral / pesoMaterialGeral : 0;

        tfoot.innerHTML = `
            <tr style="background:#ffeb3b; text-align:left; color:#333; font-weight:bold;">
                <td style="padding:10px; border:1px solid #fbc02d;">TOTAIS</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">100,00%</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">KGS ${pesoTotalGeral.toLocaleString('pt-BR')}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right; color:#2e7d32;">R$ ${fmt(precoCompraGeral)}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">R$ ${totalCompraGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right; color:#2e7d32;">R$ ${fmt(vendaLiquidaGeral)}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">KGS ${totalVendaGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">R$ ${lucroBrutoGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">${fmt(pctGeral)}%</td>
            </tr>
        `;
    };

    window.gerarPrevisaoAutomaticaMes = async function() {
        if (!_mesPlanejamentoEstrategicoSelecionado || _mesPlanejamentoEstrategicoSelecionado === 'todos') {
            _apexNotify('Atenção', 'Selecione um mês específico (Ex: 10 - Outubro) na caixa de seleção para gerar a previsão.', 'warning');
            return;
        }

        if (!confirm(`Deseja gerar uma simulação automática de lotes para o mês ${_mesPlanejamentoEstrategicoSelecionado}? Isso substituirá simulações anteriores deste mês.`)) {
            return;
        }

        const btn = document.getElementById('btn-gerar-previsao-mes');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando...';
        }

        try {
            // Remove lotes antigos deste mes localmente e na API
            const lotesParaRemover = (_localPlanejamentoEstrategico || []).filter(lc => lc.mes === _mesPlanejamentoEstrategicoSelecionado);
            for (const lote of lotesParaRemover) {
                if (lote.id) {
                    await fetch(`/api/planejamento-compras/${lote.id}`, { method: 'DELETE' }).catch(() => {});
                }
            }
            _localPlanejamentoEstrategico = _localPlanejamentoEstrategico.filter(lc => lc.mes !== _mesPlanejamentoEstrategicoSelecionado);

            // Gerar 5 lotes simulados que refletem o mix da empresa (sucata, aluminio, fio, conectores)
            const novosLotes = [
                {
                    fornecedor_id: 1, fornecedor_nome: 'Fornecedor A',
                    produto: 'Sucata de Alumínio Misturada',
                    peso_comprado: 15000, preco_compra: 5.50, percentual_rendimento: 85.0,
                    material_id: 1, material_nome: 'Alumínio Bloco', preco_venda_material: 7.80,
                    comissao: 2.0, fidc: 2.3, mes: _mesPlanejamentoEstrategicoSelecionado
                },
                {
                    fornecedor_id: 2, fornecedor_nome: 'Reciclagem B',
                    produto: 'Cobre Limpo Desmontado',
                    peso_comprado: 8000, preco_compra: 38.00, percentual_rendimento: 98.0,
                    material_id: 2, material_nome: 'Cobre Mel', preco_venda_material: 46.50,
                    comissao: 2.0, fidc: 2.3, mes: _mesPlanejamentoEstrategicoSelecionado
                },
                {
                    fornecedor_id: 3, fornecedor_nome: 'Metalúrgica C',
                    produto: 'Lote Conectores & Tomadas',
                    peso_comprado: 12000, preco_compra: 8.20, percentual_rendimento: 72.0,
                    material_id: 3, material_nome: 'Latão/Bronze', preco_venda_material: 14.50,
                    comissao: 2.0, fidc: 2.3, mes: _mesPlanejamentoEstrategicoSelecionado
                },
                {
                    fornecedor_id: 4, fornecedor_nome: 'Fornecedor D',
                    produto: 'fio misto',
                    peso_comprado: 25000, preco_compra: 15.67, percentual_rendimento: 40.0,
                    material_id: 2, material_nome: 'Cobre Mel', preco_venda_material: 46.50,
                    comissao: 2.0, fidc: 2.3, mes: _mesPlanejamentoEstrategicoSelecionado
                },
                {
                    fornecedor_id: 5, fornecedor_nome: 'Fornecedor E',
                    produto: 'fio terminais',
                    peso_comprado: 10000, preco_compra: 14.00, percentual_rendimento: 30.0,
                    material_id: 2, material_nome: 'Cobre Mel', preco_venda_material: 46.50,
                    comissao: 2.0, fidc: 2.3, mes: _mesPlanejamentoEstrategicoSelecionado
                }
            ];

            for (const lote of novosLotes) {
                const res = await fetch('/api/planejamento-compras', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(lote)
                });
                if (res.ok) {
                    const salvo = await res.json();
                    _localPlanejamentoEstrategico.push(salvo);
                }
            }

            if (typeof _apexNotify === 'function') {
                _apexNotify('Sucesso', 'Simulação automática gerada com sucesso!', 'success');
            } else {
                (window._apexNotify ? window._apexNotify('Notificação', 'Simulação automática gerada com sucesso!', 'info') : alert('Simulação automática gerada com sucesso!'));
            }
            
            window.renderPlanejamentoMesEstrategico();

        } catch (err) {
            console.error(err);
            if (typeof _apexNotify === 'function') {
                _apexNotify('Erro', 'Falha ao gerar previsão automática', 'error');
            } else {
                (window._apexNotify ? window._apexNotify('Notificação', 'Falha ao gerar previsão automática', 'info') : alert('Falha ao gerar previsão automática'));
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gerar Simulação';
            }
        }
    };

    window.exportarPlanejamentoMesEstrategicoPdf = async function() {
        const tblContainer = document.getElementById('subaba-estr-planejamento-mes').querySelector('table').parentNode;
        
        let logoWatermarkBase64 = null;
        try {
            const logoRes = await fetch('/assets/img/logo%20(2).png');
            if (logoRes.ok) {
                const blob = await logoRes.blob();
                logoWatermarkBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch(e) { console.warn('Logo watermark nao carregou:', e); }

        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1200px;box-sizing:border-box;background:#ffffff;padding:25px;font-family:sans-serif;color:#333;';
        
        let grid = '';
        if (logoWatermarkBase64) {
            grid += '<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;">';
            for (let r = 0; r < 10; r++) {
                grid += '<div style="display:flex;justify-content:space-around;align-items:center;padding:20px 0;">';
                for (let c = 0; c < 5; c++) {
                    grid += `<img src="${logoWatermarkBase64}" alt="" style="width:140px;opacity:0.07;transform:rotate(-20deg);display:block;flex-shrink:0;" />`;
                }
                grid += '</div>';
            }
            grid += '</div>';
        }

        const tableHtml = tblContainer.innerHTML;
        const hojeStr = new Date().toLocaleDateString('pt-BR');
        const mesLabel = _mesPlanejamentoEstrategicoSelecionado === 'todos' ? 'Todos os Meses' : _mesPlanejamentoEstrategicoSelecionado;
        const fmt = window.fmtBRL || function(v) { return v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); };

        tempDiv.innerHTML = `
            ${grid}
            <div style="position:relative;z-index:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ffb74d;padding-bottom:20px;margin-bottom:25px;">
                    <div><img src="assets/img/apexlogo.png" alt="ApexTech Metais" style="height:50px;"></div>
                    <div style="text-align:right;">
                        <h1 style="margin:0;color:#333;font-size:1.8rem;text-transform:uppercase;">Planejamento Estratégico - Mês</h1>
                        <p style="margin:5px 0 0 0;color:#666;font-size:1rem;">Mês Referência: <strong>${mesLabel}</strong> | Gerado em: ${hojeStr}</p>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:25px; background:#f5f5f5; padding:15px; border-radius:8px; border:1px solid #ddd;">
                    <div><strong style="color:#666;">Investimento:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-inv').textContent}</span></div>
                    <div><strong style="color:#666;">Faturamento:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-fat').textContent}</span></div>
                    <div><strong style="color:#666;">Lucro Bruto:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-lucro').textContent}</span></div>
                    <div><strong style="color:#666;">% Bruto:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-pct').textContent}</span></div>
                </div>
                <div>${tableHtml}</div>
            </div>
        `;
        
        document.body.appendChild(tempDiv);

        try {
            await new Promise(r => setTimeout(r, 400));
            const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: false });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            const pdfWidth = 297;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Planejamento_Estrategico_Mes_${mesLabel}_${hojeStr.replace(/\//g,'-')}.pdf`);
            _apexNotify('Sucesso', 'PDF Exportado com sucesso!', 'success');
        } catch (e) {
            console.error(e);
            _apexNotify('Erro', 'Falha ao exportar PDF: ' + e.message, 'error');
        } finally {
            document.body.removeChild(tempDiv);
        }
    };
    // ═══════════════════════════════════════════════════════════════
    //  BLOCO 1: RADAR DE OPORTUNIDADES
    // ═══════════════════════════════════════════════════════════════
    window.renderRadarOportunidades = function() {
        if (!_listTabelaPrecosEstrategica || _listTabelaPrecosEstrategica.length === 0) return;

        const estrelas = [];
        const nicho = [];
        const volume = [];
        const rever = [];

        // Médias para definir os eixos do quadrante
        let somaMargem = 0, countVenda = 0;
        let pVendaMedioGlobal = 0;

        _listTabelaPrecosEstrategica.forEach(tp => {
            const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const pCompra = parseFloat(tp.preco_entregar || tp.preco_compra || 0); // simplificado
            if (pVenda > 0) {
                somaMargem += ((pVenda - pCompra) / pVenda) * 100;
                countVenda++;
                pVendaMedioGlobal += pVenda;
            }
        });

        const margemMediaGlobal = countVenda > 0 ? somaMargem / countVenda : 0;
        // Definir um "potencial de volume" arbitrário com base no preço de venda (inverso: produtos mais baratos tendem a ter mais volume)
        // Para simplificar no MVP, vamos dividir em 4 categorias por margem e um limiar de preço de venda (R$ 5,00)
        
        _listTabelaPrecosEstrategica.forEach(tp => {
            const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const pCompra = parseFloat(tp.preco_entregar || tp.preco_compra || 0);
            if (pVenda <= 0) return;
            
            const margem = ((pVenda - pCompra) / pVenda) * 100;
            const ehAltoVolume = pVenda < 15.00; // Arbitrário: sucata mais barata gira mais volume

            const itemHTML = `
                <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between;">
                    <span style="color:#fff; font-weight:bold;">${tp.material_nome}</span>
                    <span style="color:#aaa;">${margem.toFixed(1)}%</span>
                </div>
            `;

            if (margem >= margemMediaGlobal && ehAltoVolume) estrelas.push(itemHTML);
            else if (margem >= margemMediaGlobal && !ehAltoVolume) nicho.push(itemHTML);
            else if (margem < margemMediaGlobal && ehAltoVolume) volume.push(itemHTML);
            else rever.push(itemHTML);
        });

        document.getElementById('plestv3-radar-estrelas').innerHTML = estrelas.length ? estrelas.join('') : '<span style="color:#666;">Nenhum produto</span>';
        document.getElementById('plestv3-radar-nicho').innerHTML = nicho.length ? nicho.join('') : '<span style="color:#666;">Nenhum produto</span>';
        document.getElementById('plestv3-radar-volume').innerHTML = volume.length ? volume.join('') : '<span style="color:#666;">Nenhum produto</span>';
        document.getElementById('plestv3-radar-rever').innerHTML = rever.length ? rever.join('') : '<span style="color:#666;">Nenhum produto</span>';
    };

    // ═══════════════════════════════════════════════════════════════
    //  BLOCO 3: CALCULADORA DE PAYBACK / TEMPO
    // ═══════════════════════════════════════════════════════════════
    let _chartPaybackInstance = null;
    window.calcularPaybackEROIV3 = function() {
        const fatAtual = window.parseCurrencyV3(document.getElementById('plestv3-payback-fat-atual')?.value) || 0;
        const metaFat = window.parseCurrencyV3(document.getElementById('plestv3-payback-meta')?.value) || 0;
        const crescPct = parseFloat(document.getElementById('plestv3-payback-crescimento')?.value) || 0;
        const invest = window.parseCurrencyV3(document.getElementById('plestv3-payback-invest')?.value) || 0;

        let fatMes = fatAtual;
        let mesesParaMeta = 0;
        let lucroAcumulado = -invest;
        let mesesParaPayback = 0;
        
        // Simulação de até 36 meses
        const historicoMeses = [];
        const historicoFat = [];
        const historicoLucro = [];

        // Assumindo uma margem líquida média do sistema (ex: 15% para simulação se não tiver do mix, mas vamos fixar 15% para o exercício)
        const margemLiquidaSimulada = 0.15; 

        for (let i = 1; i <= 36; i++) {
            fatMes = fatMes * (1 + (crescPct / 100));
            let lucroMes = fatMes * margemLiquidaSimulada;
            lucroAcumulado += lucroMes;

            historicoMeses.push(`Mês ${i}`);
            historicoFat.push(fatMes.toFixed(2));
            historicoLucro.push(lucroAcumulado.toFixed(2));

            if (fatMes >= metaFat && mesesParaMeta === 0) mesesParaMeta = i;
            if (lucroAcumulado >= 0 && mesesParaPayback === 0) mesesParaPayback = i;

            if (mesesParaMeta > 0 && mesesParaPayback > 0 && i >= 12) break; // Para quando achar tudo e tiver pelo menos 12 meses
        }

        const containerResultados = document.getElementById('plestv3-payback-resultados');
        if (containerResultados) {
            containerResultados.innerHTML = `
                <div style="background:#162433; padding:15px; border-radius:8px; border-left:4px solid #00e5ff;">
                    <span style="color:#aaa; font-size:0.8rem; display:block;">Tempo para Atingir a Meta</span>
                    <strong style="color:#00e5ff; font-size:1.5rem;">${mesesParaMeta > 0 ? mesesParaMeta + ' meses' : '> 36 meses'}</strong>
                </div>
                <div style="background:#162433; padding:15px; border-radius:8px; border-left:4px solid #2AD07A;">
                    <span style="color:#aaa; font-size:0.8rem; display:block;">Tempo para Payback (Recuperar R$ ${window.fmtBRL(invest)})</span>
                    <strong style="color:#2AD07A; font-size:1.5rem;">${mesesParaPayback > 0 ? mesesParaPayback + ' meses' : '> 36 meses'}</strong>
                </div>
                <div style="background:#162433; padding:15px; border-radius:8px; border-left:4px solid #ffb74d;">
                    <span style="color:#aaa; font-size:0.8rem; display:block;">ROI Esperado (12 meses)</span>
                    <strong style="color:#ffb74d; font-size:1.5rem;">${((historicoLucro[11] / invest) * 100).toFixed(1)}%</strong>
                </div>
            `;
        }

        // Desenhar Gráfico
        const ctx = document.getElementById('chart-payback-projecao');
        if (!ctx) return;
        
        if (_chartPaybackInstance) _chartPaybackInstance.destroy();

        _chartPaybackInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historicoMeses,
                datasets: [
                    {
                        label: 'Faturamento Projetado (R$)',
                        data: historicoFat,
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Lucro Acumulado (Caixa) (R$)',
                        data: historicoLucro,
                        borderColor: '#2AD07A',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: '#1a2e3f' }, ticks: { color: '#8eaabf' } },
                    x: { grid: { display: false }, ticks: { color: '#8eaabf' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
    };

    // ═══════════════════════════════════════════════════════════════
    //  BLOCO 4: COMPRAR MELHOR (Teto de Compra)
    // ═══════════════════════════════════════════════════════════════
    window.renderAnaliseComprarV3 = function() {
        const margemAlvo = parseFloat(document.getElementById('plestv3-compra-margem-alvo')?.value) || 0;
        const tbody = document.getElementById('plestv3-compra-tbody');
        if (!tbody || !_listTabelaPrecosEstrategica) return;

        let html = '';
        _listTabelaPrecosEstrategica.forEach(tp => {
            const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const pCompra = parseFloat(tp.preco_entregar || tp.preco_compra || 0);
            if (pVenda <= 0) return;

            // Para ter margem alvo, lucro = pVenda * (margemAlvo / 100)
            // pCompra Max = pVenda - lucro
            const tetoCompra = pVenda * (1 - (margemAlvo / 100));
            const diff = pCompra - tetoCompra; // se > 0, estou pagando mais caro do que deveria

            let statusHtml = '';
            if (diff > 0) {
                statusHtml = `<span style="color:#ff4d4d; background:rgba(255,77,77,0.1); padding:2px 6px; border-radius:4px; font-weight:bold;">⚠️ Acima do Teto</span>`;
            } else {
                statusHtml = `<span style="color:#2AD07A; background:rgba(42,208,122,0.1); padding:2px 6px; border-radius:4px; font-weight:bold;">✅ Margem Atingida</span>`;
            }

            html += `
                <tr style="border-bottom:1px solid #1a2e3f;">
                    <td style="padding:8px;"><strong>${tp.material_nome}</strong></td>
                    <td style="padding:8px; text-align:right; color:#ccc;">R$ ${window.fmtBRL(pVenda)}</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${window.fmtBRL(pCompra)}</td>
                    <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${window.fmtBRL(tetoCompra)}</td>
                    <td style="padding:8px; text-align:right; color:${diff > 0 ? '#ff4d4d' : '#2AD07A'};">
                        ${diff > 0 ? '- R$ ' + window.fmtBRL(diff) : 'R$ 0,00'}
                    </td>
                    <td style="padding:8px;">${statusHtml}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    };

    // ═══════════════════════════════════════════════════════════════
    //  BLOCO 5: VENDER MELHOR (Incremental)
    // ═══════════════════════════════════════════════════════════════
    window.renderAnaliseVenderV3 = function() {
        const tbody = document.getElementById('plestv3-venda-tbody');
        if (!tbody || !_listTabelaPrecosEstrategica) return;

        let html = '';
        _listTabelaPrecosEstrategica.forEach(tp => {
            const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const pCompra = parseFloat(tp.preco_entregar || tp.preco_compra || 0);
            if (pVenda <= 0) return;

            const margemAtual = ((pVenda - pCompra) / pVenda) * 100;
            
            const pVenda5 = pVenda * 1.05;
            const pVenda10 = pVenda * 1.10;
            const pVenda15 = pVenda * 1.15;

            const margem5 = ((pVenda5 - pCompra) / pVenda5) * 100;
            const margem10 = ((pVenda10 - pCompra) / pVenda10) * 100;
            const margem15 = ((pVenda15 - pCompra) / pVenda15) * 100;

            html += `
                <tr style="border-bottom:1px solid #1a2e3f;">
                    <td style="padding:8px;"><strong>${tp.material_nome}</strong></td>
                    <td style="padding:8px; text-align:right; color:#ccc;">${margemAtual.toFixed(1)}%</td>
                    <td style="padding:8px; text-align:right; color:#ccc;">R$ ${window.fmtBRL(pVenda)}</td>
                    <td style="padding:8px; text-align:right; color:#00e5ff;">
                        R$ ${window.fmtBRL(pVenda5)} <br>
                        <span style="font-size:0.7rem; color:#2AD07A;">Mg: ${margem5.toFixed(1)}%</span>
                    </td>
                    <td style="padding:8px; text-align:right; color:#00e5ff;">
                        R$ ${window.fmtBRL(pVenda10)} <br>
                        <span style="font-size:0.7rem; color:#2AD07A;">Mg: ${margem10.toFixed(1)}%</span>
                    </td>
                    <td style="padding:8px; text-align:right; color:#00e5ff;">
                        R$ ${window.fmtBRL(pVenda15)} <br>
                        <span style="font-size:0.7rem; color:#2AD07A;">Mg: ${margem15.toFixed(1)}%</span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    };

})();
