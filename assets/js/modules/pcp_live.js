const pcpUI = {
    planos: [],
    selectedPlan: null,
    materiais: [],
    chartAcumulado: null,
    chartDiario: null,

    init: async function() {
        await this.carregarMateriaisPCP();
        await this.carregarPlanos();
        
        // Setup initial tab
        const firstTab = document.querySelector('.tab-btn[data-target="pcp-tab-resumo"]');
        if (firstTab) this.switchTab(firstTab);
    },

    carregarMateriaisPCP: async function() {
        try {
            const res = await fetch('/api/materiais-catalogo');
            if (res.ok) {
                const data = await res.json();
                this.materiais = data;
            }
        } catch (e) { console.error('Erro ao carregar materiais', e); }
    },

    carregarPlanos: async function() {
        try {
            const res = await fetch('/api/pcp');
            if (res.ok) {
                this.planos = await res.json();
                this.renderSelectPlanos();
                
                if (this.planos.length > 0) {
                    const sel = document.getElementById('pcp-select-plano');
                    sel.value = this.planos[0].id;
                    await this.carregarPlanoSelecionado();
                }
            }
        } catch(e) { console.error('Erro ao carregar planos', e); }
    },

    renderSelectPlanos: function() {
        const sel = document.getElementById('pcp-select-plano');
        sel.innerHTML = '<option value="">Selecione um planejamento...</option>';
        this.planos.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${String(p.mes).padStart(2, '0')}/${p.ano} - Meta: ${parseFloat(p.meta_mensal).toLocaleString('pt-BR')}kg</option>`;
        });
    },

    carregarPlanoSelecionado: async function() {
        const id = document.getElementById('pcp-select-plano').value;
        if (!id) {
            document.getElementById('pcp-workspace').style.display = 'none';
            return;
        }

        try {
            const res = await fetch(`/api/pcp/${id}`);
            if (res.ok) {
                this.selectedPlan = await res.json();
                document.getElementById('pcp-workspace').style.display = 'block';
                this.renderAll();
            }
        } catch (e) {
            console.error(e);
            if (window._apexNotify) window._apexNotify('Erro', 'Erro ao carregar os dados do plano.', 'error');
        }
    },

    recarregarTudo: async function() {
        await this.carregarPlanoSelecionado();
    },

    switchTab: function(btn) {
        document.querySelectorAll('#pcp-workspace .tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderBottomColor = 'transparent';
            b.style.color = '#cbd5e0';
        });
        btn.classList.add('active');
        btn.style.borderBottomColor = '#00d2d3';
        btn.style.color = '#00d2d3';

        document.querySelectorAll('.pcp-tab-content').forEach(c => c.style.display = 'none');
        document.getElementById(btn.getAttribute('data-target')).style.display = 'block';

        if (btn.getAttribute('data-target') === 'pcp-tab-resumo') {
            this.renderGraficos();
        }
    },

    abrirModalNovoPlano: function() {
        document.getElementById('modal-pcp-novo').style.display = 'flex';
        document.getElementById('pcp-novo-ano').value = new Date().getFullYear();
        document.getElementById('pcp-novo-mes').value = new Date().getMonth() + 1;
    },

    salvarNovoPlano: async function(e) {
        e.preventDefault();
        
        let metaVal = document.getElementById('pcp-novo-meta').value;
        metaVal = metaVal.replace(',', '.'); // Previne erro de sintaxe se usuário digitar vírgula

        const payload = {
            ano: document.getElementById('pcp-novo-ano').value,
            mes: document.getElementById('pcp-novo-mes').value,
            meta_mensal: metaVal,
            dias_trabalhados: document.getElementById('pcp-novo-dias').value,
            qtd_linhas: document.getElementById('pcp-novo-linhas').value,
            criado_por: window.currentUser ? window.currentUser.nome : 'Administrador'
        };

        try {
            const res = await fetch('/api/pcp', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                document.getElementById('modal-pcp-novo').style.display = 'none';
                await this.carregarPlanos();
                const mixTab = document.querySelector('.tab-btn[data-target="pcp-tab-mix"]');
                if (mixTab) this.switchTab(mixTab);
                if (window._apexNotify) window._apexNotify('Sucesso', 'Planejamento criado com sucesso!', 'success');
            } else {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData.error || 'Verifique se os dados estão corretos.';
                if (window._apexNotify) window._apexNotify('Erro ao criar o plano', errMsg, 'error');
            }
        } catch(e) { 
            console.error(e);
            if (window._apexNotify) window._apexNotify('Erro Crítico', e.message, 'error');
        }
    },

    renderAll: function() {
        this.renderDashboard();
        this.renderMix();
        this.renderDiario();
        this.renderOperacional();
        this.renderGraficos();
    },

    renderDashboard: function() {
        const p = this.selectedPlan;
        let totalReal = 0;
        let totalProgToDate = 0;
        let daysProd = 0;
        
        p.diario.forEach(d => {
            if (parseFloat(d.real_total) > 0) {
                totalReal += parseFloat(d.real_total);
                daysProd++;
            }
            totalProgToDate += parseFloat(d.meta_total_dia);
        });

        const atingimento = totalProgToDate > 0 ? ((totalReal / p.meta_mensal) * 100).toFixed(2) : 0;
        const desvio = totalReal - totalProgToDate;

        document.getElementById('pcp-dashboard-cards').innerHTML = `
            <div class="kpi-card" style="padding:15px; text-align:center;">
                <p style="color:#a0aec0; margin:0; font-size:0.85rem;">META DO MÊS</p>
                <h3 style="margin:5px 0 0 0; color:#38bdf8;">${parseFloat(p.meta_mensal).toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</h3>
            </div>
            <div class="kpi-card" style="padding:15px; text-align:center;">
                <p style="color:#a0aec0; margin:0; font-size:0.85rem;">REAL ACUMULADO</p>
                <h3 style="margin:5px 0 0 0; color:#4ade80;">${totalReal.toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</h3>
            </div>
            <div class="kpi-card" style="padding:15px; text-align:center;">
                <p style="color:#a0aec0; margin:0; font-size:0.85rem;">ATINGIMENTO</p>
                <h3 style="margin:5px 0 0 0; color:${atingimento >= 100 ? '#4ade80' : '#facc15'};">${atingimento}%</h3>
            </div>
            <div class="kpi-card" style="padding:15px; text-align:center;">
                <p style="color:#a0aec0; margin:0; font-size:0.85rem;">DESVIO</p>
                <h3 style="margin:5px 0 0 0; color:${desvio < 0 ? '#ef4444' : '#4ade80'};">${desvio.toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</h3>
            </div>
            <div class="kpi-card" style="padding:15px; text-align:center;">
                <p style="color:#a0aec0; margin:0; font-size:0.85rem;">DIAS PRODUZIDOS</p>
                <h3 style="margin:5px 0 0 0; color:#c084fc;">${daysProd} / ${p.dias_trabalhados}</h3>
            </div>
        `;

        const tb = document.getElementById('pcp-tbody-resumo');
        tb.innerHTML = '';
        p.linhas.forEach(l => {
            const perc = (parseFloat(l.percentual_carga)*100).toFixed(4);
            tb.innerHTML += `
                <tr>
                    <td>Linha ${l.numero_linha}</td>
                    <td>${parseFloat(l.meta_mensal).toLocaleString('pt-BR', {minimumFractionDigits:1})}</td>
                    <td>${parseFloat(l.meta_diaria).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td>${perc}%</td>
                    <td><span style="color:#4ade80;">Ativo</span></td>
                </tr>
            `;
        });
    },

    renderMix: function() {
        const p = this.selectedPlan;
        const tb = document.getElementById('pcp-tbody-mix');
        tb.innerHTML = '';
        
        let localMix = [...p.mix];
        if (localMix.length === 0) {
            const defaults = [
                { nome: "Sucata de fio misto sujo (ELETRONICO)", linha: 4, vol: 23437.5 },
                { nome: "Sucata de induzidos", linha: 3, vol: 6521.7 },
                { nome: "Sucata de transformadores Cobre", linha: 3, vol: 6787.3 },
                { nome: "Sucata de cooler", linha: 3, vol: 3333.3 },
                { nome: "Sucata de disjuntores", linha: 3, vol: 6802.7 },
                { nome: "Sucata de tomada e conectores", linha: 4, vol: 43731.8 },
                { nome: "Sucata de fio de instalação", linha: 1, vol: 1585.6 },
                { nome: "Sucata de fio de internet", linha: 3, vol: 2135.2 },
                { nome: "Sucata de fio misto limpo", linha: 2, vol: 9497.4 },
                { nome: "Ajuste de arredondamento", linha: 4, vol: 0.2 }
            ];

            defaults.forEach((def, index) => {
                const mat = this.materiais.find(m => m.nome === def.nome);
                if (mat) {
                    localMix.push({
                        id: 'new_'+index,
                        material_id: mat.id,
                        material_nome: mat.nome,
                        numero_linha: def.linha,
                        volume_total: def.vol
                    });
                }
            });
        }

        localMix.forEach((item, idx) => {
            const perc = ((parseFloat(item.volume_total) / p.meta_mensal)*100).toFixed(1);
            const metaDia = (parseFloat(item.volume_total) / p.dias_trabalhados).toFixed(2);
            
            let linhaInfo = p.linhas.find(l => l.numero_linha == item.numero_linha) || { meta_mensal: 0, meta_diaria: 0, percentual_carga: 0 };
            const metaLinhaMes = parseFloat(linhaInfo.meta_mensal).toLocaleString('pt-BR', {minimumFractionDigits:3});
            const metaLinhaDia = parseFloat(linhaInfo.meta_diaria).toLocaleString('pt-BR', {minimumFractionDigits:3});
            const cargaLinha = (parseFloat(linhaInfo.percentual_carga) * 100).toFixed(1);

            let matOptions = '<option value="">Selecionar...</option>';
            this.materiais.forEach(m => {
                matOptions += `<option value="${m.id}" ${m.id == item.material_id ? 'selected' : ''}>${m.nome}</option>`;
            });

            tb.innerHTML += `
                <tr data-idx="${idx}">
                    <td><select class="form-control mix-mat" style="width:250px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;">${matOptions}</select></td>
                    <td><input type="number" step="0.0001" class="form-control mix-vol" value="${item.volume_total || 0}" style="width:120px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.updateMixConferencia()"></td>
                    <td class="mix-perc">${perc}%</td>
                    <td><input type="number" class="form-control mix-linha" value="${item.numero_linha || ''}" min="1" max="4" style="width:80px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.updateMixConferencia()"></td>
                    <td class="mix-metadia">${metaDia}</td>
                    <td>${metaLinhaMes}</td>
                    <td>${metaLinhaDia}</td>
                    <td>${cargaLinha}%</td>
                </tr>
            `;
        });
        
        let emptyOpts = '<option value="">Selecionar produto...</option>';
        this.materiais.forEach(m => { emptyOpts += `<option value="${m.id}">${m.nome}</option>`; });
        tb.innerHTML += `
            <tr data-idx="new">
                <td><select class="form-control mix-mat" style="width:250px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;">${emptyOpts}</select></td>
                <td><input type="number" step="0.0001" class="form-control mix-vol" value="" style="width:120px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.updateMixConferencia()"></td>
                <td class="mix-perc">-</td>
                <td><input type="number" class="form-control mix-linha" value="" min="1" max="4" style="width:80px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.updateMixConferencia()"></td>
                <td class="mix-metadia">-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            </tr>
        `;

        this.updateMixConferencia();
    },

    updateMixConferencia: function() {
        const p = this.selectedPlan;
        if(!p) return;

        let total = 0;
        document.querySelectorAll('.mix-vol').forEach(el => {
            if (el.value) total += parseFloat(el.value);
        });

        const confEl = document.getElementById('pcp-conferencia-mix');
        const diff = Math.abs(total - parseFloat(p.meta_mensal));
        
        if (diff < 0.01) {
            confEl.innerHTML = `<span style="background:#065f46; color:#a7f3d0; padding:5px 10px; border-radius:5px; font-weight:bold;">CONFERÊNCIA: OK</span>`;
        } else {
            confEl.innerHTML = `<span style="background:#991b1b; color:#fca5a5; padding:5px 10px; border-radius:5px; font-weight:bold;">DIVERGÊNCIA: ${diff.toLocaleString('pt-BR')} kg</span>`;
        }
    },

    salvarMix: async function() {
        const mixData = [];
        document.querySelectorAll('#pcp-tbody-mix tr').forEach(tr => {
            const matSel = tr.querySelector('.mix-mat');
            const linIn = tr.querySelector('.mix-linha');
            const volIn = tr.querySelector('.mix-vol');
            if (matSel && matSel.value && linIn.value && volIn.value) {
                mixData.push({
                    material_id: parseInt(matSel.value),
                    linha_id: null,
                    numero_linha: parseInt(linIn.value),
                    volume_total: parseFloat(volIn.value)
                });
            }
        });

        try {
            const res = await fetch(`/api/pcp/${this.selectedPlan.id}/mix`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ mix: mixData })
            });
            if (res.ok) {
                if (window._apexNotify) window._apexNotify('Mix Salvo', 'As metas diárias foram recalculadas com sucesso!', 'success');
                await this.carregarPlanoSelecionado();
            } else {
                if (window._apexNotify) window._apexNotify('Erro', 'Ocorreu um erro ao salvar o Mix de Produtos.', 'error');
            }
        } catch (e) { 
            console.error(e); 
            if (window._apexNotify) window._apexNotify('Erro Crítico', e.message, 'error');
        }
    },

    renderDiario: function() {
        const p = this.selectedPlan;
        const tb = document.getElementById('pcp-tbody-diario');
        tb.innerHTML = '';
        
        let acumDiario = 0;
        p.diario.forEach((d, idx) => {
            const dataStr = new Date(d.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            acumDiario += parseFloat(d.meta_total_dia);
            const percMeta = ((acumDiario / p.meta_mensal) * 100).toFixed(1);
            tb.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${dataStr}</td>
                    <td>${parseFloat(d.meta_l1).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td>${parseFloat(d.meta_l2).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td>${parseFloat(d.meta_l3).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td>${parseFloat(d.meta_l4).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="font-weight:bold; color:#38bdf8;">${parseFloat(d.meta_total_dia).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td>${acumDiario.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td>${percMeta}%</td>
                    <td>${d.observacao || ''}</td>
                </tr>
            `;
        });
    },

    renderOperacional: function() {
        const p = this.selectedPlan;
        const tb = document.getElementById('pcp-tbody-operacional');
        tb.innerHTML = '';

        let acumProg = 0;
        let acumReal = 0;

        p.diario.forEach((d, idx) => {
            const dataStr = new Date(d.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            
            const metaTot = parseFloat(d.meta_total_dia) || 0;
            const r1 = parseFloat(d.real_l1) || 0;
            const r2 = parseFloat(d.real_l2) || 0;
            const r3 = parseFloat(d.real_l3) || 0;
            const r4 = parseFloat(d.real_l4) || 0;
            const rTot = parseFloat(d.real_total) || 0;
            
            acumProg += metaTot;
            acumReal += rTot;

            const desvioDia = rTot - metaTot;
            const desvioAcum = acumReal - acumProg;
            const atingimento = metaTot > 0 ? (rTot / metaTot) * 100 : 0;
            
            let status = 'Aguardando';
            let statusColor = '#a0aec0';
            if (rTot > 0) {
                if (atingimento >= 100) { status = 'Meta Atingida'; statusColor = '#4ade80'; }
                else if (atingimento >= 90) { status = 'Atenção'; statusColor = '#facc15'; }
                else { status = 'Abaixo da Meta'; statusColor = '#ef4444'; }
            }

            tb.innerHTML += `
                <tr data-pdid="${d.id}" style="background: ${rTot > 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}">
                    <td style="position:sticky; left:0; width:45px; min-width:45px; max-width:45px; background:#101a24; border-right:1px solid #2d3748; z-index:5;">${idx + 1}</td>
                    <td style="position:sticky; left:45px; width:95px; min-width:95px; max-width:95px; background:#101a24; border-right:2px solid #2d3748; z-index:5;">${dataStr}</td>
                    <td style="color:#64748b;">${parseFloat(d.meta_l1).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td style="color:#64748b;">${parseFloat(d.meta_l2).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td style="color:#64748b;">${parseFloat(d.meta_l3).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td style="color:#64748b; border-right:2px solid #2d3748;">${parseFloat(d.meta_l4).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    
                    <td><input type="number" step="0.01" class="form-control pcp-real-l1" value="${r1 > 0 ? r1 : ''}" style="width:70px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.salvarProducao(${d.id})"></td>
                    <td><input type="number" step="0.01" class="form-control pcp-real-l2" value="${r2 > 0 ? r2 : ''}" style="width:70px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.salvarProducao(${d.id})"></td>
                    <td><input type="number" step="0.01" class="form-control pcp-real-l3" value="${r3 > 0 ? r3 : ''}" style="width:70px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.salvarProducao(${d.id})"></td>
                    <td style="border-right:2px solid #2d3748;"><input type="number" step="0.01" class="form-control pcp-real-l4" value="${r4 > 0 ? r4 : ''}" style="width:70px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.salvarProducao(${d.id})"></td>
                    
                    <td style="font-weight:bold; color:#38bdf8;">${metaTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td style="font-weight:bold; color:#4ade80;">${rTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td style="color:${desvioDia < 0 ? '#ef4444' : (desvioDia > 0 ? '#4ade80' : '#a0aec0')}">${desvioDia.toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td>${atingimento.toFixed(1)}%</td>
                    
                    <td style="color:#38bdf8;">${acumProg.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:2})}</td>
                    <td style="color:#4ade80;">${acumReal.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:2})}</td>
                    
                    <td style="font-weight:bold; font-size:0.75rem; color:${statusColor}; border-left:2px solid #2d3748;">${status}</td>
                    <td><input type="text" class="form-control pcp-obs" placeholder="Obs" value="${d.observacao || ''}" style="width:120px; padding:6px; background:#1a2e3f; color:#fff; border:1px solid #2d3748; border-radius:4px;" onchange="pcpUI.salvarProducao(${d.id})"></td>
                </tr>
            `;
        });
    },

    salvarProducao: async function(pdId) {
        const tr = document.querySelector(`tr[data-pdid="${pdId}"]`);
        if (!tr) return;

        const l1 = tr.querySelector('.pcp-real-l1').value;
        const l2 = tr.querySelector('.pcp-real-l2').value;
        const l3 = tr.querySelector('.pcp-real-l3').value;
        const l4 = tr.querySelector('.pcp-real-l4').value;
        const obs = tr.querySelector('.pcp-obs').value;

        const payload = {
            real_l1: l1,
            real_l2: l2,
            real_l3: l3,
            real_l4: l4,
            observacao: obs,
            atualizado_por: window.currentUser ? window.currentUser.nome : 'Administrador'
        };

        try {
            const res = await fetch(`/api/pcp/producao/${pdId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (res.ok) await this.carregarPlanoSelecionado();
        } catch (e) {
            console.error('Erro ao salvar producao', e);
        }
    },

    renderGraficos: function() {
        if (!this.selectedPlan) return;
        const p = this.selectedPlan;

        const labels = [];
        const dsProgDiario = [];
        const dsRealDiario = [];
        const dsProgAcum = [];
        const dsRealAcum = [];

        let acumP = 0;
        let acumR = 0;

        p.diario.forEach(d => {
            const l = new Date(d.data).getDate();
            labels.push(l);
            
            const meta = parseFloat(d.meta_total_dia) || 0;
            const real = parseFloat(d.real_total) || 0;

            dsProgDiario.push(meta);
            dsRealDiario.push(real);

            acumP += meta;
            acumR += real;

            dsProgAcum.push(acumP);
            dsRealAcum.push(real > 0 ? acumR : (acumR > 0 ? acumR : 0)); 
        });

        const ctx1 = document.getElementById('pcp-chart-diario');
        if (this.chartDiario) this.chartDiario.destroy();
        if (ctx1) {
            this.chartDiario = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Programado Dia', data: dsProgDiario, backgroundColor: '#38bdf8' },
                        { label: 'Realizado Dia', data: dsRealDiario, backgroundColor: '#4ade80' }
                    ]
                },
                options: { responsive: true, plugins: { title: { display: true, text: 'Produção Diária (kg)', color:'#fff' }, legend: {labels: {color:'#fff'}} }, scales: {x:{ticks:{color:'#fff'}}, y:{ticks:{color:'#fff'}}} }
            });
        }

        const ctx2 = document.getElementById('pcp-chart-acumulado');
        if (this.chartAcumulado) this.chartAcumulado.destroy();
        if (ctx2) {
            this.chartAcumulado = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Programado Acum', data: dsProgAcum, borderColor: '#38bdf8', fill: false, tension: 0.1 },
                        { label: 'Realizado Acum', data: dsRealAcum, borderColor: '#4ade80', fill: false, tension: 0.1 }
                    ]
                },
                options: { responsive: true, plugins: { title: { display: true, text: 'Acumulado Mês (kg)', color:'#fff' }, legend: {labels: {color:'#fff'}} }, scales: {x:{ticks:{color:'#fff'}}, y:{ticks:{color:'#fff'}}} }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btnPcp = document.getElementById('nav-pcp');
    if (btnPcp) {
        btnPcp.addEventListener('click', () => {
            if (pcpUI.planos.length === 0) pcpUI.init();
        });
    }
});
