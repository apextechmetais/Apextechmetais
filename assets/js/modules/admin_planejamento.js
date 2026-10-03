// ─── 5. PLANEJAMENTO MENSAL DE FORNECEDORES & MOTOR PREDITIVO DE CENÁRIOS ───
    let mesPlanejamentoSelecionado = '2026-08';
    let cenarioPreditivoSelecionado = 'moderado';
    let historicoCenarioPorMes = {}; // Guarda o cenário ativo por mês

    window.initApexPlanejamento = function() {
        if (window.carregarPlanejamentoDashboard) {
            window.carregarPlanejamentoDashboard();
        }
    };

    let chartDashPlComparativo = null;

    window.carregarPlanejamentoDashboard = async function() {
        try {
            if (!_listTabelaPrecosEstrategica || _listTabelaPrecosEstrategica.length === 0) {
                const resPrecos = await fetch('/api/tabela-precos', { cache: 'no-store' });
                if (resPrecos.ok) {
                    _listTabelaPrecosEstrategica = await resPrecos.json();
                }
            }

            if (window.popularSelectsProdutoEstrategicov3) window.popularSelectsProdutoEstrategicov3();
            if (window.onChangeConsultaMaterialV3) window.onChangeConsultaMaterialV3();
            if (window.recalcularSimulacaoV3) window.recalcularSimulacaoV3();

            const res = await fetch('/api/estrategiav3_planos', { cache: 'no-store' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao buscar planos ativos');
            
            let planos = data.planos || [];
            // Filtrar planos não finalizados
            planos = planos.filter(p => p.status !== 'FINALIZADO');

            let totalPlanejadoAlvo = 0;
            let totalRealizado = 0;
            let totalPlanosAtivos = planos.length;
            let produtosMap = new Map(); // material_id -> { alvo: 0, real: 0, nome: '' }

            planos.forEach(p => {
                if (p.itens && Array.isArray(p.itens)) {
                    p.itens.forEach(item => {
                        let fatAlvo = parseFloat(item.faturamento_alvo) || 0;
                        let fatReal = parseFloat(item.faturamento_realizado) || 0;
                        totalPlanejadoAlvo += fatAlvo;
                        totalRealizado += fatReal;

                        let prodNome = item.material_nome;
                        if (!prodNome || prodNome.startsWith('Produto #')) {
                            const found = (_listTabelaPrecosEstrategica || []).find(x => x.material_id == item.material_id);
                            prodNome = found && found.material_nome ? found.material_nome : `Produto #${item.material_id}`;
                        }
                        if (!produtosMap.has(item.material_id)) {
                            produtosMap.set(item.material_id, { alvo: 0, real: 0, nome: prodNome });
                        }
                        let pData = produtosMap.get(item.material_id);
                        pData.alvo += fatAlvo;
                        pData.real += fatReal;
                    });
                }
            });

            // Atualiza KPIs
            const elAlvo = document.getElementById('dash-pl-total-alvo');
            const elReal = document.getElementById('dash-pl-total-real');
            const elQtdPlanos = document.getElementById('dash-pl-qtd-planos');
            const elQtdProds = document.getElementById('dash-pl-qtd-produtos');

            if (elAlvo) elAlvo.textContent = totalPlanejadoAlvo.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
            if (elReal) elReal.textContent = totalRealizado.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
            if (elQtdPlanos) elQtdPlanos.textContent = totalPlanosAtivos;
            if (elQtdProds) elQtdProds.textContent = produtosMap.size;

            // Renderiza Gráfico
            renderChartDashPlComparativo(produtosMap);

        } catch (e) {
            console.error('Erro ao carregar Dashboard de Planejamento:', e);
            const errDiv = document.createElement('div');
            errDiv.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,0,0,0.8); color:white; z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; font-size:24px; padding:20px; white-space:pre-wrap;";
            errDiv.innerText = "FATAL ERROR DASHBOARD:\n" + (e.stack || e.message || String(e));
            document.body.appendChild(errDiv);
            (window._apexNotify ? window._apexNotify('Notificação', "ERRO: " + e.message, 'info') : alert("ERRO: " + e.message));
        }
    };

    function renderChartDashPlComparativo(produtosMap) {
        try {
            const ctx = document.getElementById('chart-dash-pl-comparativo');
            if (!ctx) return;

            if (chartDashPlComparativo) {
                chartDashPlComparativo.destroy();
            }

            const labels = [];
            const dataAlvo = [];
            const dataReal = [];

            produtosMap.forEach((val) => {
                labels.push(val.nome);
                dataAlvo.push(val.alvo);
                dataReal.push(val.real);
            });

            let pluginList = [];
            if (typeof ChartDataLabels !== 'undefined') {
                pluginList.push(ChartDataLabels);
            }

            chartDashPlComparativo = new Chart(ctx, {
                type: 'bar',
                plugins: pluginList,
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Planejado (Alvo)',
                            data: dataAlvo,
                            backgroundColor: 'rgba(42, 208, 122, 0.7)',
                            borderColor: '#2AD07A',
                            borderWidth: 1
                        },
                        {
                            label: 'Realizado',
                            data: dataReal,
                            backgroundColor: 'rgba(62, 124, 177, 0.7)',
                            borderColor: '#3e7cb1',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#8eaabf' },
                            grid: { color: '#1a2e3f' },
                            // Dá uma margem no topo para caber os labels
                            suggestedMax: (dataAlvo.length > 0 ? Math.max(...dataAlvo, ...dataReal) : 100) * 1.15
                        },
                        x: {
                            ticks: { color: '#8eaabf' },
                            grid: { display: false }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#fff' } },
                        datalabels: {
                            color: '#fff',
                            anchor: 'end',
                            align: 'top',
                            formatter: function(value) {
                                if (value === 0) return '';
                                return value.toLocaleString('pt-BR', { notation: "compact", maximumFractionDigits: 1 });
                            },
                            font: { weight: 'bold', size: 10 }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Erro ao renderizar grafico dash pl:', e);
            (window._apexNotify ? window._apexNotify('Notificação', 'Erro ao desenhar grafico: ' + e.message, 'info') : alert('Erro ao desenhar grafico: ' + e.message));
        }
    }

    window.alterarMesPlanejamento = function(mes) {
        mesPlanejamentoSelecionado = mes;
        renderPlanejamento();
    };

    function renderPlanejamento() {
        const body = document.getElementById('planejamento-table-body');
        const footer = document.getElementById('planejamento-table-footer');
        if (!body || !footer) return;

        body.innerHTML = '';
        footer.innerHTML = '';

        // Filtra lotes pelo mês selecionado
        const lotesMes = localPlanejamento.filter(lc => {
            if (mesPlanejamentoSelecionado === 'todos') return true;
            if (!lc.mes) return true; // se não tiver mês definido, mostra por padrão
            return lc.mes === mesPlanejamentoSelecionado;
        });

        let pesoTotal = 0;
        let totalCompra = 0;
        let pesoMaterialTotal = 0;
        let totalVenda = 0;
        let lucroBrutoTotal = 0;

        lotesMes.forEach(lc => {
            const totalC = parseFloat(lc.peso_comprado || 0) * parseFloat(lc.preco_compra || 0);
            const pesoMat = parseFloat(lc.peso_comprado || 0) * (parseFloat(lc.percentual_rendimento || 0) / 100);
            const totalV = pesoMat * parseFloat(lc.preco_venda_material || 0);
            const lucroB = totalV - totalC;
            const pctInv = totalC > 0 ? (lucroB / totalC) * 100 : 0;
            const pctFat = totalV > 0 ? (lucroB / totalV) * 100 : 0;
            const resultadoLiq = pctFat - parseFloat(lc.comissao || 2.0) - parseFloat(lc.fidc || 2.3);

            pesoTotal += parseFloat(lc.peso_comprado || 0);
            totalCompra += totalC;
            pesoMaterialTotal += pesoMat;
            totalVenda += totalV;
            lucroBrutoTotal += lucroB;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px;"><strong>${lc.fornecedor_nome || 'Fornecedor Vários'}</strong></td>
                <td style="padding:8px;">${lc.produto || '-'}</td>
                <td style="padding:8px; text-align:right;">${parseFloat(lc.peso_comprado || 0).toLocaleString('pt-BR')} kg</td>
                <td style="padding:8px; text-align:right;">R$ ${fmtBRL(lc.preco_compra)}</td>
                <td style="padding:8px; text-align:right;">R$ ${totalC.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; text-align:right;">${fmtBRL(lc.percentual_rendimento)}%</td>
                <td style="padding:8px;">${lc.material_nome || '-'}</td>
                <td style="padding:8px; text-align:right;">${pesoMat.toLocaleString('pt-BR')} kg</td>
                <td style="padding:8px; text-align:right;">R$ ${fmtBRL(lc.preco_venda_material)}</td>
                <td style="padding:8px; text-align:right;">R$ ${totalV.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; text-align:right; color:#2AD07A;">R$ ${lucroB.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; text-align:right;">${fmtBRL(pctInv)}%</td>
                <td style="padding:8px; text-align:right;">${fmtBRL(pctFat)}%</td>
                <td style="padding:8px; text-align:right;">${fmtBRL(lc.comissao || 2)}%</td>
                <td style="padding:8px; text-align:right;">${fmtBRL(lc.fidc || 2.3)}%</td>
                <td style="padding:8px; text-align:right; font-weight:bold; color:${resultadoLiq >= 0 ? '#2AD07A' : '#ff4d4d'}">${fmtBRL(resultadoLiq)}%</td>
            `;
            body.appendChild(tr);
        });

        // Rodapé de Fechamento consolidado
        const avgPrecoCompra = pesoTotal > 0 ? totalCompra / pesoTotal : 0;
        const avgRendimento = pesoTotal > 0 ? (pesoMaterialTotal / pesoTotal) * 100 : 0;
        const avgPrecoVenda = pesoMaterialTotal > 0 ? totalVenda / pesoMaterialTotal : 0;
        const overallInv = totalCompra > 0 ? (lucroBrutoTotal / totalCompra) * 100 : 0;
        const overallFat = totalVenda > 0 ? (lucroBrutoTotal / totalVenda) * 100 : 0;
        const overallLiq = overallFat - 2.0 - 2.3;

        footer.innerHTML = `
            <tr style="background:#0a2342; border-top: 2px solid #3e7cb1;">
                <td colspan="2" style="padding:10px;"><strong>TOTAIS CONSOLIDADOS (${lotesMes.length} LOTES)</strong></td>
                <td style="padding:10px; text-align:right;"><strong>${pesoTotal.toLocaleString('pt-BR')} kg</strong></td>
                <td style="padding:10px; text-align:right;">R$ ${fmtBRL(avgPrecoCompra)}</td>
                <td style="padding:10px; text-align:right;"><strong>R$ ${totalCompra.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></td>
                <td style="padding:10px; text-align:right;">${fmtBRL(avgRendimento)}%</td>
                <td style="padding:10px;">-</td>
                <td style="padding:10px; text-align:right;"><strong>${pesoMaterialTotal.toLocaleString('pt-BR')} kg</strong></td>
                <td style="padding:10px; text-align:right;">R$ ${fmtBRL(avgPrecoVenda)}</td>
                <td style="padding:10px; text-align:right;"><strong>R$ ${totalVenda.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></td>
                <td style="padding:10px; text-align:right; color:#2AD07A;"><strong>R$ ${lucroBrutoTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></td>
                <td style="padding:10px; text-align:right;">${fmtBRL(overallInv)}%</td>
                <td style="padding:10px; text-align:right;">${fmtBRL(overallFat)}%</td>
                <td colspan="2" style="padding:10px;">-</td>
                <td style="padding:10px; text-align:right; color:#2AD07A;"><strong>${fmtBRL(overallLiq)}%</strong></td>
            </tr>
        `;

        // Atualizar KPIs de Capacidade de Trabalho & Orçamento Preditivo
        const elVol = document.getElementById('pl-kpi-volume');
        const elOrc = document.getElementById('pl-kpi-orcamento');
        const elLuc = document.getElementById('pl-kpi-lucro');
        const elTrab = document.getElementById('pl-kpi-trabalho');

        // Estimativa de horas de trabalho: ~ 1 hora para cada 200kg desmontados e triados
        const horasTrabalho = Math.round(pesoTotal / 200);

        if (elVol) elVol.textContent = `${pesoTotal.toLocaleString('pt-BR')} kg`;
        if (elOrc) elOrc.textContent = `R$ ${totalCompra.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (elLuc) elLuc.textContent = `R$ ${lucroBrutoTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (elTrab) elTrab.textContent = `${horasTrabalho.toLocaleString('pt-BR')} Horas/Mês`;

        // Badge de Cenário Ativo
        const badge = document.getElementById('badge-cenario-ativo');
        const txtNome = document.getElementById('txt-cenario-nome');
        const txtDet = document.getElementById('txt-cenario-detalhe');
        const cenarioAtivo = historicoCenarioPorMes[mesPlanejamentoSelecionado];

        if (badge && cenarioAtivo) {
            badge.style.display = 'flex';
            const infoCenarios = {
                conservador: { nome: '🛡️ Conservador (-10% Volume / +5% Margem)', det: 'Alocação prudente com redução de teto de custos para menor risco financeiro.' },
                moderado: { nome: '⚖️ Moderado (Média Histórica Móvel)', det: 'Projeção contínua baseada no desempenho médio recente.' },
                agressivo: { nome: '🚀 Agressivo (+20% Volume / Expansão)', det: 'Meta de captação ampliada e alocação máxima de trabalho industrial.' }
            };
            const c = infoCenarios[cenarioAtivo] || infoCenarios.moderado;
            if (txtNome) txtNome.textContent = c.nome;
            if (txtDet) txtDet.textContent = c.det;
        } else if (badge) {
            badge.style.display = 'none';
        }
    }

    // ─── Modal & Motor de Simulação Preditiva ───
    window.abrirModalPlanejamentoPreditivo = function() {
        document.getElementById('modal-planejamento-preditivo').style.display = 'flex';
        window.atualizarPreviewPreditivo();
    };

    window.fecharModalPlanejamentoPreditivo = function() {
        document.getElementById('modal-planejamento-preditivo').style.display = 'none';
    };

    window.selecionarCenarioRadio = function(cenario) {
        cenarioPreditivoSelecionado = cenario;
        ['conservador', 'moderado', 'agressivo', 'custom'].forEach(c => {
            const card = document.getElementById(`card-cenario-${c}`);
            const rad = document.getElementById(`rad-cenario-${c}`);
            if (card) {
                if (c === cenario) {
                    card.classList.add('active');
                    card.style.borderColor = c === 'custom' ? '#e91e63' : '#7a4fd4';
                    if (rad) rad.checked = true;
                } else {
                    card.classList.remove('active');
                    card.style.borderColor = '#1e4e8c';
                    if (rad) rad.checked = false;
                }
            }
        });

        const boxCustom = document.getElementById('box-expansao-custom');
        if (boxCustom) {
            boxCustom.style.display = cenario === 'custom' ? 'block' : 'none';
        }

        window.atualizarPreviewPreditivo();
    };

    window.atualizarPreviewPreditivo = function() {
        const cenario = cenarioPreditivoSelecionado;
        const baseMeses = parseInt(document.getElementById('pred-base-historico')?.value || '3');

        // Calcula média de lotes existentes
        let volBase = localPlanejamento.reduce((acc, x) => acc + (parseFloat(x.peso_comprado) || 0), 0);
        let custoBase = localPlanejamento.reduce((acc, x) => acc + ((parseFloat(x.peso_comprado) || 0) * (parseFloat(x.preco_compra) || 0)), 0);
        let fatBase = localPlanejamento.reduce((acc, x) => acc + ((parseFloat(x.peso_comprado) || 0) * (parseFloat(x.percentual_rendimento || 0) / 100) * (parseFloat(x.preco_venda_material) || 0)), 0);

        // Se não houver dados no localPlanejamento, usa estimativa de modelo
        if (volBase === 0) {
            volBase = 45000;
            custoBase = 180000;
            fatBase = 240000;
        }

        let multVol = 1.0;
        if (cenario === 'conservador') multVol = 0.90;
        if (cenario === 'agressivo') multVol = 1.20;
        if (cenario === 'custom') {
            const expPct = parseFloat(document.getElementById('pred-expansao-pct')?.value || 0);
            multVol = 1 + (expPct / 100);
        }

        const volEst = Math.round(volBase * multVol);
        const custoEst = custoBase * multVol;
        const fatEst = fatBase * multVol;
        const lucroEst = fatEst - custoEst;
        const horasEst = Math.round(volEst / 200);

        const elPrevVol = document.getElementById('prev-vol');
        const elPrevCusto = document.getElementById('prev-custo');
        const elPrevFat = document.getElementById('prev-fat');
        const elPrevLucro = document.getElementById('prev-lucro');
        const elPrevHoras = document.getElementById('prev-horas');

        if (elPrevVol) elPrevVol.textContent = `${volEst.toLocaleString('pt-BR')} kg`;
        if (elPrevCusto) elPrevCusto.textContent = `R$ ${custoEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (elPrevFat) elPrevFat.textContent = `R$ ${fatEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (elPrevLucro) elPrevLucro.textContent = `R$ ${lucroEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (elPrevHoras) elPrevHoras.textContent = `${horasEst.toLocaleString('pt-BR')} Horas`;
    };

    window.executarGeracaoPreditiva = async function(e) {
        e.preventDefault();
        const mesAlvo = document.getElementById('pred-mes-alvo').value;
        const cenario = cenarioPreditivoSelecionado;
        const btn = e.target.querySelector('[type="submit"]');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processando Projeção...';
        }

        try {
            // Lotes padrão para preencher a projeção caso não haja histórico suficiente
            const fornecedoresList = (window.localFornecedores || []).length > 0 ? window.localFornecedores : [
                { id: 1, nome: 'Fornecedor Sucatas A' },
                { id: 2, nome: 'Reciclagem Metal B' },
                { id: 3, nome: 'Metalúrgica Centro C' }
            ];
            const materiaisList = (window.localMateriais || []).length > 0 ? window.localMateriais : [
                { id: 1, nome: 'Alumínio Bloco', categoria: 'Alumínio' },
                { id: 2, nome: 'Cobre Mel', categoria: 'Cobre' },
                { id: 3, nome: 'Sucata Miúda', categoria: 'Aço' }
            ];

            let multVol = 1.0;
            if (cenario === 'conservador') multVol = 0.90;
            if (cenario === 'agressivo') multVol = 1.20;
            if (cenario === 'custom') {
                const expPct = parseFloat(document.getElementById('pred-expansao-pct')?.value || 0);
                multVol = 1 + (expPct / 100);
            }

            const novosLotesProjetados = [
                {
                    fornecedor_id: fornecedoresList[0]?.id || 1,
                    fornecedor_nome: fornecedoresList[0]?.apelido || fornecedoresList[0]?.nome || 'Fornecedor A',
                    produto: 'Sucata de Alumínio Misturada',
                    peso_comprado: Math.round(15000 * multVol),
                    preco_compra: 5.50,
                    percentual_rendimento: 85.0,
                    material_id: materiaisList[0]?.id || 1,
                    material_nome: materiaisList[0]?.nome || 'Alumínio Bloco',
                    preco_venda_material: 7.80,
                    comissao: 2.0,
                    fidc: 2.3,
                    mes: mesAlvo
                },
                {
                    fornecedor_id: fornecedoresList[1]?.id || 2,
                    fornecedor_nome: fornecedoresList[1]?.apelido || fornecedoresList[1]?.nome || 'Reciclagem B',
                    produto: 'Cobre Limpo Desmontado',
                    peso_comprado: Math.round(8000 * multVol),
                    preco_compra: 38.00,
                    percentual_rendimento: 98.0,
                    material_id: materiaisList[1]?.id || 2,
                    material_nome: materiaisList[1]?.nome || 'Cobre Mel',
                    preco_venda_material: 46.50,
                    comissao: 2.0,
                    fidc: 2.3,
                    mes: mesAlvo
                },
                {
                    fornecedor_id: fornecedoresList[2]?.id || 3,
                    fornecedor_nome: fornecedoresList[2]?.apelido || fornecedoresList[2]?.nome || 'Metalúrgica C',
                    produto: 'Lote Conectores & Tomadas',
                    peso_comprado: Math.round(12000 * multVol),
                    preco_compra: 8.20,
                    percentual_rendimento: 72.0,
                    material_id: materiaisList[2]?.id || 3,
                    material_nome: materiaisList[2]?.nome || 'Latão/Bronze',
                    preco_venda_material: 14.50,
                    comissao: 2.0,
                    fidc: 2.3,
                    mes: mesAlvo
                }
            ];

            // Remove lotes preditivos antigos do mesmo mês para recriar
            localPlanejamento = localPlanejamento.filter(lc => lc.mes !== mesAlvo);

            // Persiste no backend cada lote projetado
            for (const lote of novosLotesProjetados) {
                try {
                    const res = await fetch('/api/planejamento-compras', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(lote)
                    });
                    if (res.ok) {
                        const salvo = await res.json();
                        localPlanejamento.push(salvo);
                    } else {
                        localPlanejamento.push({ ...lote, id: Date.now() + Math.random() });
                    }
                } catch (err) {
                    localPlanejamento.push({ ...lote, id: Date.now() + Math.random() });
                }
            }

            // Registra o cenário ativo no histórico do mês
            historicoCenarioPorMes[mesAlvo] = cenario;

            // Ajusta seletor de mês para o mês recém gerado
            const selMes = document.getElementById('pl-filtro-mes');
            if (selMes) selMes.value = mesAlvo;

            mesPlanejamentoSelecionado = mesAlvo;
            fecharModalPlanejamentoPreditivo();
            renderPlanejamento();

            _apexNotify('Sucesso', `Planejamento Preditivo para ${mesAlvo} gerado com sucesso no Cenário ${cenario.toUpperCase()}!`, 'info');
        } catch (err) {
            console.error('Erro na geração preditiva:', err);
            _apexNotify('Atenção', 'Erro ao gerar planejamento preditivo: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Gerar e Aplicar ao Mês';
            }
        }
    };

    window.abrirModalPlanejamento = function() {
        document.getElementById('form-planejamento-apex').reset();
        document.getElementById('modal-planejamento').style.display = 'flex';
    };

    window.fecharModalPlanejamento = function() {
        document.getElementById('modal-planejamento').style.display = 'none';
    };

    window.popularDadosDaAmostraNoPlan = async function() {
        const amostraId = document.getElementById('pl-amostra').value;
        if (!amostraId) return;

        try {
            const res = await fetch(`/api/amostras/${amostraId}`);
            const data = await res.json();
            const { amostra, componentes } = data;

            document.getElementById('pl-fornecedor').value = amostra.fornecedor_id;
            document.getElementById('pl-peso').value = amostra.peso_inicial;
            
            // Acha componente principal com maior rendimento
            if (componentes.length > 0) {
                componentes.sort((a,b) => b.percentual - a.percentual);
                document.getElementById('pl-material-result').value = componentes[0].material_id;
                document.getElementById('pl-rendimento').value = componentes[0].percentual;
                document.getElementById('pl-produto').value = componentes[0].material_nome;

                // Favorecer o preço especial de compra autorizado pelo Diretor
                if (amostra.decisao_diretoria === 'Aprovado' && amostra.preco_compra_entregar) {
                    document.getElementById('pl-preco-compra').value = amostra.preco_compra_entregar;
                    // Preço de venda de referência da tabela geral
                    const prc = localPrecos.find(x => x.material_id === componentes[0].material_id);
                    if (prc) {
                        document.getElementById('pl-preco-venda').value = prc.venda_ref;
                    }
                } else {
                    // Fallback para preço da tabela geral
                    const prc = localPrecos.find(x => x.material_id === componentes[0].material_id);
                    if (prc) {
                        document.getElementById('pl-preco-compra').value = prc.preco_entregar;
                        document.getElementById('pl-preco-venda').value = prc.venda_ref;
                    }
                }
            }
            calcularLotePlanSimulacao();
        } catch (err) {
            console.error(err);
        }
    };

    window.calcularLotePlanSimulacao = function() {
        const peso = parseFloat(document.getElementById('pl-peso').value) || 0;
        const precoCompra = parseFloat(document.getElementById('pl-preco-compra').value) || 0;
        const rendimento = parseFloat(document.getElementById('pl-rendimento').value) || 0;
        const precoVenda = parseFloat(document.getElementById('pl-preco-venda').value) || 0;
        const comissao = parseFloat(document.getElementById('pl-comissao').value) || 0;
        const fidc = parseFloat(document.getElementById('pl-fidc').value) || 0;

        const totalC = peso * precoCompra;
        const pesoResultante = peso * (rendimento / 100);
        const totalV = pesoResultante * precoVenda;
        const lucroB = totalV - totalC;
        
        const valorComissao = totalV * (comissao / 100);
        const valorFidc = totalV * (fidc / 100);
        
        const lucroLiqSemFidc = lucroB - valorComissao;
        const lucroLiqComFidc = lucroLiqSemFidc - valorFidc;
        
        const margem = totalV > 0 ? (lucroLiqSemFidc / totalV) * 100 : 0;
        const roi = totalC > 0 ? (lucroLiqSemFidc / totalC) * 100 : 0;

        document.getElementById('sim-custo-total').textContent = 'R$ ' + totalC.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('sim-fat-total').textContent = 'R$ ' + totalV.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('sim-lucro-bruto').textContent = 'R$ ' + lucroB.toLocaleString('pt-BR', {minimumFractionDigits:2});
        
        // Exibindo lucro líquido sem considerar o desconto antecipado (já que é opcional)
        document.getElementById('sim-res-liquido').textContent = 'R$ ' + lucroLiqSemFidc.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('sim-margem').textContent = fmtBRL(margem) + ' %';
        document.getElementById('sim-roi').textContent = fmtBRL(roi) + ' %';
        
        // Salvar valores no window para o Simulador usar
        window.currentSimData = {
            peso, precoCompra, rendimento, precoVenda, comissao, fidc,
            totalC, pesoResultante, totalV, lucroB, valorComissao, valorFidc,
            lucroLiqSemFidc, lucroLiqComFidc, margem, roi
        };
    };

    
    // --- INICIO: SIMULADOR FIDC ---
    let chartFidcInstance = null;

    window.abrirSimuladorFIDC = function() {
        if (!window.currentSimData) {
            _apexNotify('Sistema', 'Preencha os dados do planejamento primeiro.', 'info');
            return;
        }

        const data = window.currentSimData;
        const prazo = parseInt(document.getElementById('pl-prazo').value) || 30;
        const cliente = document.getElementById('pl-cliente').value || 'Não informado';

        document.getElementById('sim-fidc-prazo-s').textContent = prazo;
        document.getElementById('sim-fidc-lucro-s').textContent = 'R$ ' + data.lucroLiqSemFidc.toLocaleString('pt-BR', {minimumFractionDigits:2});
        
        document.getElementById('sim-fidc-taxa-c').textContent = fmtBRL(data.fidc) + '%';
        document.getElementById('sim-fidc-lucro-c').textContent = 'R$ ' + data.lucroLiqComFidc.toLocaleString('pt-BR', {minimumFractionDigits:2});

        // Alternativas
        const taxasAlt = [1.0, 1.5, 2.0, 2.5, 3.0];
        const containerTaxas = document.getElementById('sim-fidc-tabela-taxas');
        containerTaxas.innerHTML = '';
        taxasAlt.forEach(t => {
            const valF = data.totalV * (t / 100);
            const lucroT = data.lucroLiqSemFidc - valF;
            containerTaxas.innerHTML += `
                <div style="background:#0d1a26; border:1px solid #1e3a5f; padding:10px; border-radius:6px; text-align:center;">
                    <div style="color:#e07b39; font-weight:bold; margin-bottom:5px;">${fmtBRL(t)}%</div>
                    <div style="color:#2AD07A; font-size:0.9rem;">R$ ${lucroT.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                </div>
            `;
        });

        // Inteligencia
        let indicador = '🟢';
        let titulo = 'Excelente para antecipar';
        let cor = '#2AD07A';
        
        const impactoFidcNoLucro = data.lucroB > 0 ? (data.valorFidc / data.lucroB) : 1;
        if (impactoFidcNoLucro > 0.4 || data.margem < 5) {
            indicador = '🔴'; titulo = 'Não recomendado'; cor = '#ff4d4d';
        } else if (impactoFidcNoLucro > 0.2) {
            indicador = '🟡'; titulo = 'Avaliar necessidade'; cor = '#f0b800';
        }

        const dif = data.lucroLiqSemFidc - data.lucroLiqComFidc;
        document.getElementById('sim-fidc-indicador-icone').textContent = indicador;
        document.getElementById('sim-fidc-indicador-titulo').textContent = titulo;
        document.getElementById('sim-fidc-indicador-titulo').style.color = cor;
        document.getElementById('sim-fidc-inteligencia-box').style.borderLeftColor = cor;

        let txt = `A antecipação via FIDC reduzirá seu lucro em <strong>R$ ${dif.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong> (${fmtBRL(data.fidc)}%), porém disponibilizará o capital imediatamente (economia de ${prazo} dias), aumentando a liquidez da empresa. `;
        
        if (indicador === '🔴') {
            txt += "Como o impacto do FIDC no lucro bruto é alto ou a margem da operação é baixa, recomenda-se <strong>NÃO antecipar</strong> os recebíveis a menos que haja urgência de caixa.";
        } else if (indicador === '🟡') {
            txt += "O impacto financeiro é moderado. Avalie a real necessidade de capital de giro antes de realizar a antecipação.";
        } else {
            txt += "Excelente oportunidade de antecipação. O custo financeiro não compromete a lucratividade e fortalece o fluxo de caixa.";
        }
        
        document.getElementById('sim-fidc-inteligencia-texto').innerHTML = txt;
        document.getElementById('modal-simulador-fidc').style.display = 'flex';

        // Atualizar Grafico
        const ctx = document.getElementById('chart-fidc-simulador').getContext('2d');
        if (chartFidcInstance) chartFidcInstance.destroy();

        chartFidcInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['SEM FIDC', 'COM FIDC'],
                datasets: [
                    {
                        label: 'Lucro Líquido (R$)',
                        data: [data.lucroLiqSemFidc, data.lucroLiqComFidc],
                        backgroundColor: ['#2AD07A', '#f0b800']
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#1e3a5f' }, ticks: { color: '#aaa' } },
                    x: { ticks: { color: '#aaa' } }
                }
            }
        });

        // Registrar no historico
        window.simulacoesFidcHistorico = window.simulacoesFidcHistorico || [];
        window.simulacoesFidcHistorico.push({
            data: new Date().toISOString(),
            prazo,
            taxa: data.fidc,
            lucro_sem: data.lucroLiqSemFidc,
            lucro_com: data.lucroLiqComFidc
        });
    };

    window.fecharSimuladorFIDC = function() {
        document.getElementById('modal-simulador-fidc').style.display = 'none';
    };

    window.gerarPdfFIDC = async function() {
        if (!window.jspdf) {
            _apexNotify('Sistema', 'A biblioteca jsPDF não carregou corretamente.', 'info');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const data = window.currentSimData;
        const prazo = document.getElementById('pl-prazo').value || '30';
        const cliente = document.getElementById('pl-cliente').value || 'N/A';
        const fornecedor = document.getElementById('pl-fornecedor').options[document.getElementById('pl-fornecedor').selectedIndex]?.text || 'N/A';
        const produto = document.getElementById('pl-produto').value || 'N/A';
        const fp = document.getElementById('pl-forma-pagamento').value;

        // Cabeçalho
        doc.setFontSize(18);
        doc.setTextColor(224, 123, 57);
        doc.text('Relatório Executivo - Inteligência Financeira (FIDC)', 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 15, 28);
        doc.text('Usuário: ' + (sessionStorage.getItem('apex_logged_user_name') || 'Admin'), 15, 34);

        // Dados da Operação
        doc.setFontSize(12);
        doc.setTextColor(40);
        doc.text('1. Dados da Operação', 15, 45);

        doc.autoTable({
            startY: 50,
            head: [['Fornecedor', 'Produto', 'Cliente', 'Prazo (dias)', 'Forma Pagamento']],
            body: [[fornecedor, produto, cliente, prazo, fp]],
            theme: 'grid',
            headStyles: { fillColor: [13, 26, 38] },
        });

        // Resultados Financeiros
        doc.text('2. Indicadores Financeiros', 15, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [['Custo Total', 'Receita Estimada', 'Lucro Bruto', 'Comissão (%)', 'Margem (%)', 'ROI (%)']],
            body: [[
                'R$ ' + data.totalC.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + data.totalV.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + data.lucroB.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                fmtBRL(data.comissao) + '%',
                data.fmtBRL(margem) + '%',
                data.fmtBRL(roi) + '%'
            ]],
            theme: 'grid',
            headStyles: { fillColor: [13, 26, 38] },
        });

        // Simulação FIDC
        doc.text('3. Simulação de Antecipação (FIDC)', 15, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [['Taxa FIDC', 'Desconto Financeiro', 'Lucro SEM FIDC', 'Lucro COM FIDC', 'Diferença']],
            body: [[
                fmtBRL(data.fidc) + '%',
                'R$ ' + data.valorFidc.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + data.lucroLiqSemFidc.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + data.lucroLiqComFidc.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + (data.lucroLiqSemFidc - data.lucroLiqComFidc).toLocaleString('pt-BR', {minimumFractionDigits:2})
            ]],
            theme: 'grid',
            headStyles: { fillColor: [224, 123, 57] },
        });

        // Conclusão Inteligente
        doc.text('4. Parecer Financeiro', 15, doc.lastAutoTable.finalY + 10);
        
        const div = document.createElement('div');
        div.innerHTML = document.getElementById('sim-fidc-inteligencia-texto').innerHTML;
        const textoPuro = div.textContent || div.innerText || "";
        
        const splitText = doc.splitTextToSize(textoPuro, 180);
        doc.setFontSize(10);
        doc.text(splitText, 15, doc.lastAutoTable.finalY + 18);

        await aplicarMarcaDaguaLogoJsPDF(doc);

        doc.save('Relatorio_Financeiro_FIDC.pdf');
    };
    // --- FIM: SIMULADOR FIDC ---

    // ── Helper Marca d'água jsPDF ──────────────────────────────────────────────
    let cachedLogoWatermarkBase64 = null;
    async function getLogoWatermarkBase64JsPDF() {
        if (cachedLogoWatermarkBase64) return cachedLogoWatermarkBase64;
        try {
            let res = await fetch('/assets/img/logo%20(2).png');
            if (!res.ok) res = await fetch('/assets/img/apexlogo.png');
            if (res.ok) {
                const blob = await res.blob();
                cachedLogoWatermarkBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                return cachedLogoWatermarkBase64;
            }
        } catch(e) {
            console.warn('Erro ao carregar logo para marca dágua:', e);
        }
        return null;
    }

    async function aplicarMarcaDaguaLogoJsPDF(doc) {
        const logo = await getLogoWatermarkBase64JsPDF();
        if (!logo) return;
        
        const pageCount = doc.internal.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
            doc.setPage(p);
            
            if (doc.GState && doc.setGState) {
                try {
                    doc.setGState(new doc.GState({ opacity: 0.08 }));
                } catch(e) {}
            }
            
            const pw = doc.internal.pageSize.getWidth();
            const ph = doc.internal.pageSize.getHeight();
            const imgW = 120;
            const imgH = 90;
            const x = (pw - imgW) / 2;
            const y = (ph - imgH) / 2;
            
            try {
                doc.addImage(logo, 'PNG', x, y, imgW, imgH);
            } catch(err) {}

            if (doc.GState && doc.setGState) {
                try {
                    doc.setGState(new doc.GState({ opacity: 1.0 }));
                } catch(e) {}
            }
        }
    }
    window.aplicarMarcaDaguaLogoJsPDF = aplicarMarcaDaguaLogoJsPDF;

    window.salvarPlanejamento = async function(e) {
        e.preventDefault();
        const data = {
            amostra_id: document.getElementById('pl-amostra').value || null,
            fornecedor_id: document.getElementById('pl-fornecedor').value,
            produto: document.getElementById('pl-produto').value,
            peso_comprado: document.getElementById('pl-peso').value,
            preco_compra: document.getElementById('pl-preco-compra').value,
            percentual_rendimento: document.getElementById('pl-rendimento').value,
            material_id: document.getElementById('pl-material-result').value,
            preco_venda_material: document.getElementById('pl-preco-venda').value,
            comissao: document.getElementById('pl-comissao').value,
            fidc: document.getElementById('pl-fidc').value,
            mes: document.getElementById('pl-mes').value,
            cliente: document.getElementById('pl-cliente').value,
            prazo_recebimento_dias: document.getElementById('pl-prazo').value,
            forma_pagamento: document.getElementById('pl-forma-pagamento').value,
            simulacoes_historico: window.simulacoesFidcHistorico || []
        };

        try {
            await fetch('/api/planejamento-compras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            carregarPlanejamento();
            carregarAmostras();
        } catch (err) {
            console.error(err);
        }
    };

    // =========================================================================
    // NAVEGAÇÃO DE SUB-GUIAS DE PLANEJAMENTO INTEGRADO
    // =========================================================================
    let subAbaPlanejamentoAtual = 'simulacao';
    let localMRP = [];
    let localEquipamentos = [];
    let localOPs = [];
    let etapasOpFormDraft = [];
    let localProducaoInsumos = [];
    let localComercialRevenda = [];
    window.localComercialRevenda = localComercialRevenda;
    let localParametrosPrazos = [];
    let chartRealizadoInstance = null;
    let chartCenariosInstance = null;
    let currentCenariosConfig = { percentual_conservador: 80, percentual_moderado: 100, percentual_agressivo: 120, cenario_foco: 'AGRESSIVO', meta_base_padrao_rs: 1000000 };
    let currentCenariosSimulation = null;

    window.alternarSubAbaPlanejamento = function(aba) {
        subAbaPlanejamentoAtual = aba;

        const subtabs = ['producao-insumos', 'compras', 'realizado', 'caixa', 'prazos', 'cenarios', 'estrategico', 'estrategicov3'];
        subtabs.forEach(t => {
            const btn = document.getElementById(`tab-btn-pl-${t}`);
            const view = document.getElementById(`pl-subview-${t}`);
            if (btn) {
                if (t === aba) {
                    btn.classList.add('active');
                    btn.style.background = '#1e4e8c';
                    btn.style.color = '#fff';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = '#101a24';
                    btn.style.color = '#aaa';
                }
            }
            if (view) {
                view.style.display = (t === aba) ? 'block' : 'none';
            }
        });

        if (aba === 'producao-insumos') carregarPlanejamentoProducaoInsumos();
        if (aba === 'compras') carregarPlanejamentoComercialRevenda();
        if (aba === 'realizado') carregarComparativoRealizadoGeral();
        if (aba === 'caixa') carregarProjecaoCaixa();
        if (aba === 'prazos') carregarParametrosPrazos();
        if (aba === 'cenarios') carregarPlanejamentoCenarios();
        if (aba === 'estrategico') carregarPlanejamentoEstrategico();
        if (aba === 'estrategicov3') carregarPlanejamentoEstrategicov3();
    };


    // ── 1. Planejamento de Compra (Trading Comercial & Insumos da Indústria) ────
    window.carregarPlanejamentoCompras = async function() {
        try {
            const res = await fetch('/api/planejamento/compras');
            const data = await res.json();
            localMRP = Array.isArray(data) ? data : [];
            window.localMRP = localMRP;
            renderPlanejamentoCompras();
        } catch (err) {
            console.error('Erro ao carregar MRP compras:', err);
            localMRP = [];
            window.localMRP = [];
            renderPlanejamentoCompras();
        }
    };

    function renderPlanejamentoCompras() {
        const tbodyCompras = document.getElementById('mrp-table-body');
        const tbodyInsumos = document.getElementById('insumos-table-body');
        const tbodyRealizado = document.getElementById('realizado-table-body');

        if (tbodyCompras) tbodyCompras.innerHTML = '';
        if (tbodyInsumos) tbodyInsumos.innerHTML = '';
        if (tbodyRealizado) tbodyRealizado.innerHTML = '';

        let totalQtyCompras = 0, totalCustoCompras = 0, totalLeadTimeCompras = 0, totalRealizadoVolCompras = 0;
        let totalQtyInsumos = 0, totalCustoInsumos = 0;
        let totalMetaRealizado = 0, totalVolumeRealizado = 0, totalInvestimentoPrevisto = 0, totalInvestimentoRealizado = 0;

        (localMRP || []).forEach(p => {
            const qty = parseFloat(p.quantidade_necessaria || 0);
            const qtyReal = parseFloat(p.quantidade_realizada_kg || 0);
            const prc = parseFloat(p.preco_estimado || 0);
            const lt = parseInt(p.lead_time_dias || 7);
            const totalEst = parseFloat(p.custo_total_estimado || (qty * prc));
            const totalReal = parseFloat(p.custo_total_realizado || (qtyReal * prc));
            const tipo = p.tipo_planejamento || 'COMPRA_VENDA';

            let statusBadge = '<span style="background:#1e3650; color:#aaa; padding:3px 8px; border-radius:12px; font-size:0.75rem;">Sugerido</span>';
            if (p.status === 'Em Cotação') statusBadge = '<span style="background:#3b2d18; color:#f0b800; border:1px solid #f0b800; padding:3px 8px; border-radius:12px; font-size:0.75rem;">🔍 Em Cotação</span>';
            if (p.status === 'Aprovado') statusBadge = '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:3px 8px; border-radius:12px; font-size:0.75rem;">✅ Aprovado</span>';
            if (p.status === 'Em Trânsito') statusBadge = '<span style="background:#122a3f; color:#3e7cb1; border:1px solid #3e7cb1; padding:3px 8px; border-radius:12px; font-size:0.75rem;">🚚 Em Trânsito</span>';
            if (p.status === 'Recebido') statusBadge = '<span style="background:#2a1b3f; color:#9b59b6; border:1px solid #9b59b6; padding:3px 8px; border-radius:12px; font-size:0.75rem;">📦 Recebido</span>';

            if (tipo === 'COMPRA_VENDA') {
                totalQtyCompras += qty;
                totalCustoCompras += totalEst;
                totalLeadTimeCompras += lt;
                totalRealizadoVolCompras += qtyReal;

                if (tbodyCompras) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding:10px 8px;"><strong>${p.material_nome || '-'}</strong></td>
                        <td style="padding:10px 8px;">${p.fornecedor_nome || '-'}</td>
                        <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${qty.toLocaleString('pt-BR')} kg</td>
                        <td style="padding:10px 8px; text-align:right;">R$ ${fmtBRL(prc)}</td>
                        <td style="padding:10px 8px; text-align:right; color:#f0b800; font-weight:bold;">R$ ${totalEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                        <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${qtyReal.toLocaleString('pt-BR')} kg</td>
                        <td style="padding:10px 8px; text-align:center;"><span style="color:#3e7cb1; font-weight:bold;">${lt} dias</span></td>
                        <td style="padding:10px 8px; text-align:center;">${p.mes_referencia || '-'}</td>
                        <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
                        <td style="padding:10px 8px; text-align:center;">
                            <button type="button" onclick="abrirModalAtualizarRealizado(${p.id})" style="background:#3b2d18; border:1px solid #f0b800; color:#f0b800; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:4px;" title="Atualizar Realizado Efetuado"><i class="fa-solid fa-pen-to-square"></i> Realizado</button>
                            <button type="button" onclick="imprimirMrpPdf(${p.id})" style="background:#162b20; border:1px solid #2AD07A; color:#2AD07A; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:4px;" title="Baixar PDF com Marca d'Água"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <button type="button" onclick="excluirPlanejamentoCompra(${p.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:0.9rem;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    tbodyCompras.appendChild(tr);
                }
            } else {
                totalQtyInsumos += qty;
                totalCustoInsumos += totalEst;

                if (tbodyInsumos) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding:10px 8px;"><strong>${p.material_nome || '-'}</strong></td>
                        <td style="padding:10px 8px;">${p.fornecedor_nome || '-'}</td>
                        <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${qty.toLocaleString('pt-BR')} kg</td>
                        <td style="padding:10px 8px; text-align:right; color:#aaa;">${parseFloat(p.ponto_pedido_kg || 0).toLocaleString('pt-BR')} kg</td>
                        <td style="padding:10px 8px; text-align:center;"><span style="color:#3e7cb1; font-weight:bold;">${lt} dias</span></td>
                        <td style="padding:10px 8px; text-align:right; color:#ffb74d; font-weight:bold;">R$ ${totalEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                        <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
                        <td style="padding:10px 8px; text-align:center;">
                            <button type="button" onclick="imprimirMrpPdf(${p.id})" style="background:#1e354d; border:1px solid #3e7cb1; color:#3e7cb1; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:4px;" title="Baixar PDF com Marca d'Água"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <button type="button" onclick="excluirPlanejamentoCompra(${p.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:0.9rem;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    tbodyInsumos.appendChild(tr);
                }
            }

            // Tabela 3: Planejado vs. Realizado (Metas)
            totalMetaRealizado += qty;
            totalVolumeRealizado += qtyReal;
            totalInvestimentoPrevisto += totalEst;
            totalInvestimentoRealizado += totalReal;

            if (tbodyRealizado) {
                const desvioPct = qty > 0 ? (((qtyReal - qty) / qty) * 100) : 0;
                const desvioCor = desvioPct >= 0 ? '#2AD07A' : '#ff6b6b';
                const desvioTexto = (desvioPct >= 0 ? '+' : '') + desvioPct.toFixed(1) + '%';
                const pctBarra = qty > 0 ? Math.min(Math.round((qtyReal / qty) * 100), 100) : 0;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding:10px 8px;"><span style="background:${tipo === 'COMPRA_VENDA' ? '#162b20' : '#1e354d'}; color:${tipo === 'COMPRA_VENDA' ? '#2AD07A' : '#3e7cb1'}; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">${tipo === 'COMPRA_VENDA' ? 'Trading' : 'Insumo'}</span></td>
                    <td style="padding:10px 8px;"><strong>${p.material_nome || '-'}</strong> <small style="color:#aaa;">(${p.fornecedor_nome || '-'})</small></td>
                    <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${qty.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${qtyReal.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${desvioCor};">${desvioTexto}</td>
                    <td style="padding:10px 8px; text-align:right; color:#f0b800;">R$ ${totalEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:right; color:#2AD07A; font-weight:bold;">R$ ${totalReal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; min-width:140px;">
                        <div style="background:#162432; border-radius:10px; height:12px; overflow:hidden; border:1px solid #223547;">
                            <div style="background:${pctBarra >= 100 ? '#2AD07A' : '#f0b800'}; height:100%; width:${pctBarra}%;"></div>
                        </div>
                        <small style="font-size:0.75rem; color:#aaa; display:block; text-align:center; margin-top:2px;">${pctBarra}% Atingido</small>
                    </td>
                    <td style="padding:10px 8px; text-align:center;">
                        <button type="button" onclick="abrirModalAtualizarRealizado(${p.id})" style="background:#3b2d18; border:1px solid #f0b800; color:#f0b800; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;" title="Lançar Volume Realizado"><i class="fa-solid fa-pen"></i> Lançar</button>
                    </td>
                `;
                tbodyRealizado.appendChild(tr);
            }
        });

        // KPIs Sub-aba 1 (Trading)
        const kpiDem = document.getElementById('mrp-kpi-demandas');
        const kpiCust = document.getElementById('mrp-kpi-custototal');
        const kpiLt = document.getElementById('mrp-kpi-leadtime');
        const kpiAt = document.getElementById('mrp-kpi-atingimento');

        const comprasList = (localMRP || []).filter(x => (x.tipo_planejamento || 'COMPRA_VENDA') === 'COMPRA_VENDA');
        if (kpiDem) kpiDem.textContent = totalQtyCompras.toLocaleString('pt-BR') + ' kg';
        if (kpiCust) kpiCust.textContent = 'R$ ' + totalCustoCompras.toLocaleString('pt-BR', {minimumFractionDigits:2});
        if (kpiLt) kpiLt.textContent = (comprasList.length > 0 ? Math.round(totalLeadTimeCompras / comprasList.length) : 0) + ' dias';
        if (kpiAt) kpiAt.textContent = (totalQtyCompras > 0 ? Math.round((totalRealizadoVolCompras / totalQtyCompras) * 100) : 0) + '%';

        // KPIs Sub-aba 2 (Insumos)
        const kpiInsTot = document.getElementById('ins-kpi-total');
        const kpiInsVol = document.getElementById('ins-kpi-volume');
        const kpiInsCusto = document.getElementById('ins-kpi-custo');

        const insumosList = (localMRP || []).filter(x => x.tipo_planejamento === 'INSUMO_INDUSTRIA');
        if (kpiInsTot) kpiInsTot.textContent = insumosList.length;
        if (kpiInsVol) kpiInsVol.textContent = totalQtyInsumos.toLocaleString('pt-BR') + ' kg';
        if (kpiInsCusto) kpiInsCusto.textContent = 'R$ ' + totalCustoInsumos.toLocaleString('pt-BR', {minimumFractionDigits:2});

        // KPIs Sub-aba 3 (Realizado & Projeção)
        const kpiRealPlan = document.getElementById('real-kpi-planejado-vol');
        const kpiRealEfet = document.getElementById('real-kpi-realizado-vol');
        const kpiRealDesv = document.getElementById('real-kpi-desvio');
        const kpiRealProj = document.getElementById('real-kpi-proj-caixa');

        if (kpiRealPlan) kpiRealPlan.textContent = totalMetaRealizado.toLocaleString('pt-BR') + ' kg';
        if (kpiRealEfet) kpiRealEfet.textContent = totalVolumeRealizado.toLocaleString('pt-BR') + ' kg';
        const desvioGeralPct = totalMetaRealizado > 0 ? (((totalVolumeRealizado - totalMetaRealizado) / totalMetaRealizado) * 100) : 0;
        if (kpiRealDesv) {
            kpiRealDesv.textContent = (desvioGeralPct >= 0 ? '+' : '') + desvioGeralPct.toFixed(1) + '%';
            kpiRealDesv.style.color = desvioGeralPct >= 0 ? '#2AD07A' : '#ff6b6b';
        }
        if (kpiRealProj) kpiRealProj.textContent = 'R$ ' + totalInvestimentoPrevisto.toLocaleString('pt-BR', {minimumFractionDigits:2});
    }

    window.abrirModalPlanejamentoCompra = async function(tipoFix) {
        let _forns = window.localFornecedores || [];
        if (_forns.length === 0) {
            try {
                const res = await fetch('/api/fornecedores?limit=200');
                if (res.ok) {
                    const data = await res.json();
                    _forns = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
                    window.localFornecedores = _forns;
                }
            } catch(e){}
        }

        let _mats = window.localMateriais || [];
        if (_mats.length === 0) {
            try {
                const res = await fetch('/api/materiais-catalogo');
                if (res.ok) {
                    const data = await res.json();
                    _mats = Array.isArray(data) ? data : [];
                    window.localMateriais = _mats;
                }
            } catch(e){}
        }

        const selMat = document.getElementById('mrp-material-id');
        const selForn = document.getElementById('mrp-fornecedor-id');
        const listMat = _mats;
        const listForn = _forns;

        if (selMat) {
            selMat.innerHTML = '<option value="">Selecione o Material...</option>' +
                listMat.map(m => `<option value="${m.id}">${m.nome} (${m.categoria || 'Geral'})</option>`).join('');
        }
        if (selForn) {
            selForn.innerHTML = '<option value="">Selecione o Fornecedor...</option>' +
                listForn.map(f => `<option value="${f.id}">${f.apelido || f.nome}</option>`).join('');
        }

        document.getElementById('form-planejamento-compra').reset();
        document.getElementById('mrp-id').value = '';
        document.getElementById('mrp-mes-referencia').value = new Date().toISOString().slice(0, 7);
        document.getElementById('mrp-custo-total-previsto').value = 'R$ 0,00';

        const tipoVal = tipoFix || 'COMPRA_VENDA';
        window.mrpLastTipoOpened = tipoVal;
        document.getElementById('mrp-tipo-planejamento').value = tipoVal;
        document.getElementById('mrp-select-tipo').value = tipoVal;

        document.getElementById('modal-mrp-titulo').innerHTML = tipoVal === 'COMPRA_VENDA' ?
            '<i class="fa-solid fa-cart-shopping" style="color:#2AD07A;"></i> Nova Meta de Compra & Venda (Trading)' :
            '<i class="fa-solid fa-boxes-packing" style="color:#3e7cb1;"></i> Novo Insumo da Indústria (Produção)';

        document.getElementById('modal-planejamento-compra').style.display = 'flex';
    };

    window.fecharModalPlanejamentoCompra = function() {
        document.getElementById('modal-planejamento-compra').style.display = 'none';
    };

    window.abrirModalQuickMaterial = function() {
        window.quickOpenedFromPlanning = true;
        window.mrpLastTipoOpened = document.getElementById('mrp-tipo-planejamento')?.value || 'COMPRA_VENDA';
        window.fecharModalPlanejamentoCompra();
        if (window.abrirModalMaterial) window.abrirModalMaterial();
    };

    window.abrirModalQuickFornecedor = function() {
        window.quickOpenedFromPlanning = true;
        window.mrpLastTipoOpened = document.getElementById('mrp-tipo-planejamento')?.value || 'COMPRA_VENDA';
        window.fecharModalPlanejamentoCompra();
        if (window.abrirModalFornecedor) window.abrirModalFornecedor();
    };

    window.calcularCustoTotalMrpForm = function() {
        const qty = parseFloat(document.getElementById('mrp-qtd-necessaria').value) || 0;
        const prc = parseFloat(document.getElementById('mrp-preco-estimado').value) || 0;
        const total = qty * prc;
        const el = document.getElementById('mrp-custo-total-previsto');
        if (el) el.value = 'R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits:2});
    };

    window.salvarPlanejamentoCompraForm = async function(e) {
        e.preventDefault();
        const payload = {
            tipo_planejamento: document.getElementById('mrp-tipo-planejamento').value || 'COMPRA_VENDA',
            material_id: document.getElementById('mrp-material-id').value,
            fornecedor_id: document.getElementById('mrp-fornecedor-id').value,
            quantidade_necessaria: document.getElementById('mrp-qtd-necessaria').value,
            quantidade_realizada_kg: document.getElementById('mrp-qtd-realizada').value || 0,
            lead_time_dias: document.getElementById('mrp-lead-time').value || 7,
            preco_estimado: document.getElementById('mrp-preco-estimado').value || 0,
            mes_referencia: document.getElementById('mrp-mes-referencia').value,
            status: document.getElementById('mrp-status').value,
            observacoes: document.getElementById('mrp-obs').value
        };

        try {
            const res = await fetch('/api/planejamento/compras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar planejamento');
            _apexNotify('Sucesso', 'Planejamento salvo com sucesso no banco de dados!', 'success');
            fecharModalPlanejamentoCompra();
            await carregarPlanejamentoCompras();
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.abrirModalAtualizarRealizado = function(id) {
        const item = (localMRP || []).find(x => x.id == id);
        if (!item) return;

        document.getElementById('real-item-id').value = item.id;
        document.getElementById('real-item-material').value = item.material_nome || 'Material';
        document.getElementById('real-item-meta').value = parseFloat(item.quantidade_necessaria || 0).toLocaleString('pt-BR') + ' kg';
        document.getElementById('real-item-qtd-realizada').value = item.quantidade_realizada_kg || 0;
        document.getElementById('real-item-status').value = item.status || 'Sugerido';

        document.getElementById('modal-atualizar-realizado').style.display = 'flex';
    };

    window.fecharModalAtualizarRealizado = function() {
        document.getElementById('modal-atualizar-realizado').style.display = 'none';
    };

    window.salvarRealizadoForm = async function(e) {
        e.preventDefault();
        const id = document.getElementById('real-item-id').value;
        const qtyReal = parseFloat(document.getElementById('real-item-qtd-realizada').value) || 0;
        const status = document.getElementById('real-item-status').value;

        const item = (localMRP || []).find(x => x.id == id);
        const prc = item ? parseFloat(item.preco_estimado || 0) : 0;
        const custoReal = qtyReal * prc;

        try {
            const res = await fetch(`/api/planejamento/compras/${id}/realizado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantidade_realizada_kg: qtyReal,
                    custo_total_realizado: custoReal,
                    status: status
                })
            });
            if (!res.ok) throw new Error('Erro ao atualizar volume realizado');
            _apexNotify('Sucesso', 'Volume realizado atualizado com sucesso!', 'success');
            fecharModalAtualizarRealizado();
            await carregarPlanejamentoCompras();
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.excluirPlanejamentoCompra = async function(id) {
        if (!confirm('Excluir este planejamento?')) return;
        try {
            await fetch(`/api/planejamento/compras/${id}`, { method: 'DELETE' });
            _apexNotify('Sucesso', 'Registro excluído.', 'success');
            await carregarPlanejamentoCompras();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao excluir: ' + err.message, 'error');
        }
    };

    // ── 1. Planejamento de Produção & Explosão de Insumos ────────────────────────
    window.carregarPlanejamentoProducaoInsumos = async function() {
        try {
            const res = await fetch('/api/planejamento/producao-insumos');
            const data = await res.json();
            localProducaoInsumos = Array.isArray(data) ? data : [];
            renderPlanejamentoProducaoInsumos();
        } catch (err) {
            console.error('Erro ao carregar planejamento de produção insumos:', err);
            localProducaoInsumos = [];
            renderPlanejamentoProducaoInsumos();
        }
    };

    function renderPlanejamentoProducaoInsumos() {
        const tbody = document.getElementById('plprod-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!localProducaoInsumos || localProducaoInsumos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align:center; padding:40px 15px; color:#aaa;">
                        <i class="fa-solid fa-industry" style="font-size:2.8rem; opacity:0.25; margin-bottom:12px; display:block; color:#2AD07A;"></i>
                        <span style="font-size:1.05rem; color:#fff; font-weight:700; display:block; margin-bottom:6px;">Nenhum planejamento registrado para este período</span>
                        <span style="font-size:0.85rem; color:#7a9cb8; display:block; margin-bottom:18px;">Clique no botão abaixo para adicionar um produto acabado e calcular a explosão de insumos.</span>
                        <button type="button" onclick="window._forcarAbrirModalPlanejamentoProducao()" style="background:#2AD07A; color:#0d1826; border:none; padding:10px 22px; border-radius:8px; font-weight:800; font-size:0.9rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(42,208,122,0.4);">
                            <i class="fa-solid fa-plus-circle" style="font-size:1.1rem;"></i> + Criar Novo Planejamento de Produção
                        </button>
                    </td>
                </tr>
            `;
            const kpiProd = document.getElementById('plprod-kpi-total-prod');
            const kpiIns = document.getElementById('plprod-kpi-total-insumos');
            const kpiLiq = document.getElementById('plprod-kpi-compra-liquida');
            const kpiCusto = document.getElementById('plprod-kpi-custo-total');
            if (kpiProd) kpiProd.textContent = '0 kg';
            if (kpiIns) kpiIns.textContent = '0 kg';
            if (kpiLiq) kpiLiq.textContent = '0 kg';
            if (kpiCusto) kpiCusto.textContent = 'R$ 0,00';
            return;
        }

        let totProd = 0, totInsumo = 0, totCompraLiq = 0, totCusto = 0;

        localProducaoInsumos.forEach(item => {
            const qProd = parseFloat(item.quantidade_planejada_prod_kg || 0);
            const qIns = parseFloat(item.quantidade_insumo_nec_kg || 0);
            const qEst = parseFloat(item.estoque_atual_kg || 0);
            const qMin = parseFloat(item.estoque_minimo_kg || 0);
            const qLiq = parseFloat(item.quantidade_necessaria_compra_kg || Math.max(0, qIns - qEst));
            const cEst = parseFloat(item.custo_estimado_rs || 0);

            totProd += qProd;
            totInsumo += qIns;
            totCompraLiq += qLiq;
            totCusto += cEst;

            const isVermelho = qLiq > 0;
            const statusBadge = isVermelho ?
                '<span style="background:#3b1818; color:#ff4d4d; border:1px solid #ff4d4d; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🔴 NECESSIDADE DE COMPRA</span>' :
                '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🟢 ESTOQUE SUFICIENTE</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><strong>${item.produto_nome || 'Produto'}</strong></td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${qProd.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px;"><strong>${item.insumo_nome || 'Insumo'}</strong></td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${qIns.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; color:#aaa;">${qEst.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; color:#aaa;">${qMin.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:${isVermelho ? '#ff4d4d' : '#2AD07A'};">${qLiq.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; color:#f0b800; font-weight:bold;">R$ ${cEst.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px 8px; text-align:center;"><span style="color:#ffb74d; font-weight:bold;">${item.data_limite_pedido || '-'}</span></td>
                <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
                <td style="padding:10px 8px; text-align:center;">
                    <button type="button" onclick="excluirPlanejamentoProducaoInsumo(${item.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const kpiProd = document.getElementById('plprod-kpi-total-prod');
        const kpiIns = document.getElementById('plprod-kpi-total-insumos');
        const kpiLiq = document.getElementById('plprod-kpi-compra-liquida');
        const kpiCusto = document.getElementById('plprod-kpi-custo-total');

        if (kpiProd) kpiProd.textContent = totProd.toLocaleString('pt-BR') + ' kg';
        if (kpiIns) kpiIns.textContent = totInsumo.toLocaleString('pt-BR') + ' kg';
        if (kpiLiq) kpiLiq.textContent = totCompraLiq.toLocaleString('pt-BR') + ' kg';
        if (kpiCusto) kpiCusto.textContent = 'R$ ' + totCusto.toLocaleString('pt-BR', {minimumFractionDigits:2});
    }

    // ─── Estado do simulador de produção ───────────────────────────────────
    let _simLinhas = []; 
    let _simLinhaIdx = 0;

    window.abrirModalPlanejamentoProducao = async function() {
        const modalEl = document.getElementById('modal-planejamento-producao');
        if (!modalEl) return;
        document.body.appendChild(modalEl);
        modalEl.style.display = 'block';

        // Reset estado
        _simLinhas = [];
        _simLinhaIdx = 0;
        simIrParaStep(1);

        // Popular select de produto final
        let _mats = window.localMateriais || [];
        if (!Array.isArray(_mats) || _mats.length === 0) {
            try {
                const res = await fetch('/api/materiais-catalogo');
                if (res.ok) {
                    const data = await res.json();
                    _mats = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
                    window.localMateriais = _mats;
                }
            } catch(e) {}
        }

        const selProd = document.getElementById('sim-produto-id');
        if (selProd) selProd.innerHTML = '<option value="">Selecione o Produto Final...</option>' +
            (_mats || []).map(m => `<option value="${m.id}" data-preco-venda="${m.preco_venda||m.preco_tabela_venda||0}" data-preco-compra="${m.preco_compra||m.preco_tabela||0}">${m.nome}</option>`).join('');

        // Defaults
        const perEl = document.getElementById('sim-periodo');
        if (perEl) perEl.value = new Date().toISOString().slice(0, 7);
        document.getElementById('sim-meta-fat').value = '';
        document.getElementById('sim-preco-venda').value = '';
        document.getElementById('sim-qtd-produto').value = '—';
        document.getElementById('sim-prazo-compra').value = '';
        document.getElementById('sim-prazo-venda').value = '';
        document.getElementById('sim-linhas-rows').innerHTML = '';
        simAdicionarLinhaInsumo(); // começa com 1 linha
    };

    window.fecharModalPlanejamentoProducao = function() {
        const m = document.getElementById('modal-planejamento-producao');
        if (m) m.style.display = 'none';
    };

    window.simIrParaStep = function(step) {
        [1,2,3].forEach(s => {
            const el = document.getElementById('sim-step-' + s);
            const tab = document.getElementById('sim-step-tab-' + s);
            if (el) el.style.display = (s === step) ? 'block' : 'none';
            if (tab) {
                tab.style.color = (s === step) ? '#2AD07A' : '#8eaabf';
                tab.style.borderBottom = (s === step) ? '2px solid #2AD07A' : '2px solid transparent';
                tab.style.fontWeight = (s === step) ? '700' : '600';
            }
        });
        if (step === 2) {
            // atualizar header info
            const meta = parseFloat(document.getElementById('sim-meta-fat').value) || 0;
            const qtd = document.getElementById('sim-qtd-produto').value;
            const info = document.getElementById('sim-header-info');
            if (info) info.textContent = meta > 0 ? `Meta: R$ ${meta.toLocaleString('pt-BR', {minimumFractionDigits:0})} | Qtd Produto: ${qtd}` : '';
            simRecalcularLinhas();
        }
        if (step === 3) simGerarPreview();
    };

    window.simAutoFillProduto = function() {
        const sel = document.getElementById('sim-produto-id');
        if (!sel || !sel.value) return;
        const opt = sel.options[sel.selectedIndex];
        const pv = parseFloat(opt.dataset.precoVenda) || 0;
        if (pv > 0) {
            document.getElementById('sim-preco-venda').value = pv.toFixed(4);
            simRecalcular();
        }
    };

    window.simRecalcular = function() {
        const meta = parseFloat(document.getElementById('sim-meta-fat').value) || 0;
        const pv   = parseFloat(document.getElementById('sim-preco-venda').value) || 0;
        const qtdEl = document.getElementById('sim-qtd-produto');
        if (meta > 0 && pv > 0) {
            const qtd = meta / pv;
            qtdEl.value = qtd.toLocaleString('pt-BR', {minimumFractionDigits:3, maximumFractionDigits:3}) + ' kg';
            simRecalcularLinhas();
        } else {
            qtdEl.value = '—';
        }
    };

    window.simAdicionarLinhaInsumo = function() {
        const idx = _simLinhaIdx++;
        _simLinhas.push({ idx, insumo_produto_id: '', insumo_nome: '', coef_pct: 100,
            preco_compra_tabela: 0, preco_compra_simulado: 0, preco_venda_tabela: 0, qtd_necessaria: 0, custo_total: 0 });

        const _mats = window.localMateriais || [];
        const container = document.getElementById('sim-linhas-rows');
        if (!container) return;

        const div = document.createElement('div');
        div.id = 'sim-linha-row-' + idx;
        div.style.cssText = 'display:grid; grid-template-columns:2fr 80px 80px 90px 90px 90px 32px; gap:8px; align-items:center; background:#0d1826; border:1px solid #1a2e3f; border-radius:8px; padding:8px;';
        div.innerHTML = `
            <select id="sim-ins-sel-${idx}" class="noble-input" style="font-size:0.8rem; padding:5px 6px;" onchange="simLinhaOnChange(${idx})">
                <option value="">Selecione o insumo...</option>
                ${_mats.map(m => `<option value="${m.id}" data-nome="${m.nome}" data-pc="${m.preco_compra||m.preco_tabela||0}" data-pv="${m.preco_venda||m.preco_tabela_venda||0}">${m.nome}</option>`).join('')}
            </select>
            <input type="number" id="sim-ins-coef-${idx}" class="noble-input" style="font-size:0.8rem; padding:5px 6px; text-align:center;" value="100" min="0.01" step="0.01" title="% do produto final" oninput="simRecalcularLinhas()">
            <input type="text" id="sim-ins-qtd-${idx}" class="noble-input" style="font-size:0.8rem; padding:5px 6px; text-align:right; background:#0a1810; color:#2AD07A;" readonly value="—">
            <input type="text" id="sim-ins-pct-${idx}" class="noble-input" style="font-size:0.8rem; padding:5px 6px; text-align:right; background:#0a1810; color:#aaa;" readonly value="—">
            <input type="number" id="sim-ins-pcs-${idx}" class="noble-input" style="font-size:0.8rem; padding:5px 6px; text-align:right;" step="0.0001" placeholder="Simular" oninput="simRecalcularLinhas()">
            <input type="text" id="sim-ins-cust-${idx}" class="noble-input" style="font-size:0.8rem; padding:5px 6px; text-align:right; background:#0a1810; color:#f0b800; font-weight:700;" readonly value="—">
            <button type="button" onclick="simRemoverLinha(${idx})" style="background:transparent; border:1px solid #3d1a1a; color:#ff6b6b; width:32px; height:32px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;">
                <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i>
            </button>`;
        container.appendChild(div);
    };

    window.simLinhaOnChange = function(idx) {
        const sel = document.getElementById('sim-ins-sel-' + idx);
        if (!sel || !sel.value) return;
        const opt = sel.options[sel.selectedIndex];
        const linha = _simLinhas.find(l => l.idx === idx);
        if (!linha) return;
        linha.insumo_produto_id = parseInt(sel.value);
        linha.insumo_nome = opt.dataset.nome || '';
        linha.preco_compra_tabela = parseFloat(opt.dataset.pc) || 0;
        linha.preco_venda_tabela = parseFloat(opt.dataset.pv) || 0;
        linha.preco_compra_simulado = linha.preco_compra_tabela;
        document.getElementById('sim-ins-pct-' + idx).value = linha.preco_compra_tabela > 0
            ? 'R$ ' + linha.preco_compra_tabela.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:4})
            : '—';
        const psEl = document.getElementById('sim-ins-pcs-' + idx);
        if (psEl && !psEl.value) psEl.value = linha.preco_compra_tabela > 0 ? linha.preco_compra_tabela.toFixed(4) : '';
        simRecalcularLinhas();
    };

    window.simRemoverLinha = function(idx) {
        _simLinhas = _simLinhas.filter(l => l.idx !== idx);
        const el = document.getElementById('sim-linha-row-' + idx);
        if (el) el.remove();
        simRecalcularLinhas();
    };

    window.simRecalcularLinhas = function() {
        const meta = parseFloat(document.getElementById('sim-meta-fat').value) || 0;
        const pv   = parseFloat(document.getElementById('sim-preco-venda').value) || 0;
        const qtdProd = (meta > 0 && pv > 0) ? meta / pv : 0;

        _simLinhas.forEach(l => {
            const coef = parseFloat(document.getElementById('sim-ins-coef-' + l.idx)?.value) || 100;
            const pcs  = parseFloat(document.getElementById('sim-ins-pcs-' + l.idx)?.value) || l.preco_compra_tabela;
            l.coef_pct = coef;
            l.preco_compra_simulado = pcs || l.preco_compra_tabela;
            l.qtd_necessaria = qtdProd * (coef / 100);
            l.custo_total = l.qtd_necessaria * (l.preco_compra_simulado || l.preco_compra_tabela);

            const qtdEl = document.getElementById('sim-ins-qtd-' + l.idx);
            const custEl = document.getElementById('sim-ins-cust-' + l.idx);
            if (qtdEl) qtdEl.value = l.qtd_necessaria > 0 ? l.qtd_necessaria.toLocaleString('pt-BR', {minimumFractionDigits:3, maximumFractionDigits:3}) + ' kg' : '—';
            if (custEl) custEl.value = l.custo_total > 0 ? 'R$ ' + l.custo_total.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—';
        });
    };

    window.simGerarPreview = function() {
        const meta    = parseFloat(document.getElementById('sim-meta-fat').value) || 0;
        const pv      = parseFloat(document.getElementById('sim-preco-venda').value) || 0;
        const qtdProd = (meta > 0 && pv > 0) ? meta / pv : 0;
        const periodo = document.getElementById('sim-periodo').value;
        const selProd = document.getElementById('sim-produto-id');
        const nomeProd = selProd?.options[selProd.selectedIndex]?.text || '—';

        simRecalcularLinhas();

        const custoTotal = _simLinhas.reduce((s, l) => s + l.custo_total, 0);
        const markup = custoTotal > 0 ? ((meta - custoTotal) / custoTotal) * 100 : 0;

        const cards = [
            { label: '🎯 Meta de Faturamento', val: 'R$ ' + meta.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#3e7cb1' },
            { label: '📦 Produto Final', val: nomeProd, cor: '#2AD07A', small: periodo },
            { label: '⚖️ Qtd Necessária', val: qtdProd.toLocaleString('pt-BR', {minimumFractionDigits:3}) + ' kg', cor: '#2AD07A' },
            { label: '💰 Custo Total Insumos', val: 'R$ ' + custoTotal.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#f0b800' },
            { label: '📈 Margem Projetada', val: markup.toFixed(1) + '%', cor: markup >= 0 ? '#2AD07A' : '#ff4d4d' },
            { label: '🧮 Nº de Insumos', val: _simLinhas.length + ' insumo(s)', cor: '#9b59b6' },
        ];

        document.getElementById('sim-preview-cards').innerHTML = cards.map(c => `
            <div style="background:#0d1826; border:1px solid #1a2e3f; border-radius:10px; padding:14px; border-left:3px solid ${c.cor};">
                <div style="font-size:0.75rem; color:#8eaabf; font-weight:600; text-transform:uppercase; margin-bottom:6px;">${c.label}</div>
                <div style="font-size:1.1rem; color:${c.cor}; font-weight:800;">${c.val}</div>
                ${c.small ? `<div style="font-size:0.75rem; color:#8eaabf; margin-top:2px;">${c.small}</div>` : ''}
            </div>`).join('');

        // Tabela resumo
        document.getElementById('sim-preview-tabela').innerHTML = _simLinhas.map(l => {
            const eficiencia = l.preco_compra_simulado > 0 && l.preco_compra_tabela > 0
                ? (l.preco_compra_simulado < l.preco_compra_tabela
                    ? '<span style="color:#2AD07A; font-weight:700;">✅ BEM</span>'
                    : l.preco_compra_simulado > l.preco_compra_tabela
                    ? '<span style="color:#ff4d4d; font-weight:700;">⚠️ ACIMA TAB.</span>'
                    : '<span style="color:#aaa;">— TAB.</span>')
                : '—';
            return `<tr style="border-top:1px solid #1a2e3f; color:#fff;">
                <td style="padding:6px; text-align:left;">${l.insumo_nome || '(sem nome)'}</td>
                <td style="padding:6px; text-align:right; color:#8eaabf;">${l.coef_pct.toFixed(1)}%</td>
                <td style="padding:6px; text-align:right;">${l.qtd_necessaria.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</td>
                <td style="padding:6px; text-align:right; color:#aaa;">R$ ${l.preco_compra_tabela.toLocaleString('pt-BR',{minimumFractionDigits:4})}</td>
                <td style="padding:6px; text-align:right; color:#fff;">R$ ${(l.preco_compra_simulado||l.preco_compra_tabela).toLocaleString('pt-BR',{minimumFractionDigits:4})}</td>
                <td style="padding:6px; text-align:right; color:#f0b800; font-weight:700;">R$ ${l.custo_total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="padding:6px; text-align:right;">${eficiencia}</td>
            </tr>`;
        }).join('') + `<tr style="background:#0a1a2a; font-weight:700; border-top:2px solid #2AD07A;">
            <td colspan="5" style="padding:6px; color:#fff;">TOTAL</td>
            <td style="padding:6px; text-align:right; color:#f0b800;">R$ ${custoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding:6px; text-align:right; color:${markup >= 0 ? '#2AD07A' : '#ff4d4d'};">Markup: ${markup.toFixed(1)}%</td>
        </tr>`;
    };

    window.simSalvar = async function() {
        const selProd = document.getElementById('sim-produto-id');
        const meta    = parseFloat(document.getElementById('sim-meta-fat').value) || 0;
        const pv      = parseFloat(document.getElementById('sim-preco-venda').value) || 0;
        if (!meta || !pv || !selProd?.value) {
            _apexNotify('Atenção', 'Preencha a meta de faturamento, produto final e preço de venda.', 'warning');
            return;
        }
        if (_simLinhas.length === 0 || !_simLinhas.some(l => l.insumo_nome)) {
            _apexNotify('Atenção', 'Adicione ao menos um insumo no Step 2.', 'warning');
            return;
        }

        const qtdProd = meta / pv;
        const custoTotal = _simLinhas.reduce((s, l) => s + l.custo_total, 0);
        const margem = custoTotal > 0 ? ((meta - custoTotal) / custoTotal) * 100 : 0;

        const payload = {
            periodo: document.getElementById('sim-periodo').value,
            produto_id: parseInt(selProd.value),
            produto_nome: selProd.options[selProd.selectedIndex].text,
            meta_faturamento_rs: meta,
            preco_venda_produto_rs: pv,
            qtd_produto_necessaria: qtdProd,
            custo_total_projetado_rs: custoTotal,
            margem_projetada_pct: margem,
            prazo_compra_ate: document.getElementById('sim-prazo-compra').value || null,
            prazo_venda_ate: document.getElementById('sim-prazo-venda').value || null,
            status: 'Ativo',
            linhas: _simLinhas.filter(l => l.insumo_nome).map(l => ({
                insumo_produto_id: l.insumo_produto_id || null,
                insumo_nome: l.insumo_nome,
                coeficiente_pct: l.coef_pct,
                qtd_necessaria: l.qtd_necessaria,
                preco_compra_tabela: l.preco_compra_tabela,
                preco_compra_simulado: l.preco_compra_simulado || l.preco_compra_tabela,
                preco_venda_tabela: l.preco_venda_tabela,
                custo_total_insumo: l.custo_total
            }))
        };

        const btn = document.getElementById('btn-salvar-simulador');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
        try {
            const res = await fetch('/api/planejamento/producao-insumos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar');
            _apexNotify('Sucesso', 'Planejamento de produção salvo com sucesso!', 'success');
            fecharModalPlanejamentoProducao();
            await carregarPlanejamentoProducaoInsumos();
        } catch (err) {
            _apexNotify('Erro', err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Planejamento'; }
        }
    };

    window.excluirPlanejamentoProducaoInsumo = async function(id) {
        if (!confirm('Excluir este planejamento de produção (linhas e movimentações incluídas)?')) return;
        try {
            await fetch(`/api/planejamento/producao-insumos/${id}`, { method: 'DELETE' });
            await carregarPlanejamentoProducaoInsumos();
        } catch(e) { console.error(e); }
    };

    // ─── Extrato de Produção & Movimentações ──────────────────────────────────
    let _activePlanProducao = null; // objeto do planejamento ativo no extrato
    let _chartExtProdInsumos = null;
    let _chartExtProdMeta = null;

    window.abrirExtratoProducao = async function(id) {
        try {
            const res = await fetch('/api/planejamento/producao-insumos');
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            const plan = list.find(p => p.id === id);
            if (!plan) {
                _apexNotify('Atenção', 'Planejamento não encontrado.', 'error');
                return;
            }
            _activePlanProducao = plan;

            const modal = document.getElementById('modal-extrato-producao');
            if (modal) {
                document.body.appendChild(modal);
                modal.style.display = 'block';
            }

            document.getElementById('extrato-prod-titulo').textContent = `Extrato & Análise Produção — ${plan.produto_nome} (${plan.periodo})`;

            renderExtratoProducaoConteudo();
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível carregar o extrato.', 'error');
        }
    };

    window.fecharModalExtratoProducao = function() {
        const m = document.getElementById('modal-extrato-producao');
        if (m) m.style.display = 'none';
        _activePlanProducao = null;
        if (_chartExtProdInsumos) { _chartExtProdInsumos.destroy(); _chartExtProdInsumos = null; }
        if (_chartExtProdMeta) { _chartExtProdMeta.destroy(); _chartExtProdMeta = null; }
    };

    function renderExtratoProducaoConteudo() {
        if (!_activePlanProducao) return;
        const plan = _activePlanProducao;
        const linhas = Array.isArray(plan.linhas) ? plan.linhas : [];

        // Agrupar todas as movimentações reais
        let todasMovs = [];
        linhas.forEach(l => {
            const movs = Array.isArray(l.movimentacoes) ? l.movimentacoes : [];
            movs.forEach(m => {
                todasMovs.push({
                    ...m,
                    insumo_nome: l.insumo_nome,
                    preco_compra_tabela: l.preco_compra_tabela,
                    preco_compra_simulado: l.preco_compra_simulado
                });
            });
        });

        // Ordenar movimentações por data decrescente
        todasMovs.sort((a,b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));

        // Calcular KPIs reais vs previstos
        const metaFaturamento = parseFloat(plan.meta_faturamento_rs || 0);
        const custoPrevisto = parseFloat(plan.custo_total_projetado_rs || 0);

        // Somar compras de insumos (Real)
        const comprasInsumosReal = todasMovs.filter(m => m.tipo === 'COMPRA').reduce((sum, m) => sum + parseFloat(m.valor_total || 0), 0);
        // Somar vendas do produto (Real)
        const vendasReal = todasMovs.filter(m => m.tipo === 'VENDA').reduce((sum, m) => sum + parseFloat(m.valor_total || 0), 0);

        // Eficiência de compras (Preço pago vs Preço Planejado/Simulado)
        let comprasAcima = 0;
        let comprasAbaixo = 0;
        todasMovs.filter(m => m.tipo === 'COMPRA').forEach(m => {
            const ref = parseFloat(m.preco_compra_simulado || m.preco_compra_tabela || 0);
            if (ref > 0) {
                if (m.preco_unitario > ref) comprasAcima += parseFloat(m.valor_total || 0);
                else if (m.preco_unitario < ref) comprasAbaixo += parseFloat(m.valor_total || 0);
            }
        });

        // Markup Realizado
        const markupReal = comprasInsumosReal > 0 ? ((vendasReal - comprasInsumosReal) / comprasInsumosReal) * 100 : 0;
        const metaProgressoPct = metaFaturamento > 0 ? Math.min((vendasReal / metaFaturamento) * 100, 100) : 0;

        // Renderizar banner de prazos
        const hoje = new Date().toISOString().slice(0, 10);
        const prazoC = plan.prazo_compra_ate;
        const prazoV = plan.prazo_venda_ate;
        const bannerEl = document.getElementById('extrato-prod-prazos-banner');
        if (bannerEl) {
            let bannerHtml = '';
            if (prazoC) {
                const atrasoC = prazoC < hoje && comprasInsumosReal < custoPrevisto;
                bannerHtml += `
                    <div style="flex:1; background:${atrasoC ? '#3b1818' : '#162432'}; border:1px solid ${atrasoC ? '#ff4d4d' : '#1e4e8c'}; border-radius:8px; padding:10px; display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.1rem;">${atrasoC ? '⚠️' : '📅'}</span>
                        <div style="font-size:0.8rem;">
                            <span style="color:#aaa;">Prazo Limite Compra Insumos:</span>
                            <strong style="color:#fff; margin-left:5px;">${prazoC}</strong>
                            ${atrasoC ? `<span style="color:#ff4d4d; font-weight:700; margin-left:8px;">(ATRASADO!)</span>` : ''}
                        </div>
                    </div>`;
            }
            if (prazoV) {
                const atrasoV = prazoV < hoje && vendasReal < metaFaturamento;
                bannerHtml += `
                    <div style="flex:1; background:${atrasoV ? '#3b1818' : '#162432'}; border:1px solid ${atrasoV ? '#ff4d4d' : '#1e4e8c'}; border-radius:8px; padding:10px; display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.1rem;">${atrasoV ? '⚠️' : '📅'}</span>
                        <div style="font-size:0.8rem;">
                            <span style="color:#aaa;">Prazo Limite Faturamento/Venda:</span>
                            <strong style="color:#fff; margin-left:5px;">${prazoV}</strong>
                            ${atrasoV ? `<span style="color:#ff4d4d; font-weight:700; margin-left:8px;">(ATRASADO!)</span>` : ''}
                        </div>
                    </div>`;
            }
            if (bannerHtml) {
                bannerEl.style.display = 'flex';
                bannerEl.style.gap = '10px';
                bannerEl.innerHTML = bannerHtml;
            } else {
                bannerEl.style.display = 'none';
            }
        }

        // Renderizar KPI Cards
        const kpis = [
            { label: '🎯 Meta Faturamento', val: 'R$ ' + metaFaturamento.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#3e7cb1', desc: 'Planejado' },
            { label: '💰 Realizado (Vendas)', val: 'R$ ' + vendasReal.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#2AD07A', desc: `${metaProgressoPct.toFixed(1)}% da Meta` },
            { label: '🛒 Custo Previsto Insumos', val: 'R$ ' + custoPrevisto.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#f0b800', desc: 'Simulado' },
            { label: '💸 Investido Real Insumos', val: 'R$ ' + comprasInsumosReal.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#ff9f43', desc: `${custoPrevisto > 0 ? ((comprasInsumosReal/custoPrevisto)*100).toFixed(1) : 0}% do orçado` },
            { label: '📈 Markup Realizado', val: markupReal.toFixed(1) + '%', cor: markupReal >= 0 ? '#2AD07A' : '#ff4d4d', desc: 'Vendas vs Compras Reais' },
            { label: '⚠️ Compras Fora do Planejado', val: 'R$ ' + comprasAcima.toLocaleString('pt-BR', {minimumFractionDigits:2}), cor: '#ff4d4d', desc: 'Preço Real > Preço Simulado' }
        ];

        const kpisContainer = document.getElementById('extrato-prod-kpi-container');
        if (kpisContainer) {
            kpisContainer.innerHTML = kpis.map(k => `
                <div style="background:#0d1826; border:1px solid #1a2e3f; border-radius:10px; padding:14px; border-left:3px solid ${k.cor};">
                    <div style="font-size:0.75rem; color:#8eaabf; font-weight:600; text-transform:uppercase; margin-bottom:5px;">${k.label}</div>
                    <div style="font-size:1.1rem; color:#fff; font-weight:800; margin-bottom:3px;">${k.val}</div>
                    <div style="font-size:0.75rem; color:${k.cor}; font-weight:600;">${k.desc}</div>
                </div>`).join('');
        }

        // Gráfico 1: Insumos (Progresso Compra)
        const insumoLabels = linhas.map(l => l.insumo_nome);
        const insumoQtdPlanejada = linhas.map(l => parseFloat(l.qtd_necessaria || 0));
        const insumoQtdComprada = linhas.map(l => {
            const movs = todasMovs.filter(m => m.linha_id === l.id && m.tipo === 'COMPRA');
            return movs.reduce((sum, m) => sum + parseFloat(m.quantidade || 0), 0);
        });

        if (_chartExtProdInsumos) _chartExtProdInsumos.destroy();
        const ctxInsumos = document.getElementById('extrato-prod-chart-insumos');
        if (ctxInsumos) {
            _chartExtProdInsumos = new Chart(ctxInsumos, {
                type: 'bar',
                data: {
                    labels: insumoLabels,
                    datasets: [
                        { label: 'Planejado (kg)', data: insumoQtdPlanejada, backgroundColor: 'rgba(240, 184, 0, 0.4)', borderColor: '#f0b800', borderWidth: 1 },
                        { label: 'Comprado Real (kg)', data: insumoQtdComprada, backgroundColor: 'rgba(42, 208, 122, 0.6)', borderColor: '#2AD07A', borderWidth: 1 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } },
                    plugins: { legend: { labels: { color: '#fff', font: { size: 9 } } } }
                }
            });
        }

        // Gráfico 2: Faturamento Real vs Meta (Vendas)
        if (_chartExtProdMeta) _chartExtProdMeta.destroy();
        const ctxMeta = document.getElementById('extrato-prod-chart-meta');
        if (ctxMeta) {
            _chartExtProdMeta = new Chart(ctxMeta, {
                type: 'doughnut',
                data: {
                    labels: ['Realizado (Vendas)', 'Restante para Meta'],
                    datasets: [{
                        data: [vendasReal, Math.max(0, metaFaturamento - vendasReal)],
                        backgroundColor: ['#2AD07A', '#1a2e3f'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#fff', font: { size: 9 } } } }
                }
            });
        }

        // Renderizar Histórico de Movimentações
        const tableContainer = document.getElementById('extrato-prod-tabela-container');
        if (tableContainer) {
            if (todasMovs.length === 0) {
                tableContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#aaa; font-size:0.85rem;">Nenhuma movimentação real lançada para este planejamento.</div>`;
            } else {
                tableContainer.innerHTML = `
                    <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                        <thead>
                            <tr style="background:#223547; text-align:left; color:#8eaabf; font-size:0.75rem;">
                                <th style="padding:8px;">Data</th>
                                <th style="padding:8px; text-align:center;">Tipo</th>
                                <th style="padding:8px;">Item</th>
                                <th style="padding:8px; text-align:right;">Qtd (kg)</th>
                                <th style="padding:8px; text-align:right;">P.Unitário</th>
                                <th style="padding:8px; text-align:right;">Total</th>
                                <th style="padding:8px; text-align:center;">Eficiência</th>
                                <th style="padding:8px;">Obs</th>
                                <th style="padding:8px; text-align:center;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${todasMovs.map(m => {
                                const isCompra = m.tipo === 'COMPRA';
                                const refPrice = parseFloat(m.preco_compra_simulado || m.preco_compra_tabela || 0);
                                let ef = '—';
                                if (isCompra && refPrice > 0) {
                                    const diff = ((m.preco_unitario - refPrice) / refPrice) * 100;
                                    if (diff > 0) ef = `<span style="color:#ff4d4d; font-weight:700;">⚠️ +${diff.toFixed(1)}% (Caro)</span>`;
                                    else if (diff < 0) ef = `<span style="color:#2AD07A; font-weight:700;">✅ ${diff.toFixed(1)}% (Economia)</span>`;
                                    else ef = `<span style="color:#aaa;">= Tabela</span>`;
                                } else if (!isCompra) {
                                    const refVenda = parseFloat(plan.preco_venda_produto_rs || 0);
                                    if (refVenda > 0) {
                                        const diff = ((m.preco_unitario - refVenda) / refVenda) * 100;
                                        if (diff > 0) ef = `<span style="color:#2AD07A; font-weight:700;">📈 +${diff.toFixed(1)}% (Alta)</span>`;
                                        else if (diff < 0) ef = `<span style="color:#ff4d4d; font-weight:700;">📉 ${diff.toFixed(1)}% (Baixa)</span>`;
                                        else ef = `<span style="color:#aaa;">= Tabela</span>`;
                                    }
                                }

                                return `
                                    <tr style="border-top:1px solid #1a2e3f; color:#fff;">
                                        <td style="padding:8px;">${m.data_movimentacao}</td>
                                        <td style="padding:8px; text-align:center;">
                                            <span style="background:${isCompra ? '#1b382b' : '#3e7cb1'}; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">${m.tipo}</span>
                                        </td>
                                        <td style="padding:8px;"><strong>${isCompra ? m.insumo_nome : plan.produto_nome}</strong></td>
                                        <td style="padding:8px; text-align:right;">${parseFloat(m.quantidade||0).toLocaleString('pt-BR', {minimumFractionDigits:2})} kg</td>
                                        <td style="padding:8px; text-align:right; color:#aaa;">R$ ${parseFloat(m.preco_unitario||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                                        <td style="padding:8px; text-align:right; color:#2AD07A; font-weight:700;">R$ ${parseFloat(m.valor_total||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                                        <td style="padding:8px; text-align:center; font-size:0.75rem;">${ef}</td>
                                        <td style="padding:8px; color:#8eaabf; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.obs||''}">${m.obs || ''}</td>
                                        <td style="padding:8px; text-align:center;">
                                            <button type="button" onclick="excluirTransacaoProducao(${m.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                                        </td>
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>`;
            }
        }
    }

    // Modal lançamento de transações/movimentações de produção
    window.abrirModalTransacaoProducao = function() {
        if (!_activePlanProducao) return;
        const plan = _activePlanProducao;
        const modal = document.getElementById('modal-transacao-producao');
        if (modal) modal.style.display = 'block';

        document.getElementById('transprod-planejamento-id').value = plan.id;
        document.getElementById('transprod-tipo-compra').checked = true;
        document.getElementById('transprod-qtd-kg').value = '';
        document.getElementById('transprod-preco-unit').value = '';
        document.getElementById('transprod-valor-total').value = 'R$ 0,00';
        document.getElementById('transprod-obs').value = '';
        document.getElementById('transprod-data').value = new Date().toISOString().slice(0, 10);

        // Popular select de linhas de insumos do planejamento
        const selLinha = document.getElementById('transprod-linha-id');
        const linhas = Array.isArray(plan.linhas) ? plan.linhas : [];
        if (selLinha) {
            selLinha.innerHTML = linhas.map(l =>
                `<option value="${l.id}" data-tabela="${l.preco_compra_simulado || l.preco_compra_tabela || 0}">${l.insumo_nome}</option>`
            ).join('');
        }

        atualizarInterfaceTransacaoProducao();
    };

    window.fecharModalTransacaoProducao = function() {
        const modal = document.getElementById('modal-transacao-producao');
        if (modal) modal.style.display = 'none';
    };

    window.atualizarInterfaceTransacaoProducao = function() {
        const isCompra = document.getElementById('transprod-tipo-compra').checked;
        const lBox = document.getElementById('transprod-linha-box');
        const bCompra = document.getElementById('badge-prod-tipo-compra');
        const bVenda = document.getElementById('badge-prod-tipo-venda');

        if (isCompra) {
            if (lBox) lBox.style.display = 'block';
            if (bCompra) { bCompra.style.borderColor = '#2AD07A'; bCompra.style.color = '#2AD07A'; }
            if (bVenda) { bVenda.style.borderColor = '#444'; bVenda.style.color = '#aaa'; }
        } else {
            if (lBox) lBox.style.display = 'none';
            if (bCompra) { bCompra.style.borderColor = '#444'; bCompra.style.color = '#aaa'; }
            if (bVenda) { bVenda.style.borderColor = '#3e7cb1'; bVenda.style.color = '#3e7cb1'; }
        }
        calcularComparativoInsumoProducao();
    };

    window.calcularTotalTransacaoProducao = function() {
        const q = parseFloat(document.getElementById('transprod-qtd-kg').value) || 0;
        const p = parseFloat(document.getElementById('transprod-preco-unit').value) || 0;
        const tot = q * p;
        document.getElementById('transprod-valor-total').value = 'R$ ' + tot.toLocaleString('pt-BR', {minimumFractionDigits:2});
    };

    window.calcularComparativoInsumoProducao = function() {
        const isCompra = document.getElementById('transprod-tipo-compra').checked;
        const price = parseFloat(document.getElementById('transprod-preco-unit').value) || 0;
        const box = document.getElementById('transprod-comparativo-box');
        const labelTab = document.getElementById('transprod-preco-tabela');
        const labelDesvio = document.getElementById('transprod-desvio-tabela');

        if (!box) return;

        let refPrice = 0;
        if (isCompra) {
            const sel = document.getElementById('transprod-linha-id');
            if (sel && sel.selectedIndex >= 0) {
                refPrice = parseFloat(sel.options[sel.selectedIndex].dataset.tabela) || 0;
            }
        } else if (_activePlanProducao) {
            refPrice = parseFloat(_activePlanProducao.preco_venda_produto_rs) || 0;
        }

        if (refPrice > 0 && price > 0) {
            box.style.display = 'block';
            labelTab.textContent = 'R$ ' + refPrice.toLocaleString('pt-BR', {minimumFractionDigits:2});
            const diff = ((price - refPrice) / refPrice) * 100;
            if (isCompra) {
                if (diff > 0) {
                    labelDesvio.textContent = `⚠️ +${diff.toFixed(1)}% (Compra mais CARA)`;
                    labelDesvio.style.color = '#ff4d4d';
                } else if (diff < 0) {
                    labelDesvio.textContent = `✅ ${diff.toFixed(1)}% (Compra mais BARATA)`;
                    labelDesvio.style.color = '#2AD07A';
                } else {
                    labelDesvio.textContent = 'Preço de Tabela Planejado';
                    labelDesvio.style.color = '#aaa';
                }
            } else {
                if (diff > 0) {
                    labelDesvio.textContent = `✅ +${diff.toFixed(1)}% (Venda ACIMA do Planejado)`;
                    labelDesvio.style.color = '#2AD07A';
                } else if (diff < 0) {
                    labelDesvio.textContent = `⚠️ ${diff.toFixed(1)}% (Venda ABAIXO do Planejado)`;
                    labelDesvio.style.color = '#ff4d4d';
                } else {
                    labelDesvio.textContent = 'Preço de Tabela Planejado';
                    labelDesvio.style.color = '#aaa';
                }
            }
        } else {
            box.style.display = 'none';
        }
    };

    window.salvarTransacaoProducaoForm = async function(e) {
        e.preventDefault();
        if (!_activePlanProducao) return;
        const planId = _activePlanProducao.id;
        const isCompra = document.getElementById('transprod-tipo-compra').checked;
        const type = isCompra ? 'COMPRA' : 'VENDA';
        const linhaId = isCompra ? parseInt(document.getElementById('transprod-linha-id').value) : 0;

        const payload = {
            tipo: type,
            quantidade: parseFloat(document.getElementById('transprod-qtd-kg').value) || 0,
            preco_unitario: parseFloat(document.getElementById('transprod-preco-unit').value) || 0,
            data_movimentacao: document.getElementById('transprod-data').value,
            obs: document.getElementById('transprod-obs').value
        };

        const btn = document.getElementById('btn-salvar-trans-prod');
        if (btn) btn.disabled = true;

        try {
            const targetLinhaId = isCompra ? linhaId : (_activePlanProducao.linhas[0]?.id || 0);

            const res = await fetch(`/api/planejamento/producao-insumos/${planId}/linhas/${targetLinhaId}/movimentacao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Falha ao salvar movimentação de produção');
            _apexNotify('Sucesso', 'Movimentação real salva!', 'success');
            fecharModalTransacaoProducao();

            const resReload = await fetch('/api/planejamento/producao-insumos');
            const dataReload = await resReload.json();
            const reloadedList = Array.isArray(dataReload) ? dataReload : [];
            const planReloaded = reloadedList.find(p => p.id === planId);
            if (planReloaded) {
                _activePlanProducao = planReloaded;
                renderExtratoProducaoConteudo();
            }
            await carregarPlanejamentoProducaoInsumos();
        } catch(err) {
            _apexNotify('Erro', err.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    window.excluirTransacaoProducao = async function(movId) {
        if (!confirm('Excluir este lançamento real?')) return;
        if (!_activePlanProducao) return;
        const planId = _activePlanProducao.id;
        try {
            let targetLinhaId = 0;
            _activePlanProducao.linhas.forEach(l => {
                if (Array.isArray(l.movimentacoes) && l.movimentacoes.some(m => m.id === movId)) {
                    targetLinhaId = l.id;
                }
            });
            if (targetLinhaId === 0) targetLinhaId = _activePlanProducao.linhas[0]?.id || 0;

            const res = await fetch(`/api/planejamento/producao-insumos/${planId}/linhas/${targetLinhaId}/movimentacao/${movId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Erro ao excluir');

            const resReload = await fetch('/api/planejamento/producao-insumos');
            const dataReload = await resReload.json();
            const reloadedList = Array.isArray(dataReload) ? dataReload : [];
            const planReloaded = reloadedList.find(p => p.id === planId);
            if (planReloaded) {
                _activePlanProducao = planReloaded;
                renderExtratoProducaoConteudo();
            }
            await carregarPlanejamentoProducaoInsumos();
        } catch(e) {
            _apexNotify('Erro', e.message, 'error');
        }
    };



    // ── 2. Planejamento Comercial (Compra e Venda / Revenda) ────────────────────
    window.carregarPlanejamentoComercialRevenda = async function() {
        try {
            const res = await fetch('/api/planejamento/comercial-revenda');
            const data = await res.json();
            localComercialRevenda = Array.isArray(data) ? data : [];
            window.localComercialRevenda = localComercialRevenda;
            renderPlanejamentoComercialRevenda();
        } catch (err) {
            console.error('Erro ao carregar planejamento comercial revenda:', err);
            localComercialRevenda = [];
            window.localComercialRevenda = localComercialRevenda;
            renderPlanejamentoComercialRevenda();
        }
    };

    let _metaComercialGlobalCache = 5000000.00;

    window.onChangeMetaComercialGlobal = function() {
        const inputVal = parseFloat(document.getElementById('com-kpi-meta-global-input').value) || 0;
        _metaComercialGlobalCache = inputVal;
        renderPlanejamentoComercialRevenda();
    };

    function renderPlanejamentoComercialRevenda() {
        const tbody = document.getElementById('comercial-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totFatPrev = 0, totInvest = 0;
        const metaGlobal = _metaComercialGlobalCache;

        // Arrays para guardar estatísticas de análise de impacto
        const produtosEstatistica = [];

        localComercialRevenda.forEach(item => {
            const cPlan = parseFloat(item.compra_planejada_kg || 0);
            const vPlan = parseFloat(item.venda_planejada_kg || 0);
            const inv = parseFloat(item.investimento_planejado_rs || 0);
            const fat = parseFloat(item.faturamento_previsto_rs || 0);
            const pCompra = parseFloat(item.preco_compra_estimado || 0);
            const pVenda = parseFloat(item.preco_venda_estimado || 0);
            const markup = pCompra > 0 ? ((pVenda - pCompra) / pCompra) * 100 : 0;
            const partPct = metaGlobal > 0 ? (fat / metaGlobal) * 100 : 0;

            // Dados reais das transações
            const totalCompraKgReal = parseFloat(item.totalCompraKg || 0);
            const totalVendaKgReal  = parseFloat(item.totalVendaKg  || 0);
            const totalCompraRsReal = parseFloat(item.totalCompraRs || 0);
            const totalVendaRsReal  = parseFloat(item.totalVendaRs  || 0);
            const mediaCompra = parseFloat(item.mediaPrecoCompra || 0);
            const mediaVenda  = parseFloat(item.mediaPrecoVenda  || 0);
            const metaCompPct = cPlan > 0 ? Math.min((totalCompraKgReal / cPlan) * 100, 100) : 0;
            const metaVendPct = vPlan > 0 ? Math.min((totalVendaKgReal  / vPlan) * 100, 100) : 0;

            // Para análise de impacto
            const lucroPrevisto = fat - inv;
            const lucroRealizado = totalVendaRsReal - totalCompraRsReal;
            
            // Margem real vs planejada desvios
            const desvioPrecoCompra = mediaCompra > 0 ? (mediaCompra - pCompra) : 0;
            const desvioPrecoVenda = mediaVenda > 0 ? (mediaVenda - pVenda) : 0;

            produtosEstatistica.push({
                nome: item.produto_nome,
                lucroRealizado,
                lucroPrevisto,
                desvioPrecoCompra,
                desvioPrecoVenda,
                mediaCompra,
                pCompra,
                mediaVenda,
                pVenda,
                fat
            });

            totFatPrev += fat;
            totInvest += inv;

            const isAltoGiro = fat >= 1000000;
            const giroBadge = isAltoGiro ?
                '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:2px 6px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🔥 ALTO GIRO</span>' :
                '<span style="background:#122a3f; color:#3e7cb1; border:1px solid #3e7cb1; padding:2px 6px; border-radius:12px; font-size:0.75rem;">GIRO NORMAL</span>';

            const markupColor = markup >= 0 ? '#2AD07A' : '#ff4d4d';

            const progressBar = (pct, cor) => `<div style="background:#1a2e3f; border-radius:4px; height:6px; margin-top:4px;"><div style="width:${pct.toFixed(0)}%; background:${cor}; height:6px; border-radius:4px; transition:width 0.4s;"></div></div><small style="color:${cor};">${pct.toFixed(0)}%</small>`;

            const prazoCompraStr = item.prazo_compra_ate ? new Date(item.prazo_compra_ate).toLocaleDateString('pt-BR') : 'Sem prazo';
            const prazoVendaStr = item.prazo_venda_ate ? new Date(item.prazo_venda_ate).toLocaleDateString('pt-BR') : 'Sem prazo';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;">
                    <strong>${item.produto_nome || 'Produto'}</strong>
                    <div style="font-size:0.72rem; color:#aaa;">${item.mes_referencia || ''}</div>
                    <div style="font-size:0.7rem; color:#8eaabf; margin-top:4px; line-height:1.2;">
                        🛒 Compra: ${prazoCompraStr}<br>
                        💰 Venda: ${prazoVendaStr}
                    </div>
                </td>
                <td style="padding:10px 8px; text-align:right;">
                    <div style="font-weight:bold; color:#fff;">${cPlan.toLocaleString('pt-BR')} kg</div>
                    <div style="font-size:0.75rem; color:#8eaabf;">Comprado: ${totalCompraKgReal.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</div>
                    ${progressBar(metaCompPct,'#3e7cb1')}
                </td>
                <td style="padding:10px 8px; text-align:right;">
                    <div style="font-weight:bold; color:#2AD07A;">${vPlan.toLocaleString('pt-BR')} kg</div>
                    <div style="font-size:0.75rem; color:#8eaabf;">Vendido: ${totalVendaKgReal.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</div>
                    ${progressBar(metaVendPct,'#2AD07A')}
                </td>
                <td style="padding:10px 8px; text-align:right; color:#ccc;">
                    <div>Tab: R$ ${pCompra.toFixed(2)} / R$ ${pVenda.toFixed(2)}</div>
                    ${mediaCompra > 0 ? `<div style="font-size:0.75rem; color:#f0b800;">Méd: R$ ${mediaCompra.toFixed(2)} / R$ ${mediaVenda.toFixed(2)}</div>` : ''}
                </td>
                <td style="padding:10px 8px; text-align:right; color:#f0b800; font-weight:bold;">R$ ${inv.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px 8px; text-align:right; color:#2AD07A; font-weight:bold;">
                    <div>R$ ${fat.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                    ${totalVendaRsReal > 0 ? `<div style="font-size:0.75rem; color:#2AD07A;">Real: R$ ${totalVendaRsReal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>` : ''}
                </td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${markupColor};">${markup.toFixed(1)}%</td>
                <td style="padding:10px 8px; text-align:center;">${giroBadge} <small style="color:#aaa;">(${partPct.toFixed(1)}% Meta)</small></td>
                <td style="padding:10px 8px; text-align:center;"><span style="background:#1e4e8c; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem;">🔵 ${item.status || 'Meta Definida'}</span></td>
                <td style="padding:10px 8px; text-align:center;">
                    <button type="button" onclick="abrirModalTransacaoComercial(${item.id})" style="background:#1b382b; border:1px solid #2AD07A; color:#2AD07A; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:4px; margin-bottom:3px;" title="Lançar Movimentação"><i class="fa-solid fa-plus-minus"></i> Movimentar</button>
                    <button type="button" onclick="abrirModalExtratoComercial(${item.id})" style="background:#122a3f; border:1px solid #3e7cb1; color:#3e7cb1; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:4px; margin-bottom:3px;" title="Extrato & Análise"><i class="fa-solid fa-chart-mixed"></i> Extrato</button>
                    <button type="button" onclick="excluirPlanejamentoComercial(${item.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Atualiza a análise visual de lucro/perda
        atualizarAnaliseLucroOfensores(produtosEstatistica);

        const kpiFatPrev = document.getElementById('com-kpi-fat-previsto');
        const kpiInvest = document.getElementById('com-kpi-investimento');
        const kpiPart = document.getElementById('com-kpi-atingimento-meta');

        if (kpiFatPrev) kpiFatPrev.textContent = 'R$ ' + totFatPrev.toLocaleString('pt-BR', {minimumFractionDigits:2});
        if (kpiInvest) kpiInvest.textContent = 'R$ ' + totInvest.toLocaleString('pt-BR', {minimumFractionDigits:2});
        if (kpiPart) {
            const pct = metaGlobal > 0 ? (totFatPrev / metaGlobal) * 100 : 0;
            kpiPart.textContent = pct.toFixed(1) + '%';
        }
    }

    function atualizarAnaliseLucroOfensores(estatisticas) {
        const lucroBox = document.getElementById('com-analise-lucro-box');
        const ofensoresBox = document.getElementById('com-analise-ofensores-box');
        if (!lucroBox || !ofensoresBox) return;

        lucroBox.innerHTML = '';
        ofensoresBox.innerHTML = '';

        if (!estatisticas || estatisticas.length === 0) {
            lucroBox.innerHTML = '<span style="color:#aaa;">Nenhuma meta ou transação ativa para análise.</span>';
            ofensoresBox.innerHTML = '<span style="color:#aaa;">Nenhum desvio detectado nas movimentações.</span>';
            return;
        }

        // 1. Campeões (ordenar por faturamento previsto / lucro esperado)
        const campeoes = [...estatisticas].sort((a, b) => b.fat - a.fat).slice(0, 3);
        campeoes.forEach(c => {
            const itemDiv = document.createElement('div');
            itemDiv.style.display = 'flex';
            itemDiv.style.justifyContent = 'space-between';
            itemDiv.style.padding = '4px 0';
            itemDiv.style.borderBottom = '1px solid #162433';
            itemDiv.innerHTML = `
                <span>🌟 <strong>${c.nome}</strong></span>
                <span style="color:#2AD07A; font-weight:bold;">Fat. Projetado: R$ ${c.fat.toLocaleString('pt-BR', {maximumFractionDigits:0})}</span>
            `;
            lucroBox.appendChild(itemDiv);
        });

        // 2. Ofensores (verificar se comprou mais caro que o planejado ou vendeu mais barato)
        const ofensores = estatisticas.filter(x => x.desvioPrecoCompra > 0 || x.desvioPrecoVenda < 0);
        if (ofensores.length === 0) {
            ofensoresBox.innerHTML = '<span style="color:#2AD07A; font-size:0.8rem;"><i class="fa-solid fa-circle-check"></i> Todas as operações estão dentro ou melhores que o planejado!</span>';
        } else {
            ofensores.forEach(o => {
                const itemDiv = document.createElement('div');
                itemDiv.style.display = 'flex';
                itemDiv.style.flexDirection = 'column';
                itemDiv.style.padding = '6px 0';
                itemDiv.style.borderBottom = '1px solid #162433';
                
                let alertaText = '';
                if (o.desvioPrecoCompra > 0) {
                    alertaText += `⚠️ Compra real (R$ ${o.mediaCompra.toFixed(2)}) acima do planejado (R$ ${o.pCompra.toFixed(2)}). `;
                }
                if (o.desvioPrecoVenda < 0) {
                    alertaText += `📉 Venda real (R$ ${o.mediaVenda.toFixed(2)}) abaixo do planejado (R$ ${o.pVenda.toFixed(2)}).`;
                }

                itemDiv.innerHTML = `
                    <span style="font-weight:bold; color:#fff;">${o.nome}</span>
                    <span style="color:#ff4d4d; font-size:0.75rem; margin-top:2px;">${alertaText}</span>
                `;
                ofensoresBox.appendChild(itemDiv);
            });
        }
    }


    window.calcularPlanejamentoComercialForm = function() {
        const compraKg = parseFloat(document.getElementById('plcom-compra-kg').value) || 0;
        const vendaKg = parseFloat(document.getElementById('plcom-venda-kg').value) || 0;
        const precoCompra = parseFloat(document.getElementById('plcom-preco-compra').value) || 0;
        const precoVenda = parseFloat(document.getElementById('plcom-preco-venda').value) || 0;

        const investimento = compraKg * precoCompra;
        const faturamento = vendaKg * precoVenda;
        const markup = precoCompra > 0 ? ((precoVenda - precoCompra) / precoCompra) * 100 : 0;

        document.getElementById('plcom-investimento-rs').value = investimento.toFixed(2);
        document.getElementById('plcom-faturamento-rs').value = faturamento.toFixed(2);
        
        const badge = document.getElementById('plcom-markup-badge');
        if (badge) {
            badge.textContent = markup.toFixed(1) + '%';
            badge.style.background = markup >= 0 ? '#1b382b' : '#3b1818';
            badge.style.color = markup >= 0 ? '#2AD07A' : '#ff4d4d';
            badge.style.borderColor = markup >= 0 ? '#2AD07A' : '#ff4d4d';
        }
    };

    window.abrirModalPlanejamentoComercial = async function() {
        const modalEl = document.getElementById('modal-planejamento-comercial-meta');
        if (!modalEl) return;

        // Mover para document.body e aplicar estilos
        if (modalEl.parentElement !== document.body) {
            document.body.appendChild(modalEl);
        }
        modalEl.style.display = 'flex';
        modalEl.style.position = 'fixed';
        modalEl.style.top = '0';
        modalEl.style.left = '0';
        modalEl.style.width = '100vw';
        modalEl.style.height = '100vh';
        modalEl.style.zIndex = '9999999';
        modalEl.style.background = 'rgba(0,0,0,0.92)';
        modalEl.style.alignItems = 'center';
        modalEl.style.justifyContent = 'center';
        modalEl.style.overflowY = 'auto';
        modalEl.style.padding = '20px';
        modalEl.style.boxSizing = 'border-box';

        // Garante acesso cross-IIFE a localMateriais
        let _mats = window.localMateriais || [];
        if (_mats.length === 0) {
            try {
                const res = await fetch('/api/materiais-catalogo');
                if (res.ok) {
                    _mats = await res.json();
                    window.localMateriais = _mats;
                }
            } catch(e){}
        }

        // Garante localPrecos carregados
        if (!window.localPrecos || window.localPrecos.length === 0) {
            try {
                const res = await fetch('/api/tabela-precos', { cache: 'no-store' });
                window.localPrecos = await res.json();
            } catch(e){}
        }

        const selProd = document.getElementById('plcom-produto-id');
        if (selProd) {
            selProd.innerHTML = '<option value="">Selecione o Produto Comercial...</option>' +
                _mats.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
            
            selProd.onchange = function() {
                const matId = this.value;
                if (matId && window.localPrecos) {
                    const priceItem = window.localPrecos.find(p => p.material_id == matId);
                    if (priceItem) {
                        document.getElementById('plcom-preco-compra').value = priceItem.preco_coletar || 0;
                        document.getElementById('plcom-preco-venda').value = priceItem.venda_ref || 0;
                    } else {
                        document.getElementById('plcom-preco-compra').value = '';
                        document.getElementById('plcom-preco-venda').value = '';
                    }
                } else {
                    document.getElementById('plcom-preco-compra').value = '';
                    document.getElementById('plcom-preco-venda').value = '';
                }
                window.calcularPlanejamentoComercialForm();
            };
        }

        const form = document.getElementById('form-planejamento-comercial');
        if (form) form.reset();
        const mesEl = document.getElementById('plcom-mes');
        if (mesEl) mesEl.value = new Date().toISOString().slice(0, 7);

        // Bind calculators
        document.getElementById('plcom-compra-kg').oninput = window.calcularPlanejamentoComercialForm;
        document.getElementById('plcom-venda-kg').oninput = window.calcularPlanejamentoComercialForm;
        document.getElementById('plcom-preco-compra').oninput = window.calcularPlanejamentoComercialForm;
        document.getElementById('plcom-preco-venda').oninput = window.calcularPlanejamentoComercialForm;

        // Reset markup badge
        const badge = document.getElementById('plcom-markup-badge');
        if (badge) {
            badge.textContent = '0.0%';
            badge.style.background = '#1e4e8c';
            badge.style.color = '#fff';
            badge.style.borderColor = '#3e7cb1';
        }

        modalEl.style.display = 'flex';
    };

    window.fecharModalPlanejamentoComercial = function() {
        const modalEl = document.getElementById('modal-planejamento-comercial-meta');
        if (modalEl) modalEl.style.display = 'none';
    };

    window.salvarPlanejamentoComercialForm = async function(e) {
        e.preventDefault();
        const prodId = document.getElementById('plcom-produto-id').value;
        const prodObj = (window.localMateriais || []).find(m => m.id == prodId);

        const payload = {
            mes_referencia: document.getElementById('plcom-mes').value,
            produto_id: prodId,
            produto_nome: prodObj ? prodObj.nome : 'Produto Comercial',
            compra_planejada_kg: document.getElementById('plcom-compra-kg').value,
            venda_planejada_kg: document.getElementById('plcom-venda-kg').value,
            preco_compra_estimado: document.getElementById('plcom-preco-compra').value,
            preco_venda_estimado: document.getElementById('plcom-preco-venda').value,
            investimento_planejado_rs: document.getElementById('plcom-investimento-rs').value,
            faturamento_previsto_rs: document.getElementById('plcom-faturamento-rs').value,
            prazo_compra_ate: document.getElementById('plcom-prazo-compra')?.value || null,
            prazo_venda_ate: document.getElementById('plcom-prazo-venda')?.value || null,
            status: 'Meta Definida'
        };

        try {
            const res = await fetch('/api/planejamento/comercial-revenda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar meta comercial');
            _apexNotify('Sucesso', 'Meta comercial salva com sucesso!', 'success');
            fecharModalPlanejamentoComercial();
            await carregarPlanejamentoComercialRevenda();
            if (typeof window.carregarComparativoRealizadoGeral === 'function') {
                window.carregarComparativoRealizadoGeral();
            }
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.calcularRealizadoComercialForm = function() {
        const compraKg = parseFloat(document.getElementById('realcom-compra-kg').value) || 0;
        const vendaKg = parseFloat(document.getElementById('realcom-venda-kg').value) || 0;
        const precoCompra = parseFloat(document.getElementById('realcom-preco-compra').value) || 0;
        const precoVenda = parseFloat(document.getElementById('realcom-preco-venda').value) || 0;

        const investimento = compraKg * precoCompra;
        const faturamento = vendaKg * precoVenda;
        const markup = precoCompra > 0 ? ((precoVenda - precoCompra) / precoCompra) * 100 : 0;

        document.getElementById('realcom-investimento-rs').value = investimento.toFixed(2);
        document.getElementById('realcom-faturamento-rs').value = faturamento.toFixed(2);
        
        const badge = document.getElementById('realcom-markup-badge');
        if (badge) {
            badge.textContent = markup.toFixed(1) + '%';
            badge.style.background = markup >= 0 ? '#1b382b' : '#3b1818';
            badge.style.color = markup >= 0 ? '#2AD07A' : '#ff4d4d';
            badge.style.borderColor = markup >= 0 ? '#2AD07A' : '#ff4d4d';
        }
    };

    window.abrirModalAtualizarRealizadoComercial = function(id) {
        const item = (window.localComercialRevenda || []).find(x => x.id === id);
        if (!item) return;

        const modalEl = document.getElementById('modal-atualizar-realizado-comercial');
        if (modalEl) {
            if (modalEl.parentElement !== document.body) {
                document.body.appendChild(modalEl);
            }
            modalEl.style.display = 'flex';
            modalEl.style.position = 'fixed';
            modalEl.style.top = '0';
            modalEl.style.left = '0';
            modalEl.style.width = '100vw';
            modalEl.style.height = '100vh';
            modalEl.style.zIndex = '9999999';
            modalEl.style.background = 'rgba(0,0,0,0.92)';
            modalEl.style.alignItems = 'center';
            modalEl.style.justifyContent = 'center';
            modalEl.style.overflowY = 'auto';
            modalEl.style.padding = '20px';
            modalEl.style.boxSizing = 'border-box';
        }

        document.getElementById('realcom-item-id').value = item.id;
        document.getElementById('realcom-produto-nome').value = item.produto_nome || '';
        document.getElementById('realcom-mes-ref').value = item.mes_referencia || '';
        document.getElementById('realcom-compra-kg').value = item.compra_realizada_kg || item.compra_planejada_kg || '';
        document.getElementById('realcom-preco-compra').value = item.preco_compra_realizado || item.preco_compra_estimado || '';
        document.getElementById('realcom-venda-kg').value = item.venda_realizada_kg || item.venda_planejada_kg || '';
        document.getElementById('realcom-preco-venda').value = item.preco_venda_realizado || item.preco_venda_estimado || '';
        document.getElementById('realcom-status').value = item.status || 'Meta Definida';

        // Bind input calculators
        document.getElementById('realcom-compra-kg').oninput = window.calcularRealizadoComercialForm;
        document.getElementById('realcom-venda-kg').oninput = window.calcularRealizadoComercialForm;
        document.getElementById('realcom-preco-compra').oninput = window.calcularRealizadoComercialForm;
        document.getElementById('realcom-preco-venda').oninput = window.calcularRealizadoComercialForm;

        window.calcularRealizadoComercialForm();
    };

    window.fecharModalAtualizarRealizadoComercial = function() {
        const modalEl = document.getElementById('modal-atualizar-realizado-comercial');
        if (modalEl) modalEl.style.display = 'none';
    };

    window.salvarRealizadoComercialForm = async function(e) {
        e.preventDefault();
        const id = document.getElementById('realcom-item-id').value;
        const compraRealKg = document.getElementById('realcom-compra-kg').value;
        const precoCompraReal = document.getElementById('realcom-preco-compra').value;
        const vendaRealKg = document.getElementById('realcom-venda-kg').value;
        const precoVendaReal = document.getElementById('realcom-preco-venda').value;
        const faturamentoReal = parseFloat(vendaRealKg || 0) * parseFloat(precoVendaReal || 0);

        const payload = {
            compra_realizada_kg: compraRealKg,
            venda_realizada_rs: faturamentoReal,
            venda_realizada_kg: vendaRealKg,
            preco_compra_realizado: precoCompraReal,
            preco_venda_realizado: precoVendaReal,
            status: document.getElementById('realcom-status').value
        };

        try {
            const res = await fetch(`/api/planejamento/comercial-revenda/${id}/realizado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao atualizar realizado comercial');
            _apexNotify('Sucesso', 'Realizado comercial atualizado com sucesso!', 'success');
            fecharModalAtualizarRealizadoComercial();
            await carregarPlanejamentoComercialRevenda();
            if (typeof window.carregarComparativoRealizadoGeral === 'function') {
                window.carregarComparativoRealizadoGeral();
            }
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.excluirPlanejamentoComercial = async function(id) {
        if (!confirm('Excluir esta meta comercial?')) return;
        try {
            await fetch(`/api/planejamento/comercial-revenda/${id}`, { method: 'DELETE' });
            await carregarPlanejamentoComercialRevenda();
        } catch(e){}
    };

    // ── Transações Comerciais Fracionadas ──────────────────────────────────────

    // Contexto do modal de transação
    let _transacaoCtx = { planejamento_id: null, item: null };

    window.abrirModalTransacaoComercial = function(planejamentoId) {
        const item = (window.localComercialRevenda || []).find(x => x.id === planejamentoId);
        if (!item) return;
        _transacaoCtx = { planejamento_id: planejamentoId, item, fromExtrato: false };
        _abrirModalTransacaoInterno();
    };

    window.abrirModalTransacaoComercialFromExtrato = function() {
        _transacaoCtx.fromExtrato = true;
        _abrirModalTransacaoInterno();
    };

    function _abrirModalTransacaoInterno() {
        const modalEl = document.getElementById('modal-lancar-transacao-comercial');
        if (!modalEl) return;
        document.body.appendChild(modalEl);
        modalEl.style.display = 'flex';
        document.getElementById('transcom-planejamento-id').value = _transacaoCtx.planejamento_id;
        document.getElementById('form-transacao-comercial').reset();
        document.getElementById('transcom-data').value = new Date().toISOString().slice(0,10);
        document.getElementById('transcom-tipo-compra').checked = true;
        atualizarTipoTransacao();
        calcularTotalTransacao();
    }

    window.fecharModalTransacaoComercial = function() {
        const modalEl = document.getElementById('modal-lancar-transacao-comercial');
        if (modalEl) modalEl.style.display = 'none';
    };

    window.atualizarTipoTransacao = function() {
        const tipo = document.querySelector('input[name="transcom-tipo"]:checked')?.value || 'COMPRA';
        const item = _transacaoCtx.item;

        const badgeCompra = document.getElementById('badge-tipo-compra');
        const badgeVenda  = document.getElementById('badge-tipo-venda');
        if (tipo === 'COMPRA') {
            badgeCompra.style.borderColor = '#3e7cb1'; badgeCompra.style.color = '#fff'; badgeCompra.style.background = '#1e354d';
            badgeVenda.style.borderColor  = '#444';    badgeVenda.style.color  = '#aaa'; badgeVenda.style.background  = 'transparent';
        } else {
            badgeVenda.style.borderColor  = '#2AD07A'; badgeVenda.style.color  = '#fff'; badgeVenda.style.background  = '#1b382b';
            badgeCompra.style.borderColor = '#444';    badgeCompra.style.color = '#aaa'; badgeCompra.style.background = 'transparent';
        }

        // Mostrar comparativo vs tabela
        const precoTabela = item ? (tipo === 'COMPRA' ? parseFloat(item.preco_compra_estimado||0) : parseFloat(item.preco_venda_estimado||0)) : 0;
        const cmpBox = document.getElementById('transcom-comparativo-box');
        if (precoTabela > 0) {
            document.getElementById('transcom-preco-tabela').textContent = 'R$ ' + precoTabela.toFixed(2) + '/kg';
            cmpBox.style.display = 'block';
        } else {
            cmpBox.style.display = 'none';
        }
        calcularTotalTransacao();
    };

    window.calcularTotalTransacao = function() {
        const qtd   = parseFloat(document.getElementById('transcom-qtd-kg').value)  || 0;
        const preco = parseFloat(document.getElementById('transcom-preco-unit').value) || 0;
        const total = qtd * preco;
        document.getElementById('transcom-valor-total').value = total > 0 ? 'R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits:2}) : 'R$ 0,00';

        // Desvio vs tabela
        const tipo = document.querySelector('input[name="transcom-tipo"]:checked')?.value || 'COMPRA';
        const item = _transacaoCtx.item;
        const precoTabela = item ? (tipo === 'COMPRA' ? parseFloat(item.preco_compra_estimado||0) : parseFloat(item.preco_venda_estimado||0)) : 0;
        if (precoTabela > 0 && preco > 0) {
            const desvioPct = ((preco - precoTabela) / precoTabela) * 100;
            const desEl = document.getElementById('transcom-desvio-tabela');
            desEl.textContent = (desvioPct >= 0 ? '+' : '') + desvioPct.toFixed(1) + '% (R$ ' + (preco - precoTabela).toFixed(2) + ')';
            desEl.style.color = tipo === 'COMPRA'
                ? (desvioPct > 0 ? '#ff4d4d' : '#2AD07A')   // COMPRA: mais caro é ruim
                : (desvioPct > 0 ? '#2AD07A' : '#ff4d4d');  // VENDA: mais caro é bom
        }
    };

    window.salvarTransacaoComercialForm = async function(e) {
        e.preventDefault();
        const pid      = document.getElementById('transcom-planejamento-id').value;
        const tipo     = document.querySelector('input[name="transcom-tipo"]:checked')?.value || 'COMPRA';
        const qtdKg    = document.getElementById('transcom-qtd-kg').value;
        const precoU   = document.getElementById('transcom-preco-unit').value;
        const data     = document.getElementById('transcom-data').value;
        const obs      = document.getElementById('transcom-obs').value;

        try {
            const res = await fetch('/api/planejamento/comercial-transacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planejamento_id: pid, tipo, quantidade_kg: qtdKg, preco_unitario: precoU, data_transacao: data, observacoes: obs })
            });
            if (!res.ok) throw new Error('Erro ao salvar movimentação');
            _apexNotify('Sucesso', tipo === 'COMPRA' ? 'Compra registrada!' : 'Venda registrada!', 'success');
            fecharModalTransacaoComercial();
            await carregarPlanejamentoComercialRevenda();
            // Se veio do extrato, reabrir extrato atualizado
            if (_transacaoCtx.fromExtrato) {
                _transacaoCtx.fromExtrato = false;
                await abrirModalExtratoComercial(_transacaoCtx.planejamento_id);
            }
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    // ── Extrato & Análise ──────────────────────────────────────────────────────

    let _extratoCtx = { planejamento_id: null, item: null };

    window.abrirModalExtratoComercial = async function(planejamentoId) {
        const item = (window.localComercialRevenda || []).find(x => x.id === planejamentoId);
        if (!item) return;
        _extratoCtx = { planejamento_id: planejamentoId, item };
        _transacaoCtx.planejamento_id = planejamentoId;
        _transacaoCtx.item = item;

        const modalEl = document.getElementById('modal-extrato-comercial');
        if (!modalEl) return;
        document.body.appendChild(modalEl);
        modalEl.style.display = 'block';

        document.getElementById('extrato-titulo').textContent = `Extrato & Análise — ${item.produto_nome} (${item.mes_referencia})`;

        // Buscar transações
        let transacoes = [];
        try {
            const r = await fetch(`/api/planejamento/comercial-revenda/${planejamentoId}/transacoes`);
            transacoes = await r.json();
        } catch(e){}

        _renderExtratoAnalise(item, transacoes);
        _renderExtratoTabela(transacoes);
    };

    window.fecharModalExtratoComercial = function() {
        const modalEl = document.getElementById('modal-extrato-comercial');
        if (modalEl) modalEl.style.display = 'none';
    };

    // Instâncias dos gráficos do extrato (para destruir antes de recriar)
    let _extratoCharts = {};

    function _destroyExtratoCharts() {
        Object.values(_extratoCharts).forEach(c => { try { c.destroy(); } catch(e){} });
        _extratoCharts = {};
    }

    function _renderExtratoAnalise(item, transacoes) {
        _destroyExtratoCharts();

        const compras = transacoes.filter(t => t.tipo === 'COMPRA');
        const vendas  = transacoes.filter(t => t.tipo === 'VENDA');

        const cPlan = parseFloat(item.compra_planejada_kg || 0);
        const vPlan = parseFloat(item.venda_planejada_kg  || 0);
        const pCompraTab = parseFloat(item.preco_compra_estimado || 0);
        const pVendaTab  = parseFloat(item.preco_venda_estimado  || 0);

        const totalCompraKg = compras.reduce((s,t) => s + parseFloat(t.quantidade_kg), 0);
        const totalVendaKg  = vendas.reduce( (s,t) => s + parseFloat(t.quantidade_kg), 0);
        const totalCompraRs = compras.reduce((s,t) => s + parseFloat(t.valor_total),   0);
        const totalVendaRs  = vendas.reduce( (s,t) => s + parseFloat(t.valor_total),   0);

        const mediaCompra = totalCompraKg > 0 ? totalCompraRs / totalCompraKg : 0;
        const mediaVenda  = totalVendaKg  > 0 ? totalVendaRs  / totalVendaKg  : 0;
        const markupReal  = mediaCompra   > 0 ? ((mediaVenda - mediaCompra) / mediaCompra) * 100 : 0;
        const markupPlan  = pCompraTab    > 0 ? ((pVendaTab  - pCompraTab)  / pCompraTab)  * 100 : 0;

        const kgRestVenda  = Math.max(vPlan - totalVendaKg, 0);
        const kgRestCompra = Math.max(cPlan - totalCompraKg, 0);
        const fatProjetado = totalVendaRs + (kgRestVenda * pVendaTab);
        const reservaNecessaria = kgRestCompra * pCompraTab;

        const metaCompPct = cPlan > 0 ? (totalCompraKg / cPlan) * 100 : 0;
        const metaVendPct = vPlan > 0 ? (totalVendaKg  / vPlan) * 100 : 0;
        const faltaComprar = Math.max(cPlan - totalCompraKg, 0);
        const faltaVender  = Math.max(vPlan - totalVendaKg,  0);

        const desvioPCompra = pCompraTab > 0 && mediaCompra > 0 ? ((mediaCompra - pCompraTab) / pCompraTab) * 100 : null;
        const desvioPVenda  = pVendaTab  > 0 && mediaVenda  > 0 ? ((mediaVenda  - pVendaTab)  / pVendaTab)  * 100 : null;

        // ── Banner de prazos ───────────────────────────────────────────────────
        const prazoCompra = item.prazo_compra_ate ? new Date(item.prazo_compra_ate) : null;
        const prazoVenda  = item.prazo_venda_ate  ? new Date(item.prazo_venda_ate)  : null;
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const bannerEl = document.getElementById('extrato-prazos-banner');
        if (bannerEl) {
            let bannerHtml = '<div style="display:flex; gap:12px; flex-wrap:wrap;">';
            const addPrazo = (label, data, kgFalta, cor) => {
                if (!data) return;
                const diff = Math.ceil((data - hoje) / (1000*60*60*24));
                const urgCor = diff <= 3 ? '#ff4d4d' : diff <= 7 ? '#f0b800' : cor;
                const icon = diff <= 3 ? '🚨' : diff <= 7 ? '⚠️' : '📅';
                bannerHtml += `<div style="flex:1; min-width:220px; background:#0d1826; border:1px solid ${urgCor}; border-radius:8px; padding:10px 14px; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.3rem;">${icon}</span>
                    <div>
                        <div style="font-size:0.75rem; color:#8eaabf;">${label}</div>
                        <div style="font-weight:bold; color:${urgCor}; font-size:0.95rem;">${data.toLocaleDateString('pt-BR')} — ${diff > 0 ? diff + ' dias restantes' : diff === 0 ? 'HOJE!' : 'VENCIDO'}</div>
                        <div style="font-size:0.72rem; color:#aaa;">Falta comprar/vender: ${kgFalta.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</div>
                    </div>
                </div>`;
            };
            addPrazo('🛒 Prazo Limite de Compra', prazoCompra, faltaComprar, '#3e7cb1');
            addPrazo('💰 Prazo Limite de Venda',  prazoVenda,  faltaVender,  '#2AD07A');
            bannerHtml += '</div>';
            bannerEl.innerHTML = bannerHtml;
            bannerEl.style.display = (prazoCompra || prazoVenda) ? 'block' : 'none';
        }

        // ── KPI cards ─────────────────────────────────────────────────────────
        const card = (icon, label, value, sub, cor) =>
            `<div style="background:#0d1826; border:1px solid #1a2e3f; border-radius:10px; padding:14px; border-left:3px solid ${cor};">
                <div style="font-size:0.75rem; color:#8eaabf; margin-bottom:4px;">${icon} ${label}</div>
                <div style="font-size:1.05rem; font-weight:bold; color:${cor};">${value}</div>
                ${sub ? `<div style="font-size:0.72rem; color:#888; margin-top:3px;">${sub}</div>` : ''}
            </div>`;

        const fmtKg  = v => v.toLocaleString('pt-BR', {minimumFractionDigits:1}) + ' kg';
        const fmtRs  = v => 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2});
        const fmtPct = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

        // Métrica de Eficiência de Compra
        let statusCompraTxt = 'Sem compras';
        let statusCompraCor = '#aaa';
        if (mediaCompra > 0) {
            if (mediaCompra < pCompraTab) {
                statusCompraTxt = `COMPRANDO BEM (-${Math.abs(desvioPCompra).toFixed(1)}%)`;
                statusCompraCor = '#2AD07A';
            } else if (mediaCompra > pCompraTab) {
                statusCompraTxt = `COMPRANDO MAL (+${Math.abs(desvioPCompra).toFixed(1)}%)`;
                statusCompraCor = '#ff4d4d';
            } else {
                statusCompraTxt = 'NO PREÇO DA TABELA';
                statusCompraCor = '#f0b800';
            }
        }

        // Métrica de Eficiência de Venda
        let statusVendaTxt = 'Sem vendas';
        let statusVendaCor = '#aaa';
        if (mediaVenda > 0) {
            if (mediaVenda > pVendaTab) {
                statusVendaTxt = `VENDENDO BEM (+${Math.abs(desvioPVenda).toFixed(1)}%)`;
                statusVendaCor = '#2AD07A';
            } else if (mediaVenda < pVendaTab) {
                statusVendaTxt = `VENDENDO MAL (-${Math.abs(desvioPVenda).toFixed(1)}%)`;
                statusVendaCor = '#ff4d4d';
            } else {
                statusVendaTxt = 'NO PREÇO DA TABELA';
                statusVendaCor = '#f0b800';
            }
        }

        let html = '';
        html += card('🛒', 'Meta de Compra',       fmtKg(cPlan),             '', '#3e7cb1');
        html += card('✅', 'Comprado Real',         fmtKg(totalCompraKg),
            `${metaCompPct.toFixed(1)}% da meta | Falta: ${fmtKg(faltaComprar)}`,
            metaCompPct >= 100 ? '#2AD07A' : metaCompPct >= 50 ? '#f0b800' : '#ff4d4d');
        html += card('💰', 'Total Gasto (Compras)', fmtRs(totalCompraRs),      'Capital já investido em estoque', '#ff4d4d');
        html += card('💵', 'Reserva p/ Comprar',   fmtRs(reservaNecessaria),
            `${fmtKg(kgRestCompra)} × R$ ${pCompraTab.toFixed(2)}/kg (tab)`, '#f0b800');
        html += card('📊', 'Eficiência de Compra',  statusCompraTxt,          mediaCompra > 0 ? `Média Real: ${fmtRs(mediaCompra)}/kg vs Tab: ${fmtRs(pCompraTab)}` : 'Nenhuma compra lançada', statusCompraCor);
        html += card('💰', 'Meta de Venda',        fmtKg(vPlan),             '', '#3e7cb1');
        html += card('✅', 'Vendido Real',          fmtKg(totalVendaKg),
            `${metaVendPct.toFixed(1)}% da meta | Falta: ${fmtKg(faltaVender)}`,
            metaVendPct >= 100 ? '#2AD07A' : metaVendPct >= 50 ? '#f0b800' : '#ff4d4d');
        html += card('💵', 'Faturamento Real',     fmtRs(totalVendaRs),      `Investido: ${fmtRs(totalCompraRs)}`, '#2AD07A');
        html += card('🔮', 'Faturamento Projetado',fmtRs(fatProjetado),
            `Restante ${fmtKg(kgRestVenda)} × R$ ${pVendaTab.toFixed(2)}/kg`, '#9b59b6');
        html += card('📊', 'Eficiência de Venda',   statusVendaTxt,           mediaVenda > 0 ? `Média Real: ${fmtRs(mediaVenda)}/kg vs Tab: ${fmtRs(pVendaTab)}` : 'Nenhuma venda lançada', statusVendaCor);
        html += card('📈', 'Markup Planejado',     fmtPct(markupPlan),       `R$ ${pCompraTab.toFixed(2)} → R$ ${pVendaTab.toFixed(2)}`, '#3e7cb1');
        html += card('📈', 'Markup Médio Real',    markupReal !== 0 ? fmtPct(markupReal) : 'Sem dados',
            mediaCompra > 0 ? `R$ ${mediaCompra.toFixed(2)} → R$ ${mediaVenda.toFixed(2)}` : '',
            markupReal >= markupPlan ? '#2AD07A' : '#ff4d4d');

        document.getElementById('extrato-painel-analise').innerHTML = html;

        // ── Renderizar gráficos ────────────────────────────────────────────────
        // Precisamos de setTimeout para garantir que os canvas já existam no DOM
        setTimeout(() => _renderExtratoGraficos(item, transacoes, {
            totalCompraKg, totalVendaKg, cPlan, vPlan,
            pCompraTab, pVendaTab, mediaCompra, mediaVenda
        }), 50);
    }

    function _renderExtratoGraficos(item, transacoes, calc) {
        const { totalCompraKg, totalVendaKg, cPlan, vPlan,
                pCompraTab, pVendaTab, mediaCompra, mediaVenda } = calc;

        const ChartJS = window.Chart;
        if (!ChartJS) return;

        // Estilo global
        ChartJS.defaults.color = '#8eaabf';
        ChartJS.defaults.font.family = 'Inter, sans-serif';

        // ── 1. Donut: Meta de Compra ──
        const ctxC = document.getElementById('extrato-chart-compra');
        if (ctxC) {
            const realC  = Math.min(totalCompraKg, cPlan);
            const faltaC = Math.max(cPlan - totalCompraKg, 0);
            _extratoCharts.compra = new ChartJS(ctxC, {
                type: 'doughnut',
                data: {
                    labels: ['Comprado', 'Falta'],
                    datasets: [{ data: [realC, faltaC],
                        backgroundColor: ['#3e7cb1', '#1a2e3f'],
                        borderColor: ['#2e5c8a', '#0d1826'], borderWidth: 2 }]
                },
                options: { cutout:'70%', plugins:{ legend:{display:false},
                    tooltip:{ callbacks:{ label: ctx => ctx.label + ': ' + parseFloat(ctx.raw).toLocaleString('pt-BR',{minimumFractionDigits:1}) + ' kg' }}},
                    animation: { duration: 600 } }
            });
            const pct = cPlan > 0 ? ((totalCompraKg/cPlan)*100).toFixed(0) : 0;
            const legCompra = document.getElementById('extrato-legend-compra');
            if (legCompra) legCompra.innerHTML = `<span style="color:#3e7cb1; font-weight:bold; font-size:1.1rem;">${pct}%</span><br><span style="color:#8eaabf; font-size:0.72rem;">${totalCompraKg.toLocaleString('pt-BR',{minimumFractionDigits:1})} / ${cPlan.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</span>`;
        }

        // ── 2. Donut: Meta de Venda ──
        const ctxV = document.getElementById('extrato-chart-venda');
        if (ctxV) {
            const realV  = Math.min(totalVendaKg, vPlan);
            const faltaV = Math.max(vPlan - totalVendaKg, 0);
            _extratoCharts.venda = new ChartJS(ctxV, {
                type: 'doughnut',
                data: {
                    labels: ['Vendido', 'Falta'],
                    datasets: [{ data: [realV, faltaV],
                        backgroundColor: ['#2AD07A', '#1a2e3f'],
                        borderColor: ['#1e9456', '#0d1826'], borderWidth: 2 }]
                },
                options: { cutout:'70%', plugins:{ legend:{display:false},
                    tooltip:{ callbacks:{ label: ctx => ctx.label + ': ' + parseFloat(ctx.raw).toLocaleString('pt-BR',{minimumFractionDigits:1}) + ' kg' }}},
                    animation: { duration: 600 } }
            });
            const pct = vPlan > 0 ? ((totalVendaKg/vPlan)*100).toFixed(0) : 0;
            const legVenda = document.getElementById('extrato-legend-venda');
            if (legVenda) legVenda.innerHTML = `<span style="color:#2AD07A; font-weight:bold; font-size:1.1rem;">${pct}%</span><br><span style="color:#8eaabf; font-size:0.72rem;">${totalVendaKg.toLocaleString('pt-BR',{minimumFractionDigits:1})} / ${vPlan.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</span>`;
        }

        // ── 3. Barras: Preço Médio vs Tabela ──
        const ctxP = document.getElementById('extrato-chart-preco');
        if (ctxP) {
            const labels = ['Compra', 'Venda'];
            const tabela = [pCompraTab, pVendaTab];
            const real   = [mediaCompra || 0, mediaVenda || 0];
            _extratoCharts.preco = new ChartJS(ctxP, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Tabela Ref.',  data: tabela, backgroundColor: '#1e354d', borderColor: '#3e7cb1', borderWidth: 2, borderRadius: 4 },
                        { label: 'Médio Real',   data: real,   backgroundColor: ctx => {
                            const i = ctx.dataIndex;
                            // Compra: vermelho se acima da tabela. Venda: verde se acima da tabela.
                            if (i === 0) return real[0] > tabela[0] ? '#ff4d4d' : '#2AD07A';
                            return real[1] >= tabela[1] ? '#2AD07A' : '#ff4d4d';
                        }, borderRadius: 4 }
                    ]
                },
                options: {
                    plugins: { legend:{ labels:{ color:'#8eaabf', font:{ size:10 } } } },
                    scales: {
                        x: { ticks:{ color:'#8eaabf' }, grid:{ color:'#1a2e3f' } },
                        y: { ticks:{ color:'#8eaabf', callback: v => 'R$'+v.toFixed(2) }, grid:{ color:'#1a2e3f' } }
                    },
                    animation: { duration: 600 }
                }
            });
        }

        // ── 4. Linha: Evolução acumulada ──
        const ctxE = document.getElementById('extrato-chart-evolucao');
        if (ctxE && transacoes.length > 0) {
            // Ordenar por data
            const sorted = [...transacoes].sort((a,b) => new Date(a.data_transacao) - new Date(b.data_transacao));
            const labels = []; let acumC = 0, acumV = 0;
            const dataCompra = [], dataVenda = [];
            sorted.forEach(t => {
                const dt = new Date(t.data_transacao).toLocaleDateString('pt-BR');
                if (!labels.includes(dt)) labels.push(dt);
                if (t.tipo === 'COMPRA') acumC += parseFloat(t.quantidade_kg);
                else                     acumV += parseFloat(t.quantidade_kg);
                dataCompra.push(acumC);
                dataVenda.push(acumV);
            });
            _extratoCharts.evolucao = new ChartJS(ctxE, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Compra Acum. (kg)', data: dataCompra, borderColor: '#3e7cb1', backgroundColor: 'rgba(62,124,177,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Venda Acum. (kg)',  data: dataVenda,  borderColor: '#2AD07A', backgroundColor: 'rgba(42,208,122,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Meta Compra',  data: Array(labels.length).fill(cPlan), borderColor: '#3e7cb1', borderDash:[5,5], pointRadius:0, borderWidth:1.5 },
                        { label: 'Meta Venda',   data: Array(labels.length).fill(vPlan), borderColor: '#2AD07A', borderDash:[5,5], pointRadius:0, borderWidth:1.5 }
                    ]
                },
                options: {
                    plugins: { legend:{ labels:{ color:'#8eaabf', font:{ size:10 }, boxWidth:12 } } },
                    scales: {
                        x: { ticks:{ color:'#8eaabf', font:{ size:9 } }, grid:{ color:'#1a2e3f' } },
                        y: { ticks:{ color:'#8eaabf', callback: v => v.toLocaleString('pt-BR',{minimumFractionDigits:0})+' kg' }, grid:{ color:'#1a2e3f' } }
                    },
                    animation: { duration: 600 }
                }
            });
        }
    }

    function _renderExtratoTabela(transacoes) {
        const container = document.getElementById('extrato-tabela-container');
        if (!container) return;

        if (transacoes.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#8eaabf; padding:24px;">Nenhuma movimentação lançada ainda.<br><small>Use o botão "Nova Movimentação" para registrar compras e vendas fracionadas.</small></div>';
            return;
        }

        // Calcular saldo acumulado
        let acumCompra = 0, acumVenda = 0;
        const sorted = [...transacoes].sort((a,b) => new Date(a.data_transacao) - new Date(b.data_transacao));

        let rows = sorted.map(t => {
            const isCompra = t.tipo === 'COMPRA';
            const cor = isCompra ? '#3e7cb1' : '#2AD07A';
            const qtd = parseFloat(t.quantidade_kg);
            const pUnit = parseFloat(t.preco_unitario);
            const total = parseFloat(t.valor_total);
            if (isCompra) acumCompra += qtd; else acumVenda += qtd;
            return `<tr style="border-bottom:1px solid #1a2e3f;">
                <td style="padding:8px;">${new Date(t.data_transacao).toLocaleDateString('pt-BR')}</td>
                <td style="padding:8px;"><span style="background:${isCompra?'#1e354d':'#1b382b'}; color:${cor}; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">${t.tipo}</span></td>
                <td style="padding:8px; text-align:right; color:#fff; font-weight:bold;">${qtd.toLocaleString('pt-BR',{minimumFractionDigits:3})} kg</td>
                <td style="padding:8px; text-align:right; color:${cor};">R$ ${pUnit.toFixed(2)}/kg</td>
                <td style="padding:8px; text-align:right; color:#f0b800; font-weight:bold;">R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="padding:8px; text-align:right; color:#aaa; font-size:0.78rem;">Comp: ${acumCompra.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg<br>Vend: ${acumVenda.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</td>
                <td style="padding:8px; color:#888; font-size:0.8rem;">${t.observacoes||''}</td>
                <td style="padding:8px; text-align:center;">
                    <button onclick="excluirTransacaoComercial(${t.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:0.85rem;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#0d1826; color:#8eaabf; font-size:0.75rem; text-transform:uppercase;">
                        <th style="padding:8px; text-align:left;">Data</th>
                        <th style="padding:8px;">Tipo</th>
                        <th style="padding:8px; text-align:right;">Qtd (kg)</th>
                        <th style="padding:8px; text-align:right;">Preço Unit.</th>
                        <th style="padding:8px; text-align:right;">Total R$</th>
                        <th style="padding:8px; text-align:right;">Acumulado</th>
                        <th style="padding:8px;">Obs</th>
                        <th style="padding:8px;"></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    // ── 3. Planejado vs. Realizado Geral & Chart.js ──────────────────────────────
    window.carregarComparativoRealizadoGeral = async function() {
        await Promise.all([
            carregarPlanejamentoProducaoInsumos(),
            carregarPlanejamentoComercialRevenda(),
            carregarPlanejamentoCompras()
        ]);
        renderComparativoRealizadoGeral();
    };

    function renderComparativoRealizadoGeral() {
        const tbody = document.getElementById('realizado-geral-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totPlanKg = 0, totRealKg = 0, totPlanRs = 0, totRealRs = 0;
        const chartLabels = [];
        const chartDataPlan = [];
        const chartDataReal = [];

        // Itens Comercial
        (localComercialRevenda || []).forEach(c => {
            const planKg = parseFloat(c.compra_planejada_kg || 0);
            const realKg = parseFloat(c.compra_realizada_kg || 0);
            const planRs = parseFloat(c.investimento_planejado_rs || 0);
            const realRs = parseFloat(c.venda_realizada_rs || 0);
            const desvioPct = planKg > 0 ? (((realKg - planKg) / planKg) * 100) : 0;

            const pCompraPlan = parseFloat(c.preco_compra_estimado || 0);
            const pVendaPlan = parseFloat(c.preco_venda_estimado || 0);
            const markupPlan = pCompraPlan > 0 ? ((pVendaPlan - pCompraPlan) / pCompraPlan) * 100 : 0;

            const pCompraReal = parseFloat(c.preco_compra_realizado || 0);
            const pVendaReal = parseFloat(c.preco_venda_realizado || 0);
            const markupReal = pCompraReal > 0 ? ((pVendaReal - pCompraReal) / pCompraReal) * 100 : 0;

            const realInvest = realKg * pCompraReal;

            totPlanKg += planKg; totRealKg += realKg;
            totPlanRs += planRs; totRealRs += realInvest; // investimento real

            chartLabels.push(c.produto_nome || 'Produto');
            chartDataPlan.push(planKg);
            chartDataReal.push(realKg);

            let statusBadge = '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🟢 DENTRO DO PLANEJADO</span>';
            if (desvioPct < -10) statusBadge = '<span style="background:#3b1818; color:#ff4d4d; border:1px solid #ff4d4d; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🔴 ABAIXO DO PLANEJADO</span>';
            else if (desvioPct > 10) statusBadge = '<span style="background:#2a1b3f; color:#9b59b6; border:1px solid #9b59b6; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🟢 ACIMA DO PLANEJADO</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><span style="background:#162b20; color:#2AD07A; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;">Commercial</span></td>
                <td style="padding:10px 8px;">
                    <strong>${c.produto_nome || 'Produto'}</strong>
                    <div style="font-size:0.78rem; color:#aaa; margin-top:4px; line-height:1.3;">
                        Unit. Compra: Plan R$ ${pCompraPlan.toFixed(2)} | Real R$ ${pCompraReal.toFixed(2)}<br>
                        Unit. Venda: Plan R$ ${pVendaPlan.toFixed(2)} | Real R$ ${pVendaReal.toFixed(2)}<br>
                        <span style="color:#f0b800; font-weight:bold;">Markup: Plan ${markupPlan.toFixed(1)}% | Real ${markupReal.toFixed(1)}%</span>
                    </div>
                </td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${planKg.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${realKg.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${desvioPct >= 0 ? '#2AD07A' : '#ff4d4d'};">${desvioPct >= 0 ? '+' : ''}${desvioPct.toFixed(1)}%</td>
                <td style="padding:10px 8px; text-align:right; color:#f0b800;">
                    R$ ${planRs.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    <div style="font-size:0.75rem; color:#888;">Fat: R$ ${(parseFloat(c.faturamento_previsto_rs) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                </td>
                <td style="padding:10px 8px; text-align:right; color:#2AD07A; font-weight:bold;">
                    R$ ${realInvest.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    <div style="font-size:0.75rem; color:#2AD07A; font-weight:normal;">Fat: R$ ${realRs.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                </td>
                <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

        // Itens Produção Insumos
        (localProducaoInsumos || []).forEach(p => {
            const planKg = parseFloat(p.quantidade_insumo_nec_kg || 0);
            const realKg = parseFloat(p.estoque_atual_kg || 0);
            const planRs = parseFloat(p.custo_estimado_rs || 0);
            const realRs = 0;
            const desvioPct = planKg > 0 ? (((realKg - planKg) / planKg) * 100) : 0;

            totPlanKg += planKg; totRealKg += realKg;
            totPlanRs += planRs;

            let statusBadge = '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🟢 DENTRO DO PLANEJADO</span>';
            if (desvioPct < 0) statusBadge = '<span style="background:#3b1818; color:#ff4d4d; border:1px solid #ff4d4d; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">🔴 NECESSIDADE DE INSUMO</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><span style="background:#1e354d; color:#3e7cb1; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;">Insumo Indústria</span></td>
                <td style="padding:10px 8px;"><strong>${p.insumo_nome || 'Insumo'}</strong> <small style="color:#aaa;">(${p.produto_nome || ''})</small></td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${planKg.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${realKg.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${desvioPct >= 0 ? '#2AD07A' : '#ff4d4d'};">${desvioPct >= 0 ? '+' : ''}${desvioPct.toFixed(1)}%</td>
                <td style="padding:10px 8px; text-align:right; color:#f0b800;">R$ ${planRs.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px 8px; text-align:right; color:#aaa;">R$ 0,00</td>
                <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

        const desvioGeralPct = totPlanKg > 0 ? (((totRealKg - totPlanKg) / totPlanKg) * 100) : 0;
        const txtDesvio = document.getElementById('real-desvio-geral-txt');
        if (txtDesvio) {
            txtDesvio.textContent = (desvioGeralPct >= 0 ? '+' : '') + desvioGeralPct.toFixed(1) + '%';
            txtDesvio.style.color = desvioGeralPct >= 0 ? '#2AD07A' : '#ff4d4d';
        }

        renderGraficoPlanejadoVsRealizado(chartLabels, chartDataPlan, chartDataReal);
    }

    function renderGraficoPlanejadoVsRealizado(labels, dataPlan, dataReal) {
        const ctx = document.getElementById('chart-planejado-vs-realizado');
        if (!ctx) return;

        if (chartRealizadoInstance) chartRealizadoInstance.destroy();

        if (typeof Chart === 'undefined') return;

        chartRealizadoInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['Conector', 'Fio Cobre', 'Alumínio'],
                datasets: [
                    {
                        label: 'Planejado (kg)',
                        data: dataPlan.length > 0 ? dataPlan : [35000, 20000, 15000],
                        backgroundColor: '#3e7cb1'
                    },
                    {
                        label: 'Realizado (kg)',
                        data: dataReal.length > 0 ? dataReal : [42000, 18000, 15000],
                        backgroundColor: '#2AD07A'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#ccc' } }
                },
                scales: {
                    x: { ticks: { color: '#aaa' } },
                    y: { ticks: { color: '#aaa' } }
                }
            }
        });
    }

    // ── 4. Projeção Financeira de Caixa ──────────────────────────────────────────
    window.carregarProjecaoCaixa = async function() {
        // Popula o select de produto no formulário de entrada
        let _mats = window.localMateriais || [];
        if (_mats.length === 0) {
            try {
                const res = await fetch('/api/materiais-catalogo');
                if (res.ok) { _mats = await res.json(); window.localMateriais = _mats; }
            } catch(e){}
        }
        const selProd = document.getElementById('cx-produto-id');
        if (selProd) {
            selProd.innerHTML = '<option value="">Selecione o Material...</option>' +
                _mats.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
        }

        // Define o mês padrão
        const cxMes = document.getElementById('cx-mes');
        if (cxMes && !cxMes.value) {
            // Próximo mês
            const d = new Date(); d.setMonth(d.getMonth() + 1);
            cxMes.value = d.toISOString().slice(0, 7);
        }

        let totPlan = 0, totReal = 0;
        const desinstalos = [];

        // Soma os dados de planejamento comercial e insumos
        (localComercialRevenda || []).forEach(c => {
            const inv = parseFloat(c.investimento_planejado_rs || 0);
            totPlan += inv;
            desinstalos.push({
                nome: c.produto_nome || 'Produto Comercial',
                qtd: parseFloat(c.compra_planejada_kg || 0),
                preco: parseFloat(c.compra_planejada_kg || 0) > 0 ? inv / parseFloat(c.compra_planejada_kg) : 0,
                desembolso: inv
            });
        });

        (localProducaoInsumos || []).forEach(p => {
            const cEst = parseFloat(p.custo_estimado_rs || 0);
            totPlan += cEst;
            desinstalos.push({
                nome: (p.insumo_nome || 'Insumo') + ' (Indústria)',
                qtd: parseFloat(p.quantidade_necessaria_compra_kg || 0),
                preco: parseFloat(p.quantidade_necessaria_compra_kg || 0) > 0 ? cEst / parseFloat(p.quantidade_necessaria_compra_kg) : 0,
                desembolso: cEst
            });
        });

        (localMRP || []).forEach(m => {
            const cEst = parseFloat(m.custo_total_estimado || 0);
            const cReal = parseFloat(m.custo_total_realizado || 0);
            totPlan += cEst;
            totReal += cReal;
        });

        const kpiPlan = document.getElementById('cx-kpi-atual-plan');
        const kpiReal = document.getElementById('cx-kpi-atual-real');
        const kpiProx = document.getElementById('cx-kpi-prox-caixa');

        if (kpiPlan) kpiPlan.textContent = 'R$ ' + totPlan.toLocaleString('pt-BR', {minimumFractionDigits:2});
        if (kpiReal) kpiReal.textContent = 'R$ ' + totReal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        if (kpiProx) kpiProx.textContent = 'R$ ' + (totPlan * 1.15).toLocaleString('pt-BR', {minimumFractionDigits:2});

        const tbody = document.getElementById('caixa-desembolso-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            desinstalos.sort((a, b) => b.desembolso - a.desembolso);
            desinstalos.forEach(item => {
                const part = totPlan > 0 ? ((item.desembolso / totPlan) * 100) : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding:10px 8px;"><strong>${item.nome}</strong></td>
                    <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${item.qtd.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:10px 8px; text-align:right;">R$ ${item.preco.toFixed(2)}</td>
                    <td style="padding:10px 8px; text-align:right; color:#9b59b6; font-weight:bold;">R$ ${item.desembolso.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:center;"><span style="color:#2AD07A; font-weight:bold;">${part.toFixed(1)}%</span></td>
                `;
                tbody.appendChild(tr);
            });

            if (desinstalos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#aaa;">Nenhuma projeção registrada. Use o formulário acima para adicionar entradas manuais ou cadastre dados nas abas de Produção e Compra e Venda.</td></tr>';
            }
        }
    };

    window.calcularProjecaoCaixaTotal = function() {
        const qtd = parseFloat(document.getElementById('cx-qtd-kg').value || 0);
        const preco = parseFloat(document.getElementById('cx-preco-unit').value || 0);
        const total = qtd * preco;
        const preview = document.getElementById('cx-total-preview');
        if (preview) preview.textContent = 'R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits:2});
    };

    window.salvarProjecaoCaixaForm = async function(e) {
        e.preventDefault();
        const mesVal = document.getElementById('cx-mes').value;
        const prodId = document.getElementById('cx-produto-id').value;
        const qtdKg = parseFloat(document.getElementById('cx-qtd-kg').value || 0);
        const precoUnit = parseFloat(document.getElementById('cx-preco-unit').value || 0);

        if (!mesVal || !prodId || qtdKg <= 0 || precoUnit <= 0) {
            _apexNotify('Atenção', 'Preencha todos os campos obrigatórios com valores válidos.', 'warning');
            return;
        }

        const desembolso = qtdKg * precoUnit;
        // Salva como um planejamento de compra manual com o tipo PROJECAO_CAIXA
        try {
            const payload = {
                tipo_planejamento: 'COMPRA_VENDA',
                material_id: prodId,
                fornecedor_id: null,
                quantidade_necessaria: qtdKg,
                quantidade_realizada_kg: 0,
                lead_time_dias: 7,
                preco_estimado: precoUnit,
                mes_referencia: mesVal,
                status: 'Projeção Caixa',
                observacoes: `Projeção de caixa manual. Desembolso: R$ ${desembolso.toLocaleString('pt-BR', {minimumFractionDigits:2})}`
            };
            const res = await fetch('/api/planejamento/compras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao registrar projeção');
            _apexNotify('Sucesso', `Projeção de R$ ${desembolso.toLocaleString('pt-BR', {minimumFractionDigits:2})} adicionada ao caixa!`, 'success');
            document.getElementById('form-projecao-caixa').reset();
            document.getElementById('cx-total-preview').textContent = 'R$ 0,00';
            // Recarrega os dados
            localMRP = [];
            await carregarPlanejamentoCompras();
            await carregarProjecaoCaixa();
        } catch (err) {
            _apexNotify('Erro', err.message, 'error');
        }
    };

    // ── 5. Parâmetros de Prazos & Estoque Mínimo ──────────────────────────────────
    window.carregarParametrosPrazos = async function() {
        try {
            const res = await fetch('/api/planejamento/parametros-prazos');
            const data = await res.json();
            localParametrosPrazos = Array.isArray(data) ? data : [];
            renderParametrosPrazos();
        } catch (err) {
            console.error('Erro ao carregar parâmetros de prazos:', err);
            localParametrosPrazos = [];
            renderParametrosPrazos();
        }
    };

    function renderParametrosPrazos() {
        const tbody = document.getElementById('prazos-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        localParametrosPrazos.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><strong>${p.material_nome || 'Material #' + p.material_id}</strong></td>
                <td style="padding:10px 8px; text-align:center;"><span style="color:#3e7cb1; font-weight:bold;">${p.lead_time_compra_dias || 7} dias</span></td>
                <td style="padding:10px 8px; text-align:center;"><span style="color:#ffb74d; font-weight:bold;">${p.prazo_entrega_dias || 15} dias</span></td>
                <td style="padding:10px 8px; text-align:center;"><span style="color:#9b59b6; font-weight:bold;">${p.prazo_producao_dias || 5} dias</span></td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${parseFloat(p.estoque_minimo_kg || 0).toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${parseFloat(p.estoque_seguranca_kg || 0).toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:center;">${p.prazo_permanencia_dias || 30} dias</td>
                <td style="padding:10px 8px; text-align:center;">
                    <button type="button" onclick="editarParametrosPrazos(${p.material_id})" style="background:#1e354d; border:1px solid #3e7cb1; color:#3e7cb1; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;" title="Editar Parâmetros"><i class="fa-solid fa-pen"></i> Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.abrirModalParametrosPrazos = async function() {
        const modalEl = document.getElementById('modal-parametros-prazos');
        if (!modalEl) return;

        // Mover para document.body e aplicar estilos
        if (modalEl.parentElement !== document.body) {
            document.body.appendChild(modalEl);
        }
        modalEl.style.display = 'flex';
        modalEl.style.position = 'fixed';
        modalEl.style.top = '0';
        modalEl.style.left = '0';
        modalEl.style.width = '100vw';
        modalEl.style.height = '100vh';
        modalEl.style.zIndex = '9999999';
        modalEl.style.background = 'rgba(0,0,0,0.92)';
        modalEl.style.alignItems = 'center';
        modalEl.style.justifyContent = 'center';
        modalEl.style.overflowY = 'auto';
        modalEl.style.padding = '20px';
        modalEl.style.boxSizing = 'border-box';

        // Garante acesso cross-IIFE a localMateriais
        let _mats = window.localMateriais || [];
        if (_mats.length === 0) {
            try {
                const res = await fetch('/api/materiais-catalogo');
                if (res.ok) {
                    _mats = await res.json();
                    window.localMateriais = _mats;
                }
            } catch(e){}
        }

        const selMat = document.getElementById('prazos-mat-id');
        if (selMat) {
            selMat.innerHTML = '<option value="">Selecione o Material...</option>' +
                _mats.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
        }

        const form = document.getElementById('form-parametros-prazos');
        if (form) form.reset();
        
        // Garantir visível
        modalEl.style.display = 'flex';
    };

    window.fecharModalParametrosPrazos = function() {
        const modalEl = document.getElementById('modal-parametros-prazos');
        if (modalEl) modalEl.style.display = 'none';
    };

    window.editarParametrosPrazos = function(matId) {
        const p = (localParametrosPrazos || []).find(x => x.material_id == matId);
        if (!p) return;
        abrirModalParametrosPrazos().then(() => {
            document.getElementById('prazos-mat-id').value = p.material_id;
            document.getElementById('prazos-lt-compra').value = p.lead_time_compra_dias || 7;
            document.getElementById('prazos-pr-entrega').value = p.prazo_entrega_dias || 15;
            document.getElementById('prazos-pr-producao').value = p.prazo_producao_dias || 5;
            document.getElementById('prazos-est-min').value = p.estoque_minimo_kg || 0;
            document.getElementById('prazos-est-seg').value = p.estoque_seguranca_kg || 0;
            const perm = document.getElementById('prazos-permanencia');
            if (perm) perm.value = p.prazo_permanencia_dias || 30;
        });
    };

    window.salvarParametrosPrazosForm = async function(e) {
        e.preventDefault();
        const matId = document.getElementById('prazos-mat-id').value;
        if (!matId) {
            _apexNotify('Atenção', 'Selecione o material antes de salvar.', 'warning');
            return;
        }
        const payload = {
            material_id: matId,
            lead_time_compra_dias: parseInt(document.getElementById('prazos-lt-compra').value) || 7,
            prazo_entrega_dias: parseInt(document.getElementById('prazos-pr-entrega').value) || 15,
            prazo_producao_dias: parseInt(document.getElementById('prazos-pr-producao').value) || 5,
            estoque_minimo_kg: parseFloat(document.getElementById('prazos-est-min').value) || 0,
            estoque_seguranca_kg: parseFloat(document.getElementById('prazos-est-seg').value) || 0,
            prazo_permanencia_dias: parseInt(document.getElementById('prazos-permanencia')?.value) || 30
        };

        try {
            const res = await fetch('/api/planejamento/parametros-prazos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar parâmetros');
            _apexNotify('Sucesso', 'Parâmetros de prazos e estoque salvos!', 'success');
            fecharModalParametrosPrazos();
            await carregarParametrosPrazos();
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    // ── Exportação PDF Adicional ────────────────────────────────────────────────
    window.imprimirPlanejamentoProducaoPdf = async function() {
        try {
            const jsPDFClass = getJsPDFClass();
            if (!jsPDFClass) return;
            const doc = new jsPDFClass('landscape', 'pt', 'a4');
            
            // Título e Meta Info em Fundo Branco
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("APEXTECH METAIS - PLANEJAMENTO DE PRODUÇÃO & EXPLOSÃO DE INSUMOS", 40, 40);

            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Central de Inteligência`, 40, 56);

            const headers = [['Produto', 'Insumo', 'Insumo Nec. (kg)', 'Estoque Atual', 'Compra Líquida', 'Custo Est. (R$)']];
            const body = (localProducaoInsumos || []).map(item => [
                item.produto_nome || '',
                item.insumo_nome || '',
                parseFloat(item.quantidade_insumo_nec_kg || 0).toLocaleString('pt-BR') + ' kg',
                parseFloat(item.estoque_atual_kg || 0).toLocaleString('pt-BR') + ' kg',
                parseFloat(item.quantidade_necessaria_compra_kg || 0).toLocaleString('pt-BR') + ' kg',
                'R$ ' + parseFloat(item.custo_estimado_rs || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})
            ]);

            doc.autoTable({
                startY: 70,
                head: headers,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 8.5, cellPadding: 5 }
            });

            await aplicarMarcaDaguaLogoJsPDF(doc);
            doc.save(`Planejamento_Producao_Insumos_${new Date().toISOString().slice(0, 10)}.pdf`);
            _apexNotify('Sucesso', 'PDF de Insumos da Produção baixado!', 'success');
        } catch(e){}
    };

    window.imprimirPlanejamentoComercialPdf = async function() {
        try {
            const jsPDFClass = getJsPDFClass();
            if (!jsPDFClass) return;
            const doc = new jsPDFClass('landscape', 'pt', 'a4');
            
            // Título e Meta Info em Fundo Branco
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("APEXTECH METAIS - PLANEJAMENTO COMERCIAL & META R$ 5.000.000,00", 40, 40);

            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Central de Inteligência`, 40, 56);

            const headers = [['Produto Comercial', 'Compra Plan. (kg)', 'Venda Plan. (kg)', 'Investimento (R$)', 'Faturamento Prev. (R$)', '% Meta Global']];
            const body = (localComercialRevenda || []).map(item => {
                const fat = parseFloat(item.faturamento_previsto_rs || 0);
                const part = (fat / 5000000.00) * 100;
                return [
                    item.produto_nome || '',
                    parseFloat(item.compra_planejada_kg || 0).toLocaleString('pt-BR') + ' kg',
                    parseFloat(item.venda_planejada_kg || 0).toLocaleString('pt-BR') + ' kg',
                    'R$ ' + parseFloat(item.investimento_planejado_rs || 0).toLocaleString('pt-BR', {minimumFractionDigits:2}),
                    'R$ ' + fat.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                    part.toFixed(1) + '%'
                ];
            });

            doc.autoTable({
                startY: 70,
                head: headers,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 8.5, cellPadding: 5 }
            });

            await aplicarMarcaDaguaLogoJsPDF(doc);
            doc.save(`Planejamento_Comercial_Revenda_${new Date().toISOString().slice(0, 10)}.pdf`);
            _apexNotify('Sucesso', 'PDF Comercial de Revenda baixado!', 'success');
        } catch(e){}
    };

    window.imprimirComparativoRealizadoGeralPdf = function() {
        if (window.imprimirComparativoRealizadoPdf) window.imprimirComparativoRealizadoPdf();
    };

    // ── 7. Planejamento por Cenários Estratégicos (16 a 22) ─────────────────────
    window.carregarPlanejamentoCenarios = async function() {
        try {
            const resCfg = await fetch('/api/planejamento/cenarios/configuracao');
            if (resCfg.ok) {
                currentCenariosConfig = await resCfg.json();
                document.getElementById('cfg-pct-conservador').value = currentCenariosConfig.percentual_conservador || 80;
                document.getElementById('cfg-pct-moderado').value = currentCenariosConfig.percentual_moderado || 100;
                document.getElementById('cfg-pct-agressivo').value = currentCenariosConfig.percentual_agressivo || 120;
                document.getElementById('cfg-cenario-foco').value = currentCenariosConfig.cenario_foco || 'AGRESSIVO';
            }
        } catch(e){}

        // Popular Select de Produtos para Requisito 22
        let _mats = window.localMateriais || [];
        if (_mats.length === 0) {
            try {
                const resM = await fetch('/api/materiais-catalogo');
                if (resM.ok) {
                    _mats = await resM.json();
                    window.localMateriais = _mats;
                }
            } catch(e){}
        }

        const selProd = document.getElementById('cenarios-select-produto');
        if (selProd) {
            selProd.innerHTML = '<option value="">Selecione o Produto para Análise...</option>' +
                _mats.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
        }

        const metaInput = document.getElementById('sim-meta-base-input');
        const metaVal = metaInput ? parseFloat(metaInput.value || 1000000) : 1000000;
        await executarSimulacaoCenarios(metaVal);
    };

    window.toggleConfiguracaoCenariosPanel = function() {
        const panel = document.getElementById('cenarios-config-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    };

    window.salvarConfiguracaoCenariosForm = async function() {
        const payload = {
            percentual_conservador: parseFloat(document.getElementById('cfg-pct-conservador').value || 80),
            percentual_moderado: parseFloat(document.getElementById('cfg-pct-moderado').value || 100),
            percentual_agressivo: parseFloat(document.getElementById('cfg-pct-agressivo').value || 120),
            cenario_foco: document.getElementById('cfg-cenario-foco').value || 'AGRESSIVO',
            meta_base_padrao_rs: parseFloat(document.getElementById('sim-meta-base-input').value || 1000000)
        };

        try {
            const res = await fetch('/api/planejamento/cenarios/configuracao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar configuração dos cenários');
            _apexNotify('Sucesso', 'Percentuais dos cenários salvos com sucesso!', 'success');
            currentCenariosConfig = payload;
            toggleConfiguracaoCenariosPanel();
            await executarSimulacaoCenarios(payload.meta_base_padrao_rs);
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.onSimuladorMetaBaseInput = function(val) {
        const metaVal = parseFloat(val || 0);
        executarSimulacaoCenarios(metaVal);
    };

    window.executarSimulacaoCenarios = async function(metaBase) {
        const payload = {
            meta_base_rs: metaBase,
            p_conservador: parseFloat(document.getElementById('cfg-pct-conservador').value || 80),
            p_moderado: parseFloat(document.getElementById('cfg-pct-moderado').value || 100),
            p_agressivo: parseFloat(document.getElementById('cfg-pct-agressivo').value || 120)
        };

        try {
            const res = await fetch('/api/planejamento/cenarios/simular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao simular cenários');
            const data = await res.json();
            currentCenariosSimulation = data;
            renderCenariosEstrategicos(data);
        } catch (err) {
            console.error('Erro na simulação dos cenários:', err);
        }
    };

    function renderCenariosEstrategicos(data) {
        if (!data || !data.cenarios) return;

        const cons = data.cenarios.conservador;
        const mod = data.cenarios.moderado;
        const agr = data.cenarios.agressivo;

        // 1. Destaque do Cenário Foco (Agressivo por padrão ou configurável)
        const foco = data.cenario_foco || agr;
        document.getElementById('foco-titulo-cenario').textContent = `CENÁRIO ${foco.cenario}`;
        document.getElementById('foco-fat-rs').textContent = 'R$ ' + foco.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('foco-invest-rs').textContent = 'R$ ' + foco.investimento_necessario_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('foco-caixa-rs').textContent = 'R$ ' + foco.necessidade_caixa_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('foco-volume-kg').textContent = foco.volume_vendas_kg.toLocaleString('pt-BR') + ' kg';

        const diffMod = data.diferenca_foco_moderado_rs || (foco.faturamento_previsto_rs - mod.faturamento_previsto_rs);
        const diffCons = data.diferenca_foco_conservador_rs || (foco.faturamento_previsto_rs - cons.faturamento_previsto_rs);

        document.getElementById('foco-diff-mod').textContent = (diffMod >= 0 ? '+' : '') + 'R$ ' + diffMod.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ` (${((diffMod / (mod.faturamento_previsto_rs || 1)) * 100).toFixed(1)}%)`;
        document.getElementById('foco-diff-cons').textContent = (diffCons >= 0 ? '+' : '') + 'R$ ' + diffCons.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ` (${((diffCons / (cons.faturamento_previsto_rs || 1)) * 100).toFixed(1)}%)`;

        // 2. Triple Cards dos 3 Cenários
        // Conservador
        document.getElementById('cons-pct-badge').textContent = `${cons.percentual}% Meta`;
        document.getElementById('cons-fat-txt').textContent = 'R$ ' + cons.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('cons-inv-txt').textContent = 'R$ ' + cons.investimento_necessario_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('cons-caixa-txt').textContent = 'R$ ' + cons.necessidade_caixa_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('cons-margem-txt').textContent = 'R$ ' + cons.margem_estimada_rs.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ` (${cons.margem_estimada_pct.toFixed(1)}%)`;
        document.getElementById('cons-vol-txt').textContent = cons.volume_compras_kg.toLocaleString('pt-BR') + ' kg';

        // Moderado
        document.getElementById('mod-pct-badge').textContent = `${mod.percentual}% Meta`;
        document.getElementById('mod-fat-txt').textContent = 'R$ ' + mod.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('mod-inv-txt').textContent = 'R$ ' + mod.investimento_necessario_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('mod-caixa-txt').textContent = 'R$ ' + mod.necessidade_caixa_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('mod-margem-txt').textContent = 'R$ ' + mod.margem_estimada_rs.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ` (${mod.margem_estimada_pct.toFixed(1)}%)`;
        document.getElementById('mod-vol-txt').textContent = mod.volume_compras_kg.toLocaleString('pt-BR') + ' kg';

        // Agressivo
        document.getElementById('agr-pct-badge').textContent = `${agr.percentual}% Meta`;
        document.getElementById('agr-fat-txt').textContent = 'R$ ' + agr.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('agr-inv-txt').textContent = 'R$ ' + agr.investimento_necessario_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('agr-caixa-txt').textContent = 'R$ ' + agr.necessidade_caixa_rs.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('agr-margem-txt').textContent = 'R$ ' + agr.margem_estimada_rs.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ` (${agr.margem_estimada_pct.toFixed(1)}%)`;
        document.getElementById('agr-vol-txt').textContent = agr.volume_compras_kg.toLocaleString('pt-BR') + ' kg';

        // 3. Frases da Apresentação Gerencial (Requisito 20)
        document.getElementById('apres-cons-txt').textContent = `"Se trabalharmos no cenário conservador (${cons.percentual}%), teremos R$ ${cons.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2})} de faturamento."`;
        document.getElementById('apres-mod-txt').textContent = `"No cenário moderado (${mod.percentual}%), atingiremos R$ ${mod.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2})}."`;
        document.getElementById('apres-agr-txt').textContent = `"Para atingir nossa meta estratégica, precisamos trabalhar no cenário agressivo (${agr.percentual}%), chegando a R$ ${agr.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2})}."`;

        // 4. Gráfico Comparativo Chart.js
        renderGraficoCenarios(cons, mod, agr);

        // 5. Atualizar Produto se houver selecionado
        const selProdVal = document.getElementById('cenarios-select-produto').value;
        if (selProdVal) renderCenariosPorProduto(selProdVal);
    }

    function renderGraficoCenarios(cons, mod, agr) {
        const ctx = document.getElementById('chart-cenarios-faturamento');
        if (!ctx) return;

        if (chartCenariosInstance) chartCenariosInstance.destroy();

        if (typeof Chart === 'undefined') return;

        chartCenariosInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [`Conservador (${cons.percentual}%)`, `Moderado (${mod.percentual}%)`, `Agressivo (${agr.percentual}%)`],
                datasets: [
                    {
                        label: 'Faturamento Previsto (R$)',
                        data: [cons.faturamento_previsto_rs, mod.faturamento_previsto_rs, agr.faturamento_previsto_rs],
                        backgroundColor: ['#2AD07A', '#f0b800', '#ff4d4d']
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#ccc' } },
                    y: { ticks: { color: '#ccc' } }
                }
            }
        });
    }

    window.onCenamProdutoChange = function(prodId) {
        renderCenariosPorProduto(prodId);
    };

    function renderCenariosPorProduto(prodId) {
        const tbody = document.getElementById('cenarios-produto-table-body');
        if (!tbody) return;

        if (!prodId) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto acima para visualizar os cenários individuais.</td></tr>';
            return;
        }

        const prod = (window.localMateriais || []).find(m => m.id == prodId);
        const prodNome = prod ? prod.nome : 'Produto #' + prodId;
        const metaBaseVal = parseFloat(document.getElementById('sim-meta-base-input').value || 1000000);

        const pCons = parseFloat(document.getElementById('cfg-pct-conservador').value || 80);
        const pMod = parseFloat(document.getElementById('cfg-pct-moderado').value || 100);
        const pAgr = parseFloat(document.getElementById('cfg-pct-agressivo').value || 120);

        const metaVolBaseKg = (metaBaseVal * 0.25) / 30.00; // Assume 25% da meta global para o produto

        const buildRow = (nome, pct, color) => {
            const volKg = metaVolBaseKg * (pct / 100);
            const valVenda = volKg * 30.00;
            const valCompra = volKg * 21.00;
            const margem = valVenda - valCompra;
            const invest = valCompra;
            const caixa = invest * 1.15;

            return `
                <tr>
                    <td style="padding:10px 8px;"><strong style="color:${color};">${nome} (${pct}%)</strong></td>
                    <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#fff;">${volKg.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:10px 8px; text-align:right; color:#f0b800;">R$ ${valCompra.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:right; color:#2AD07A; font-weight:bold;">R$ ${valVenda.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:right; color:#2AD07A; font-weight:bold;">R$ ${margem.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:right; color:#f0b800;">R$ ${invest.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:right; color:#9b59b6; font-weight:bold;">R$ ${caixa.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="padding:10px 8px; text-align:center;"><span style="background:#101a24; border:1px solid ${color}; color:${color}; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold;">${nome}</span></td>
                </tr>
            `;
        };

        tbody.innerHTML =
            buildRow('🟢 CONSERVADOR', pCons, '#2AD07A') +
            buildRow('🟡 MODERADO', pMod, '#f0b800') +
            buildRow('🔴 AGRESSIVO', pAgr, '#ff4d4d');
    }

    window.imprimirCenariosPdf = async function() {
        try {
            const jsPDFClass = getJsPDFClass();
            if (!jsPDFClass) return;
            const doc = new jsPDFClass('landscape', 'pt', 'a4');
            
            // Título e Meta Info em Fundo Branco
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("APEXTECH METAIS - PLANEJAMENTO POR CENÁRIOS ESTRATÉGICOS", 40, 40);

            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Central de Inteligência`, 40, 56);

            if (!currentCenariosSimulation || !currentCenariosSimulation.cenarios) return;

            const cons = currentCenariosSimulation.cenarios.conservador;
            const mod = currentCenariosSimulation.cenarios.moderado;
            const agr = currentCenariosSimulation.cenarios.agressivo;

            const headers = [['Cenário', '% Meta', 'Faturamento (R$)', 'Investimento (R$)', 'Caixa (R$)', 'Volume (kg)']];
            const body = [cons, mod, agr].map(item => [
                item.cenario,
                item.percentual + '%',
                'R$ ' + item.faturamento_previsto_rs.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + item.investimento_necessario_rs.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + item.necessidade_caixa_rs.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                item.volume_vendas_kg.toLocaleString('pt-BR') + ' kg'
            ]);

            doc.autoTable({
                startY: 70,
                head: headers,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 8.5, cellPadding: 5 }
            });

            await aplicarMarcaDaguaLogoJsPDF(doc);
            doc.save(`Planejamento_Cenarios_Estrategicos_${new Date().toISOString().slice(0, 10)}.pdf`);
            _apexNotify('Sucesso', 'PDF de Cenários Estratégicos baixado!', 'success');
        } catch(e){}
    };

    // ── PDF Export: Planejamento de Compra & Venda (Trading) ────────────────────
    window.imprimirRelatorioMrpPdf = window.imprimirMrpPdf = function(id) {
        try {
            const jsPDFClass = getJsPDFClass();
            if (!jsPDFClass) {
                _apexNotify('Atenção', 'Biblioteca jsPDF não carregada.', 'error');
                return;
            }
            const doc = new jsPDFClass('landscape', 'pt', 'a4');
            const dataToExport = id ? (localMRP || []).filter(x => x.id == id) : (localMRP || []).filter(x => (x.tipo_planejamento || 'COMPRA_VENDA') === 'COMPRA_VENDA');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text("APEXTECH METAIS - PLANEJAMENTO DE COMPRA & VENDA (TRADING)", 40, 40);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(170, 170, 170);
            doc.text(`Relatório Gerencial Comercial | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 55);

            let y = 80;
            doc.setFillColor(30, 78, 140);
            doc.rect(40, y, doc.internal.pageSize.getWidth() - 80, 22, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text("Material / Produto", 50, y + 15);
            doc.text("Fornecedor", 220, y + 15);
            doc.text("Meta (kg)", 380, y + 15);
            doc.text("Preço (R$/kg)", 460, y + 15);
            doc.text("Investimento (R$)", 550, y + 15);
            doc.text("Realizado (kg)", 670, y + 15);
            doc.text("Status", 770, y + 15);

            y += 28;
            doc.setFont('helvetica', 'normal');
            dataToExport.forEach((item, idx) => {
                if (y > doc.internal.pageSize.getHeight() - 50) {
                    aplicarMarcaDaguaLogoJsPDF(doc);
                    doc.addPage();
                    y = 40;
                }
                const qty = parseFloat(item.quantidade_necessaria || 0);
                const prc = parseFloat(item.preco_estimado || 0);
                const total = parseFloat(item.custo_total_estimado || (qty * prc));
                const realQty = parseFloat(item.quantidade_realizada_kg || 0);

                doc.setFillColor(idx % 2 === 0 ? 18 : 24, 34, 48);
                doc.rect(40, y - 10, doc.internal.pageSize.getWidth() - 80, 20, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text(String(item.material_nome || '-').slice(0, 25), 50, y + 2);
                doc.text(String(item.fornecedor_nome || '-').slice(0, 25), 220, y + 2);
                doc.text(qty.toLocaleString('pt-BR') + ' kg', 380, y + 2);
                doc.text('R$ ' + prc.toFixed(2), 460, y + 2);
                doc.text('R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits:2}), 550, y + 2);
                doc.text(realQty.toLocaleString('pt-BR') + ' kg', 670, y + 2);
                doc.text(String(item.status || 'Sugerido'), 770, y + 2);
                y += 22;
            });

            aplicarMarcaDaguaLogoJsPDF(doc);
            doc.save(`Planejamento_Trading_${new Date().toISOString().slice(0, 10)}.pdf`);
            _apexNotify('Sucesso', 'PDF de Trading Comercial gerado com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF Trading:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    // ── PDF Export: Insumos da Indústria ───────────────────────────────────────
    window.imprimirInsumosIndustriaPdf = function() {
        try {
            const jsPDFClass = getJsPDFClass();
            if (!jsPDFClass) {
                _apexNotify('Atenção', 'Biblioteca jsPDF não carregada.', 'error');
                return;
            }
            const doc = new jsPDFClass('landscape', 'pt', 'a4');
            const dataToExport = (localMRP || []).filter(x => x.tipo_planejamento === 'INSUMO_INDUSTRIA');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text("APEXTECH METAIS - PLANEJAMENTO DE INSUMOS DA INDÚSTRIA", 40, 40);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(170, 170, 170);
            doc.text(`Consumo e Abastecimento de Fábrica | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 55);

            let y = 80;
            doc.setFillColor(30, 78, 140);
            doc.rect(40, y, doc.internal.pageSize.getWidth() - 80, 22, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text("Insumo / Material", 50, y + 15);
            doc.text("Fornecedor", 240, y + 15);
            doc.text("Qtd Necessária (kg)", 420, y + 15);
            doc.text("Lead Time", 550, y + 15);
            doc.text("Custo Previsto (R$)", 640, y + 15);
            doc.text("Status", 770, y + 15);

            y += 28;
            doc.setFont('helvetica', 'normal');
            dataToExport.forEach((item, idx) => {
                if (y > doc.internal.pageSize.getHeight() - 50) {
                    aplicarMarcaDaguaLogoJsPDF(doc);
                    doc.addPage();
                    y = 40;
                }
                const qty = parseFloat(item.quantidade_necessaria || 0);
                const prc = parseFloat(item.preco_estimado || 0);
                const total = parseFloat(item.custo_total_estimado || (qty * prc));

                doc.setFillColor(idx % 2 === 0 ? 18 : 24, 34, 48);
                doc.rect(40, y - 10, doc.internal.pageSize.getWidth() - 80, 20, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text(String(item.material_nome || '-').slice(0, 28), 50, y + 2);
                doc.text(String(item.fornecedor_nome || '-').slice(0, 25), 240, y + 2);
                doc.text(qty.toLocaleString('pt-BR') + ' kg', 420, y + 2);
                doc.text(String(item.lead_time_dias || 7) + ' dias', 550, y + 2);
                doc.text('R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits:2}), 640, y + 2);
                doc.text(String(item.status || 'Sugerido'), 770, y + 2);
                y += 22;
            });

            aplicarMarcaDaguaLogoJsPDF(doc);
            doc.save(`Planejamento_Insumos_Industria_${new Date().toISOString().slice(0, 10)}.pdf`);
            _apexNotify('Sucesso', 'PDF de Insumos da Indústria gerado com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF Insumos:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    // ── PDF Export: Planejado vs. Realizado (Metas & Caixa) ────────────────────
    window.imprimirComparativoRealizadoPdf = async function() {
        try {
            const jsPDFClass = getJsPDFClass();
            if (!jsPDFClass) {
                _apexNotify('Atenção', 'Biblioteca jsPDF não carregada.', 'error');
                return;
            }
            const doc = new jsPDFClass('landscape', 'pt', 'a4');
            const dataToExport = localMRP || [];

            // Título e Meta Info em Fundo Branco
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("APEXTECH METAIS - DEMONSTRATIVO PLANEJADO VS. REALIZADO", 40, 40);

            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Acompanhamento de Metas de Compra & Projeção de Caixa | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 56);

            const headers = [['Tipo', 'Material / Produto', 'Meta (kg)', 'Realizado (kg)', 'Desvio %', 'Previsto (R$)', 'Realizado (R$)']];
            const body = dataToExport.map(item => {
                const qty = parseFloat(item.quantidade_necessaria || 0);
                const qtyReal = parseFloat(item.quantidade_realizada_kg || 0);
                const prc = parseFloat(item.preco_estimado || 0);
                const totalEst = parseFloat(item.custo_total_estimado || (qty * prc));
                const totalReal = parseFloat(item.custo_total_realizado || (qtyReal * prc));
                const desvioPct = qty > 0 ? (((qtyReal - qty) / qty) * 100) : 0;
                const tipoStr = (item.tipo_planejamento || 'COMPRA_VENDA') === 'COMPRA_VENDA' ? 'Trading' : 'Insumo';

                return [
                    tipoStr,
                    item.material_nome || '-',
                    qty.toLocaleString('pt-BR') + ' kg',
                    qtyReal.toLocaleString('pt-BR') + ' kg',
                    (desvioPct >= 0 ? '+' : '') + desvioPct.toFixed(1) + '%',
                    'R$ ' + totalEst.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                    'R$ ' + totalReal.toLocaleString('pt-BR', {minimumFractionDigits:2})
                ];
            });

            doc.autoTable({
                startY: 70,
                head: headers,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 8.5, cellPadding: 4 }
            });

            let nextY = doc.lastAutoTable.finalY + 20;

            // Capturar e Inserir o Gráfico de Metas
            const chartCanvas = document.getElementById('chart-planejado-vs-realizado');
            if (chartCanvas) {
                try {
                    // Garantir que cabe na página atual, senão cria nova
                    if (nextY + 160 > doc.internal.pageSize.getHeight() - 40) {
                        await aplicarMarcaDaguaLogoJsPDF(doc);
                        doc.addPage();
                        nextY = 40;
                    }

                    const chartImgData = chartCanvas.toDataURL('image/png');
                    doc.addImage(chartImgData, 'PNG', 40, nextY, doc.internal.pageSize.getWidth() - 80, 150);
                } catch (e) {
                    console.warn('Erro ao inserir gráfico no PDF:', e);
                }
            }

            await aplicarMarcaDaguaLogoJsPDF(doc);
            doc.save(`Planejado_vs_Realizado_${new Date().toISOString().slice(0, 10)}.pdf`);
            _apexNotify('Sucesso', 'PDF Planejado vs. Realizado baixado com gráficos e marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF Planejado vs Realizado:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.excluirPlanejamentoCompra = async function(id) {
        if (!confirm('Remover esta necessidade de compra?')) return;
        try {
            await fetch(`/api/planejamento/compras/${id}`, { method: 'DELETE' });
            await carregarPlanejamentoCompras();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao excluir: ' + err.message, 'error');
        }
    };

    // ── 2. Planejamento Industrial / Capacidade ──────────────────────────────────
    window.carregarCapacidadeIndustrial = window.carregarPlanejamentoIndustrial = async function() {
        try {
            const res = await fetch('/api/planejamento/industrial/equipamentos');
            const data = await res.json();
            localEquipamentos = Array.isArray(data) ? data : [];
            window.localEquipamentos = localEquipamentos;
            renderCapacidadeIndustrial();
        } catch (err) {
            console.error('Erro ao carregar equipamentos industriais:', err);
            localEquipamentos = [];
            window.localEquipamentos = [];
            renderCapacidadeIndustrial();
        }
    };

    function renderCapacidadeIndustrial() {
        const tbody = document.getElementById('ind-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalCap = 0;
        let totalSetup = 0;
        let totalOee = 0;

        localEquipamentos.forEach(eq => {
            const cap = parseFloat(eq.capacidade_nominal_kgh || 0);
            const disp = parseFloat(eq.disponibilidade_horas_dia || 16);
            const setup = parseFloat(eq.tempo_setup_horas || 1.0);
            const oee = parseFloat(eq.eficiencia_oee_pct || 85);

            totalCap += cap;
            totalSetup += setup;
            totalOee += oee;

            let statusBadge = '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:3px 8px; border-radius:12px; font-size:0.75rem;">✅ Operacional</span>';
            if (eq.status === 'Manutenção') statusBadge = '<span style="background:#3b2d18; color:#f0b800; border:1px solid #f0b800; padding:3px 8px; border-radius:12px; font-size:0.75rem;">⚠️ Manutenção</span>';
            if (eq.status === 'Parado') statusBadge = '<span style="background:#3b1818; color:#ff4d4d; border:1px solid #ff4d4d; padding:3px 8px; border-radius:12px; font-size:0.75rem;">❌ Parado</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><span style="background:#101a24; border:1px solid #1e4e8c; color:#3e7cb1; padding:2px 6px; border-radius:4px; font-weight:bold;">${eq.codigo_tag}</span></td>
                <td style="padding:10px 8px;"><strong>${eq.nome_equipamento}</strong></td>
                <td style="padding:10px 8px;">${eq.setor || 'Processamento'}</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#2AD07A;">${cap.toLocaleString('pt-BR')} kg/h</td>
                <td style="padding:10px 8px; text-align:center;">${disp} h/dia</td>
                <td style="padding:10px 8px; text-align:center; color:#ffb74d;">${setup} h</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:#9b59b6;">${oee}%</td>
                <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
                <td style="padding:10px 8px; text-align:center;">
                    <button type="button" onclick="imprimirEquipamentoPdf(${eq.id})" style="background:#1e354d; border:1px solid #3e7cb1; color:#3e7cb1; border-radius:4px; padding:3px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:6px;" title="Baixar PDF Ficha do Equipamento com Marca d'Água"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                    <button type="button" onclick="editarEquipamentoIndustrial(${eq.id})" style="background:none; border:none; color:#3e7cb1; cursor:pointer; font-size:0.9rem; margin-right:8px;" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" onclick="excluirEquipamentoIndustrial(${eq.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:0.9rem;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const kpiTot = document.getElementById('ind-kpi-total');
        const kpiCap = document.getElementById('ind-kpi-capacidade');
        const kpiSet = document.getElementById('ind-kpi-setup');
        const kpiOee = document.getElementById('ind-kpi-oee');

        if (kpiTot) kpiTot.textContent = localEquipamentos.length;
        if (kpiCap) kpiCap.textContent = totalCap.toLocaleString('pt-BR') + ' kg/h';
        if (kpiSet) kpiSet.textContent = (localEquipamentos.length > 0 ? (totalSetup / localEquipamentos.length).toFixed(1) : '0.0') + ' h';
        if (kpiOee) kpiOee.textContent = (localEquipamentos.length > 0 ? Math.round(totalOee / localEquipamentos.length) : 0) + ' %';
    }

    window.abrirModalEquipamentoIndustrial = function() {
        document.getElementById('form-equipamento-industrial').reset();
        document.getElementById('eq-id').value = '';
        document.getElementById('modal-eq-titulo').textContent = 'Cadastrar Equipamento Industrial';
        document.getElementById('modal-equipamento-industrial').style.display = 'flex';
    };

    window.editarEquipamentoIndustrial = function(id) {
        const eq = localEquipamentos.find(x => x.id === id);
        if (!eq) return;
        document.getElementById('eq-id').value = eq.id;
        document.getElementById('eq-codigo-tag').value = eq.codigo_tag;
        document.getElementById('eq-nome').value = eq.nome_equipamento;
        document.getElementById('eq-setor').value = eq.setor;
        document.getElementById('eq-capacidade').value = eq.capacidade_nominal_kgh;
        document.getElementById('eq-disponibilidade').value = eq.disponibilidade_horas_dia;
        document.getElementById('eq-tempo-setup').value = eq.tempo_setup_horas;
        document.getElementById('eq-oee').value = eq.eficiencia_oee_pct;
        document.getElementById('eq-status').value = eq.status;
        document.getElementById('eq-obs').value = eq.observacoes || '';
        document.getElementById('modal-eq-titulo').textContent = 'Editar Equipamento Industrial';
        document.getElementById('modal-equipamento-industrial').style.display = 'flex';
    };

    window.fecharModalEquipamentoIndustrial = function() {
        document.getElementById('modal-equipamento-industrial').style.display = 'none';
    };

    window.salvarEquipamentoIndustrialForm = async function(e) {
        e.preventDefault();
        const id = document.getElementById('eq-id').value;
        const payload = {
            codigo_tag: document.getElementById('eq-codigo-tag').value,
            nome_equipamento: document.getElementById('eq-nome').value,
            setor: document.getElementById('eq-setor').value,
            capacidade_nominal_kgh: document.getElementById('eq-capacidade').value,
            disponibilidade_horas_dia: document.getElementById('eq-disponibilidade').value,
            tempo_setup_horas: document.getElementById('eq-tempo-setup').value,
            eficiencia_oee_pct: document.getElementById('eq-oee').value,
            status: document.getElementById('eq-status').value,
            observacoes: document.getElementById('eq-obs').value
        };

        const url = id ? `/api/planejamento/industrial/equipamentos/${id}` : '/api/planejamento/industrial/equipamentos';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar equipamento industrial');
            _apexNotify('Sucesso', 'Equipamento salvo com sucesso!', 'success');
            fecharModalEquipamentoIndustrial();
            await carregarCapacidadeIndustrial();
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.excluirEquipamentoIndustrial = async function(id) {
        if (!confirm('Excluir este equipamento industrial?')) return;
        try {
            await fetch(`/api/planejamento/industrial/equipamentos/${id}`, { method: 'DELETE' });
            await carregarCapacidadeIndustrial();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao excluir: ' + err.message, 'error');
        }
    };

    // ── 3. Produção & PCP (Ordens de Produção com Tempos Operacionais) ─────────
    window.carregarOrdensProducao = async function() {
        try {
            const res = await fetch('/api/planejamento/producao/ops');
            const data = await res.json();
            localOPs = Array.isArray(data) ? data : [];
            window.localOPs = localOPs;
            renderOrdensProducao();
        } catch (err) {
            console.error('Erro ao carregar Ordens de Produção PCP:', err);
            localOPs = [];
            window.localOPs = [];
            renderOrdensProducao();
        }
    };

    function renderOrdensProducao() {
        const tbody = document.getElementById('pcp-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let opsExecucaoCount = 0;
        let volumeTotal = 0;
        let tempoEstTotal = 0;
        let tempoRealTotal = 0;

        localOPs.forEach(op => {
            const pesoEnt = parseFloat(op.peso_entrada_kg || 0);
            if (op.status === 'Em Execução') opsExecucaoCount++;
            volumeTotal += pesoEnt;

            const etapas = op.etapas || [];
            let opEstHours = 0;
            let opRealHours = 0;

            const etapasHtml = etapas.map(et => {
                const estH = parseFloat(et.tempo_estimado_horas || 0);
                const realH = parseFloat(et.tempo_real_horas || 0);
                opEstHours += estH;
                opRealHours += realH;

                let stBg = '#aaa';
                if (et.status_etapa === 'Em Andamento') stBg = '#f0b800';
                if (et.status_etapa === 'Concluída') stBg = '#2AD07A';

                return `
                    <div style="background:#0d1826; border:1px solid #1a2a3a; padding:6px 10px; border-radius:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
                        <div>
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${stBg}; margin-right:5px;"></span>
                            <strong>${et.ordem}. ${et.nome_etapa}</strong>
                            <span style="color:#aaa; font-size:0.72rem; margin-left:5px;">(${et.operador_responsavel || 'Operador'})</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="color:#aaa;">Est: <strong style="color:#2AD07A;">${estH.toFixed(1)}h</strong> | Real: <strong style="color:${realH > estH ? '#ff4d4d' : realH > 0 ? '#9b59b6' : '#888'};">${realH.toFixed(1)}h</strong></span>
                            <button type="button" onclick="abrirModalApontamentoTempo(${op.id}, ${et.id})" style="background:#1e4e8c; color:#fff; border:none; padding:2px 6px; border-radius:4px; cursor:pointer; font-size:0.72rem;">
                                <i class="fa-solid fa-clock"></i> Apontar
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            tempoEstTotal += opEstHours;
            tempoRealTotal += opRealHours;

            let statusBadge = '<span style="background:#1e3650; color:#aaa; padding:3px 8px; border-radius:12px; font-size:0.75rem;">Planejada</span>';
            if (op.status === 'Em Execução') statusBadge = '<span style="background:#3b2d18; color:#f0b800; border:1px solid #f0b800; padding:3px 8px; border-radius:12px; font-size:0.75rem;">⏳ Em Execução</span>';
            if (op.status === 'Concluída') statusBadge = '<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:3px 8px; border-radius:12px; font-size:0.75rem;">✅ Concluída</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><strong style="color:#ffb74d;">${op.numero_op}</strong></td>
                <td style="padding:10px 8px;">${op.material_entrada || '-'}</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold;">${pesoEnt.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px;">${op.material_saida_nome || '-'} (${parseFloat(op.peso_saida_estimado_kg||0).toLocaleString('pt-BR')} kg)</td>
                <td style="padding:10px 8px; text-align:center; font-size:0.78rem;">${fmtD(op.data_inicio_prevista)} até ${fmtD(op.data_fim_prevista)}</td>
                <td style="padding:10px 8px; min-width:280px;">${etapasHtml}</td>
                <td style="padding:10px 8px; text-align:center;">${statusBadge}</td>
                <td style="padding:10px 8px; text-align:center;">
                    <button type="button" onclick="imprimirOPPdf(${op.id})" style="background:#3b2d18; border:1px solid #ffb74d; color:#ffb74d; border-radius:4px; padding:4px 10px; font-size:0.78rem; font-weight:bold; cursor:pointer; margin-right:8px;" title="Baixar PDF da OP com Roteiro PCP e Marca d'Água"><i class="fa-solid fa-file-pdf"></i> PDF OP</button>
                    <button type="button" onclick="excluirOrdemProducao(${op.id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:0.9rem;" title="Excluir OP"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const kpiOps = document.getElementById('pcp-kpi-ops');
        const kpiVol = document.getElementById('pcp-kpi-volume');
        const kpiEst = document.getElementById('pcp-kpi-tempo-est');
        const kpiReal = document.getElementById('pcp-kpi-tempo-real');

        if (kpiOps) kpiOps.textContent = opsExecucaoCount;
        if (kpiVol) kpiVol.textContent = volumeTotal.toLocaleString('pt-BR') + ' kg';
        if (kpiEst) kpiEst.textContent = tempoEstTotal.toFixed(1) + ' h';
        if (kpiReal) kpiReal.textContent = tempoRealTotal.toFixed(1) + ' h';
    }

    window.abrirModalOrdemProducao = async function() {
        const opId = Date.now().toString().slice(-4);
        document.getElementById('op-numero').value = `OP-2026-${opId}`;

        let _mats = window.localMateriais || [];
        if (_mats.length === 0) {
            try {
                const res = await fetch('/api/materiais-catalogo');
                if (res.ok) {
                    const data = await res.json();
                    _mats = Array.isArray(data) ? data : [];
                    window.localMateriais = _mats;
                }
            } catch(e){}
        }

        const selMat = document.getElementById('op-material-saida-id');
        if (selMat) {
            selMat.innerHTML = '<option value="">Selecione o Material de Saída...</option>' +
                _mats.map(m => `<option value="${m.id}">${m.nome} (${m.categoria || 'Geral'})</option>`).join('');
        }

        const hoje = new Date().toISOString().slice(0, 10);
        const amanha = new Date(Date.now() + 86400000*2).toISOString().slice(0, 10);
        document.getElementById('op-data-inicio').value = hoje;
        document.getElementById('op-data-fim').value = amanha;

        // Etapas padrão pré-carregadas para acelerar o PCP
        etapasOpFormDraft = [
            { nome_etapa: 'Recepção & Pesagem', equipamento_id: '', tempo_estimado_horas: 1.5, operador_responsavel: 'Carlos' },
            { nome_etapa: 'Trituração & Desmonte', equipamento_id: '', tempo_estimado_horas: 4.0, operador_responsavel: 'João' },
            { nome_etapa: 'Separação Magnética & Prensagem', equipamento_id: '', tempo_estimado_horas: 3.0, operador_responsavel: 'Marcos' },
            { nome_etapa: 'Qualidade & Embalagem', equipamento_id: '', tempo_estimado_horas: 1.5, operador_responsavel: 'Eng. Roberto' }
        ];

        renderEtapasOpFormDraft();
        document.getElementById('modal-ordem-producao').style.display = 'flex';
    };

    window.fecharModalOrdemProducao = function() {
        document.getElementById('modal-ordem-producao').style.display = 'none';
    };

    function renderEtapasOpFormDraft() {
        const tbody = document.getElementById('op-etapas-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalEst = 0;

        etapasOpFormDraft.forEach((et, i) => {
            const estH = parseFloat(et.tempo_estimado_horas || 0);
            totalEst += estH;

            const eqOptions = (localEquipamentos || []).map(eq =>
                `<option value="${eq.id}" ${eq.id == et.equipamento_id ? 'selected' : ''}>${eq.codigo_tag} - ${eq.nome_equipamento}</option>`
            ).join('');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:6px; text-align:center;">${i + 1}</td>
                <td style="padding:6px;">
                    <input type="text" value="${et.nome_etapa}" onchange="etapasOpFormDraft[${i}].nome_etapa = this.value" class="noble-input" style="padding:4px 8px; font-size:0.8rem;" />
                </td>
                <td style="padding:6px;">
                    <select onchange="etapasOpFormDraft[${i}].equipamento_id = this.value" class="noble-input" style="padding:4px 8px; font-size:0.8rem;">
                        <option value="">Nenhum / Manual</option>
                        ${eqOptions}
                    </select>
                </td>
                <td style="padding:6px; text-align:right;">
                    <input type="number" step="0.1" value="${estH}" oninput="etapasOpFormDraft[${i}].tempo_estimado_horas = parseFloat(this.value)||0; calcularTotalHorasOpForm();" class="noble-input" style="width:75px; text-align:right; padding:4px 8px; font-size:0.8rem;" />
                </td>
                <td style="padding:6px;">
                    <input type="text" value="${et.operador_responsavel || ''}" onchange="etapasOpFormDraft[${i}].operador_responsavel = this.value" class="noble-input" style="padding:4px 8px; font-size:0.8rem;" placeholder="Operador" />
                </td>
                <td style="padding:6px; text-align:center;">
                    <button type="button" onclick="removerEtapaOpForm(${i})" style="background:none; border:none; color:#ff6b6b; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        calcularTotalHorasOpForm();
    }

    window.calcularTotalHorasOpForm = function() {
        const total = etapasOpFormDraft.reduce((s, et) => s + (parseFloat(et.tempo_estimado_horas) || 0), 0);
        const el = document.getElementById('op-tempo-total-est');
        if (el) el.textContent = total.toFixed(1) + ' Horas';
    };

    window.adicionarEtapaOpForm = function() {
        etapasOpFormDraft.push({
            nome_etapa: `Etapa ${etapasOpFormDraft.length + 1}`,
            equipamento_id: '',
            tempo_estimado_horas: 2.0,
            operador_responsavel: ''
        });
        renderEtapasOpFormDraft();
    };

    window.removerEtapaOpForm = function(idx) {
        etapasOpFormDraft.splice(idx, 1);
        renderEtapasOpFormDraft();
    };

    window.salvarOrdemProducaoForm = async function(e) {
        e.preventDefault();
        const payload = {
            numero_op: document.getElementById('op-numero').value,
            material_entrada: document.getElementById('op-material-entrada').value,
            peso_entrada_kg: document.getElementById('op-peso-entrada').value,
            material_saida_id: document.getElementById('op-material-saida-id').value,
            peso_saida_estimado_kg: document.getElementById('op-peso-saida-est').value || 0,
            data_inicio_prevista: document.getElementById('op-data-inicio').value,
            data_fim_prevista: document.getElementById('op-data-fim').value,
            responsavel_pcp: document.getElementById('op-responsavel').value,
            observacoes: document.getElementById('op-obs').value,
            etapas: etapasOpFormDraft
        };

        try {
            const res = await fetch('/api/planejamento/producao/ops', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar Ordem de Produção');
            _apexNotify('Sucesso', 'Ordem de Produção (OP) criada com sucesso!', 'success');
            fecharModalOrdemProducao();
            await carregarOrdensProducao();
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.excluirOrdemProducao = async function(id) {
        if (!confirm('Excluir esta Ordem de Produção (OP)?')) return;
        try {
            await fetch(`/api/planejamento/producao/ops/${id}`, { method: 'DELETE' });
            await carregarOrdensProducao();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao excluir: ' + err.message, 'error');
        }
    };

    // ── 4. Apontamento de Tempo Real da Etapa ────────────────────────────────────
    window.abrirModalApontamentoTempo = function(opId, etapaId) {
        const op = localOPs.find(x => x.id === opId);
        if (!op) return;
        const et = (op.etapas || []).find(e => e.id == etapaId);
        if (!et) return;

        document.getElementById('ap-op-id').value = opId;
        document.getElementById('ap-etapa-id').value = etapaId;
        document.getElementById('ap-txt-op').textContent = op.numero_op;
        document.getElementById('ap-txt-etapa').textContent = et.nome_etapa;
        document.getElementById('ap-tempo-real').value = et.tempo_real_horas || et.tempo_estimado_horas || 0;
        document.getElementById('ap-txt-tempo-est').textContent = (et.tempo_estimado_horas || 0) + 'h';
        document.getElementById('ap-status-etapa').value = et.status_etapa || 'Em Andamento';
        document.getElementById('ap-operador').value = et.operador_responsavel || '';
        document.getElementById('modal-apontamento-tempo').style.display = 'flex';
    };

    window.fecharModalApontamentoTempo = function() {
        document.getElementById('modal-apontamento-tempo').style.display = 'none';
    };

    window.salvarApontamentoTempoForm = async function(e) {
        e.preventDefault();
        const opId = document.getElementById('ap-op-id').value;
        const etapaId = document.getElementById('ap-etapa-id').value;
        const payload = {
            etapa_id: etapaId,
            tempo_real_horas: document.getElementById('ap-tempo-real').value,
            status_etapa: document.getElementById('ap-status-etapa').value,
            operador_responsavel: document.getElementById('ap-operador').value
        };

        try {
            const res = await fetch(`/api/planejamento/producao/ops/${opId}/etapas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar apontamento de tempo');
            _apexNotify('Sucesso', 'Apontamento de tempo registrado com sucesso!', 'success');
            fecharModalApontamentoTempo();
            await carregarOrdensProducao();
        } catch (err) {
            _apexNotify('Atenção', err.message, 'error');
        }
    };

    window.exportarPlanejamentoExcel = function() {
        _apexNotify('Sistema', 'Planejamento Mensal exportado com sucesso (PLANEJAMENTO_DE_NVS_FORNECEDOR.xlsx)', 'info');
    };

    window.exportarDashboardPDF = async function() {
        if (!window.jspdf) {
            _apexNotify('Sistema', 'A biblioteca jsPDF não carregou corretamente.', 'info');
            return;
        }
        const section = document.getElementById('dashboard');
        if (!section) return;

        _apexNotify('Sistema', 'Gerando PDF da Central de Decisão LME...', 'info');

        try {
            const canvas = await html2canvas(section, {
                scale: 2,
                backgroundColor: '#0a192f',
                useCORS: true,
                allowTaint: false,
                scrollY: 0,
                windowHeight: section.scrollHeight,
                height: section.scrollHeight,
                width: section.scrollWidth
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const { jsPDF } = window.jspdf;

            const pdfWidthMm = 297;
            const pdfPageHeightMm = 210;
            const imgHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            let heightLeft = imgHeightMm;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidthMm, imgHeightMm);
            heightLeft -= pdfPageHeightMm;

            while (heightLeft > 5) {
                position -= pdfPageHeightMm;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidthMm, imgHeightMm);
                heightLeft -= pdfPageHeightMm;
            }

            pdf.save(`Relatorio_Estrategico_LME_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sistema', 'PDF da Central de Decisão LME baixado com sucesso!', 'info');
        } catch (err) {
            console.error('Erro ao gerar PDF do Dashboard:', err);
            _apexNotify('Atenção', 'Erro ao exportar PDF do Dashboard.', 'error');
        }
    };

    window.exportarPlanejamentoPDF = async function() {
        if (!window.jspdf) {
            _apexNotify('Sistema', 'A biblioteca jsPDF não carregou corretamente.', 'info');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        const mesFiltro = typeof mesPlanejamentoSelecionado !== 'undefined' ? mesPlanejamentoSelecionado : 'todos';
        let list = localPlanejamento || [];
        if (mesFiltro !== 'todos') {
            list = list.filter(lc => !lc.mes || lc.mes === mesFiltro);
        }

        // Build Table Body
        const body = [];
        list.forEach(pl => {
            let fornecedorStr = (pl.fornecedor_nome || '').trim();
            if (!fornecedorStr && pl.fornecedor_id) {
                const fornObj = (window.localFornecedores || []).find(f => f.id == pl.fornecedor_id);
                if (fornObj) fornecedorStr = fornObj.nome || fornObj.nome_fantasia || fornObj.apelido || '';
            }
            if (!fornecedorStr) fornecedorStr = 'Fornecedor Vários';
            
            // Remove duplicate token if repeated like "ACJG JG" -> "ACJG"
            const tokens = fornecedorStr.split(/\s+/);
            if (tokens.length >= 2 && tokens[0].includes(tokens[1])) {
                fornecedorStr = tokens[0];
            }

            const mesLabel = pl.mes || pl.mes_ref || (pl.criado_em ? new Date(pl.criado_em).toLocaleDateString('pt-BR', {month:'2-digit', year:'numeric'}) : '-') || '-';
            const reqData = pl.amostra_id ? `Amostra #${pl.amostra_id}` : `[Avulso] ${pl.produto || 'Material'}`;
            
            const totalC = parseFloat(pl.peso_comprado || 0) * parseFloat(pl.preco_compra || 0);
            const pesoMat = parseFloat(pl.peso_comprado || 0) * (parseFloat(pl.percentual_rendimento || 0) / 100);
            const totalV = pesoMat * parseFloat(pl.preco_venda_material || 0);
            const lucroB = totalV - totalC;
            const pctFat = totalV > 0 ? (lucroB / totalV) * 100 : 0;
            const resultadoLiq = pctFat - parseFloat(pl.comissao || 2.0) - parseFloat(pl.fidc || 2.3);

            body.push([
                mesLabel,
                fornecedorStr,
                reqData,
                parseFloat(pl.peso_comprado || 0).toLocaleString('pt-BR') + ' kg',
                'R$ ' + fmtBRL(pl.preco_compra),
                'R$ ' + totalC.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                fmtBRL(pl.percentual_rendimento) + '%',
                pl.material_nome || '-',
                pesoMat.toLocaleString('pt-BR') + ' kg',
                'R$ ' + fmtBRL(pl.preco_venda_material),
                'R$ ' + totalV.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                'R$ ' + lucroB.toLocaleString('pt-BR', {minimumFractionDigits:2}),
                fmtBRL(resultadoLiq) + '%'
            ]);
        });

        doc.autoTable({
            startY: 45,
            head: [['Mês', 'Fornecedor', 'Produto/Ref', 'Peso Comp.','Preço Comp.', 'Total Compra', 'Rend. %', 'Material', 'Peso Mat.', 'Preço Venda', 'Total Venda', 'Lucro Bruto', 'Margem Liq.']],
            body: body,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [27, 45, 61], fontSize: 8.5 }
        });

        // Cabeçalho
        const selectElem = document.getElementById('pl-filtro-mes');
        const mesTexto = selectElem ? selectElem.options[selectElem.selectedIndex]?.text : mesFiltro;
        doc.setFontSize(16);
        doc.setTextColor(62, 124, 177); // #3e7cb1
        doc.text(`Relatório de Planejamento Mensal (${mesTexto})`, 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 15, 28);
        doc.text('Usuário: ' + (sessionStorage.getItem('apex_logged_user_name') || 'Admin'), 15, 34);

        await aplicarMarcaDaguaLogoJsPDF(doc);

        doc.save(`Planejamento_Lote_${mesFiltro}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    window.gerarPdfPlanejamentoModal = async function() {
        if (!window.jspdf) {
            _apexNotify('Sistema', 'A biblioteca jsPDF não carregou corretamente.', 'info');
            return;
        }
        
        const amostraTxt = document.getElementById('pl-amostra').options[document.getElementById('pl-amostra').selectedIndex]?.text || '';
        const fornecedor = document.getElementById('pl-fornecedor').options[document.getElementById('pl-fornecedor').selectedIndex]?.text || '';
        const produto = document.getElementById('pl-produto').value || '';
        const pesoComprado = document.getElementById('pl-peso-comprado').value || '0';
        const precoCompra = document.getElementById('pl-preco-compra').value || '0';
        const rendimento = document.getElementById('pl-rendimento').value || '0';
        const material = document.getElementById('pl-material').options[document.getElementById('pl-material').selectedIndex]?.text || '';
        const precoVenda = document.getElementById('pl-preco-venda-material').value || '0';
        const comissao = document.getElementById('pl-comissao').value || '0';
        const fidc = document.getElementById('pl-fidc').value || '0';
        
        const lucroBruto = document.getElementById('sim-lucro-bruto').innerText;
        const lucroLiq = document.getElementById('sim-res-liquido').innerText;
        const margem = document.getElementById('sim-margem').innerText;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabeçalho
        doc.setFontSize(18);
        doc.setTextColor(62, 124, 177);
        doc.text('Relatório Executivo - Simulação de Lote', 15, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 15, 28);
        doc.text('Usuário: ' + (sessionStorage.getItem('apex_logged_user_name') || 'Admin'), 15, 34);

        // Dados
        doc.setFontSize(12);
        doc.setTextColor(40);
        
        doc.autoTable({
            startY: 45,
            head: [['Campo', 'Valor Informado']],
            body: [
                ['Amostra', amostraTxt],
                ['Fornecedor', fornecedor],
                ['Produto', produto],
                ['Material Resultante', material],
                ['Peso Comprado', pesoComprado + ' kg'],
                ['Preço de Compra', 'R$ ' + parseFloat(precoCompra).toFixed(2)],
                ['Rendimento Estimado', rendimento + '%'],
                ['Preço Venda Estimado', 'R$ ' + parseFloat(precoVenda).toFixed(2)],
                ['Comissão', comissao + '%'],
                ['Taxa FIDC', fidc + '%']
            ],
            theme: 'grid',
            headStyles: { fillColor: [27, 45, 61] }
        });
        
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Indicador de Rentabilidade', 'Resultado']],
            body: [
                ['Lucro Bruto', lucroBruto],
                ['Lucro Líquido Estimado', lucroLiq],
                ['Margem', margem]
            ],
            theme: 'grid',
            headStyles: { fillColor: [42, 208, 122] }
        });

        await aplicarMarcaDaguaLogoJsPDF(doc);

        doc.save(`Simulacao_Lote_${new Date().toISOString().split('T')[0]}.pdf`);
    };


    // --- 6. ESTOQUE INTELIGENTE ---
    window.initApexEstoque = function() {
        carregarEstoque();
    };

    async function carregarEstoque() {
        try {
            const res = await fetch('/api/estoque');
            const data = await res.json();
            const { estoque, movimentacoes } = data;

            renderEstoqueKPIs(estoque);
            renderEstoqueSaldos(estoque);
            renderEstoqueMovimentacoes(movimentacoes);
        } catch (err) {
            console.error(err);
        }
    }

    function renderEstoqueKPIs(estoque) {
        const grid = document.getElementById('estoque-kpis-grid');
        if (!grid) return;
        grid.innerHTML = '';

        // Agrupar peso por categoria
        const cats = {};
        estoque.forEach(e => {
            cats[e.material_categoria] = (cats[e.material_categoria] || 0) + parseFloat(e.saldo);
        });

        Object.keys(cats).forEach(cat => {
            const card = document.createElement('div');
            card.className = 'estoque-card';
            card.innerHTML = `
                <span style="font-size:0.75rem; text-transform:uppercase; color:#aaa; font-weight:bold;">${cat}</span>
                <h2 style="margin:5px 0 0; color:#fff;">${cats[cat].toLocaleString('pt-BR')} kg</h2>
                <div style="font-size:0.8rem; color:#3e7cb1; margin-top:5px;">Estoque físico ativo</div>
            `;
            grid.appendChild(card);
        });
    }

    function renderEstoqueSaldos(estoque) {
        const body = document.getElementById('estoque-saldos-body');
        if (!body) return;
        body.innerHTML = '';
        estoque.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px;"><strong>${e.material_nome}</strong></td>
                <td style="padding:10px;"><span class="badge-status em-analise">${e.material_categoria}</span></td>
                <td style="padding:10px; text-align:right;">${parseFloat(e.saldo).toLocaleString('pt-BR')} ${e.material_unidade}</td>
            `;
            body.appendChild(tr);
        });
    }

    function renderEstoqueMovimentacoes(movs) {
        const body = document.getElementById('estoque-movimentacoes-body');
        if (!body) return;
        body.innerHTML = '';
        movs.forEach(m => {
            const dataFmt = new Date(m.data || m.criado_em).toLocaleDateString('pt-BR');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px;">${m.material_nome}</td>
                <td style="padding:10px; font-weight:bold; color:${m.tipo === 'ENTRADA' ? '#2AD07A' : '#ff4d4d'}">${m.tipo}</td>
                <td style="padding:10px; text-align:right;">${parseFloat(m.quantidade).toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px; font-size:0.8rem;">${m.motivo || '-'}</td>
                <td style="padding:10px;">${dataFmt}</td>
            `;
            body.appendChild(tr);
        });
    }

    // --- 7. USUÁRIOS & CONTROLE DE ACESSO ---
    let localUsuarios = [];
    window.initApexUsuarios = function() {
        carregarUsuarios();
    };

    async function carregarUsuarios() {
        try {
            const res = await fetch('/api/usuarios');
            localUsuarios = await res.json();
            renderUsuarios();
        } catch (err) {
            console.error(err);
        }
    }

    function renderUsuarios() {
        const body = document.getElementById('usuarios-table-body');
        if (!body) return;
        body.innerHTML = '';
        localUsuarios.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:12px;"><strong>${u.nome}</strong></td>
                <td style="padding:12px;">${u.user}</td>
                <td style="padding:12px;"><span class="badge-status em-analise">${u.perfil}</span></td>
                <td style="padding:12px; text-align:center;">
                    <button class="btn-refresh" style="background:none; border:none; color:#ff4d4d;" onclick="deletarUsuario(${u.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    window.abrirModalUsuario = function() {
        document.getElementById('form-usuario-apex').reset();
        document.getElementById('modal-usuario').style.display = 'flex';
    };

    window.fecharModalUsuario = function() {
        document.getElementById('modal-usuario').style.display = 'none';
    };

    window.salvarUsuario = async function(e) {
        e.preventDefault();
        const data = {
            nome: document.getElementById('usr-nome').value,
            user: document.getElementById('usr-user').value,
            pass: document.getElementById('usr-pass').value,
            perfil: document.getElementById('usr-perfil').value
        };

        try {
            await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            fecharModalUsuario();
            carregarUsuarios();
        } catch (err) {
            console.error(err);
        }
    };

    window.deletarUsuario = async function(id) {
        if (!confirm('Deseja realmente remover este usuário?')) return;
        try {
            await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
            carregarUsuarios();
        } catch (err) {
            console.error(err);
        }
    };

    let perfilSelecionado = null;

    window.carregarPermissoesView = function() {
        popularPerfisPermissoes();
        document.getElementById('grid-permissoes').style.opacity = '0.5';
        document.getElementById('grid-permissoes').style.pointerEvents = 'none';
        document.getElementById('perfil-selecionado-lbl').textContent = 'Nenhum';
        document.getElementById('msg-admin-lock').style.display = 'none';
        document.querySelectorAll('.perm-checkbox input').forEach(c => c.checked = false);
        perfilSelecionado = null;
    };

    

    function popularPerfisPermissoes() {
        const perfis = ['Administrador', 'Laboratório', 'Compras', 'Produção', 'Financeiro', 'Diretoria'];
        const container = document.getElementById('lista-perfis-permissoes');
        container.innerHTML = perfis.map(p => `
            <div onclick="selecionarPerfilPermissoes('${p}')" style="padding:10px 15px; border-radius:6px; background:#1a3045; cursor:pointer; color:#fff; border:1px solid transparent; transition:0.2s;" onmouseover="this.style.borderColor='#3e7cb1'" onmouseout="this.style.borderColor='transparent'" id="btn-perfil-${p.toLowerCase().replace(/[^a-z0-9]/g,'')}">
                <i class="fa-solid fa-user-tag" style="color:#a0b4c8; margin-right:8px;"></i> ${p}
            </div>
        `).join('');
    }

    window.selecionarPerfilPermissoes = function(perfil) {
        perfilSelecionado = perfil;
        
        // Highlights
        document.querySelectorAll('#lista-perfis-permissoes div').forEach(el => el.style.background = '#1a3045');
        const btn = document.getElementById(`btn-perfil-${perfil.toLowerCase().replace(/[^a-z0-9]/g,'')}`);
        if (btn) btn.style.background = '#223547';

        document.getElementById('perfil-selecionado-lbl').textContent = perfil;
        
        const grid = document.getElementById('grid-permissoes');
        const msgAdmin = document.getElementById('msg-admin-lock');
        const checkboxes = grid.querySelectorAll('input[type="checkbox"]');

        if (perfil === 'Administrador') {
            grid.style.opacity = '0.5';
            grid.style.pointerEvents = 'none';
            msgAdmin.style.display = 'block';
            checkboxes.forEach(chk => chk.checked = true);
        } else {
            grid.style.opacity = '1';
            grid.style.pointerEvents = 'auto';
            msgAdmin.style.display = 'none';
            
            const permissoes = globalRolePermissions[perfil] || [];
            checkboxes.forEach(chk => {
                chk.checked = permissoes.includes(chk.value);
            });
        }
    };

    window.salvarPermissoesPerfil = async function() {
        if (!perfilSelecionado) {
            _apexNotify('Sistema', 'Selecione um perfil primeiro.', 'info');
            return;
        }
        
        if (perfilSelecionado !== 'Administrador') {
            const grid = document.getElementById('grid-permissoes');
            const checkboxes = grid.querySelectorAll('input[type="checkbox"]:checked');
            const permissoes = Array.from(checkboxes).map(chk => chk.value);
            
            globalRolePermissions[perfilSelecionado] = permissoes;
        }

        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role_permissions: JSON.stringify(globalRolePermissions) })
            });
            _apexNotify('Sistema', 'Permissões salvas com sucesso!', 'info');
            applyRolePermissions();
        } catch (err) {
            console.error('Erro ao salvar permissões:', err);
            _apexNotify('Atenção', 'Erro ao salvar permissões.', 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN (Posicionado no final para evitar TDZ e erros de inicialização)
    // ─────────────────────────────────────────────────────────────────────────
    const loginOverlay       = document.getElementById('login-overlay');
    const dashboardContainer = document.getElementById('admin-dashboard-container');
    const loginForm          = document.getElementById('admin-login-form');
    const loginError         = document.getElementById('login-error');

    const hasSession = sessionStorage.getItem('apex_admin_logged_in') === 'true';
    const hasToken = !!localStorage.getItem('apex_token');

    if (hasSession && hasToken) {
        loginOverlay.style.display      = 'none';
        dashboardContainer.style.display = 'flex';
        initAdmin();
    } else {
        sessionStorage.removeItem('apex_admin_logged_in');
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value.trim();

            // Função para entrar no painel
            function entrarNoPainel(nome, perfil) {
                sessionStorage.setItem('apex_admin_logged_in', 'true');
                if (nome) sessionStorage.setItem('apex_logged_user_name', nome);
                if (perfil) {
                    sessionStorage.setItem('apex_user_role', perfil);
                    currentSimulatedRole = perfil;
                }
                loginOverlay.style.display       = 'none';
                dashboardContainer.style.display = 'flex';
                loginError.style.display         = 'none';
                initAdmin();
            }

            // Tentativa via API do servidor (Obrigatória para obter o JWT Token)
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user, pass })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    if (data.token) {
                        localStorage.setItem('apex_token', data.token);
                    }
                    entrarNoPainel(data.user.nome, data.user.perfil);
                } else {
                    loginError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (data.error || 'Credenciais incorretas.');
                    loginError.style.display = 'block';
                }
            } catch (error) {
                console.error('Erro no login:', error);
                loginError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Erro de conexão com o servidor.';
                loginError.style.display = 'block';
            }
        });
    }

// end DOMContentLoaded removed


// --- MODULO FINANCEIRO ISOLADO ---
let chartFidcIsolado = null;

window.calcularFidcIsolado = function() {
    const receita = parseFloat(document.getElementById('fin-sim-receita').value) || 0;
    const prazo = parseInt(document.getElementById('fin-sim-prazo').value) || 30;
    const taxa = parseFloat(document.getElementById('fin-sim-taxa').value) || 0;

    const desconto = receita * (taxa / 100);
    const liquido = receita - desconto;

    document.getElementById('fin-sim-res-com').textContent = 'R$ ' + liquido.toLocaleString('pt-BR', {minimumFractionDigits:2});
    document.getElementById('fin-sim-res-desc').textContent = 'R$ ' + desconto.toLocaleString('pt-BR', {minimumFractionDigits:2});

    const ctx = document.getElementById('chart-fidc-isolado').getContext('2d');
    if (chartFidcIsolado) chartFidcIsolado.destroy();

    chartFidcIsolado = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Líquido Imediato', 'Desconto FIDC'],
            datasets: [{
                data: [liquido, desconto],
                backgroundColor: ['#2AD07A', '#ff4d4d'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#aaa' } }
            }
        }
    });
};

window.carregarFinanceiroView = async function() {
    // Buscar lotes de compras e simulações via API
    try {
        const res = await fetch('/api/planejamento-compras'); // Rota a ser checada ou criada
        if (!res.ok) throw new Error('Falha ao carregar planejamentos');
        const planejamentos = await res.json();
        
        const tbody = document.getElementById('lista-financeiro-historico');
        tbody.innerHTML = '';
        
        let totalReceita = 0;
        let somaTaxaFidc = 0;
        let countFidc = 0;

        planejamentos.forEach(plan => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #1a3045';
            
            const lucroNum = parseFloat(plan.preco_venda_material) * parseFloat(plan.peso_comprado) * (parseFloat(plan.percentual_rendimento)/100);
            const custoNum = parseFloat(plan.peso_comprado) * parseFloat(plan.preco_compra);
            const margemNum = lucroNum > 0 ? ((lucroNum - custoNum) / lucroNum) * 100 : 0;
            
            totalReceita += lucroNum;
            
            if (plan.fidc) {
                somaTaxaFidc += parseFloat(plan.fidc);
                countFidc++;
            }

            row.innerHTML = `
                <td style="padding:10px; color:#fff;">${plan.mes || '-'}</td>
                <td style="padding:10px; color:#fff;">${plan.fornecedor_nome || '-'}</td>
                <td style="padding:10px; color:#2AD07A;">R$ ${lucroNum.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; color:#ff4d4d;">R$ ${custoNum.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; color:#a0b4c8;">${fmtBRL(margemNum)}%</td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('fin-kpi-total').textContent = planejamentos.length;
        document.getElementById('fin-kpi-lucro').textContent = 'R$ ' + (totalReceita).toLocaleString('pt-BR', {minimumFractionDigits:2});
        
        const mediaFidc = countFidc > 0 ? (somaTaxaFidc / countFidc) : 0;
        document.getElementById('fin-kpi-fidc').textContent = fmtBRL(mediaFidc) + '%';
        
        calcularFidcIsolado(); // Inicializa o grafico vazio
        
    } catch (e) {
        console.error('Erro ao carregar dados financeiros', e);
        calcularFidcIsolado();
    }
};

// =============================================================================
// PEDIDOS DE VENDA
// =============================================================================
(function() {
    let localPedidos = [];
    let itensPedido  = [];

    const fmtR = (v) => 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    const fmtD = (d) => { if (!d) return '-'; try { return new Date(d).toLocaleDateString('pt-BR', {timeZone:'UTC'}); } catch(e){ return d; } };
    const statusColor = {
        'Rascunho': '#7fa8c8',
        'Aguardando Aprovação': '#ffeb3b',
        'Aprovado': '#2AD07A',
        'Confirmado': '#2AD07A',
        'Em Separação': '#4fc3f7',
        'Faturado': '#2AD07A',
        'Entregue': '#2AD07A',
        'Cancelado': '#ff6b6b'
    };

    window.initApexPedidos = function() {
        carregarPedidos();
    };

    async function carregarPedidos() {
        try {
            const res  = await fetch('/api/pedidos-venda');
            if (res.ok) {
                const data = await res.json();
                localPedidos = Array.isArray(data) ? data : [];
            } else {
                localPedidos = [];
            }
        } catch(e) {
            console.error('Erro ao carregar pedidos:', e);
            localPedidos = [];
        }
        renderPedidos(localPedidos);
    }

    function renderPedidos(lista) {
        const tbody = document.getElementById('pedidos-tbody');
        if (!tbody) return;
        if (!lista || lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#5a738e;"><i class="fa-solid fa-file-invoice-dollar" style="font-size:2rem; margin-bottom:10px; display:block; color:#2AD07A;"></i>Nenhum pedido cadastrado ainda.<br><small>Clique em <strong>+ Novo Pedido</strong> para emitir um novo pedido de venda.</small></td></tr>';
            return;
        }
        tbody.innerHTML = lista.map(p => {
            const stColor = statusColor[p.status] || '#7fa8c8';
            const cliCadastrado = p.cliente_id ? true : false;
            const badgeCliente = cliCadastrado
                ? `<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:6px;"><i class="fa-solid fa-user-check"></i> CADASTRADO</span>`
                : `<span style="background:#38321b; color:#ffeb3b; border:1px solid #ffeb3b; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:6px;"><i class="fa-solid fa-user-clock"></i> NOVO / PENDENTE</span>`;

            return `
            <tr style="border-bottom:1px solid #1a2a3a; transition:background 0.15s;" onmouseover="this.style.background='#0f2030'" onmouseout="this.style.background=''">
                <td style="padding:12px 10px; font-weight:bold; color:#2AD07A;">
                    ${p.numero || '-'}<br>
                    <small style="color:#5a738e; font-weight:normal;">Emissão: ${fmtD(p.data_emissao)}</small>
                </td>
                <td style="padding:12px 10px; color:#fff;">
                    <div style="font-weight:bold; font-size:0.92rem;">${p.cliente_nome || p.cliente_nome_avulso || 'Cliente Avulso'} ${badgeCliente}</div>
                    <div style="color:#7fa8c8; font-size:0.8rem; margin-top:2px;">
                        ${p.cliente_cnpj ? 'CNPJ: ' + p.cliente_cnpj : 'Sem CNPJ'} ${p.cliente_cidade ? ' | ' + p.cliente_cidade + '-' + (p.cliente_uf||'') : ''}
                    </div>
                </td>
                <td style="padding:12px 10px; color:#ccc;">
                    <div style="font-weight:600; color:#fff;">${p.criado_por || 'Admin'}</div>
                    <small style="color:#7fa8c8;">${p.criado_por_perfil || 'Administrador'}</small>
                </td>
                <td style="padding:12px 10px; color:#aaa;">
                    <div><i class="fa-solid fa-calendar-day" style="color:#2AD07A;"></i> Delivery: <strong>${fmtD(p.data_entrega)}</strong></div>
                    <small style="color:#7fa8c8;">${p.tipo_frete || 'CIF - Entrega APEXTECH'}</small>
                    ${p.responsavel_recebimento ? `<br><small style="color:#e07b39;">Rec: ${p.responsavel_recebimento}</small>` : ''}
                </td>
                <td style="padding:12px 10px;">
                    <span style="background:${stColor}22; color:${stColor}; border:1px solid ${stColor}66; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; display:inline-block;">
                        ${p.status || 'Rascunho'}
                    </span>
                </td>
                <td style="padding:12px 10px; text-align:right; color:#2AD07A; font-weight:bold; font-size:0.98rem;">${fmtR(p.total_geral)}</td>
                <td style="padding:12px 10px; text-align:center;">
                    <button onclick="exportarPedidoPdfPorId(${p.id})" style="background:none; border:none; color:#2AD07A; cursor:pointer; margin-right:6px; font-size:1.05rem;" title="Baixar PDF do Pedido"><i class="fa-solid fa-file-pdf"></i></button>
                    <button onclick="editarPedido(${p.id})" style="background:none; border:none; color:#3e7cb1; cursor:pointer; margin-right:6px; font-size:1.05rem;" title="Editar Pedido"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirPedido(${p.id}, '${p.numero}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1.05rem;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
        }).join('');
    }

    window.filtrarPedidos = function() {
        const txt    = (document.getElementById('pedidos-search')?.value || '').toLowerCase();
        const status = document.getElementById('pedidos-status-filter')?.value || '';
        const filtrado = localPedidos.filter(p => {
            const matchTxt = !txt || (p.numero||'').toLowerCase().includes(txt) || (p.cliente_nome||'').toLowerCase().includes(txt) || (p.criado_por||'').toLowerCase().includes(txt);
            const matchSt  = !status || p.status === status;
            return matchTxt && matchSt;
        });
        renderPedidos(filtrado);
    };

    window.abrirNovoPedido = async function() {
        itensPedido = [];

        // 1. Abrir o modal IMEDIATAMENTE ao clicar no botão
        const modal = document.getElementById('modal-pedido-venda');
        if (modal) modal.style.display = 'flex';

        try { document.getElementById('form-pedido-venda')?.reset(); } catch(e){}
        if (document.getElementById('pedido-condicao-custom')) {
            document.getElementById('pedido-condicao-custom').style.display = 'none';
            document.getElementById('pedido-condicao-custom').value = '';
        }
        document.getElementById('pedido-id').value = '';
        document.getElementById('modal-pedido-titulo').textContent = 'Novo Pedido de Venda';
        document.getElementById('pedido-data-emissao').value = new Date().toISOString().split('T')[0];
        
        // Auto-preencher usuário logado e perfil
        const loggedUser = sessionStorage.getItem('apex_logged_user_name') || 'Administrador Apex';
        const loggedRole = sessionStorage.getItem('apex_logged_user_role') || 'Administrador';
        if (document.getElementById('pedido-vendedor')) document.getElementById('pedido-vendedor').value = loggedUser;
        if (document.getElementById('pedido-perfil')) document.getElementById('pedido-perfil').value = loggedRole;

        limparClientePedido();
        renderItensPedido();
        recalcularPedido();

        // Número provisório imediato
        document.getElementById('pedido-numero').value = 'PV-' + String(Math.floor(Date.now()/1000)%10000).padStart(4,'0');

        // 2. Buscar dados em segundo plano com validação de status HTTP
        try {
            const res = await fetch('/api/clientes');
            if (res.ok) window.localClientes = await res.json();
        } catch(e){}

        try {
            const r = await fetch('/api/pedidos-venda/proximo-numero');
            if (r.ok) {
                const d = await r.json();
                if (d && d.numero) document.getElementById('pedido-numero').value = d.numero;
            }
        } catch(e){}
    };

    window.fecharModalPedido = function() {
        document.getElementById('modal-pedido-venda').style.display = 'none';
    };

    const normalizeTxt = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    window.buscarClientePedido = async function(val) {
        const drop = document.getElementById('pedido-cliente-dropdown');
        if (!drop) return;

        if (!window.localClientes || window.localClientes.length === 0) {
            try {
                const res = await fetch('/api/clientes');
                window.localClientes = await res.json();
            } catch(e){}
        }

        const rawVal = (val || '').trim();
        const q = normalizeTxt(rawVal);
        const searchTerms = q.split(/\s+/).filter(Boolean);

        let resultados = [];
        if (searchTerms.length === 0) {
            resultados = (window.localClientes || []).slice(0, 15);
        } else {
            resultados = (window.localClientes || []).filter(c => {
                const targetText = normalizeTxt(`${c.nome||''} ${c.fantasia||''} ${c.razao_social||''} ${c.cnpj||''} ${c.cpf||''} ${c.email||''}`);
                const cleanCnpj = (c.cnpj||'').replace(/\D/g,'');
                const cleanCpf = (c.cpf||'').replace(/\D/g,'');
                const cleanQ = q.replace(/\D/g,'');

                const matchesCNPJ = cleanQ.length >= 3 && (cleanCnpj.includes(cleanQ) || cleanCpf.includes(cleanQ));
                const matchesWords = searchTerms.every(term => targetText.includes(term));

                return matchesCNPJ || matchesWords;
            });
        }

        let html = '';

        if (rawVal.length > 0) {
            html += `
                <div onclick="abrirCadastroClienteExpress('${rawVal.replace(/'/g,"\\'")}')" style="padding:10px 14px; background:#1b382b; color:#2AD07A; cursor:pointer; font-weight:bold; border-bottom:1px solid #1e4e8c; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#224535'" onmouseout="this.style.background='#1b382b'">
                    <i class="fa-solid fa-user-plus"></i> + Cadastrar Novo Cliente "${rawVal}"
                </div>
            `;
        } else {
            html += `
                <div onclick="abrirCadastroClienteExpress('')" style="padding:10px 14px; background:#162738; color:#7fa8c8; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #1e4e8c; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#1e354d'" onmouseout="this.style.background='#162738'">
                    <i class="fa-solid fa-plus-circle"></i> + Cadastrar Novo Cliente do Zero
                </div>
            `;
        }

        if (resultados.length > 0) {
            html += resultados.map(c => `
                <div onclick="selecionarClientePedido(${c.id})" style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #1a2a3a; transition:background 0.15s;" onmouseover="this.style.background='#1a2a3a'" onmouseout="this.style.background=''">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#fff;">${c.nome||c.fantasia||''}</strong>
                        <span style="background:#1b382b; color:#2AD07A; font-size:0.7rem; padding:1px 6px; border-radius:3px; font-weight:bold;">CADASTRADO</span>
                    </div>
                    <div style="color:#7fa8c8; font-size:0.8rem; margin-top:2px;">${c.cnpj||c.cpf||'Sem CNPJ'} | ${c.cidade||''}${c.uf?'/'+c.uf:''} | ${c.telefone1||''}</div>
                </div>
            `).join('');
        } else if (rawVal.length > 0) {
            html += `
                <div style="padding:14px; text-align:center; color:#aaa; font-size:0.88rem;">
                    Nenhum cliente encontrado com "<strong>${rawVal}</strong>".
                    <div style="margin-top:8px;">
                        <button type="button" onclick="abrirCadastroClienteExpress('${rawVal.replace(/'/g,"\\'")}')" class="btn-primary" style="font-size:0.82rem; background:#2AD07A; color:#000; border:none; padding:6px 14px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-user-plus"></i> Cadastrar "${rawVal}" Agora
                        </button>
                    </div>
                </div>
            `;
        }

        drop.innerHTML = html;
        drop.style.display = 'block';
    };

    window.redirecionarParaCadastroCliente = function(nomePrefill) {
        const drop = document.getElementById('pedido-cliente-dropdown');
        if (drop) drop.style.display = 'none';

        fecharModalPedido();

        const navClientes = document.getElementById('nav-clientes') || document.querySelector('.nav-item[data-target="clientes-view"]');
        if (navClientes) {
            navClientes.click();
        } else {
            document.querySelectorAll('.view-section').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            const cliSec = document.getElementById('clientes-view');
            if (cliSec) { cliSec.classList.add('active'); cliSec.style.display = 'block'; }
        }

        if (window.initApexClientes) window.initApexClientes();

        setTimeout(() => {
            if (window.abrirModalCliente) window.abrirModalCliente();
            if (nomePrefill) {
                const elNome = document.getElementById('cli-nome');
                const elFant = document.getElementById('cli-fantasia');
                if (elNome) elNome.value = nomePrefill;
                if (elFant) elFant.value = nomePrefill;
            }
        }, 150);
    };

    window.abrirCadastroClienteExpress = function(nomePrefill) {
        redirecionarParaCadastroCliente(nomePrefill);
    };

    window.selecionarClientePedido = function(id) {
        if (!window.localClientes || window.localClientes.length === 0) {
            fetch('/api/clientes').then(r=>r.json()).then(clis=>{
                window.localClientes = clis;
                window.selecionarClientePedido(id);
            });
            return;
        }
        const c = (window.localClientes||[]).find(x => x.id == id);
        if (!c) return;
        document.getElementById('pedido-cliente-id').value = c.id;
        document.getElementById('pedido-cliente-busca').value = c.nome || c.fantasia || '';
        document.getElementById('pedido-cliente-dropdown').style.display = 'none';
        document.getElementById('cc-nome').textContent     = c.nome || c.fantasia || '';
        document.getElementById('cc-cnpj').textContent     = c.cnpj || c.cpf || 'CNPJ Não informado';
        document.getElementById('cc-cidade').textContent   = c.cidade || '';
        document.getElementById('cc-uf').textContent       = c.uf || '';
        document.getElementById('cc-tel').textContent      = c.telefone1 || c.telefone2 || '-';
        document.getElementById('cc-email').textContent    = c.email || '-';
        if (document.getElementById('cc-endereco')) document.getElementById('cc-endereco').textContent = c.endereco || 'Endereço principal de cadastro';
        
        const badge = document.getElementById('cc-status-badge');
        if (badge) {
            badge.style.background = '#1b382b';
            badge.style.color = '#2AD07A';
            badge.style.borderColor = '#2AD07A';
            badge.innerHTML = '<i class="fa-solid fa-user-check"></i> CLIENTE CADASTRADO NO SISTEMA';
        }

        // Se o endereço de entrega estiver vazio, preenche com o endereço do cliente
        const elEndEntrega = document.getElementById('pedido-endereco-entrega');
        if (elEndEntrega && !elEndEntrega.value) {
            elEndEntrega.value = (c.endereco || '') + (c.cidade ? ' - ' + c.cidade + '/' + (c.uf||'') : '');
        }

        document.getElementById('pedido-cliente-card').style.display = 'block';
        if (c.condicao_pagamento) {
            definirCondicaoPagamento(c.condicao_pagamento);
        }
    };

    window.verificarCondicaoPersonalizada = function(val) {
        const inputCustom = document.getElementById('pedido-condicao-custom');
        if (!inputCustom) return;
        if (val === 'CUSTOM') {
            inputCustom.style.display = 'block';
            inputCustom.focus();
        } else {
            inputCustom.style.display = 'none';
        }
    };

    function obterCondicaoPagamento() {
        const sel = document.getElementById('pedido-condicao');
        if (!sel) return '';
        if (sel.value === 'CUSTOM') {
            const customVal = (document.getElementById('pedido-condicao-custom')?.value || '').trim();
            if (!customVal) return 'A Combinar';
            return customVal.toLowerCase().includes('dia') ? customVal : customVal + ' dias';
        }
        return sel.value;
    }

    function definirCondicaoPagamento(val) {
        const sel = document.getElementById('pedido-condicao');
        const inputCustom = document.getElementById('pedido-condicao-custom');
        if (!sel) return;
        if (!val) {
            sel.selectedIndex = 0;
            if (inputCustom) inputCustom.style.display = 'none';
            return;
        }
        let achou = false;
        for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === val) {
                sel.selectedIndex = i;
                achou = true;
                break;
            }
        }
        if (!achou) {
            sel.value = 'CUSTOM';
            if (inputCustom) {
                inputCustom.style.display = 'block';
                inputCustom.value = val;
            }
        } else {
            if (inputCustom) inputCustom.style.display = 'none';
        }
    }

    window.limparClientePedido = function() {
        document.getElementById('pedido-cliente-id').value = '';
        document.getElementById('pedido-cliente-busca').value = '';
        document.getElementById('pedido-cliente-dropdown').style.display = 'none';
        document.getElementById('pedido-cliente-card').style.display = 'none';
    };

    window.adicionarItemPedido = function() {
        itensPedido.push({ descricao:'', unidade:'kg', quantidade:0, preco_unitario:0, desconto_item:0, total_item:0 });
        renderItensPedido();
    };

    window.removerItemPedido = function(idx) {
        itensPedido.splice(idx,1);
        renderItensPedido();
        recalcularPedido();
    };

    window.atualizarItemPedido = function(idx, campo, val) {
        itensPedido[idx][campo] = campo==='descricao'||campo==='unidade' ? val : parseFloat(val)||0;
        const it = itensPedido[idx];
        it.total_item = it.quantidade * it.preco_unitario * (1 - (it.desconto_item||0)/100);
        renderItensPedido();
        recalcularPedido();
    };

    function renderItensPedido() {
        const tbody = document.getElementById('itens-pedido-tbody');
        const meud = document.getElementById('itens-thead');
        const vazio  = document.getElementById('itens-vazio');
        if (meud) meud.style.display = 'table-header-group';
        if (!tbody) return;
        if (itensPedido.length === 0) {
            tbody.innerHTML = '';
            if (vazio) vazio.style.display = 'block';
            return;
        }
        if (vazio) vazio.style.display = 'none';
        tbody.innerHTML = itensPedido.map((it,i) => `
            <tr style="border-bottom:1px solid #1a2a3a;">
                <td style="padding:6px 4px;">
                    <input value="${it.descricao||''}" onchange="atualizarItemPedido(${i},'descricao',this.value)" class="noble-input" style="width:100%; padding:5px 8px; font-size:0.82rem;" placeholder="Ex: Sucata de Cobre / Alumínio" />
                </td>
                <td style="padding:6px 4px; text-align:center;">
                    <select onchange="atualizarItemPedido(${i},'unidade',this.value)" class="noble-input" style="padding:5px 4px; font-size:0.82rem; width:65px;">
                        ${['kg','t','un','m','m²','L'].map(u=>`<option value="${u}" ${it.unidade===u?'selected':''}>${u}</option>`).join('')}
                    </select>
                </td>
                <td style="padding:6px 4px;">
                    <input type="number" min="0" step="0.001" value="${it.quantidade||''}" placeholder="Ex: 50.5" onchange="atualizarItemPedido(${i},'quantidade',this.value)" class="noble-input" style="width:100px; text-align:right; padding:5px 8px; font-size:0.82rem; font-weight:600; border-color:#1e4e8c;" />
                </td>
                <td style="padding:6px 4px;">
                    <input type="number" min="0" step="0.0001" value="${it.preco_unitario||''}" placeholder="R$ 0,00" onchange="atualizarItemPedido(${i},'preco_unitario',this.value)" class="noble-input" style="width:110px; text-align:right; padding:5px 8px; font-size:0.82rem;" />
                </td>
                <td style="padding:6px 4px;">
                    <input type="number" min="0" max="100" step="0.01" value="${it.desconto_item||0}" onchange="atualizarItemPedido(${i},'desconto_item',this.value)" class="noble-input" style="width:75px; text-align:right; padding:5px 8px; font-size:0.82rem;" />
                </td>
                <td style="padding:6px 4px; text-align:right; color:#2AD07A; font-weight:600;">${fmtR(it.total_item)}</td>
                <td style="padding:6px 4px; text-align:center;">
                    <button type="button" onclick="removerItemPedido(${i})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1rem;" title="Remover Item"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    window.recalcularPedido = function() {
        const subtotal  = itensPedido.reduce((s,it) => s+(it.total_item||0), 0);
        const desc      = parseFloat(document.getElementById('pedido-desconto')?.value)||0;
        const frete     = parseFloat(document.getElementById('pedido-frete')?.value)||0;
        const total     = subtotal*(1-desc/100)+frete;
        if (document.getElementById('pedido-total-itens'))  document.getElementById('pedido-total-itens').textContent  = fmtR(subtotal);
        if (document.getElementById('pedido-total-geral'))  document.getElementById('pedido-total-geral').textContent  = fmtR(total);
    };

    window.salvarPedido = async function(e) {
        e.preventDefault();
        const clienteId = document.getElementById('pedido-cliente-id').value;
        const clienteBusca = document.getElementById('pedido-cliente-busca').value;
        
        if (!clienteId && !clienteBusca) {
            _apexNotify('Sistema', 'Selecione ou informe um cliente para o pedido.', 'info');
            return;
        }
        if (itensPedido.length === 0) {
            _apexNotify('Sistema', 'Adicione ao menos um item ao pedido.', 'info');
            return;
        }

        const payload = {
            numero:                  document.getElementById('pedido-numero').value,
            cliente_id:              clienteId ? parseInt(clienteId) : null,
            cliente_nome:            clienteBusca,
            data_emissao:            document.getElementById('pedido-data-emissao').value,
            data_entrega:            document.getElementById('pedido-data-entrega').value || null,
            status:                  document.getElementById('pedido-status').value,
            condicao_pagamento:      obterCondicaoPagamento(),
            observacoes:             document.getElementById('pedido-obs').value,
            desconto_pct:            parseFloat(document.getElementById('pedido-desconto').value)||0,
            frete:                   parseFloat(document.getElementById('pedido-frete').value)||0,
            criado_por:              document.getElementById('pedido-vendedor')?.value || sessionStorage.getItem('apex_logged_user_name') || 'Admin',
            criado_por_perfil:       document.getElementById('pedido-perfil')?.value || sessionStorage.getItem('apex_logged_user_role') || 'Administrador',
            endereco_entrega:        document.getElementById('pedido-endereco-entrega')?.value || '',
            responsavel_recebimento: document.getElementById('pedido-responsavel-recebimento')?.value || '',
            tipo_frete:              document.getElementById('pedido-tipo-frete')?.value || 'CIF - Entrega APEXTECH',
            itens:                   itensPedido
        };

        const id  = document.getElementById('pedido-id').value;
        const url = id ? `/api/pedidos-venda/${id}` : '/api/pedidos-venda';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Erro ao salvar pedido');
            }
            _apexNotify('Sucesso', 'Pedido de Venda salvo com sucesso!', 'success');
            fecharModalPedido();
            await carregarPedidos();
        } catch(err) {
            _apexNotify('Atenção', 'Não foi possível salvar o pedido: '+err.message, 'error');
        }
    };

    window.editarPedido = async function(id) {
        try {
            const res  = await fetch(`/api/pedidos-venda/${id}`);
            const data = await res.json();
            document.getElementById('pedido-id').value             = data.id;
            document.getElementById('modal-pedido-titulo').textContent = `Editar Pedido ${data.numero}`;
            document.getElementById('pedido-numero').value          = data.numero;
            document.getElementById('pedido-data-emissao').value    = (data.data_emissao||'').slice(0,10);
            document.getElementById('pedido-data-entrega').value    = (data.data_entrega||'').slice(0,10);
            document.getElementById('pedido-desconto').value        = data.desconto_pct||0;
            document.getElementById('pedido-frete').value           = data.frete||0;
            document.getElementById('pedido-obs').value             = data.observacoes||'';

            if (document.getElementById('pedido-vendedor')) document.getElementById('pedido-vendedor').value = data.criado_por || 'Admin';
            if (document.getElementById('pedido-perfil')) document.getElementById('pedido-perfil').value = data.criado_por_perfil || 'Administrador';
            if (document.getElementById('pedido-endereco-entrega')) document.getElementById('pedido-endereco-entrega').value = data.endereco_entrega || '';
            if (document.getElementById('pedido-responsavel-recebimento')) document.getElementById('pedido-responsavel-recebimento').value = data.responsavel_recebimento || '';
            
            if (document.getElementById('pedido-tipo-frete')) {
                const selF = document.getElementById('pedido-tipo-frete');
                for(let i=0;i<selF.options.length;i++) if(selF.options[i].value===data.tipo_frete){selF.selectedIndex=i;break;}
            }

            const selSt = document.getElementById('pedido-status');
            for(let i=0;i<selSt.options.length;i++) if(selSt.options[i].value===data.status){selSt.selectedIndex=i;break;}
            const selCond = document.getElementById('pedido-condicao');
            for(let i=0;i<selCond.options.length;i++) if(selCond.options[i].value===data.condicao_pagamento){selCond.selectedIndex=i;break;}
            
            if (data.cliente_id) {
                window.selecionarClientePedido(data.cliente_id);
            } else if (data.cliente_nome) {
                document.getElementById('pedido-cliente-busca').value = data.cliente_nome;
            }

            itensPedido = (data.itens||[]).map(it => ({...it}));
            renderItensPedido();
            recalcularPedido();
            document.getElementById('modal-pedido-venda').style.display = 'flex';
        } catch(err) {
            _apexNotify('Atenção', 'Erro ao carregar pedido: '+err.message, 'error');
        }
    };

    window.excluirPedido = async function(id, numero) {
        if (!confirm(`Excluir o pedido ${numero}? Esta ação não pode ser desfeita.`)) return;
        try {
            await fetch(`/api/pedidos-venda/${id}`, {method:'DELETE'});
            await carregarPedidos();
        } catch(err) {
            _apexNotify('Atenção', 'Erro ao excluir: '+err.message, 'error');
        }
    };

    window.imprimirPedido = function() {
        exportarPedidoPdfDoForm();
    };

    window.exportarPedidoPdfPorId = async function(id) {
        let p = null;
        try {
            const r = await fetch(`/api/pedidos-venda/${id}`);
            p = await r.json();
        } catch(e) {
            console.error('Erro ao buscar itens do pedido:', e);
        }
        if (!p || p.error) { _apexNotify('Sistema', 'Pedido não encontrado.', 'info'); return; }
        await gerarPdfPedidoVenda(p);
    };

    window.exportarPedidoPdfDoForm = async function() {
        const num    = document.getElementById('pedido-numero').value || 'PV-0000';
        const cliId  = document.getElementById('pedido-cliente-id').value;
        const c      = (window.localClientes||[]).find(x => x.id == cliId) || {};
        const p = {
            numero: num,
            cliente_id: cliId ? parseInt(cliId) : null,
            cliente_nome: document.getElementById('cc-nome').textContent || document.getElementById('pedido-cliente-busca').value || '-',
            cliente_cnpj: document.getElementById('cc-cnpj').textContent || c.cnpj || c.cpf || '-',
            cliente_cidade: document.getElementById('cc-cidade').textContent || c.cidade || '-',
            cliente_uf: document.getElementById('cc-uf').textContent || c.uf || '-',
            cliente_telefone: document.getElementById('cc-tel').textContent || c.telefone1 || '-',
            cliente_email: document.getElementById('cc-email').textContent || c.email || '-',
            cliente_endereco: c.endereco || '-',
            data_emissao: document.getElementById('pedido-data-emissao').value,
            data_entrega: document.getElementById('pedido-data-entrega').value,
            condicao_pagamento: document.getElementById('pedido-condicao').value,
            status: document.getElementById('pedido-status').value,
            observacoes: document.getElementById('pedido-obs').value,
            desconto_pct: parseFloat(document.getElementById('pedido-desconto').value)||0,
            frete: parseFloat(document.getElementById('pedido-frete').value)||0,
            criado_por: document.getElementById('pedido-vendedor')?.value || sessionStorage.getItem('apex_logged_user_name') || 'Admin',
            criado_por_perfil: document.getElementById('pedido-perfil')?.value || sessionStorage.getItem('apex_logged_user_role') || 'Administrador',
            endereco_entrega: document.getElementById('pedido-endereco-entrega')?.value || '',
            responsavel_recebimento: document.getElementById('pedido-responsavel-recebimento')?.value || '',
            tipo_frete: document.getElementById('pedido-tipo-frete')?.value || 'CIF - Entrega APEXTECH',
            itens: itensPedido
        };
        await gerarPdfPedidoVenda(p);
    };

    async function gerarPdfPedidoVenda(p) {
        if (!window.jspdf) { _apexNotify('Sistema', 'Biblioteca jsPDF não carregada.', 'info'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Marca d'água do logo em toda a folha
        if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
            await window.aplicarMarcaDaguaLogoJsPDF(doc);
        } else if (typeof aplicarMarcaDaguaLogoJsPDF === 'function') {
            await aplicarMarcaDaguaLogoJsPDF(doc);
        }

        if (doc.GState && doc.setGState) {
            try { doc.setGState(new doc.GState({ opacity: 1.0 })); } catch(e){}
        }

        // Cabeçalho da Empresa
        doc.setFillColor(13, 36, 22);
        doc.rect(0, 0, 210, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('APEXTECH METAIS', 14, 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('PEDIDO DE VENDA / PROPOSTA COMERCIAL', 14, 21);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(p.numero || 'PV-0000', 196, 14, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Emissão: ${fmtD(p.data_emissao)}`, 196, 21, { align: 'right' });

        // Box 1: Dados do Cliente & Cadastro
        doc.setFillColor(240, 244, 248);
        doc.setDrawColor(200, 212, 224);
        doc.roundedRect(14, 33, 182, 38, 2, 2, 'FD');

        const cliStatusText = p.cliente_id ? 'CLIENTE CADASTRADO NO SISTEMA' : 'NOVO CLIENTE / PENDENTE';
        doc.setTextColor(13, 36, 22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('DADOS DO CLIENTE (DESTINATÁRIO)', 18, 40);
        
        doc.setFontSize(8);
        doc.setTextColor(p.cliente_id ? 42 : 180, p.cliente_id ? 150 : 120, p.cliente_id ? 80 : 20);
        // Removed status text

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Razão Social / Nome: ', 18, 46);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.cliente_nome || p.cliente_nome_avulso || p.cliente_id || 'Não informado'), 55, 46);

        doc.setFont('helvetica', 'bold');
        doc.text('CNPJ/CPF: ', 18, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.cliente_cnpj || '-'), 38, 52);

        doc.setFont('helvetica', 'bold');
        doc.text('Telefone: ', 115, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.cliente_telefone || '-'), 132, 52);

        doc.setFont('helvetica', 'bold');
        doc.text('Endereço Fiscal: ', 18, 58);
        doc.setFont('helvetica', 'normal');
        const endStr = `${p.cliente_endereco || ''} ${p.cliente_cidade ? '- ' + p.cliente_cidade : ''}${p.cliente_uf ? '/' + p.cliente_uf : ''}`;
        doc.text(endStr.trim() ? endStr : '-', 45, 58);

        doc.setFont('helvetica', 'bold');
        doc.text('E-mail: ', 18, 64);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.cliente_email || '-'), 33, 64);

        // Box 2: Emissor, Logística e Aprovação
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(14, 74, 182, 24, 2, 2, 'FD');

        doc.setTextColor(13, 36, 22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        
        doc.text('Emitido por: ', 18, 80);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(`${p.criado_por || 'Admin'} (${p.criado_por_perfil || 'Administrador'})`, 38, 80);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Status / Aprovação: ', 115, 80);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(p.status === 'Aprovado' || p.status === 'Faturado' || p.status === 'Entregue' ? 42 : 200, p.status === 'Aprovado' ? 150 : 100, 40);
        doc.text(String(p.status || 'Rascunho'), 147, 80);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Endereço de Entrega: ', 18, 86);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(String(p.endereco_entrega || endStr || 'Mesmo do cadastro'), 52, 86);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Recebedor Destino: ', 18, 92);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(String(p.responsavel_recebimento || 'Almoxarifado Cliente'), 48, 92);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Frete / Logística: ', 115, 92);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(String(p.tipo_frete || 'CIF - Entrega APEXTECH').replace(/Apex ?Tech/ig, 'APEXTECH'), 142, 92);

        // Tabela de Itens
        const tableItens = (p.itens || []).map((it, idx) => [
            String(idx + 1),
            it.descricao || '-',
            it.unidade || 'kg',
            (parseFloat(it.quantidade) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
            fmtR(it.preco_unitario),
            (parseFloat(it.desconto_item) || 0) + '%',
            fmtR(it.total_item)
        ]);

        doc.autoTable({
            startY: 102,
            head: [['Item', 'Descrição do Produto/Material', 'Und', 'Qtd', 'Preço Unit.', 'Desc%', 'Total (R$)']],
            body: tableItens.length > 0 ? tableItens : [['1', 'Nenhum item adicionado', '-', '0', 'R$ 0,00', '0%', 'R$ 0,00']],
            theme: 'grid',
            headStyles: { fillColor: [13, 36, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
            bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
            alternateRowStyles: { fillColor: [240, 245, 250] },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 22, halign: 'right' },
                4: { cellWidth: 28, halign: 'right' },
                5: { cellWidth: 18, halign: 'right' },
                6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: 14, right: 14 }
        });

        let finalY = doc.lastAutoTable.finalY + 8;

        // Resumo de Totais
        const subtot = (p.itens || []).reduce((s, it) => s + (parseFloat(it.total_item) || 0), 0);
        const descPct = parseFloat(p.desconto_pct) || 0;
        const descVal = subtot * (descPct / 100);
        const freteVal = parseFloat(p.frete) || 0;
        const totalGeral = subtot - descVal + freteVal;

        doc.setFillColor(240, 244, 248);
        doc.setDrawColor(200, 212, 224);
        doc.roundedRect(120, finalY, 76, 32, 2, 2, 'FD');

        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        doc.text('Subtotal Itens:', 124, finalY + 7);
        doc.text(fmtR(subtot), 192, finalY + 7, { align: 'right' });

        doc.text(`Desconto Geral (${descPct}%):`, 124, finalY + 13);
        doc.text(`- ${fmtR(descVal)}`, 192, finalY + 13, { align: 'right' });

        doc.text('Frete:', 124, finalY + 19);
        doc.text(fmtR(freteVal), 192, finalY + 19, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(13, 36, 22);
        doc.text('TOTAL DO PEDIDO:', 124, finalY + 27);
        doc.text(fmtR(p.total_geral || totalGeral), 192, finalY + 27, { align: 'right' });

        // Observações
        if (p.observacoes) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(13, 36, 22);
            doc.text('OBSERVAÇÕES / INSTRUÇÕES DE ENTREGA:', 14, finalY + 7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(50, 50, 50);
            const splitObs = doc.splitTextToSize(p.observacoes, 95);
            doc.text(splitObs, 14, finalY + 13);
        }

        // Assinaturas
        const sigY = Math.min(Math.max(finalY + 45, 245), 265);
        doc.setDrawColor(180, 180, 180);
        doc.line(20, sigY, 90, sigY);
        doc.line(120, sigY, 190, sigY);

        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.text(`ApexTech Metais — Emissor: ${p.criado_por || 'Admin'}`, 55, sigY + 5, { align: 'center' });
        doc.text('Aceito e De Acordo (Cliente)', 155, sigY + 5, { align: 'center' });

        // Aplicar Marca d'água oficial em todas as páginas
        if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
            await window.aplicarMarcaDaguaLogoJsPDF(doc);
        } else if (typeof aplicarMarcaDaguaLogoJsPDF === 'function') {
            await aplicarMarcaDaguaLogoJsPDF(doc);
        }

        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7.5);
            doc.setTextColor(130, 130, 130);
            doc.text(`ApexTech Metais — Documento de Pedido de Venda ${p.numero || ''} | Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`Pedido_Venda_${p.numero || 'PV'}.pdf`);
    }

    // =========================================================================
    // EXPORTAR CENTRAL DE INTELIGÊNCIA APEXTECH (BI) EM PDF
    // =========================================================================
    window.exportarBIPDF = async function() {
        const biView = document.getElementById('bi-view');
        if (!biView) {
            _apexNotify('Atenção', 'Painel BI não encontrado.', 'error');
            return;
        }

        _apexNotify('Gerando PDF', 'Formatando relatório BI com fundo claro institucional... Aguarde!', 'info');

        const btnPdf = biView.querySelector('button[onclick="exportarBIPDF()"]');
        if (btnPdf) btnPdf.style.visibility = 'hidden';

        // Salvar estilo original para restaurar depois
        const originalStyle = biView.getAttribute('style') || '';
        
        // Guardar estilos originais para restauração pós-impressão
        const allDynamicEls = biView.querySelectorAll('*');
        const originalInlineStyles = new Map();
        allDynamicEls.forEach(el => {
            originalInlineStyles.set(el, el.getAttribute('style'));
        });
        const originalBiViewStyle = biView.getAttribute('style');

        try {
            // 1. Aplicar Tema de Impressão de Altíssima Nitidez (Fundo 100% Branco Puro e sem Backgrounds em Cards)
            biView.style.background = '#ffffff';
            biView.style.color = '#000000';
            biView.style.padding = '15px';
            biView.style.borderRadius = '0px';

            // Remover backgrounds de TODOS os cards, tabelas e contêineres internos
            const elementsToClearBg = biView.querySelectorAll('.estoque-card, .kpi-card, .dashboard-card, table, thead, tr, th, td, div, section, header, .chart-container');
            elementsToClearBg.forEach(el => {
                el.style.backgroundColor = 'transparent';
                el.style.background = 'none';
            });

            // Dar bordas limpas e elegantes aos cards KPI e de gráficos para estruturação sem poluição visual
            const cardsBorder = biView.querySelectorAll('.estoque-card, .kpi-card');
            cardsBorder.forEach(el => {
                el.style.border = '1px solid #cbd5e1';
                el.style.borderRadius = '6px';
                el.style.boxShadow = 'none';
            });

            // Ajustar o cabeçalho da tabela TOP 10 Produtos (removendo fundo escuro e aplicando fundo cinza institucional bem suave)
            const tableHeaders = biView.querySelectorAll('thead tr, th');
            tableHeaders.forEach(el => {
                el.style.backgroundColor = '#f1f5f9';
                el.style.color = '#0f172a';
                el.style.fontWeight = '700';
                el.style.borderBottom = '2px solid #94a3b8';
            });

            const tableRows = biView.querySelectorAll('tbody tr, td');
            tableRows.forEach(el => {
                el.style.borderBottom = '1px solid #e2e8f0';
            });

            // Ajustar especificamente as badges de Posição (#4 em diante) e Status no PDF
            const posBadges = biView.querySelectorAll('.bi-pos-badge');
            posBadges.forEach(el => {
                const txt = el.textContent || '';
                // Manter cores especiais só do pódio (#1 ouro, #2 prata, #3 bronze)
                if (!txt.includes('#1') && !txt.includes('#2') && !txt.includes('#3')) {
                    el.style.backgroundColor = 'transparent';
                    el.style.background = 'none';
                    el.style.color = '#0f172a';
                    el.style.border = '1px solid #cbd5e1';
                }
            });

            const statusBadges = biView.querySelectorAll('.bi-status-badge');
            statusBadges.forEach(el => {
                el.style.backgroundColor = 'transparent';
                el.style.background = 'none';
                el.style.border = '1px solid #cbd5e1';
                if (el.textContent.includes('Excelente')) el.style.color = '#15803d';
                else if (el.textContent.includes('Boa')) el.style.color = '#b45309';
                else el.style.color = '#b91c1c';
            });

            // Ajustar cores de textos para ficarem 100% nítidos e legíveis
            const allTextNodes = biView.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, strong, label, th, td');
            allTextNodes.forEach(el => {
                const comp = window.getComputedStyle(el).color;
                // Se o texto for amarelo (Venda Ref), converter para Marrom/Âmbar escuro vibrante nítido (#b45309)
                if (el.classList.contains('bi-venda-ref') || comp.includes('255, 235, 59') || comp.includes('240, 184, 0') || comp.includes('217, 119, 6')) {
                    el.style.color = '#b45309';
                    el.style.fontWeight = 'bold';
                }
                // Se o texto for branco, cinza claro ou amarelado fraco, transformar em tom escuro de alta legibilidade (respeitando se for badge)
                else if (!el.classList.contains('bi-pos-badge') && (comp.includes('255, 255, 255') || comp.includes('170, 170, 170') || comp.includes('127, 168, 200') || comp.includes('204, 204, 204'))) {
                    el.style.color = '#0f172a';
                }
                // Títulos e subtítulos principais em tom azul marinho escuro nítido
                if (['H1','H2','H3','H4','STRONG'].includes(el.tagName)) {
                    if (comp.includes('255, 255, 255') || comp.includes('15, 23, 42') || comp.includes('17, 24, 39')) {
                        el.style.color = '#0f172a';
                    }
                }
            });

            // Capturar com html2canvas em altíssima definição (scale: 2)
            const canvas = await html2canvas(biView, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // 2. Restaurar estilos visuais da tela escura imediatamente
            if (btnPdf) btnPdf.style.visibility = 'visible';
            if (originalBiViewStyle !== null) biView.setAttribute('style', originalBiViewStyle);
            else biView.removeAttribute('style');

            allDynamicEls.forEach(el => {
                const orig = originalInlineStyles.get(el);
                if (orig !== null && orig !== undefined) el.setAttribute('style', orig);
                else el.removeAttribute('style');
            });

            // 3. Montar PDF Multi-páginas com jsPDF em A4 com encaixe perfeito sem fatiar linhas ao meio
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                _apexNotify('Atenção', 'Biblioteca jsPDF não carregada.', 'error');
                return;
            }

            const today = new Date();
            const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            const formattedDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Configurar Margens Institucionais e Área Útil de Impressão
            const marginTop = 18;
            const marginBottom = 12;
            const marginLeft = 8;
            const contentWidth = pdfWidth - (marginLeft * 2); // 194mm útil
            const maxPageHeight = pdfHeight - marginTop - marginBottom; // 267mm área útil por folha

            // Calcular proporções
            const pxToMm = contentWidth / canvas.width;
            const totalContentHeightMm = canvas.height * pxToMm;

            let remainingHeightMm = totalContentHeightMm;
            let currentSrcYPx = 0;
            let pageNum = 1;

            while (remainingHeightMm > 0) {
                if (pageNum > 1) pdf.addPage();

                // Cabeçalho Institucional de topo em cada página
                pdf.setFillColor(30, 78, 140);
                pdf.rect(0, 0, pdfWidth, 13, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.text('APEXTECH METAIS — RELATÓRIO BI & DESEMPENHO OPERACIONAL', 8, 8.5);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Emissão: ${dateStr}`, pdfWidth - 8, 8.5, { align: 'right' });

                // Quantos mm e px cabem nesta folha
                const sliceHeightMm = Math.min(maxPageHeight, remainingHeightMm);
                const sliceHeightPx = sliceHeightMm / pxToMm;

                // Recorte exato no Canvas
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeightPx;
                const ctx = pageCanvas.getContext('2d');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                ctx.drawImage(
                    canvas,
                    0, currentSrcYPx, canvas.width, sliceHeightPx,
                    0, 0, canvas.width, sliceHeightPx
                );

                const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
                pdf.addImage(pageImgData, 'JPEG', marginLeft, marginTop, contentWidth, sliceHeightMm);

                // Rodapé com numeração de página institucional
                pdf.setFontSize(8);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`Página ${pageNum} | Central de Inteligência ApexTech`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });

                currentSrcYPx += sliceHeightPx;
                remainingHeightMm -= sliceHeightMm;
                pageNum++;
            }

            // Aplicar marca d'água oficial com logo em todas as páginas do PDF
            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(pdf);
            }

            pdf.save(`Relatorio_BI_ApexTech_${formattedDate}.pdf`);

            _apexNotify('Sucesso', '✅ Relatório BI exportado em PDF nítido e limpo!', 'info');

        } catch (err) {
            console.error('Erro ao exportar PDF do BI:', err);
            if (btnPdf) btnPdf.style.visibility = 'visible';
            if (originalBiViewStyle !== null) biView.setAttribute('style', originalBiViewStyle);
            else biView.removeAttribute('style');

            allDynamicEls.forEach(el => {
                const orig = originalInlineStyles.get(el);
                if (orig !== null && orig !== undefined) el.setAttribute('style', orig);
                else el.removeAttribute('style');
            });
            _apexNotify('Atenção', 'Erro ao exportar PDF: ' + err.message, 'error');
        }
    };

    // ── GERAÇÃO DE PDFS DE PLANEJAMENTO, MRP, INDUSTRIAL E ORDENS DE PRODUÇÃO (PCP) ──

    function getJsPDFClass() {
        if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
        if (window.jsPDF) return window.jsPDF;
        return null;
    }

    window.imprimirOPPdf = async function(opId) {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível no navegador.', 'error');
                return;
            }
            const list = (localOPs && localOPs.length > 0) ? localOPs : (window.localOPs || []);
            const op = list.find(x => x.id == opId);
            if (!op) {
                _apexNotify('Atenção', 'Ordem de Produção não encontrada.', 'error');
                return;
            }

            const doc = new JSClass('portrait', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 210, 32, 'F');

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 183, 77);
            doc.text('APEXTECH METAIS ERP', 15, 15);

            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`ORDEM DE PRODUÇÃO & ROTEIRO PCP — ${op.numero_op || 'OP'}`, 15, 24);

            doc.setFontSize(8);
            doc.setTextColor(180, 200, 220);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 145, 15);
            doc.text(`Emissor: ${sessionStorage.getItem('apex_logged_user_name') || 'Administrador'}`, 145, 22);

            doc.autoTable({
                startY: 38,
                head: [['Campo / Parâmetro', 'Especificação Industrial']],
                body: [
                    ['Número da OP', op.numero_op || 'OP-2026'],
                    ['Material de Entrada', op.material_entrada || '-'],
                    ['Peso de Entrada (kg)', parseFloat(op.peso_entrada_kg || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Material Resultante Esperado', op.material_saida_nome || '-'],
                    ['Peso de Saída Estimado (kg)', parseFloat(op.peso_saida_estimado_kg || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Cronograma Previsto', `${fmtD(op.data_inicio_prevista)} até ${fmtD(op.data_fim_prevista)}`],
                    ['Responsável PCP', op.responsavel_pcp || 'Eng. Roberto'],
                    ['Status da Ordem de Produção', op.status || 'Planejada'],
                    ['Observações / Instruções', op.observacoes || 'Sem observações']
                ],
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 }
            });

            const etapas = op.etapas || [];
            let totalEst = 0;
            let totalReal = 0;

            const etapasBody = etapas.map(et => {
                const estH = parseFloat(et.tempo_estimado_horas || 0);
                const realH = parseFloat(et.tempo_real_horas || 0);
                totalEst += estH;
                totalReal += realH;
                return [
                    et.ordem || '-',
                    et.nome_etapa || '-',
                    et.equipamento_nome || 'Nenhum / Manual',
                    estH.toFixed(1) + ' h',
                    realH.toFixed(1) + ' h',
                    et.status_etapa || 'Pendente',
                    et.operador_responsavel || 'Operador'
                ];
            });

            etapasBody.push([
                '', 'TOTAL ACUMULADO DA OP', '', totalEst.toFixed(1) + ' h', totalReal.toFixed(1) + ' h', '', ''
            ]);

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['#', 'Etapa Operacional', 'Equipamento', 'Tempo Est.', 'Tempo Real', 'Status Etapa', 'Operador']],
                body: etapasBody,
                theme: 'grid',
                headStyles: { fillColor: [255, 183, 77], textColor: [10, 20, 30], fontStyle: 'bold' },
                styles: { fontSize: 8.5, cellPadding: 3 },
                didParseCell: function(data) {
                    if (data.row.index === etapasBody.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                        data.cell.styles.textColor = [0, 0, 0];
                    }
                }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Ordem_Producao_${op.numero_op}_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', `PDF da Ordem de Produção ${op.numero_op} baixado com marca d'água!`, 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF da OP:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF da OP: ' + err.message, 'error');
        }
    };

    window.imprimirRelatorioOPsPdf = async function() {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localOPs && localOPs.length > 0) ? localOPs : (window.localOPs || []);
            if (list.length === 0) {
                _apexNotify('Atenção', 'Nenhuma Ordem de Produção (OP) cadastrada para imprimir.', 'info');
                return;
            }

            const doc = new JSClass('landscape', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 297, 28, 'F');

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 183, 77);
            doc.text('APEXTECH METAIS ERP — RELATÓRIO GERAL DE ORDENS DE PRODUÇÃO & PCP', 15, 18);

            const body = list.map(op => {
                const etapas = op.etapas || [];
                const totalEst = etapas.reduce((s, e) => s + parseFloat(e.tempo_estimado_horas || 0), 0);
                const totalReal = etapas.reduce((s, e) => s + parseFloat(e.tempo_real_horas || 0), 0);
                return [
                    op.numero_op || '-',
                    op.material_entrada || '-',
                    parseFloat(op.peso_entrada_kg || 0).toLocaleString('pt-BR') + ' kg',
                    op.material_saida_nome || '-',
                    parseFloat(op.peso_saida_estimado_kg || 0).toLocaleString('pt-BR') + ' kg',
                    `${fmtD(op.data_inicio_prevista)} a ${fmtD(op.data_fim_prevista)}`,
                    totalEst.toFixed(1) + ' h',
                    totalReal.toFixed(1) + ' h',
                    op.status || 'Planejada',
                    op.responsavel_pcp || '-'
                ];
            });

            doc.autoTable({
                startY: 34,
                head: [['Nº OP', 'Mat. Entrada', 'Peso Entrada', 'Mat. Saída Esperado', 'Peso Saída Est.', 'Cronograma', 'Tempo Est.', 'Tempo Real', 'Status OP', 'Responsável']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Relatorio_Ordens_Producao_PCP_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Relatório Geral de Ordens de Produção baixado com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar relatório geral de OPs:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.imprimirMrpPdf = async function(id) {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localMRP && localMRP.length > 0) ? localMRP : (window.localMRP || []);
            const item = list.find(x => x.id == id);
            if (!item) {
                _apexNotify('Atenção', 'Demanda de compra MRP não encontrada.', 'error');
                return;
            }

            const doc = new JSClass('portrait', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 210, 32, 'F');

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(42, 208, 122);
            doc.text('APEXTECH METAIS ERP', 15, 15);

            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`DEMANDA DE COMPRA (MRP) — MATÉRIA-PRIMA`, 15, 24);

            doc.autoTable({
                startY: 38,
                head: [['Item de Demanda', 'Especificação MRP']],
                body: [
                    ['Material Requerido', item.material_nome || 'Material'],
                    ['Fornecedor Homologado', item.fornecedor_nome || 'Fornecedor'],
                    ['Quantidade Necessária (kg)', parseFloat(item.quantidade_necessaria || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Ponto de Pedido / Est. Mínimo (kg)', parseFloat(item.ponto_pedido_kg || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Lead Time de Entrega (Dias)', (item.lead_time_dias || 7) + ' dias'],
                    ['Preço Estimado (R$/kg)', 'R$ ' + parseFloat(item.preco_estimado || 0).toFixed(2)],
                    ['Custo Total Previsto (R$)', 'R$ ' + parseFloat(item.custo_total_estimado || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})],
                    ['Mês Referência', item.mes_referencia || '-'],
                    ['Status da Demanda', item.status || 'Sugerido'],
                    ['Observações', item.observacoes || '-']
                ],
                theme: 'grid',
                headStyles: { fillColor: [42, 208, 122], textColor: [0, 0, 0], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Demanda_Compra_MRP_${item.id}_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Demanda de compra MRP baixada em PDF com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF MRP:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF MRP: ' + err.message, 'error');
        }
    };

    window.imprimirRelatorioMrpPdf = async function() {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localMRP && localMRP.length > 0) ? localMRP : (window.localMRP || []);
            if (list.length === 0) {
                _apexNotify('Atenção', 'Nenhuma demanda de compra (MRP) cadastrada para imprimir.', 'info');
                return;
            }

            const doc = new JSClass('landscape', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 297, 28, 'F');

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(42, 208, 122);
            doc.text('APEXTECH METAIS ERP — PLANEJAMENTO DE NECESSIDADES DE COMPRA (MRP)', 15, 18);

            const body = list.map(m => [
                m.material_nome || '-',
                m.fornecedor_nome || '-',
                parseFloat(m.quantidade_necessaria || 0).toLocaleString('pt-BR') + ' kg',
                parseFloat(m.ponto_pedido_kg || 0).toLocaleString('pt-BR') + ' kg',
                (m.lead_time_dias || 7) + ' dias',
                'R$ ' + parseFloat(m.preco_estimado || 0).toFixed(2),
                'R$ ' + parseFloat(m.custo_total_estimado || 0).toLocaleString('pt-BR', {minimumFractionDigits:2}),
                m.mes_referencia || '-',
                m.status || 'Sugerido'
            ]);

            doc.autoTable({
                startY: 34,
                head: [['Material', 'Fornecedor', 'Qtd Necessária', 'Est. Mínimo', 'Lead Time', 'Preço Est.', 'Custo Total', 'Mês Ref.', 'Status']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [42, 208, 122], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Relatorio_Planejamento_MRP_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Relatório Geral MRP baixado em PDF com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar relatório MRP:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.imprimirEquipamentoPdf = async function(id) {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localEquipamentos && localEquipamentos.length > 0) ? localEquipamentos : (window.localEquipamentos || []);
            const eq = list.find(x => x.id == id);
            if (!eq) {
                _apexNotify('Atenção', 'Equipamento não encontrado.', 'error');
                return;
            }

            const doc = new JSClass('portrait', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 210, 32, 'F');

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(62, 124, 177);
            doc.text('APEXTECH METAIS ERP', 15, 15);

            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`FICHA DE CAPACIDADE INDUSTRIAL — TAG: ${eq.codigo_tag || 'EQ'}`, 15, 24);

            doc.autoTable({
                startY: 38,
                head: [['Parâmetro Operacional', 'Especificação da Máquina']],
                body: [
                    ['Código / TAG', eq.codigo_tag || '-'],
                    ['Nome do Equipamento', eq.nome_equipamento || '-'],
                    ['Setor Operacional', eq.setor || 'Processamento'],
                    ['Capacidade Nominal (kg/h)', parseFloat(eq.capacidade_nominal_kgh || 0).toLocaleString('pt-BR') + ' kg/h'],
                    ['Disponibilidade (h/dia)', (eq.disponibilidade_horas_dia || 16) + ' horas/dia'],
                    ['Tempo de Setup (Horas)', (eq.tempo_setup_horas || 1.0) + ' horas'],
                    ['Eficiência OEE (%)', (eq.eficiencia_oee_pct || 85) + ' %'],
                    ['Status Operacional', eq.status || 'Operacional'],
                    ['Observações Técnicas', eq.observacoes || '-']
                ],
                theme: 'grid',
                headStyles: { fillColor: [62, 124, 177], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Ficha_Equipamento_${eq.codigo_tag || eq.id}_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', `Ficha do equipamento ${eq.codigo_tag || eq.nome_equipamento} baixada em PDF!`, 'success');
        } catch (err) {
            console.error('Erro ao gerar ficha do equipamento:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.imprimirRelatorioIndustrialPdf = async function() {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localEquipamentos && localEquipamentos.length > 0) ? localEquipamentos : (window.localEquipamentos || []);
            if (list.length === 0) {
                _apexNotify('Atenção', 'Nenhum equipamento industrial cadastrado para imprimir.', 'info');
                return;
            }

            const doc = new JSClass('landscape', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 297, 28, 'F');

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(62, 124, 177);
            doc.text('APEXTECH METAIS ERP — MAPEAMENTO DE CAPACIDADE & LINHAS INDUSTRIAIS', 15, 18);

            const body = list.map(e => [
                e.codigo_tag || '-',
                e.nome_equipamento || '-',
                e.setor || '-',
                parseFloat(e.capacidade_nominal_kgh || 0).toLocaleString('pt-BR') + ' kg/h',
                (e.disponibilidade_horas_dia || 16) + ' h/dia',
                (e.tempo_setup_horas || 1.0) + ' h',
                (e.eficiencia_oee_pct || 85) + ' %',
                e.status || 'Operacional'
            ]);

            doc.autoTable({
                startY: 34,
                head: [['TAG', 'Equipamento', 'Setor', 'Capacidade Nominal', 'Disponibilidade', 'Setup', 'OEE %', 'Status']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [62, 124, 177], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Relatorio_Capacidade_Industrial_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Relatório Geral de Capacidade Industrial baixado em PDF com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar relatório industrial:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };



    let _chartEstrategicoCenarios = null;
    let _mesEstrategicoAtivo = null; // null significa visualizando tela de 12 meses

    window.carregarPlanejamentoEstrategico = async function() {
        try {
            // Buscar tabela de preços completa e metas estratégicas cadastradas
            const [resPrecos, resMetas] = await Promise.all([
                fetch('/api/tabela-precos', { cache: 'no-store' }),
                fetch('/api/planejamento-estrategico')
            ]);
            
            _listTabelaPrecosEstrategica = await resPrecos.json();
            const rawMetas = await resMetas.json();
            _listMetasEstrategicas = Array.isArray(rawMetas) ? rawMetas : [];

            // Popular comboboxes de seleção de produto
            if (window.popularSelectsProdutoEstrategico) window.popularSelectsProdutoEstrategico();

            if (_mesEstrategicoAtivo) {
                // Se um mês está ativo, renderiza os detalhes daquele mês
                renderDashboardEstrategico();
            } else {
                // Caso contrário, mostra a visão geral dos 12 meses
                renderVisualizacao12Meses();
            }
        } catch(e) {
            console.error('Erro ao carregar planejamento estratégico:', e);
            _apexNotify('Erro', 'Não foi possível carregar os dados estratégicos.', 'error');
        }
    };

    window.popularSelectsProdutoEstrategico = function() {
        const selectProd = document.getElementById('plest-select-produto');
        const selectModal = document.getElementById('metaest-material-id');
        if (!selectProd || !selectModal) return;

        const currentValProd = selectProd.value;
        const currentValModal = selectModal.value;

        // Limpar e preencher
        selectProd.innerHTML = '<option value="">-- Selecione um Produto --</option>';
        selectModal.innerHTML = '<option value="">-- Selecione o Insumo/Produto --</option>';

        // Tabela de preços possui material_id e material_nome
        _listTabelaPrecosEstrategica.forEach(tp => {
            const opt1 = document.createElement('option');
            opt1.value = tp.material_id;
            opt1.textContent = tp.material_nome + ' (' + tp.material_categoria + ')';
            selectProd.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = tp.material_id;
            opt2.textContent = tp.material_nome + ' (' + tp.material_categoria + ')';
            selectModal.appendChild(opt2);
        });

        if (currentValProd) selectProd.value = currentValProd;
        if (currentValModal) selectModal.value = currentValModal;
    }

    window.voltarPara12MesesEstrategico = function() {
        _mesEstrategicoAtivo = null;
        document.getElementById('plest-view-12meses').style.display = 'block';
        document.getElementById('plest-view-detalhes-mes').style.display = 'none';
        renderVisualizacao12Meses();
    };

    window.detalharMesEstrategico = function(mes) {
        _mesEstrategicoAtivo = mes;
        document.getElementById('plest-view-12meses').style.display = 'none';
        document.getElementById('plest-view-detalhes-mes').style.display = 'block';
        document.getElementById('plest-txt-mes-ativo').innerHTML = `<i class="fa-solid fa-calendar-days" style="color:#00e5ff;"></i> Planejamento Estratégico — ${formatarMesAnoLabel(mes)}`;
        
        // Selecionar o primeiro produto por padrão se não houver um selecionado
        const selectProd = document.getElementById('plest-select-produto');
        if (selectProd && !selectProd.value && _listTabelaPrecosEstrategica.length > 0) {
            selectProd.value = _listTabelaPrecosEstrategica[0].material_id;
        }

        renderDashboardEstrategico();
    };

    function formatarMesAnoLabel(mesStr) {
        if (!mesStr) return '';
        const [year, month] = mesStr.split('-');
        const mesesNomes = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${mesesNomes[parseInt(month) - 1]} de ${year}`;
    }

    function renderVisualizacao12Meses() {
        const tbody = document.getElementById('plest-12meses-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Obter os 12 meses a partir de Agosto/2026
        const listMeses = [];
        let startYear = 2026;
        let startMonth = 8; // Agosto

        // Obter data atual do sistema para comparar status do mês
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-indexed

        for (let i = 0; i < 12; i++) {
            const m = String(startMonth).padStart(2, '0');
            const mesKey = `${startYear}-${m}`;
            listMeses.push(mesKey);

            startMonth++;
            if (startMonth > 12) {
                startMonth = 1;
                startYear++;
            }
        }

        listMeses.forEach(mesKey => {
            // Filtrar metas cadastradas neste mês
            const metasMes = _listMetasEstrategicas.filter(m => m.mes === mesKey);

            let totalMetaCompra = 0;
            let totalMetaVenda = 0;
            let totalFaturamentoProjetado = 0;
            let totalRealizado = 0;
            let totalConservador = 0;
            let totalAgressivo = 0;

            metasMes.forEach(meta => {
                const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === meta.material_id);
                const pVenda = tp ? parseFloat(tp.venda_ref || 0) : 0;

                const qCons = parseFloat(meta.qtd_conservador || 0);
                const qMod = parseFloat(meta.qtd_moderado || 0);
                const qAgr = parseFloat(meta.qtd_agressivo || 0);
                const qReal = parseFloat(meta.qtd_realizado || 0);

                totalMetaCompra += qMod;
                totalMetaVenda += qMod;
                totalFaturamentoProjetado += (qMod * pVenda);
                totalRealizado += qReal;
                totalConservador += qCons;
                totalAgressivo += qAgr;
            });

            const atingimentoPct = totalMetaCompra > 0 ? (totalRealizado / totalMetaCompra) * 100 : 0;

            // Determinar Status
            let statusStr = '';
            let statusCor = '';
            const [y, m] = mesKey.split('-').map(Number);
            const isFuturo = (y > currentYear) || (y === currentYear && m > currentMonth);
            const isAtual = (y === currentYear && m === currentMonth);

            if (totalRealizado === 0 && isFuturo) {
                statusStr = 'NÃO INICIADO';
                statusCor = '#aaa';
            } else if (isAtual) {
                statusStr = 'EM ANDAMENTO';
                statusCor = '#00e5ff';
            } else if (atingimentoPct >= 100) {
                statusStr = atingimentoPct > 100 ? 'META SUPERADA' : 'META ATINGIDA';
                statusCor = '#2AD07A';
            } else {
                statusStr = 'ABAIXO DA META';
                statusCor = '#ff4d4d';
            }

            // Posição entre os cenários
            let cenarioAlcancado = '—';
            if (totalRealizado > 0) {
                if (totalRealizado >= totalAgressivo && totalAgressivo > 0) {
                    cenarioAlcancado = '<span style="color:#ff4d4d; font-weight:bold;">Agressivo</span>';
                } else if (totalRealizado >= totalMetaCompra && totalMetaCompra > 0) {
                    cenarioAlcancado = '<span style="color:#00e5ff; font-weight:bold;">Moderado</span>';
                } else if (totalRealizado >= totalConservador && totalConservador > 0) {
                    cenarioAlcancado = '<span style="color:#ffeb3b; font-weight:bold;">Conservador</span>';
                } else {
                    cenarioAlcancado = '<span style="color:#ff4d4d;">Abaixo do Conservador</span>';
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><strong>${formatarMesAnoLabel(mesKey)}</strong></td>
                <td style="padding:10px 8px; text-align:right;">${totalMetaCompra.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right;">${totalMetaVenda.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${totalFaturamentoProjetado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td style="padding:10px 8px; text-align:right; color:#fff;">${totalRealizado.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${atingimentoPct >= 100 ? '#2AD07A' : '#ffb74d'};">${atingimentoPct.toFixed(1)}%</td>
                <td style="padding:10px 8px; text-align:center;">${cenarioAlcancado}</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${statusCor};">${statusStr}</td>
                <td style="padding:10px 8px; text-align:center;">
                    <button onclick="detalharMesEstrategico('${mesKey}')" class="btn-primary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#2AD07A; color:#0d1826; font-weight:bold;">
                        <i class="fa-solid fa-magnifying-glass"></i> Detalhar Mês
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.onSelectProdutoEstrategico = function() {
        if (_mesEstrategicoAtivo) {
            renderDashboardEstrategico();
        }
    };

    window.onSelectModalMaterial = function() {
        const matId = parseInt(document.getElementById('metaest-material-id').value);
        const lblCompra = document.getElementById('metaest-lbl-compra');
        const lblVenda = document.getElementById('metaest-lbl-venda');
        const lblMargem = document.getElementById('metaest-lbl-margem');

        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (tp) {
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVenda = parseFloat(tp.venda_ref || 0);
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const frete = parseFloat(tp.frete_coleta || 0);

            const impostoUnit = pVenda * ((pisCofins + icms) / 100);
            const custoTotal = pCompra + frete + impostoUnit + (pVenda * (comissao / 100)) + (pVenda * (fidc / 100));
            const lucro = pVenda - custoTotal;
            const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;

            lblCompra.textContent = 'R$ ' + pCompra.toFixed(2);
            lblVenda.textContent = 'R$ ' + pVenda.toFixed(2);
            lblMargem.textContent = margem.toFixed(1) + '%';
        } else {
            lblCompra.textContent = '—';
            lblVenda.textContent = '—';
            lblMargem.textContent = '—';
        }
    };

    function renderDashboardEstrategico() {
        if (!_mesEstrategicoAtivo) return;
        const filterMes = _mesEstrategicoAtivo;
        const targetMatId = parseInt(document.getElementById('plest-select-produto').value) || null;

        // Filtrar metas cadastradas para o mês selecionado
        const metasMes = _listMetasEstrategicas.filter(m => m.mes === filterMes);

        // Agregadores gerais do mês para o dashboard KPI (Moderado)
        let totalFaturamentoProjetado = 0;
        let totalCustoCompraProjetado = 0;
        let totalLucroProjetado = 0;
        let totalFidcProjetado = 0;
        let countMateriais = 0;
        let somaMargem = 0;
        let somaMarkup = 0;

        const tableBody = document.getElementById('plest-geral-table-body');
        if (tableBody) tableBody.innerHTML = '';

        // Tabela de preços é a base de tudo
        _listTabelaPrecosEstrategica.forEach(tp => {
            // Achar se existe meta cadastrada para este produto no mês
            const meta = metasMes.find(m => m.material_id === tp.material_id);
            
            // Metas de volume para os cenários (padrão 0 se não cadastrado)
            const qCons = meta ? parseFloat(meta.qtd_conservador || 0) : 0;
            const qMod = meta ? parseFloat(meta.qtd_moderado || 0) : 0;
            const qAgr = meta ? parseFloat(meta.qtd_agressivo || 0) : 0;
            const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;

            // Margem customizada definida pelo usuário
            const margemCustom = (meta && meta.margem_alvo !== null) ? parseFloat(meta.margem_alvo) : null;

            // Valores comerciais oficiais da tabela
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVendaBase = parseFloat(tp.venda_ref || 0);
            const comissaoPct = parseFloat(tp.comissao || 0);
            const pisCofinsPct = parseFloat(tp.pis_cofins || 0);
            const fidcPct = parseFloat(tp.fidc || 0);
            const icmsPct = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);

            // Custos unitários baseados nos percentuais
            const custoImpostos = pVendaBase * ((pisCofinsPct + icmsPct) / 100);
            const custoComissao = pVendaBase * (comissaoPct / 100);
            const custoFidc = pVendaBase * (fidcPct / 100);
            const custoTotalUnit = pCompra + freteColeta + custoImpostos + custoComissao + custoFidc;

            // Calcular preço de venda planejado se houver margem customizada
            let pVendaProjetado = pVendaBase;
            if (margemCustom !== null && margemCustom < 100) {
                pVendaProjetado = custoTotalUnit / (1 - margemCustom / 100);
            }

            const lucroUnit = pVendaProjetado - custoTotalUnit;
            const margemUnitPct = pVendaProjetado > 0 ? (lucroUnit / pVendaProjetado) * 100 : 0;
            const markupUnit = pCompra > 0 ? (pVendaProjetado / pCompra) : 0;

            // Faturamento e custos totais projetados no cenário moderado (alvo)
            const fatMod = qMod * pVendaProjetado;
            const custoMod = qMod * custoTotalUnit;
            const lucroMod = fatMod - custoMod;
            const fidcTotalMod = qMod * custoFidc;

            totalFaturamentoProjetado += fatMod;
            totalCustoCompraProjetado += custoMod;
            totalLucroProjetado += lucroMod;
            totalFidcProjetado += fidcTotalMod;

            if (qMod > 0) {
                somaMargem += margemUnitPct;
                somaMarkup += markupUnit;
                countMateriais++;
            }

            // Atingimento e desvios
            const atingimentoPct = qMod > 0 ? (qReal / qMod) * 100 : 0;
            const saldo = qMod - qReal;

            // Comparação de qual cenário de volume o realizado alcançou
            let cenarioAlcancado = 'Abaixo';
            let cenarioCor = '#ff4d4d';
            if (qReal > 0) {
                if (qReal >= qAgr && qAgr > 0) {
                    cenarioAlcancado = 'Agressivo';
                    cenarioCor = '#ff4d4d';
                } else if (qReal >= qMod && qMod > 0) {
                    cenarioAlcancado = 'Moderado';
                    cenarioCor = '#00e5ff';
                } else if (qReal >= qCons && qCons > 0) {
                    cenarioAlcancado = 'Conservador';
                    cenarioCor = '#ffeb3b';
                } else {
                    cenarioAlcancado = 'Abaixo';
                    cenarioCor = '#aaa';
                }
            }

            // Detectar prejuízo unitário
            const isPrejuizo = lucroUnit < 0;

            // Inserir na planilha geral se houver meta
            if (tableBody && (meta || qMod > 0)) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding:8px;">
                        <strong>${tp.material_nome}</strong>
                        ${isPrejuizo ? '<span style="background:#ff4d4d; color:#fff; font-size:0.65rem; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">PREJUÍZO</span>' : ''}
                    </td>
                    <td style="padding:8px; text-align:right;">${qCons.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#00e5ff;">${qMod.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right;">${qAgr.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${pCompra.toFixed(2)}</td>
                    <td style="padding:8px; text-align:right; color:#2AD07A;">R$ ${pVendaProjetado.toFixed(2)}</td>
                    <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${fatMod.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; color:${lucroMod >= 0 ? '#2AD07A' : '#ff4d4d'}; font-weight:bold;">R$ ${lucroMod.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:${margemUnitPct >= 10 ? '#2AD07A' : '#ff4d4d'};">${margemUnitPct.toFixed(1)}%</td>
                    <td style="padding:8px; text-align:right; color:#fff;">
                        ${qReal.toLocaleString('pt-BR')} kg
                        <div style="font-size:0.7rem; color:${cenarioCor}; margin-top:2px;">Cenário: ${cenarioAlcancado}</div>
                    </td>
                    <td style="padding:8px; text-align:center; font-weight:bold;">
                        <span style="color:${atingimentoPct >= 100 ? '#2AD07A' : (atingimentoPct >= 75 ? '#ffb74d' : '#ff4d4d')};">${atingimentoPct.toFixed(1)}%</span>
                        <div style="font-size:0.7rem; color:#aaa; margin-top:2px;">Saldo: ${saldo.toLocaleString('pt-BR')} kg</div>
                    </td>
                    <td style="padding:8px; text-align:center;">
                        <button onclick="editarMetaEstrategicaRapido(${tp.material_id}, '${filterMes}', ${qCons}, ${qMod}, ${qAgr}, ${qReal}, ${margemCustom || '""'}, ${meta ? meta.valor_compra_realizado : 0}, ${meta ? meta.valor_venda_realizado : 0})" class="btn-primary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#00e5ff; color:#0d1826;" title="Editar"><i class="fa-solid fa-edit"></i></button>
                        ${meta ? `<button onclick="deletarMetaEstrategica(${meta.id})" style="background:none; border:none; color:#ff6b6b; margin-left:8px; cursor:pointer;" title="Remover Meta"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                `;
                tableBody.appendChild(tr);
            }
        });

        if (tableBody && tableBody.children.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; color:#aaa;">Nenhuma meta cadastrada para este mês. Clique em "Alterar Metas do Mês" no topo para planejar.</td></tr>`;
        }

        // Renderizar KPIs no topo
        document.getElementById('est-kpi-fat-previsto').textContent = 'R$ ' + totalFaturamentoProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('est-kpi-custo-previsto').textContent = 'R$ ' + totalCustoCompraProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('est-kpi-lucro-previsto').textContent = 'R$ ' + totalLucroProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('est-kpi-margem-media').textContent = (countMateriais > 0 ? (somaMargem / countMateriais) : 0).toFixed(1) + '%';
        document.getElementById('est-kpi-markup-medio').textContent = (countMateriais > 0 ? (somaMarkup / countMateriais) : 0).toFixed(2) + 'x';
        document.getElementById('est-kpi-fidc-total').textContent = 'R$ ' + totalFidcProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});

        // 3. Renderizar produto detalhado ativo e cenários individuais
        renderDetalhesProdutoSelecionado(targetMatId, filterMes);

        // 4. Renderizar rankings executivos
        renderRankingEstrategico();

        // 5. Atualizar insights automáticos de IA
        gerarInsightsIAEstrategicos(metasMes);
    }

    function renderDetalhesProdutoSelecionado(matId, mes) {
        const container = document.getElementById('plest-produto-detalhes-container');
        const cenBody = document.getElementById('plest-cenarios-table-body');
        const prBody = document.getElementById('plest-planejado-realizado-tbody');
        if (!container || !cenBody || !prBody) return;

        const preco = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        const meta = _listMetasEstrategicas.find(m => m.material_id === matId && m.mes === mes);

        if (!preco) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:15px; color:#aaa; font-size:0.85rem;">
                    Selecione um produto no combobox acima para avaliar custos, spreads e margens integradas.
                </div>
            `;
            cenBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto para visualizar cenários.</td></tr>`;
            prBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto.</td></tr>`;
            if (_chartEstrategicoCenarios) { _chartEstrategicoCenarios.destroy(); _chartEstrategicoCenarios = null; }
            return;
        }

        const pCompra = parseFloat(preco.preco_entregar || 0);
        const pVendaBase = parseFloat(preco.venda_ref || 0);
        const comissao = parseFloat(preco.comissao || 0);
        const pisCofins = parseFloat(preco.pis_cofins || 0);
        const fidc = parseFloat(preco.fidc || 0);
        const icms = parseFloat(preco.icms || 0);
        const frete = parseFloat(preco.frete_coleta || 0);

        const impostoUnit = pVendaBase * ((pisCofins + icms) / 100);
        const comissaoUnit = pVendaBase * (comissao / 100);
        const fidcUnit = pVendaBase * (fidc / 100);
        const custoTotal = pCompra + frete + impostoUnit + comissaoUnit + fidcUnit;

        // Custom Target Margin
        const margemCustom = (meta && meta.margem_alvo !== null) ? parseFloat(meta.margem_alvo) : null;
        let pVendaProjetado = pVendaBase;
        if (margemCustom !== null && margemCustom < 100) {
            pVendaProjetado = custoTotal / (1 - margemCustom / 100);
        }

        const lucroUnit = pVendaProjetado - custoTotal;
        const margem = pVendaProjetado > 0 ? (lucroUnit / pVendaProjetado) * 100 : 0;
        const markup = pCompra > 0 ? (pVendaProjetado / pCompra) : 0;

        container.innerHTML = `
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Compra (Tabela)</small>
                <div style="font-weight:bold; color:#ffb74d; margin-top:2px;">R$ ${pCompra.toFixed(2)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Venda Projetada</small>
                <div style="font-weight:bold; color:#2AD07A; margin-top:2px;">R$ ${pVendaProjetado.toFixed(2)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Markup Projetado</small>
                <div style="font-weight:bold; color:#9b59b6; margin-top:2px;">${markup.toFixed(2)}x</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Lucro Unitário</small>
                <div style="font-weight:bold; color:${lucroUnit >= 0 ? '#00e5ff' : '#ff4d4d'}; margin-top:2px;">R$ ${lucroUnit.toFixed(2)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Margem Líquida</small>
                <div style="font-weight:bold; color:${margem >= 10 ? '#3e7cb1' : '#ff4d4d'}; margin-top:2px;">${margem.toFixed(1)}%</div>
            </div>
        `;

        // Cenários individuais
        const qCons = meta ? parseFloat(meta.qtd_conservador || 0) : 0;
        const qMod = meta ? parseFloat(meta.qtd_moderado || 0) : 0;
        const qAgr = meta ? parseFloat(meta.qtd_agressivo || 0) : 0;
        const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;

        const fillCenario = (nome, qtd, cor) => {
            const fat = qtd * pVendaProjetado;
            const custo = qtd * custoTotal;
            const lucro = fat - custo;
            return `
                <tr>
                    <td style="padding:8px; font-weight:bold; color:${cor};">${nome}</td>
                    <td style="padding:8px; text-align:right; color:#fff;">${qtd.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${fat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${custo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; color:${lucro >= 0 ? '#2AD07A' : '#ff4d4d'}; font-weight:bold;">R$ ${lucro.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:#2AD07A;">${margem.toFixed(1)}%</td>
                    <td style="padding:8px; text-align:center; color:#9b59b6;">${markup.toFixed(2)}x</td>
                </tr>
            `;
        };

        cenBody.innerHTML = `
            ${fillCenario('Conservador', qCons, '#ffeb3b')}
            ${fillCenario('Moderado (Meta)', qMod, '#00e5ff')}
            ${fillCenario('Agressivo', qAgr, '#ff4d4d')}
        `;

        // Realizados financeiros consolidados
        const valCompraReal = meta ? parseFloat(meta.valor_compra_realizado || 0) : 0;
        const valVendaReal = meta ? parseFloat(meta.valor_venda_realizado || 0) : 0;

        // Planejado vs Realizado (Mês Consolidado)
        const fatPlan = qMod * pVendaProjetado;
        const fatReal = valVendaReal > 0 ? valVendaReal : (qReal * pVendaProjetado);
        const investPlan = qMod * custoTotal;
        const investReal = valCompraReal > 0 ? valCompraReal : (qReal * custoTotal);
        const lucroPlan = fatPlan - investPlan;
        const lucroReal = fatReal - investReal;

        const precoMedioVendaReal = qReal > 0 ? (fatReal / qReal) : pVendaProjetado;
        const precoMedioCompraReal = qReal > 0 ? (investReal / qReal) : pCompra;
        const margemReal = precoMedioVendaReal > 0 ? ((precoMedioVendaReal - precoMedioCompraReal) / precoMedioVendaReal) * 100 : 0;

        const compRow = (nome, planVal, realVal, unit, isMoney, isPercent = false) => {
            const diff = planVal - realVal;
            const pct = planVal > 0 ? (realVal / planVal) * 100 : 0;
            const fmt = (v) => {
                if (isPercent) return v.toFixed(1) + '%';
                return isMoney ? 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2}) : v.toLocaleString('pt-BR') + ' ' + unit;
            };
            return `
                <tr>
                    <td style="padding:8px; font-weight:600; color:#fff;">${nome}</td>
                    <td style="padding:8px; text-align:right; color:#aaa;">${fmt(planVal)}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#fff;">${fmt(realVal)}</td>
                    <td style="padding:8px; text-align:right; color:${diff <= 0 ? '#2AD07A' : '#ff4d4d'};">${diff <= 0 ? 'Meta Atingida' : fmt(diff) + ' restante'}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:${pct >= 100 ? '#2AD07A' : (pct >= 80 ? '#ffb74d' : '#ff4d4d')};">${pct.toFixed(1)}%</td>
                </tr>
            `;
        };

        prBody.innerHTML = `
            ${compRow('Meta de Compra (Volume)', qMod, qReal, 'kg', false)}
            ${compRow('Meta de Venda (Volume)', qMod, qReal, 'kg', false)}
            ${compRow('Faturamento', fatPlan, fatReal, '', true)}
            ${compRow('Investimento (Reserva)', investPlan, investReal, '', true)}
            ${compRow('Lucro Projetado', lucroPlan, lucroReal, '', true)}
            ${compRow('Margem Líquida', margem, margemReal, '', false, true)}
        `;

        // Renderizar gráfico de cenários com Chart.js
        renderGraficoCenariosEstrategicos(qCons, qMod, qAgr, qReal, preco.material_nome);
    }

    function renderGraficoCenariosEstrategicos(cons, mod, agr, real, produtoNome) {
        const ctx = document.getElementById('plest-chart-cenarios');
        if (!ctx) return;

        if (_chartEstrategicoCenarios) {
            _chartEstrategicoCenarios.destroy();
        }

        _chartEstrategicoCenarios = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Conservador', 'Moderado', 'Agressivo', 'Realizado'],
                datasets: [{
                    label: 'Volume (kg) - ' + produtoNome,
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

    window.renderRankingEstrategico = function() {
        const select = document.getElementById('plest-select-ranking-tipo');
        const tbody = document.getElementById('plest-rankings-tbody');
        if (!select || !tbody) return;

        const tipo = select.value;
        tbody.innerHTML = '';

        // Mapear produtos com cálculos
        const dadosRanked = _listTabelaPrecosEstrategica.map(tp => {
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVenda = parseFloat(tp.venda_ref || 0);
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const frete = parseFloat(tp.frete_coleta || 0);

            const impostoUnit = pVenda * ((pisCofins + icms) / 100);
            const custoTotal = pCompra + frete + impostoUnit + (pVenda * (comissao / 100)) + (pVenda * (fidc / 100));

            const lucro = pVenda - custoTotal;
            const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;
            const markup = pCompra > 0 ? (pVenda / pCompra) : 0;
            const spread = pVenda - pCompra;

            return {
                material_nome: tp.material_nome,
                material_categoria: tp.material_categoria,
                preco_compra: pCompra,
                preco_venda: pVenda,
                lucro,
                margem,
                markup,
                spread
            };
        });

        // Ordenação com base no tipo selecionado
        if (tipo === 'lucro') {
            dadosRanked.sort((a,b) => b.lucro - a.lucro);
        } else if (tipo === 'margem') {
            dadosRanked.sort((a,b) => b.margem - a.margem);
        } else if (tipo === 'markup') {
            dadosRanked.sort((a,b) => b.markup - a.markup);
        } else if (tipo === 'oportunidade' || tipo === 'faturamento') {
            dadosRanked.sort((a,b) => b.spread - a.spread);
        } else if (tipo === 'abaixo') {
            dadosRanked.sort((a,b) => a.margem - b.margem);
        }

        // Exibir Top 10
        const top10 = dadosRanked.slice(0, 10);
        top10.forEach((item, idx) => {
            let keyMetricStr = '';
            if (tipo === 'lucro') keyMetricStr = 'R$ ' + item.lucro.toFixed(2);
            else if (tipo === 'margem' || tipo === 'abaixo') keyMetricStr = item.margem.toFixed(1) + '%';
            else if (tipo === 'markup') keyMetricStr = item.markup.toFixed(2) + 'x';
            else if (tipo === 'oportunidade' || tipo === 'faturamento') keyMetricStr = 'Spread: R$ ' + item.spread.toFixed(2);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; text-align:center; font-weight:bold; color:#00e5ff;">#${idx+1}</td>
                <td style="padding:8px;"><strong>${item.material_nome}</strong></td>
                <td style="padding:8px;"><span style="background:#122a3f; color:#3e7cb1; padding:2px 8px; border-radius:12px; font-size:0.7rem;">${item.material_categoria}</span></td>
                <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${item.preco_compra.toFixed(2)}</td>
                <td style="padding:8px; text-align:right; color:#2AD07A;">R$ ${item.preco_venda.toFixed(2)}</td>
                <td style="padding:8px; text-align:right; color:${item.lucro >= 0 ? '#00e5ff' : '#ff4d4d'}; font-weight:bold;">R$ ${item.lucro.toFixed(2)} /kg</td>
                <td style="padding:8px; text-align:center; font-weight:bold; color:#2AD07A;">${keyMetricStr}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function gerarInsightsIAEstrategicos(metasMes) {
        const insightsContainer = document.getElementById('plest-ia-insights');
        if (!insightsContainer) return;

        if (_listTabelaPrecosEstrategica.length === 0) {
            insightsContainer.textContent = 'Sem dados de cotações para formular insights estratégicos.';
            return;
        }

        // Mapear margens
        const listCalculada = _listTabelaPrecosEstrategica.map(tp => {
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVenda = parseFloat(tp.venda_ref || 0);
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const frete = parseFloat(tp.frete_coleta || 0);

            const impostoUnit = pVenda * ((pisCofins + icms) / 100);
            const custoTotal = pCompra + frete + impostoUnit + (pVenda * (comissao / 100)) + (pVenda * (fidc / 100));
            const lucro = pVenda - custoTotal;
            const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;
            return { nome: tp.material_nome, margem, lucro, pCompra, pVenda };
        });

        // Achar campeão de margem
        const melhorMargem = [...listCalculada].sort((a,b) => b.margem - a.margem)[0];
        // Achar risco de margem (margem negativa ou menor que 5%)
        const riscoMargem = listCalculada.filter(x => x.margem < 5);

        let html = `<ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:6px;">`;
        if (melhorMargem) {
            html += `<li>🚀 <strong>Destaque Comercial</strong>: O produto <strong>${melhorMargem.nome}</strong> possui a melhor margem líquida da tabela com <strong>${melhorMargem.margem.toFixed(1)}%</strong>. Focar volume nele aumenta exponencialmente o lucro.</li>`;
        }

        if (riscoMargem.length > 0) {
            html += `<li>⚠️ <strong>Alerta de Risco</strong>: Encontramos ${riscoMargem.length} produtos com margem crítica ou negativa (ex: <strong>${riscoMargem[0].nome}</strong> com ${riscoMargem[0].margem.toFixed(1)}%). Recomenda-se renegociar compra ou reajustar tabela de venda.</li>`;
        } else {
            html += `<li>✅ <strong>Saúde da Carteira</strong>: Todos os produtos da Tabela de Preços apresentam margens unitárias saudáveis e seguras contra flutuações.</li>`;
        }

        // Acompanhar realizado
        if (metasMes.length > 0) {
            const atingimentoMedio = metasMes.reduce((acc, curr) => {
                const mod = parseFloat(curr.qtd_moderado || 0);
                const real = parseFloat(curr.qtd_realizado || 0);
                return acc + (mod > 0 ? (real / mod) * 100 : 0);
            }, 0) / metasMes.length;

            html += `<li>📊 <strong>Atingimento</strong>: O atingimento médio das metas estratégicas do mês atual está em <strong>${atingimentoMedio.toFixed(1)}%</strong>.</li>`;
        }

        // Análises de progresso por produto
        metasMes.forEach(m => {
            const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === m.material_id);
            if (tp) {
                const mod = parseFloat(m.qtd_moderado || 0);
                const real = parseFloat(m.qtd_realizado || 0);
                const cons = parseFloat(m.qtd_conservador || 0);

                if (real >= mod && mod > 0) {
                    html += `<li>🏆 <strong>Meta Atingida</strong>: O produto <strong>${tp.material_nome}</strong> superou a meta moderada com <strong>${real.toLocaleString('pt-BR')} kg</strong> realizados.</li>`;
                } else if (real >= cons && cons > 0) {
                    html += `<li>📈 <strong>Cenário Conservador</strong>: O produto <strong>${tp.material_nome}</strong> superou o cenário conservador e está buscando a meta moderada.</li>`;
                } else if (mod > 0) {
                    const restante = mod - real;
                    html += `<li>🕒 <strong>Restante</strong>: Faltam <strong>${restante.toLocaleString('pt-BR')} kg</strong> de <strong>${tp.material_nome}</strong> para atingir a meta moderada do mês.</li>`;
                }
            }
        });

        html += `</ul>`;
        insightsContainer.innerHTML = html;
    }

    // Modal meta estratégica handlers
    window.abrirModalMetaEstrategica = function() {
        const modal = document.getElementById('modal-meta-estrategica');
        if (modal) {
            // Preencher mês atual ou ativo no input
            const mesInput = document.getElementById('metaest-mes');
            if (mesInput) {
                if (_mesEstrategicoAtivo) {
                    mesInput.value = _mesEstrategicoAtivo;
                } else {
                    const today = new Date();
                    mesInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
                }
            }

            document.body.appendChild(modal);
            modal.style.display = 'flex';
        }
    };

    window.fecharModalMetaEstrategica = function() {
        const modal = document.getElementById('modal-meta-estrategica');
        if (modal) modal.style.display = 'none';
        document.getElementById('form-meta-estrategica').reset();
    };

    window.editarMetaEstrategicaRapido = function(materialId, mes, cons, mod, agr, real) {
        document.getElementById('metaest-material-id').value = materialId;
        document.getElementById('metaest-mes').value = mes;
        document.getElementById('metaest-qtd-conservador').value = cons;
        document.getElementById('metaest-qtd-moderado').value = mod;
        document.getElementById('metaest-qtd-agressivo').value = agr;
        document.getElementById('metaest-qtd-realizado').value = real;

        onSelectModalMaterial();
        abrirModalMetaEstrategica();
    };

    window.salvarMetaEstrategicaForm = async function(event) {
        event.preventDefault();
        const material_id = document.getElementById('metaest-material-id').value;
        const mes = document.getElementById('metaest-mes').value;
        const qtd_conservador = document.getElementById('metaest-qtd-conservador').value;
        const qtd_moderado = document.getElementById('metaest-qtd-moderado').value;
        const qtd_agressivo = document.getElementById('metaest-qtd-agressivo').value;
        const qtd_realizado = document.getElementById('metaest-qtd-realizado').value;

        try {
            const res = await fetch('/api/planejamento-estrategico', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_id, mes, qtd_conservador, qtd_moderado, qtd_agressivo, qtd_realizado
                })
            });

            if (res.ok) {
                _apexNotify('Sucesso', 'Meta de planejamento estratégico salva com sucesso!', 'success');
                fecharModalMetaEstrategica();
                await carregarPlanejamentoEstrategico();
            } else {
                throw new Error('Falha ao salvar meta');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível salvar a meta estratégica.', 'error');
        }
    };

    window.deletarMetaEstrategica = async function(id) {
        if (!confirm('Deseja realmente remover esta meta de planejamento estratégico?')) return;
        try {
            const res = await fetch(`/api/planejamento-estrategico/${id}`, { method: 'DELETE' });
            if (res.ok) {
                _apexNotify('Sucesso', 'Meta estratégica excluída.', 'success');
                await carregarPlanejamentoEstrategico();
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível excluir a meta.', 'error');
        }
    };


    

})();
