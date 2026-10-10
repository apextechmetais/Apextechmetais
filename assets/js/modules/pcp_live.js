/**
 * PCP — Planejamento e Controle da Produção.
 * Três etapas, na ordem em que o trabalho acontece:
 *   1. Visão geral: meta do mês, quanto já foi produzido e o ritmo necessário.
 *   2. Mix de produtos: o que cada linha vai produzir; define a meta de cada linha e de cada dia.
 *   3. Apontamento diário: a produção real de cada linha, dia a dia.
 */
window.pcpUI = {
    planos: [],
    plano: null,
    materiais: [],
    mixEdicao: [],
    aba: 'geral',
    chartDiario: null,
    chartAcumulado: null,
    _salvando: {},

    // ───────── utilidades ─────────
    el: (id) => document.getElementById(id),
    esc: (t) => String(t == null ? '' : t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    kg: (v, casas = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }),
    MESES: ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    DIAS: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    hojeIso: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
    avisar: (titulo, msg, tipo) => { if (window._apexNotify) window._apexNotify(titulo, msg, tipo || 'info'); },

    async api(url, opcoes) {
        const res = await fetch(url, Object.assign({ cache: 'no-store' }, opcoes));
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(dados.error || 'Não foi possível concluir a operação.');
        return dados;
    },

    // ───────── carga ─────────
    async init() {
        try {
            const mats = await this.api('/api/materiais-catalogo').catch(() => []);
            this.materiais = (Array.isArray(mats) ? mats : (mats.data || [])).map(m => ({ id: m.id, nome: m.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            await this.carregarPlanos();
        } catch (e) {
            console.error('[PCP] Erro ao iniciar:', e);
            this.avisar('PCP', e.message, 'error');
        }
    },

    async carregarPlanos(selecionarId) {
        this.planos = await this.api('/api/pcp');
        const sel = this.el('pcp-select-plano');
        sel.innerHTML = this.planos.map(p => `<option value="${p.id}">${this.MESES[p.mes] || p.mes} de ${p.ano}</option>`).join('');
        const vazio = this.planos.length === 0;
        this.el('pcp-vazio').style.display = vazio ? 'block' : 'none';
        this.el('pcp-workspace').style.display = vazio ? 'none' : 'block';
        sel.style.display = vazio ? 'none' : '';
        if (vazio) { this.plano = null; return; }
        sel.value = String(selecionarId || (this.plano && this.planos.some(p => p.id === this.plano.id) ? this.plano.id : this.planos[0].id));
        await this.carregarPlanoSelecionado();
    },

    async carregarPlanoSelecionado() {
        const id = this.el('pcp-select-plano').value;
        if (!id) return;
        try {
            this.plano = await this.api(`/api/pcp/${id}`);
            this.mixEdicao = this.plano.mix.map(m => ({ material_id: m.material_id, numero_linha: m.numero_linha, volume_total: m.volume_total }));
            this.renderTudo();
        } catch (e) {
            console.error('[PCP] Erro ao carregar o plano:', e);
            this.avisar('PCP', 'Não foi possível carregar o planejamento: ' + e.message, 'error');
        }
    },

    // ───────── cálculos ─────────
    resumo() {
        const p = this.plano, hoje = this.hojeIso();
        let real = 0, programadoAteHoje = 0, diasApontados = 0, diasPassados = 0;
        const porLinha = [0, 0, 0, 0];
        p.diario.forEach(d => {
            real += d.real_total;
            [1, 2, 3, 4].forEach(n => { porLinha[n - 1] += d['real_l' + n]; });
            if (d.real_total > 0) diasApontados++;
            // o programado "até agora" conta os dias que já passaram ou que já têm apontamento
            if (d.data <= hoje || d.real_total > 0) { programadoAteHoje += d.meta_total_dia; diasPassados++; }
        });
        const diasRestantes = p.diario.filter(d => d.data > hoje && !(d.real_total > 0)).length;
        const falta = Math.max(0, p.meta_mensal - real);
        const mixTotal = p.mix.reduce((t, m) => t + m.volume_total, 0);
        return {
            real, programadoAteHoje, diasApontados, diasPassados, diasRestantes, falta, porLinha, mixTotal,
            atingimento: p.meta_mensal > 0 ? (real / p.meta_mensal) * 100 : 0,
            desvio: real - programadoAteHoje,
            ritmo: diasRestantes > 0 ? falta / diasRestantes : 0
        };
    },

    // ───────── render ─────────
    renderTudo() {
        this.renderCabecalho();
        this.renderAbas();
        this.renderGeral();
        this.renderMix();
        this.renderDiario();
        this.mostrarAba(this.aba);
    },

    renderCabecalho() {
        const p = this.plano;
        this.el('pcp-resumo-plano').innerHTML = `
            <div>
                <strong>${this.MESES[p.mes] || p.mes} de ${p.ano}</strong>
                <span>${p.dias_trabalhados} dias úteis · ${p.qtd_linhas} ${p.qtd_linhas === 1 ? 'linha' : 'linhas'} de produção · meta de ${this.kg(p.meta_mensal)} kg</span>
                ${p.observacoes ? `<span class="pcp-obs-plano">${this.esc(p.observacoes)}</span>` : ''}
            </div>
            <button type="button" class="pcp-link-perigo" id="pcp-btn-excluir" onclick="pcpUI.excluirPlano(this)">Excluir planejamento</button>`;
    },

    // As abas são as etapas do trabalho, com a situação de cada uma
    renderAbas() {
        const r = this.resumo(), p = this.plano;
        const dif = r.mixTotal - p.meta_mensal;
        const situacao = {
            geral: `${r.atingimento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da meta`,
            mix: p.mix.length === 0 ? 'ainda não definido' : (Math.abs(dif) < 0.5 ? 'fecha com a meta' : (dif < 0 ? `faltam ${this.kg(-dif)} kg` : `${this.kg(dif)} kg acima da meta`)),
            diario: `${r.diasApontados} de ${p.diario.length} dias apontados`
        };
        const alerta = { mix: p.mix.length === 0 || Math.abs(dif) >= 0.5 };
        this.el('pcp-abas').innerHTML = [['geral', '1', 'Visão geral'], ['mix', '2', 'Mix de produtos'], ['diario', '3', 'Apontamento diário']].map(([id, n, nome]) => `
            <button type="button" role="tab" data-aba="${id}" class="pcp-aba${this.aba === id ? ' is-ativa' : ''}" aria-selected="${this.aba === id}" onclick="pcpUI.mostrarAba('${id}')">
                <span class="pcp-aba__n">${n}</span>
                <span class="pcp-aba__txt"><strong>${nome}</strong><small class="${alerta[id] ? 'is-alerta' : ''}">${situacao[id]}</small></span>
            </button>`).join('');
    },

    mostrarAba(id) {
        this.aba = id;
        ['geral', 'mix', 'diario'].forEach(a => { this.el('pcp-aba-' + a).hidden = a !== id; });
        document.querySelectorAll('#pcp-abas .pcp-aba').forEach(b => { const on = b.dataset.aba === id; b.classList.toggle('is-ativa', on); b.setAttribute('aria-selected', on); });
        if (id === 'geral') this.renderGraficos();
    },

    renderGeral() {
        const p = this.plano, r = this.resumo();
        const pct = Math.min(100, r.atingimento);
        const semMix = p.mix.length === 0;
        const cartao = (rotulo, valor, apoio, classe) => `<div class="pcp-kpi ${classe || ''}"><span>${rotulo}</span><strong>${valor}</strong><small>${apoio}</small></div>`;
        this.el('pcp-dashboard-cards').innerHTML =
            `<div class="pcp-kpi pcp-kpi--principal">
                <span>Produzido no mês</span>
                <strong>${this.kg(r.real)} <em>kg</em></strong>
                <div class="pcp-barra" role="img" aria-label="${r.atingimento.toFixed(1)}% da meta"><i style="width:${pct}%"></i></div>
                <small>${r.atingimento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da meta de ${this.kg(p.meta_mensal)} kg</small>
            </div>` +
            cartao('Falta produzir', `${this.kg(r.falta)} <em>kg</em>`, r.falta === 0 ? 'Meta do mês atingida' : `em ${r.diasRestantes} dias úteis restantes`) +
            cartao('Ritmo necessário', r.diasRestantes > 0 ? `${this.kg(r.ritmo)} <em>kg/dia</em>` : '—', r.diasRestantes > 0 ? 'para fechar a meta no prazo' : 'não há dias restantes no plano') +
            cartao('Desvio até agora', `${r.desvio > 0 ? '+' : ''}${this.kg(r.desvio)} <em>kg</em>`, semMix ? 'defina o mix para ter a meta de cada dia' : (r.desvio >= 0 ? 'acima do programado' : 'abaixo do programado'), semMix ? '' : (r.desvio >= 0 ? 'is-bom' : 'is-ruim'));

        this.el('pcp-aviso-geral').innerHTML = semMix
            ? `<p class="pcp-aviso">Este planejamento ainda não tem mix de produtos, então as linhas estão sem meta. <button type="button" class="pcp-link" onclick="pcpUI.mostrarAba('mix')">Definir o mix agora</button></p>`
            : '';

        this.el('pcp-tbody-resumo').innerHTML = p.linhas.map(l => {
            const real = r.porLinha[l.numero_linha - 1];
            const ating = l.meta_mensal > 0 ? (real / l.meta_mensal) * 100 : 0;
            return `<tr>
                <td><strong>Linha ${l.numero_linha}</strong></td>
                <td class="num">${this.kg(l.meta_mensal)} kg</td>
                <td class="num">${this.kg(l.meta_diaria)} kg</td>
                <td class="num">${(l.percentual_carga * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
                <td class="num">${this.kg(real)} kg</td>
                <td><div class="pcp-barra pcp-barra--linha"><i style="width:${Math.min(100, ating)}%"></i></div><small>${l.meta_mensal > 0 ? ating.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : 'sem meta'}</small></td>
            </tr>`;
        }).join('');
        if (this.aba === 'geral') this.renderGraficos();
    },

    renderGraficos() {
        if (!this.plano || !window.Chart) return;
        const hoje = this.hojeIso();
        const rotulos = [], prog = [], real = [], progAcum = [], realAcum = [];
        let ap = 0, ar = 0;
        this.plano.diario.forEach(d => {
            rotulos.push(d.data.slice(8, 10) + '/' + d.data.slice(5, 7));
            prog.push(d.meta_total_dia);
            real.push(d.real_total > 0 ? d.real_total : null);
            ap += d.meta_total_dia; ar += d.real_total;
            progAcum.push(ap);
            // a linha do realizado para no último dia com apontamento, em vez de seguir reta até o fim do mês
            realAcum.push(d.data <= hoje || d.real_total > 0 ? ar : null);
        });
        const opcoes = (titulo) => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: {} }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${this.kg(c.parsed.y)} kg` } }, title: { display: false, text: titulo } },
            scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: {} }, y: { beginAtZero: true, ticks: { callback: (v) => this.kg(v) }, grid: {} } } });

        if (this.chartDiario) this.chartDiario.destroy();
        this.chartDiario = new Chart(this.el('pcp-chart-diario'), { type: 'bar', data: { labels: rotulos, datasets: [
            { label: 'Programado', data: prog, backgroundColor: 'rgba(245, 246, 243, 0.22)' },
            { label: 'Realizado', data: real, backgroundColor: '#25D07F' }
        ] }, options: opcoes('Produção por dia') });

        if (this.chartAcumulado) this.chartAcumulado.destroy();
        this.chartAcumulado = new Chart(this.el('pcp-chart-acumulado'), { type: 'line', data: { labels: rotulos, datasets: [
            { label: 'Programado acumulado', data: progAcum, borderColor: 'rgba(245, 246, 243, 0.55)', borderDash: [6, 5], pointRadius: 0, fill: false },
            { label: 'Realizado acumulado', data: realAcum, borderColor: '#25D07F', backgroundColor: 'rgba(37, 208, 127, 0.12)', fill: true, spanGaps: false }
        ] }, options: opcoes('Acumulado do mês') });
    },

    // ───────── etapa 2: mix ─────────
    renderMix() {
        const p = this.plano;
        const opMateriais = (sel) => '<option value="">Escolha o material…</option>' + this.materiais.map(m => `<option value="${m.id}"${m.id == sel ? ' selected' : ''}>${this.esc(m.nome)}</option>`).join('');
        const opLinhas = (sel) => Array.from({ length: p.qtd_linhas }, (_, i) => `<option value="${i + 1}"${i + 1 == sel ? ' selected' : ''}>Linha ${i + 1}</option>`).join('');
        this.el('pcp-tbody-mix').innerHTML = this.mixEdicao.length === 0
            ? `<tr><td colspan="6" class="pcp-vazio-linha">Nenhum produto no mix. Adicione o primeiro para distribuir a meta de ${this.kg(p.meta_mensal)} kg entre as linhas.</td></tr>`
            : this.mixEdicao.map((m, i) => `<tr>
                <td><select class="noble-input" aria-label="Material" onchange="pcpUI.mudarMix(${i}, 'material_id', this.value)">${opMateriais(m.material_id)}</select></td>
                <td><select class="noble-input" aria-label="Linha" onchange="pcpUI.mudarMix(${i}, 'numero_linha', this.value)">${opLinhas(m.numero_linha)}</select></td>
                <td><input type="number" class="noble-input num" min="0" step="100" aria-label="Volume em kg" value="${m.volume_total || ''}" placeholder="0" oninput="pcpUI.mudarMix(${i}, 'volume_total', this.value)"></td>
                <td class="num" data-mix-pct="${i}"></td>
                <td class="num" data-mix-dia="${i}"></td>
                <td><button type="button" class="pcp-link-perigo" aria-label="Remover item" onclick="pcpUI.removerMix(${i})">Remover</button></td>
            </tr>`).join('');
        this.atualizarTotaisMix();
    },

    atualizarTotaisMix() {
        const p = this.plano;
        let total = 0;
        this.mixEdicao.forEach((m, i) => {
            const vol = Number(m.volume_total) || 0;
            total += vol;
            const pct = document.querySelector(`[data-mix-pct="${i}"]`), dia = document.querySelector(`[data-mix-dia="${i}"]`);
            if (pct) pct.textContent = p.meta_mensal > 0 ? ((vol / p.meta_mensal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—';
            if (dia) dia.textContent = this.kg(p.dias_trabalhados > 0 ? vol / p.dias_trabalhados : 0) + ' kg';
        });
        const dif = total - p.meta_mensal;
        const fecha = Math.abs(dif) < 0.5;
        this.el('pcp-mix-total').innerHTML = `
            <span>Distribuído: <strong>${this.kg(total)} kg</strong> de ${this.kg(p.meta_mensal)} kg</span>
            <span class="${fecha ? 'is-bom' : 'is-alerta'}">${fecha ? 'O mix fecha com a meta do mês.' : (dif < 0 ? `Faltam ${this.kg(-dif)} kg para chegar à meta.` : `O mix passa ${this.kg(dif)} kg da meta.`)}</span>`;
        const mudou = JSON.stringify(this.mixEdicao.map(m => [Number(m.material_id) || 0, Number(m.numero_linha), Number(m.volume_total) || 0])) !== JSON.stringify(p.mix.map(m => [m.material_id, m.numero_linha, m.volume_total]));
        this.el('pcp-btn-salvar-mix').disabled = !mudou;
        this.el('pcp-mix-estado').textContent = mudou ? 'Há alterações não salvas.' : (p.mix.length ? 'Mix salvo.' : '');
    },

    adicionarMix() {
        this.mixEdicao.push({ material_id: '', numero_linha: 1, volume_total: 0 });
        this.renderMix();
        const sels = document.querySelectorAll('#pcp-tbody-mix tr:last-child select');
        if (sels[0]) sels[0].focus();
    },
    removerMix(i) { this.mixEdicao.splice(i, 1); this.renderMix(); },
    mudarMix(i, campo, valor) {
        this.mixEdicao[i][campo] = campo === 'volume_total' ? (parseFloat(valor) || 0) : (parseInt(valor) || '');
        this.atualizarTotaisMix();
    },

    async salvarMix() {
        if (this.mixEdicao.some(m => !m.material_id)) return this.avisar('PCP', 'Escolha o material de todos os itens antes de salvar.', 'warning');
        const btn = this.el('pcp-btn-salvar-mix');
        btn.disabled = true;
        try {
            await this.api(`/api/pcp/${this.plano.id}/mix`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mix: this.mixEdicao }) });
            await this.carregarPlanoSelecionado();
            this.avisar('PCP', 'Mix salvo. As metas das linhas e de cada dia foram recalculadas.', 'success');
        } catch (e) {
            btn.disabled = false;
            this.avisar('PCP', e.message, 'error');
        }
    },

    // ───────── etapa 3: apontamento ─────────
    statusDia(d, hoje) {
        if (d.real_total > 0) {
            if (d.meta_total_dia <= 0) return ['Apontado', 'neutro'];
            const a = (d.real_total / d.meta_total_dia) * 100;
            return a >= 100 ? ['Meta atingida', 'bom'] : (a >= 90 ? ['Perto da meta', 'alerta'] : ['Abaixo da meta', 'ruim']);
        }
        return d.data < hoje ? ['Sem apontamento', 'alerta'] : (d.data === hoje ? ['Hoje', 'neutro'] : ['A produzir', 'neutro']);
    },

    renderDiario() {
        const p = this.plano, hoje = this.hojeIso(), n = p.qtd_linhas;
        this.el('pcp-thead-operacional').innerHTML = `<tr>
            <th>Dia</th><th class="num">Meta do dia</th>
            ${Array.from({ length: n }, (_, i) => `<th class="num">Linha ${i + 1}</th>`).join('')}
            <th class="num">Total</th><th class="num">Desvio</th><th>Situação</th><th>Observação</th>
        </tr>`;
        this.el('pcp-tbody-operacional').innerHTML = p.diario.map(d => {
            const dt = new Date(d.data + 'T12:00:00');
            const [txt, tom] = this.statusDia(d, hoje);
            const desvio = d.real_total - d.meta_total_dia;
            return `<tr data-pdid="${d.id}" class="${d.data === hoje ? 'is-hoje' : ''}">
                <td><strong>${d.data.slice(8, 10)}/${d.data.slice(5, 7)}</strong> <small>${this.DIAS[dt.getDay()]}</small></td>
                <td class="num">${this.kg(d.meta_total_dia)}</td>
                ${Array.from({ length: n }, (_, i) => `<td><input type="number" class="noble-input num pcp-real" data-linha="${i + 1}" min="0" step="any" inputmode="decimal" aria-label="Produção da linha ${i + 1} em ${d.data.slice(8, 10)}/${d.data.slice(5, 7)}" value="${d['real_l' + (i + 1)] > 0 ? d['real_l' + (i + 1)] : ''}" placeholder="${this.kg(d['meta_l' + (i + 1)])}" oninput="pcpUI.aoDigitar(${d.id})"></td>`).join('')}
                <td class="num" data-c="total"><strong>${d.real_total > 0 ? this.kg(d.real_total) : '—'}</strong></td>
                <td class="num" data-c="desvio">${d.real_total > 0 ? `<span class="${desvio >= 0 ? 'is-bom' : 'is-ruim'}">${desvio > 0 ? '+' : ''}${this.kg(desvio)}</span>` : '—'}</td>
                <td data-c="status"><span class="pcp-chip pcp-chip--${tom}">${txt}</span></td>
                <td><input type="text" class="noble-input pcp-obs" maxlength="500" aria-label="Observação do dia" value="${this.esc(d.observacao)}" placeholder="Opcional" onchange="pcpUI.aoDigitar(${d.id}, true)"></td>
            </tr>`;
        }).join('');
        this.el('pcp-ir-hoje').style.display = p.diario.some(d => d.data === hoje) ? '' : 'none';
    },

    irParaHoje() {
        const linha = document.querySelector('#pcp-tbody-operacional tr.is-hoje');
        if (linha) { linha.scrollIntoView({ behavior: 'smooth', block: 'center' }); const c = linha.querySelector('.pcp-real'); if (c) c.focus(); }
    },

    // Atualiza a linha na hora e grava sozinho pouco depois; não recarrega a tabela, para o cursor não sair do campo
    aoDigitar(pdId, imediato) {
        const tr = document.querySelector(`#pcp-tbody-operacional tr[data-pdid="${pdId}"]`);
        const d = this.plano.diario.find(x => x.id === pdId);
        if (!tr || !d) return;
        let total = 0;
        tr.querySelectorAll('.pcp-real').forEach(inp => { const v = Math.max(0, parseFloat(inp.value) || 0); d['real_l' + inp.dataset.linha] = v; total += v; });
        d.real_total = total;
        d.observacao = tr.querySelector('.pcp-obs').value;
        const desvio = total - d.meta_total_dia, [txt, tom] = this.statusDia(d, this.hojeIso());
        tr.querySelector('[data-c="total"]').innerHTML = `<strong>${total > 0 ? this.kg(total) : '—'}</strong>`;
        tr.querySelector('[data-c="desvio"]').innerHTML = total > 0 ? `<span class="${desvio >= 0 ? 'is-bom' : 'is-ruim'}">${desvio > 0 ? '+' : ''}${this.kg(desvio)}</span>` : '—';
        tr.querySelector('[data-c="status"]').innerHTML = `<span class="pcp-chip pcp-chip--${tom}">${txt}</span>`;
        this.estadoSalvar('Salvando…');
        clearTimeout(this._salvando[pdId]);
        this._salvando[pdId] = setTimeout(() => this.salvarDia(pdId), imediato ? 0 : 700);
    },

    estadoSalvar(txt, erro) { const e = this.el('pcp-estado-salvar'); e.textContent = txt; e.className = erro ? 'is-ruim' : ''; },

    async salvarDia(pdId) {
        const d = this.plano.diario.find(x => x.id === pdId);
        if (!d) return;
        try {
            await this.api(`/api/pcp/producao/${pdId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ real_l1: d.real_l1, real_l2: d.real_l2, real_l3: d.real_l3, real_l4: d.real_l4, observacao: d.observacao }) });
            this.estadoSalvar('Alterações salvas às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            // os indicadores e as abas acompanham o que foi apontado
            this.renderAbas();
            this.renderGeral();
        } catch (e) {
            this.estadoSalvar('Não foi possível salvar: ' + e.message, true);
        }
    },

    // ───────── planejamento: novo e excluir ─────────
    abrirModalNovoPlano() {
        const hoje = new Date();
        this.el('pcp-form-novo').reset();
        this.el('pcp-novo-ano').value = hoje.getFullYear();
        this.el('pcp-novo-mes').value = hoje.getMonth() + 1;
        this.sugerirDias();
        this.el('modal-pcp-novo').style.display = 'flex';
        this.el('pcp-novo-meta').focus();
    },
    fecharModalNovoPlano() { this.el('modal-pcp-novo').style.display = 'none'; },

    // Sugere os dias úteis (segunda a sexta) do mês escolhido
    sugerirDias() {
        const ano = parseInt(this.el('pcp-novo-ano').value), mes = parseInt(this.el('pcp-novo-mes').value);
        if (!ano || !mes) return;
        let uteis = 0;
        for (const d = new Date(ano, mes - 1, 1); d.getMonth() === mes - 1; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) uteis++;
        this.el('pcp-novo-dias').value = uteis;
        this.el('pcp-novo-dias').max = uteis;
        this.el('pcp-novo-dias-ajuda').textContent = `${this.MESES[mes]} de ${ano} tem ${uteis} dias úteis (segunda a sexta).`;
    },

    async salvarNovoPlano(ev) {
        ev.preventDefault();
        const corpo = {
            ano: this.el('pcp-novo-ano').value, mes: this.el('pcp-novo-mes').value, meta_mensal: this.el('pcp-novo-meta').value,
            dias_trabalhados: this.el('pcp-novo-dias').value, qtd_linhas: this.el('pcp-novo-linhas').value, observacoes: this.el('pcp-novo-obs').value
        };
        try {
            const r = await this.api('/api/pcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
            this.fecharModalNovoPlano();
            this.aba = 'mix'; // o passo seguinte é distribuir a meta
            await this.carregarPlanos(r.id);
            this.avisar('PCP', 'Planejamento criado. Agora distribua a meta entre as linhas, no mix de produtos.', 'success');
        } catch (e) {
            this.avisar('PCP', e.message, 'error');
        }
    },

    // Confirmação em dois cliques, no próprio botão
    async excluirPlano(btn) {
        if (btn.dataset.confirmar !== '1') {
            btn.dataset.confirmar = '1';
            btn.textContent = 'Clique de novo para excluir tudo deste mês';
            setTimeout(() => { if (btn.isConnected) { btn.dataset.confirmar = ''; btn.textContent = 'Excluir planejamento'; } }, 4000);
            return;
        }
        try {
            await this.api(`/api/pcp/${this.plano.id}`, { method: 'DELETE' });
            this.plano = null;
            this.aba = 'geral';
            await this.carregarPlanos();
            this.avisar('PCP', 'Planejamento excluído.', 'success');
        } catch (e) {
            this.avisar('PCP', e.message, 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btnPcp = document.getElementById('nav-pcp');
    if (btnPcp) btnPcp.addEventListener('click', () => { window.pcpUI.init(); });
});
