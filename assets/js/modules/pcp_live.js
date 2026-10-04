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

        const atingimento = totalProgToDate > 0 ? ((totalReal / p.meta_mensal) * 100).toFixed(1) : 0;
        const desvio = totalReal - totalProgToDate;
        const diasRestantes = Math.max(0, p.dias_trabalhados - daysProd);
        const metaRestanteKg = Math.max(0, parseFloat(p.meta_mensal) - totalReal);
        const ritmoNecessario = diasRestantes > 0 ? (metaRestanteKg / diasRestantes).toFixed(1) : 0;

        document.getElementById('pcp-dashboard-cards').innerHTML = `
            <div class="kpi-card" style="padding:18px; text-align:center; background:#0d1c2b; border-left:4px solid #38bdf8; border-radius:8px;">
                <p style="color:#a0aec0; margin:0; font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-bullseye" style="color:#38bdf8;"></i> META DO MÊS</p>
                <h3 style="margin:8px 0 0 0; color:#38bdf8; font-size:1.5rem; font-weight:800;">${parseFloat(p.meta_mensal).toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</h3>
                <small style="color:#aaa;">Meta total da fábrica</small>
            </div>
            <div class="kpi-card" style="padding:18px; text-align:center; background:#0d1c2b; border-left:4px solid #4ade80; border-radius:8px;">
                <p style="color:#a0aec0; margin:0; font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-industry" style="color:#4ade80;"></i> REAL ACUMULADO</p>
                <h3 style="margin:8px 0 0 0; color:#4ade80; font-size:1.5rem; font-weight:800;">${totalReal.toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</h3>
                <small style="color:#aaa;">Produção computada</small>
            </div>
            <div class="kpi-card" style="padding:18px; text-align:center; background:#0d1c2b; border-left:4px solid ${atingimento >= 100 ? '#4ade80' : '#facc15'}; border-radius:8px;">
                <p style="color:#a0aec0; margin:0; font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-chart-pie" style="color:#facc15;"></i> ATINGIMENTO DA META</p>
                <h3 style="margin:8px 0 0 0; color:${atingimento >= 100 ? '#4ade80' : '#facc15'}; font-size:1.5rem; font-weight:800;">${atingimento}%</h3>
                <div style="background:#1e293b; height:6px; border-radius:3px; margin-top:8px; overflow:hidden;">
                    <div style="background:${atingimento >= 100 ? '#4ade80' : '#facc15'}; width:${Math.min(100, atingimento)}%; height:100%;"></div>
                </div>
            </div>
            <div class="kpi-card" style="padding:18px; text-align:center; background:#0d1c2b; border-left:4px solid ${desvio < 0 ? '#ef4444' : '#4ade80'}; border-radius:8px;">
                <p style="color:#a0aec0; margin:0; font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-scale-balanced" style="color:#00d2d3;"></i> DESVIO VS PROGRAMADO</p>
                <h3 style="margin:8px 0 0 0; color:${desvio < 0 ? '#ef4444' : '#4ade80'}; font-size:1.5rem; font-weight:800;">${desvio.toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</h3>
                <small style="color:#aaa;">Real - Programado</small>
            </div>
            <div class="kpi-card" style="padding:18px; text-align:center; background:#0d1c2b; border-left:4px solid #c084fc; border-radius:8px;">
                <p style="color:#a0aec0; margin:0; font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-stopwatch" style="color:#c084fc;"></i> RITMO NECESSÁRIO</p>
                <h3 style="margin:8px 0 0 0; color:#c084fc; font-size:1.5rem; font-weight:800;">${parseFloat(ritmoNecessario).toLocaleString('pt-BR')} kg/dia</h3>
                <small style="color:#aaa;">${diasRestantes} dias úteis restantes</small>
            </div>
        `;

        const tb = document.getElementById('pcp-tbody-resumo');
        tb.innerHTML = '';
        p.linhas.forEach(l => {
            const perc = (parseFloat(l.percentual_carga)*100).toFixed(2);
            tb.innerHTML += `
                <tr>
                    <td style="font-weight:bold; color:#00d2d3;">Linha ${l.numero_linha}</td>
                    <td>${parseFloat(l.meta_mensal).toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</td>
                    <td>${parseFloat(l.meta_diaria).toLocaleString('pt-BR', {minimumFractionDigits:2})} kg/dia</td>
                    <td>${perc}%</td>
                    <td><span style="background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">Operacional</span></td>
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
            const atingimento = metaTot > 0 ? (rTot / metaTot) * 100 : 0;
            
            let status = 'Aguardando';
            let statusColor = '#a0aec0';
            if (rTot > 0) {
                if (atingimento >= 100) { status = 'Meta Atingida'; statusColor = '#4ade80'; }
                else if (atingimento >= 90) { status = 'Atenção'; statusColor = '#facc15'; }
                else { status = 'Abaixo da Meta'; statusColor = '#ef4444'; }
            }

            tb.innerHTML += `
                <tr data-pdid="${d.id}" style="background: ${rTot > 0 ? 'rgba(0, 210, 211, 0.05)' : 'transparent'}">
                    <td style="position:sticky; left:0; width:45px; min-width:45px; max-width:45px; background:#101a24; border-right:1px solid #2d3748; z-index:5; text-align:center; font-weight:bold; color:#00d2d3;">${idx + 1}</td>
                    <td style="position:sticky; left:45px; width:95px; min-width:95px; max-width:95px; background:#101a24; border-right:2px solid #2d3748; z-index:5; font-weight:600;">${dataStr}</td>
                    <td style="color:#64748b; text-align:right;">${parseFloat(d.meta_l1).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td style="color:#64748b; text-align:right;">${parseFloat(d.meta_l2).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td style="color:#64748b; text-align:right;">${parseFloat(d.meta_l3).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td style="color:#64748b; text-align:right; border-right:2px solid #2d3748;">${parseFloat(d.meta_l4).toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    
                    <td><input type="number" step="0.01" class="form-control pcp-real-l1" value="${r1 > 0 ? r1 : ''}" style="width:75px; padding:6px; background:#0d1826; color:#00e5ff; font-weight:bold; border:1px solid #1e4e8c; border-radius:4px; text-align:right;" oninput="pcpUI.onRealInputChanged(this, ${d.id})"></td>
                    <td><input type="number" step="0.01" class="form-control pcp-real-l2" value="${r2 > 0 ? r2 : ''}" style="width:75px; padding:6px; background:#0d1826; color:#00e5ff; font-weight:bold; border:1px solid #1e4e8c; border-radius:4px; text-align:right;" oninput="pcpUI.onRealInputChanged(this, ${d.id})"></td>
                    <td><input type="number" step="0.01" class="form-control pcp-real-l3" value="${r3 > 0 ? r3 : ''}" style="width:75px; padding:6px; background:#0d1826; color:#00e5ff; font-weight:bold; border:1px solid #1e4e8c; border-radius:4px; text-align:right;" oninput="pcpUI.onRealInputChanged(this, ${d.id})"></td>
                    <td style="border-right:2px solid #2d3748;"><input type="number" step="0.01" class="form-control pcp-real-l4" value="${r4 > 0 ? r4 : ''}" style="width:75px; padding:6px; background:#0d1826; color:#00e5ff; font-weight:bold; border:1px solid #1e4e8c; border-radius:4px; text-align:right;" oninput="pcpUI.onRealInputChanged(this, ${d.id})"></td>
                    
                    <td class="pcp-meta-tot-dia" data-val="${metaTot}" style="font-weight:bold; color:#38bdf8; text-align:right;">${metaTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td class="pcp-val-tot-real" style="font-weight:bold; color:#4ade80; text-align:right;">${rTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td class="pcp-val-desvio" style="color:${desvioDia < 0 ? '#ef4444' : (desvioDia > 0 ? '#4ade80' : '#a0aec0')}; text-align:right; font-weight:bold;">${desvioDia.toLocaleString('pt-BR', {maximumFractionDigits:2})}</td>
                    <td class="pcp-val-ating" style="font-weight:bold; text-align:right;">${atingimento.toFixed(1)}%</td>
                    
                    <td style="color:#38bdf8; text-align:right;">${acumProg.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:2})}</td>
                    <td style="color:#4ade80; text-align:right; font-weight:bold;">${acumReal.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:2})}</td>
                    
                    <td class="pcp-val-status" style="font-weight:bold; font-size:0.8rem; color:${statusColor}; border-left:2px solid #2d3748; text-align:center;">${status}</td>
                    <td><input type="text" class="form-control pcp-obs" placeholder="Observação..." value="${d.observacao || ''}" style="width:140px; padding:6px; background:#0d1826; color:#fff; border:1px solid #1e4e8c; border-radius:4px;" onchange="pcpUI.salvarProducao(${d.id})"></td>
                </tr>
            `;
        });
    },

    onRealInputChanged: function(inputEl, pdId) {
        const tr = document.querySelector(`tr[data-pdid="${pdId}"]`);
        if (!tr) return;

        const l1 = parseFloat(tr.querySelector('.pcp-real-l1')?.value || 0);
        const l2 = parseFloat(tr.querySelector('.pcp-real-l2')?.value || 0);
        const l3 = parseFloat(tr.querySelector('.pcp-real-l3')?.value || 0);
        const l4 = parseFloat(tr.querySelector('.pcp-real-l4')?.value || 0);
        const metaTot = parseFloat(tr.querySelector('.pcp-meta-tot-dia')?.getAttribute('data-val') || 0);

        const rTot = l1 + l2 + l3 + l4;
        const desvioDia = rTot - metaTot;
        const atingimento = metaTot > 0 ? (rTot / metaTot) * 100 : 0;

        const elTotReal = tr.querySelector('.pcp-val-tot-real');
        const elDesvio = tr.querySelector('.pcp-val-desvio');
        const elAting = tr.querySelector('.pcp-val-ating');
        const elStatus = tr.querySelector('.pcp-val-status');

        if (elTotReal) elTotReal.textContent = rTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
        if (elDesvio) {
            elDesvio.textContent = desvioDia.toLocaleString('pt-BR', {maximumFractionDigits:2});
            elDesvio.style.color = desvioDia < 0 ? '#ef4444' : (desvioDia > 0 ? '#4ade80' : '#a0aec0');
        }
        if (elAting) elAting.textContent = atingimento.toFixed(1) + '%';
        if (elStatus) {
            if (rTot > 0) {
                if (atingimento >= 100) { elStatus.textContent = 'Meta Atingida'; elStatus.style.color = '#4ade80'; }
                else if (atingimento >= 90) { elStatus.textContent = 'Atenção'; elStatus.style.color = '#facc15'; }
                else { elStatus.textContent = 'Abaixo da Meta'; elStatus.style.color = '#ef4444'; }
            } else {
                elStatus.textContent = 'Aguardando'; elStatus.style.color = '#a0aec0';
            }
        }

        if (tr._saveTimeout) clearTimeout(tr._saveTimeout);
        tr._saveTimeout = setTimeout(() => {
            pcpUI.salvarProducao(pdId);
        }, 600);
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
