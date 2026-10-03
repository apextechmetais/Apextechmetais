var _listMetasEstrategicas = [];
var _listTabelaPrecosEstrategica = [];

// DOMContentLoaded wrapper removed

    window.getJsPDFClass = function() {
        if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
        if (window.jsPDF) return window.jsPDF;
        return null;
    };

    // ─── TOGGLE MENU LATERAL RECOLHÍVEL (DESKTOP) ──────────────────────────────
    window.toggleDesktopSidebar = function(forceState) {
        const container = document.getElementById('admin-dashboard-container');
        const icon = document.getElementById('sidebar-toggle-icon');
        const btn = document.getElementById('btn-toggle-desktop-sidebar');
        if (!container) return;

        let isCollapsed;
        if (typeof forceState === 'boolean') {
            isCollapsed = !forceState;
        } else {
            isCollapsed = !container.classList.contains('sidebar-collapsed');
        }

        if (isCollapsed) {
            container.classList.add('sidebar-collapsed');
        } else {
            container.classList.remove('sidebar-collapsed');
        }

        try {
            localStorage.setItem('apex_sidebar_collapsed', isCollapsed ? 'true' : 'false');
        } catch(e) {}

        if (icon) {
            icon.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
        }
        if (btn) {
            btn.title = isCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu Lateral';
        }
    };

    // Restaurar preferência do menu ao carregar
    try {
        const prefCollapsed = localStorage.getItem('apex_sidebar_collapsed') === 'true';
        if (prefCollapsed) {
            window.toggleDesktopSidebar(false);
        }
    } catch(e) {}

    // ─── Utilitário global: formata número no padrão brasileiro com 2 casas ───
    window.fmtBRL = function(val) {
        const n = parseFloat(val);
        if (isNaN(n)) return '0,00';
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ─── SISTEMA DE NOTIFICAÇÃO GLASSMORPHISM (substitui alert nativo) ────────
    // Tipos: 'success' | 'error' | 'info' | 'warning'
    window._apexNotify = function(titulo, mensagem, tipo) {
        tipo = tipo || 'info';
        const overlay = document.getElementById('_apex_notify_overlay');
        const iconEl  = document.getElementById('_apex_notify_icon');
        const titleEl = document.getElementById('_apex_notify_title');
        const msgEl   = document.getElementById('_apex_notify_msg');
        if (!overlay) { _apexNotify('Sistema', titulo + (mensagem ? '\n' + mensagem : ''), 'info'); return; }

        const configs = {
            success: { icon:'✅', bg:'rgba(42,208,122,0.18)', border:'rgba(42,208,122,0.5)', glow:'rgba(42,208,122,0.25)' },
            error:   { icon:'❌', bg:'rgba(224,80,80,0.18)',  border:'rgba(224,80,80,0.5)',  glow:'rgba(224,80,80,0.25)' },
            warning: { icon:'⚠️', bg:'rgba(240,184,0,0.18)',  border:'rgba(240,184,0,0.5)',  glow:'rgba(240,184,0,0.25)' },
            info:    { icon:'ℹ️', bg:'rgba(30,78,140,0.25)',  border:'rgba(42,140,208,0.5)', glow:'rgba(42,140,208,0.2)' },
        };
        const cfg = configs[tipo] || configs.info;

        iconEl.innerHTML  = cfg.icon;
        iconEl.style.background = cfg.bg;
        iconEl.style.border = `2px solid ${cfg.border}`;
        iconEl.style.boxShadow = `0 0 0 10px ${cfg.glow}`;
        titleEl.textContent = titulo || '';
        msgEl.textContent   = mensagem || '';
        msgEl.style.display = mensagem ? 'block' : 'none';

        overlay.style.display = 'flex';
        overlay.style.animation = 'none';
        requestAnimationFrame(() => { overlay.style.animation = '_apex_fadein 0.2s ease'; });
    };

    window._apexNotifyClose = function() {
        const overlay = document.getElementById('_apex_notify_overlay');
        if (overlay) overlay.style.display = 'none';
    };
    // Fecha ao clicar fora da caixa
    document.getElementById('_apex_notify_overlay')?.addEventListener('click', function(e) {
        if (e.target === this) window._apexNotifyClose();
    });
    // ─────────────────────────────────────────────────────────────────────────


    window.formatarDataSemFuso = function(dStr) {
        if (!dStr) return '-';
        const s = String(dStr).split('T')[0];
        const parts = s.split('-');
        if (parts.length === 3) {
            return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        try {
            return new Date(dStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch (e) {
            return dStr;
        }
    };

    // ─── Tecla ESC (Escape) para cancelar/fechar qualquer modal ou dropdown ───
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            const drop = document.getElementById('pedido-cliente-dropdown');
            if (drop && drop.style.display !== 'none') {
                drop.style.display = 'none';
                return;
            }

            if (window.fecharModalPedido) window.fecharModalPedido();
            if (window.fecharModalCliente) window.fecharModalCliente();
            if (window.fecharModalVigenciaGeral) window.fecharModalVigenciaGeral();
            if (window.fecharModalFornecedor) window.fecharModalFornecedor();
            if (window.fecharModalMaterial) window.fecharModalMaterial();
            if (window.fecharModalPreco) window.fecharModalPreco();
            if (window.fecharModalAmostra) window.fecharModalAmostra();
            if (window.fecharModalPlanejamento) window.fecharModalPlanejamento();
            if (window.fecharModalFidc) window.fecharModalFidc();
            if (window.fecharModalUsuario) window.fecharModalUsuario();
            if (window.fecharModalReprovacao) window.fecharModalReprovacao();

            document.getElementById('modal-preco-residuos')?.remove();
            document.getElementById('modal-preco-ligas')?.remove();
            document.getElementById('modal-preco-volume')?.remove();
            document.getElementById('modal-preco-fundicao')?.remove();

            // Fechar todos fullscreen-overlay EXCETO o modal de planejamento de produção
            document.querySelectorAll('.fullscreen-overlay').forEach(modal => {
                if (modal.id !== 'modal-planejamento-producao') {
                    modal.style.display = 'none';
                }
            });
        }
    });

    let globalRolePermissions = {};

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────────────────────────────────




    // ─────────────────────────────────────────────────────────────────────────
    // NAVEGAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const sections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            navItems.forEach(nav => nav.classList.remove('active'));
            // Esconde todas as seções EXCETO o histórico (que é gerenciado internamente pelo botão)
            sections.forEach(sec => {
                if (sec.id !== 'relatorio-diario-historico') {
                    sec.classList.remove('active');
                    sec.style.display = 'none';
                }
            });
            item.classList.add('active');
            const target = document.getElementById(item.dataset.target);
            if (target) {
                // Se o target for relatorio-diario, garante que historico fique oculto
                if (item.dataset.target === 'relatorio-diario') {
                    const histSec = document.getElementById('relatorio-diario-historico');
                    if (histSec) {
                        histSec.classList.remove('active');
                        histSec.style.display = 'none';
                    }
                }
                target.classList.add('active');
                target.style.display = 'block';
                // Sempre volta ao topo ao trocar de seção
                const mainContent = document.querySelector('.main-content');
                if (mainContent) mainContent.scrollTop = 0;
                if (item.dataset.target === 'permissoes-view' && window.carregarPermissoesView) {
                    window.carregarPermissoesView();
                }
                if (item.dataset.target === 'financeiro-view' && window.carregarFinanceiroView) {
                    window.carregarFinanceiroView();
                }
                if (item.dataset.target === 'fornecedores-view' && window.initApexFornecedores) {
                    window.initApexFornecedores();
                }
                if (item.dataset.target === 'clientes-view' && window.initApexClientes) {
                    window.initApexClientes();
                }
                if (item.dataset.target === 'pedidos-venda-view' && window.initApexPedidos) {
                    window.initApexPedidos();
                }
                if (item.dataset.target === 'residuos-view' && window.initApexPrecosResiduos) {
                    window.initApexPrecosResiduos();
                }
                if (item.dataset.target === 'ligas-view' && window.initApexPrecosLigas) {
                    window.initApexPrecosLigas();
                }
                if (item.dataset.target === 'volume-view' && window.initApexPrecosVolume) {
                    window.initApexPrecosVolume();
                }
                if (item.dataset.target === 'fundicao-view' && window.initApexPrecosFundicao) {
                    window.initApexPrecosFundicao();
                }
                if (item.dataset.target === 'planejamento-estrategicov3-view' && window.carregarPlanejamentoEstrategicov3) {
                    window.carregarPlanejamentoEstrategicov3();
                }
                if (item.dataset.target === 'planejamento-view' && window.carregarPlanejamentoDashboard) {
                    window.carregarPlanejamentoDashboard();
                }
                setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // INIT ADMIN
    // ─────────────────────────────────────────────────────────────────────────
    async function initAdmin() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if (settings.role_permissions) {
                globalRolePermissions = JSON.parse(settings.role_permissions);
            }
        } catch (e) {
            console.error('Erro ao buscar permissões:', e);
        }

        initLMEDashboard();
        initLMEExcelReport();
        initRelatorioDiario();
        initRelatorioDiarioHistorico();
        initSettings();
        initGaleria();
        initMateriais();
        initSolucoes();
        initNoticias();
        initLMEEmailConfig();
        
        // Apex Gestão Inits
        initApexFornecedores();
        initApexClientes();
        initApexMateriais();
        initApexPrecos();
        initApexPrecosResiduos();
        initApexPrecosLigas();
        initApexPrecosVolume();
        initApexPrecosFundicao();
        initApexAmostras();
        initApexPlanejamento();
        initApexEstoque();
        initApexUsuarios();
        initApexBI();
        initApexPedidos();
        switchSimulatedRole(sessionStorage.getItem('apex_user_role') || 'Administrador');
    }

    // =========================================================================
    // LME EXCEL REPORT
    // =========================================================================
    async function initLMEExcelReport() {
        const filterMes     = document.getElementById('lme-filter-mes');
        const selector      = document.getElementById('lme-week-selector');
        const preview       = document.getElementById('excel-table-preview');
        const previewWrap   = document.getElementById('excel-preview-wrapper');
        const btnDownload    = document.getElementById('btn-download-lme-excel');
        const btnDownloadPdf = document.getElementById('btn-download-lme-pdf');
        const btnRefresh     = document.getElementById('btn-refresh-excel');
        const loadingDiv    = document.getElementById('excel-loading');
        const errorDiv      = document.getElementById('excel-error');
        const errorMsg      = document.getElementById('excel-error-msg');
        const countNum      = document.getElementById('lme-count-num');
        const metalCbs      = document.querySelectorAll('.metal-toggle-cb');
        const btnToggleAll  = document.getElementById('btn-toggle-all-metals');

        if (!selector || !preview) return;

        const MONTH_NAMES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        let excelWeeks = [];
        let activeMetals = new Set(['cobre','zinco','aluminio','chumbo','estanho','niquel','dolar']);
        let allMetalsOn = true;

        // ─── HELPERS ────────────────────────────────────────────────────
        function showLoading() {
            if (loadingDiv)  { loadingDiv.style.display  = 'flex'; }
            if (errorDiv)    { errorDiv.style.display    = 'none'; }
            if (previewWrap) { previewWrap.style.display = 'none'; }
        }
        function showError(msg) {
            if (loadingDiv)  { loadingDiv.style.display  = 'none'; }
            if (errorDiv)    { errorDiv.style.display    = 'flex'; }
            if (errorMsg)    { errorMsg.textContent      = msg;    }
            if (previewWrap) { previewWrap.style.display = 'none'; }
        }
        function showTable() {
            if (loadingDiv)  { loadingDiv.style.display  = 'none'; }
            if (errorDiv)    { errorDiv.style.display    = 'none'; }
            if (previewWrap) { previewWrap.style.display = 'block'; }
        }

        // ─── LOAD DATA ──────────────────────────────────────────────────
        async function loadWeeks(mesOverride = null) {
            showLoading();
            try {
                // 1. Fetch available months if not overriding
                let mesToFetch = mesOverride;
                if (!mesToFetch) {
                    const resMeses = await fetch('/api/lme/meses');
                    const mesesDisponiveis = await resMeses.json();
                    
                    filterMes.innerHTML = mesesDisponiveis.map(m => 
                        `<option value="${m.valor}">${m.texto}</option>`
                    ).join('');
                    
                    if (mesesDisponiveis.length > 0) {
                        mesToFetch = mesesDisponiveis[0].valor;
                        filterMes.value = mesToFetch;
                    } else {
                        throw new Error('Nenhum mês disponível na LME.');
                    }
                }

                // 2. Fetch weekly report for the selected month
                const res = await fetch(`/api/lme/relatorio-semanal?mes=${mesToFetch}`);
                if (!res.ok) throw new Error(`Servidor respondeu com erro ${res.status}`);
                
                const data = await res.json();
                excelWeeks = data.semanas || [];
                
                if (excelWeeks.length === 0) {
                    selector.innerHTML = '<option value="">Nenhuma semana encontrada</option>';
                    showError('Nenhuma semana encontrada neste mês.');
                    if (countNum) countNum.textContent = '0';
                    return;
                }

                if (countNum) countNum.textContent = excelWeeks.length;
                
                selector.innerHTML = excelWeeks.map(w => {
                    const lastDay = w.days && w.days.length > 0 ? w.days[w.days.length - 1]?.data : '—';
                    return `<option value="${w.header}">Semana ${w.header} → ${lastDay}</option>`;
                }).join('');

                renderPreview(excelWeeks[0].header);
            } catch(e) {
                console.error('Error loading LME weeks:', e);
                showError(`Erro ao carregar dados LME: ${e.message}`);
            }
        }

        // ─── RENDER PREVIEW TABLE ────────────────────────────────────────
        const formatVal = (v, formatType) => {
            if (v === null || v === undefined) return '—';
            if (v === 'feriado') return '<span class="excel-feriado">feriado</span>';
            if (typeof v === 'string') return v;

            if (formatType === 'percent') {
                const pct = (v * 100).toFixed(3);
                const cls = v >= 0 ? 'excel-up' : 'excel-down';
                return `<span class="${cls}">${pct}%</span>`;
            }
            if (formatType === 'currency_usd') {
                return `$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
            }
            if (formatType === 'currency3') {
                return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
            }
            if (formatType === 'currency4') {
                return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
            }
            if (formatType === 'dolar') {
                return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
            }
            return v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        };

        const renderOscilacao = (v, isDolar) => {
            if (v === null || v === undefined || typeof v === 'string') return '—';
            const isUp = v >= 0;
            const arrow = isUp ? '▲' : '▼';
            const cls = isUp ? 'excel-up' : 'excel-down';
            // OSCILAÇÃO R$ é a variação convertida em reais brasileiros
            const prefix = 'R$ ';
            const formatted = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            return `<span class="${cls}">${arrow} ${prefix}${formatted}</span>`;
        };

        // Metal column config: key, header text, header CSS class, cell CSS class, default format, dollar format
        const COLS = [
            { k: 'cobre',    lbl: 'COBRE',    hcls: 'excel-hdr-cobre',    ccls: 'excel-col-cobre',    fmt: 'currency_usd', dolFmt: null       },
            { k: 'zinco',    lbl: 'ZINCO',    hcls: 'excel-hdr-zinco',    ccls: 'excel-col-zinco',    fmt: 'currency_usd', dolFmt: null       },
            { k: 'aluminio', lbl: 'ALUMÍNIO', hcls: 'excel-hdr-aluminio', ccls: 'excel-col-aluminio', fmt: 'currency_usd', dolFmt: null       },
            { k: 'chumbo',   lbl: 'CHUMBO',   hcls: 'excel-hdr-chumbo',   ccls: 'excel-col-chumbo',   fmt: 'currency_usd', dolFmt: null       },
            { k: 'estanho',  lbl: 'ESTANHO',  hcls: 'excel-hdr-estanho',  ccls: 'excel-col-estanho',  fmt: 'currency_usd', dolFmt: null       },
            { k: 'niquel',   lbl: 'NÍQUEL',   hcls: 'excel-hdr-niquel',   ccls: 'excel-col-niquel',   fmt: 'currency_usd', dolFmt: null       },
            { k: 'dolar',    lbl: 'DÓLAR',    hcls: 'excel-hdr-dolar',    ccls: 'excel-col-dolar',    fmt: 'currency4',    dolFmt: 'currency4' },
        ];

        function visibleCols() {
            return COLS.filter(c => activeMetals.has(c.k));
        }

        function renderPreview(headerVal) {
            const block = excelWeeks.find(b => b.header === headerVal);
            if (!block) return;

            const vc = visibleCols();
            const colSpan = 1 + vc.length;
            const d = block.days || [];
            const comp = block.computed || {};

            const thHeaders = vc.map(c => `<th class="${c.hcls}">${c.lbl}</th>`).join('');
            const thSummary = vc.map(c => {
                const suffix = c.k === 'dolar' ? ' (R$)' : ' (R$/kg)';
                return `<th class="${c.hcls}">${c.lbl}${suffix}</th>`;
            }).join('');

            const firstDate = d[0]?.data || headerVal;
            const lastDate  = d[d.length - 1]?.data || '—';
            const monthName = filterMes.options[filterMes.selectedIndex]?.text || '';

            let html = `
            <div class="excel-title-row">
                <span class="excel-company">APEXTECH METAIS</span>
                <span class="excel-week-label">${monthName} &mdash; Semana de ${firstDate} a ${lastDate}</span>
            </div>
            <table class="excel-table">
                <thead>
                    <tr>
                        <th class="excel-hdr-date">DATA</th>${thHeaders}
                    </tr>
                </thead>
                <tbody>
            `;

            // Daily rows
            for (let i = 0; i < 5; i++) {
                const day = d[i] || {};
                const isFeriado = vc.every(c => day[c.k] === 'feriado' || day[c.k] === null);
                const rowCls = isFeriado ? ' class="excel-row-feriado"' : '';
                const dateTd = `<td class="excel-date-cell">${day.data || '—'}</td>`;
                const valTds = vc.map(c => `<td class="${c.ccls}">${formatVal(day[c.k], c.fmt)}</td>`).join('');
                html += `<tr${rowCls}>${dateTd}${valTds}</tr>`;
            }

            // Computed rows config
            const COMP_ROWS = [
                { lbl: 'MÉDIA SEMANAL',                    key: 'MEDIA SEMANAL',                    cls: 'excel-row-mensal',         fmt: 'currency_usd', dolFmt: 'dolar'     },
                { lbl: '100% LME (R$)',                    key: '100% LME',                         cls: 'excel-row-lme100',        fmt: 'currency3',    dolFmt: 'dolar'     },
                { lbl: 'SEMANA ANTERIOR',                  key: 'SEMANA ANTERIOR',                  cls: 'excel-row-anterior',      fmt: 'currency3',    dolFmt: 'dolar'     },
                { lbl: 'FECHAMENTO % (SEMANA ANTERIOR)',   key: 'FECHAMENTO % ( SEMANA ANTERIOR )', cls: 'excel-row-fechamento',    fmt: 'percent',      dolFmt: 'percent'   },
                { lbl: 'OSCILAÇÃO %',                      key: 'OSCILAÇÃO %',                      cls: 'excel-row-oscilacao-pct', fmt: 'percent',      dolFmt: 'percent'   },
                { lbl: 'OSCILAÇÃO R$',                     key: 'OSCILAÇÃO R$',                     cls: 'excel-row-oscilacao-rs',  fmt: 'currency4',    dolFmt: 'dolar'     },
                { lbl: 'MÉDIA MENSAL',                     key: 'MEDIA MENSAL',                     cls: 'excel-row-mensal',        fmt: 'currency3',    dolFmt: 'dolar'     },
            ];

            COMP_ROWS.forEach(row => {
                const vals = comp[row.key] || {};
                const isAnterior = row.cls === 'excel-row-anterior';
                const inlineStyle = isAnterior ? ' style="background-color:#1a1a1a;color:#ffffff;"' : '';
                // Indicar feriado: se a semana teve menos de 5 dias úteis, mostrar no label da média
                let lbl = row.lbl;
                if (row.key === 'MEDIA SEMANAL' && block.numDias !== undefined && block.numDias < 5) {
                    lbl += ` <span style="font-size:0.65em;font-weight:normal;opacity:0.7;font-style:italic">(${block.numDias} dias úteis)</span>`;
                }
                const labelTd = `<td class="excel-label-cell"${inlineStyle}>${lbl}</td>`;
                const valTds = vc.map(c => {
                    const fmtToUse = c.k === 'dolar' && row.dolFmt ? row.dolFmt : row.fmt;
                    return `<td class="excel-col-${c.k}">${formatVal(vals[c.k], fmtToUse)}</td>`;
                }).join('');
                html += `<tr class="${row.cls}">${labelTd}${valTds}</tr>`;
            });

            // Spacer
            html += `<tr class="excel-spacer"><td colspan="${colSpan}"></td></tr>`;

            // Summary mini-table header
            html += `
                <tr>
                    <th class="excel-hdr-date">TIPO</th>${thSummary}
                </tr>
            `;

            // Mini-tabela resumo: SEMANA ANTERIOR e LME ATUAL em R$/kg
            const SUMMARY_ROWS = [
                { lbl: 'SEMANA ANTERIOR (R$/kg)', key: 'SEMANA ANTERIOR', fmt: 'currency3', dolFmt: 'currency4' },
                { lbl: 'LME ATUAL (R$/kg)',       key: '100% LME',        fmt: 'currency3', dolFmt: 'currency4' },
            ];
            SUMMARY_ROWS.forEach(row => {
                const vals = comp[row.key] || {};
                const labelTd = `<td class="excel-label-cell">${row.lbl}</td>`;
                const valTds = vc.map(c => {
                    const fmtToUse = c.k === 'dolar' && row.dolFmt ? row.dolFmt : row.fmt;
                    return `<td class="excel-col-${c.k}">${formatVal(vals[c.k], fmtToUse)}</td>`;
                }).join('');
                html += `<tr class="excel-row-summary">${labelTd}${valTds}</tr>`;
            });

            // Oscillation row (with arrows)
            const osc = comp['OSCILAÇÃO R$'] || {};
            const oscTds = vc.map(c => `<td class="excel-col-${c.k}">${renderOscilacao(osc[c.k], false)}</td>`).join('');
            html += `
                <tr class="excel-row-oscilacao-arrow">
                    <td class="excel-label-cell" style="font-style:italic;">Oscilação R$/kg</td>
                    ${oscTds}
                </tr>
            `;

            html += '</tbody></table>';
            preview.innerHTML = '<div id="pdf-print-area">' + html + '</div>';
            showTable();
        }

        // ─── EVENT LISTENERS ─────────────────────────────────────────────
        filterMes.addEventListener('change', () => {
            loadWeeks(filterMes.value);
        });

        selector.addEventListener('change', () => {
            if (selector.value) renderPreview(selector.value);
        });

        btnDownload.addEventListener('click', async () => {
            const val = selector.value;
            if (!val) return;
            const block = excelWeeks.find(b => b.header === val);
            if (!block) return;
            
            btnDownload.classList.add('downloading');
            try {
                const res = await fetch('/api/lme/gerar-excel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        semana: block,
                        mesLabel: filterMes.options[filterMes.selectedIndex]?.text
                    })
                });
                if (!res.ok) throw new Error('Erro ao gerar Excel');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `LME-Relatorio-${val.replace(/\//g, '-')}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } catch(e) {
                console.error(e);
                _apexNotify('Atenção', 'Erro ao baixar Excel: ' + e.message, 'error');
            } finally {
                btnDownload.classList.remove('downloading');
            }
        });

        // ── PDF Download ──
        if (btnDownloadPdf) {
            btnDownloadPdf.addEventListener('click', () => {
                const val = selector.value;
                if (!val) { _apexNotify('Sistema', 'Selecione uma semana primeiro.', 'info'); return; }
                const block = excelWeeks.find(b => b.header === val);
                if (!block) return;

                // Inject/update timestamp into the print area
                const area = document.getElementById('pdf-print-area');
                if (!area) { _apexNotify('Sistema', 'Visualize o relatório antes de baixar o PDF.', 'info'); return; }

                const now = new Date();
                const ts = now.toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });

                let tsEl = area.querySelector('.pdf-timestamp');
                if (!tsEl) {
                    tsEl = document.createElement('div');
                    tsEl.className = 'pdf-timestamp';
                    tsEl.style.cssText = 'font-size:9pt;color:#555;margin-bottom:8px;text-align:right;font-family:Calibri,sans-serif;border-bottom:1px solid #ccc;padding-bottom:6px;';
                    area.insertBefore(tsEl, area.firstChild);
                }
                tsEl.textContent = `Relatório gerado em: ${ts} — ApexTech Metais`;

                window.print();
            });
        }

        btnRefresh.addEventListener('click', async () => {
            btnRefresh.classList.add('spinning');
            btnRefresh.disabled = true;
            await loadWeeks();
            btnRefresh.classList.remove('spinning');
            btnRefresh.disabled = false;
        });

        // Metal column toggles
        metalCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    activeMetals.add(cb.dataset.metal);
                } else {
                    activeMetals.delete(cb.dataset.metal);
                }
                if (selector.value) renderPreview(selector.value);
                // Update "Todos" button label
                allMetalsOn = activeMetals.size === 7;
                if (btnToggleAll) btnToggleAll.textContent = allMetalsOn ? 'Nenhum' : 'Todos';
            });
        });

        if (btnToggleAll) {
            btnToggleAll.addEventListener('click', () => {
                allMetalsOn = !allMetalsOn;
                metalCbs.forEach(cb => {
                    cb.checked = allMetalsOn;
                    if (allMetalsOn) activeMetals.add(cb.dataset.metal);
                    else activeMetals.delete(cb.dataset.metal);
                });
                btnToggleAll.textContent = allMetalsOn ? 'Nenhum' : 'Todos';
                if (selector.value) renderPreview(selector.value);
            });
        }

        // ─── INITIAL LOAD ────────────────────────────────────────────────
        await loadWeeks();
    }

    // =========================================================================
    // LME DASHBOARD — 20 ANALYSES
    // =========================================================================

    const METALS = ['cobre', 'aluminio', 'zinco', 'chumbo', 'estanho', 'niquel'];
    const METAL_LABELS = {
        cobre: 'Cobre', aluminio: 'Alumínio', zinco: 'Zinco',
        chumbo: 'Chumbo', estanho: 'Estanho', niquel: 'Níquel'
    };
    const METAL_COLORS = {
        cobre: '#e07b39', aluminio: '#7eb3d5', zinco: '#a8c5a0',
        chumbo: '#b0a0c0', estanho: '#d4b896', niquel: '#2AD07A'
    };
    const NBI_WEIGHTS = { cobre: 0.45, aluminio: 0.20, chumbo: 0.15, estanho: 0.10, zinco: 0.10 };

    const chartInstances = {};
    let activeMetalFilter = 'cobre';
    let currentData = null;
    let currentStats = null;

    function parsePrice(str) {
        if (!str || str === '—' || str === '-' || str.trim() === '') return null;
        // Brazilian format: "9.234,56" → 9234.56
        const cleaned = str.replace(/\./g, '').replace(',', '.');
        const val = parseFloat(cleaned);
        return isNaN(val) ? null : val;
    }

    function fmtPrice(val, dec = 2) {
        if (val === null || val === undefined || isNaN(val)) return '—';
        return val.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }

    function destroyChart(id) {
        if (chartInstances[id]) {
            chartInstances[id].destroy();
            delete chartInstances[id];
        }
    }

    const baseChartOpts = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { labels: { color: '#ccc', font: { family: 'Lato', size: 12 }, padding: 16 } },
            datalabels: { display: false }
        },
        scales: {
            x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
    };

    function deepMerge(target, source) {
        const output = Object.assign({}, target);
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                output[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                output[key] = source[key];
            }
        });
        return output;
    }

    // ─── Init LME Dashboard ────────────────────────────────────────────────────
    async function initLMEDashboard() {
        const mesSel   = document.getElementById('mes-selector');
        const btnRefresh = document.getElementById('btn-refresh-lme');

        const now        = new Date();
        const currentMes = `${now.getMonth() + 1}-${now.getFullYear()}`;

        // Try to get available months
        try {
            const res = await fetch(`/api/lme/tabela/atual`);
            if (res.ok) {
                const data = await res.json();
                if (data.mesesDisponiveis && data.mesesDisponiveis.length > 0) {
                    mesSel.innerHTML = data.mesesDisponiveis.map((m, idx) =>
                        `<option value="${m.valor}" ${idx === 0 ? 'selected' : ''}>${m.texto}</option>`
                    ).join('');
                } else {
                    mesSel.innerHTML = `<option value="${currentMes}">${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>`;
                }
            }
        } catch(e) {
            mesSel.innerHTML = `<option value="${currentMes}">Mês atual</option>`;
        }

        // Setup filter bar and fullscreen events
        setupAnalysisControls();

        await loadAndRenderLME(mesSel.value || currentMes);

        mesSel.addEventListener('change', () => loadAndRenderLME(mesSel.value));
        btnRefresh.addEventListener('click', () => loadAndRenderLME(mesSel.value));
    }

    function setupAnalysisControls() {
        const filterBtns = document.querySelectorAll('.analysis-filter-btn');
        const blocks = document.querySelectorAll('.analysis-block');
        const overlay = document.getElementById('fullscreen-overlay');
        const fsBody = document.getElementById('fullscreen-body');
        const fsTitle = document.getElementById('fullscreen-title');
        const btnCloseFs = document.getElementById('btn-close-fullscreen');
        const filterBar = document.getElementById('analysis-filter-bar');

        if (filterBar) filterBar.style.display = 'block';

        // Filters
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.dataset.filter;
                blocks.forEach(block => {
                    // Ignora a block do relatorio executivo se tivermos removido, 
                    // mas os que restaram usam data-aid
                    if (!block.dataset.aid) return; 
                    if (filter === 'all' || block.dataset.aid === filter) {
                        block.style.display = 'block';
                    } else {
                        block.style.display = 'none';
                    }
                });
            });
        });

        // Fullscreen
        document.querySelectorAll('.btn-fullscreen').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const aid = btn.dataset.aid;
                const block = document.querySelector(`.analysis-block[data-aid="${aid}"]`);
                if (!block) return;
                
                // Set title
                const titleEl = block.querySelector('.analysis-title');
                fsTitle.innerHTML = titleEl ? titleEl.innerHTML : `Análise ${aid}`;
                
                // Clone the chart container / content
                const contentToClone = block.querySelector('.chart-container, .charts-grid-2, .kpi-grid, .ranking-container, .momentum-grid, .alertas-grid, .canal-container');
                if (contentToClone) {
                    fsBody.innerHTML = '';
                    // We move the actual canvas/elements to the modal so the chart stays interactive,
                    // but wait, chart.js canvas cannot be easily moved without redrawing. 
                    // Since it's easier, we just temporarily move the elements.
                    
                    // Salva a referência original
                    const originalParent = contentToClone.parentNode;
                    const originalNextSibling = contentToClone.nextSibling;
                    
                    btn.dataset.originalParentId = 'temp-fs-storage'; // just a flag
                    
                    // Mover
                    fsBody.appendChild(contentToClone);
                    overlay.style.display = 'flex';
                    
                    // Ajustar tamanho se for grafico
                    window.dispatchEvent(new Event('resize'));
                    
                    btnCloseFs.onclick = () => {
                        overlay.style.display = 'none';
                        // Retornar ao lugar original
                        if (originalNextSibling) {
                            originalParent.insertBefore(contentToClone, originalNextSibling);
                        } else {
                            originalParent.appendChild(contentToClone);
                        }
                        fsBody.innerHTML = '';
                        window.dispatchEvent(new Event('resize'));
                    };
                }
            });
        });
    }

    async function loadAndRenderLME(mes) {
        const loading = document.getElementById('lme-loading');
        const errorEl = document.getElementById('lme-error');
        const content = document.getElementById('analysis-content');

        loading.style.display = 'flex';
        errorEl.style.display = 'none';
        content.style.display = 'none';

        try {
            const res = await fetch(`/api/lme/tabela/${mes}`);
            if (!res.ok) throw new Error('API error');
            const apiData = await res.json();

            // Filter only daily rows
            const diarias = (apiData.cotacoes || []).filter(r => r.tipo === 'diaria');
            if (!diarias.length) throw new Error('No daily data');

            // Parse each row
            const parsed = diarias.map(row => ({
                dia:      row.dia,
                cobre:    parsePrice(row.cobre),
                aluminio: parsePrice(row.aluminio),
                zinco:    parsePrice(row.zinco),
                chumbo:   parsePrice(row.chumbo),
                estanho:  parsePrice(row.estanho),
                niquel:   parsePrice(row.niquel),
                dolar:    parsePrice(row.dolar)
            })).filter(r => r.cobre !== null || r.aluminio !== null);

            if (!parsed.length) throw new Error('No valid rows');

            currentData  = parsed;
            currentStats = computeStats(parsed);

            loading.style.display = 'none';
            content.style.display = 'block';

            renderAllAnalyses(parsed, currentStats);

        } catch(e) {
            console.error('LME load error:', e);
            loading.style.display = 'none';
            errorEl.style.display = 'flex';
        }
    }

    // ─── Compute Stats ─────────────────────────────────────────────────────────
    function computeStats(data) {
        const stats = {};
        const latest = data[data.length - 1];
        const prev   = data.length > 1 ? data[data.length - 2] : null;

        METALS.forEach(m => {
            const vals = data.map(r => r[m]).filter(v => v !== null && !isNaN(v));
            if (!vals.length) { stats[m] = null; return; }

            const current   = latest[m] || vals[vals.length - 1];
            const min       = Math.min(...vals);
            const max       = Math.max(...vals);
            const avg       = vals.reduce((a, b) => a + b, 0) / vals.length;
            const channelPos = max > min ? ((current - min) / (max - min)) * 100 : 50;
            const prevVal   = prev ? prev[m] : null;
            const dayChange = (current && prevVal) ? ((current - prevVal) / prevVal) * 100 : 0;
            const first     = vals[0];
            const monthChange = first ? ((current - first) / first) * 100 : 0;

            // Standard deviation & risk
            const variance = vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length;
            const stddev   = Math.sqrt(variance);
            const riskIndex = avg ? (stddev / avg) * 100 : 0;

            // Zscore
            const zscore = stddev ? (current - avg) / stddev : 0;

            // SMA-5
            const sma5 = data.map((_, i) => {
                if (i < 4) return null;
                const slice = data.slice(i - 4, i + 1).map(r => r[m]).filter(v => v !== null);
                return slice.length === 5 ? slice.reduce((a, b) => a + b, 0) / 5 : null;
            });

            // Momentum: last 5 vs prev 5
            const last5Vals = vals.slice(-5);
            const prev5Vals = vals.slice(-10, -5);
            const avg5      = last5Vals.length ? last5Vals.reduce((a, b) => a + b, 0) / last5Vals.length : avg;
            const avgPrev5  = prev5Vals.length ? prev5Vals.reduce((a, b) => a + b, 0) / prev5Vals.length : avg;
            const momentum  = avgPrev5 ? ((avg5 - avgPrev5) / avgPrev5) * 100 : 0;

            // Opportunity Score (0–100)
            const chanScore = (channelPos / 100) * 40;
            const momScore  = Math.max(0, Math.min(1, (momentum + 5) / 10)) * 30;
            const dayScore  = Math.max(0, Math.min(1, (dayChange + 2) / 4)) * 30;
            const score     = chanScore + momScore + dayScore;

            // Signal
            let signal, signalClass;
            if (channelPos >= 85)      { signal = 'VENDER';   signalClass = 'signal-sell';  }
            else if (channelPos >= 60) { signal = 'ATENÇÃO';  signalClass = 'signal-watch'; }
            else if (channelPos >= 30) { signal = 'RETER';    signalClass = 'signal-hold';  }
            else                       { signal = 'ACUMULAR'; signalClass = 'signal-buy';   }

            stats[m] = {
                current, min, max, avg, channelPos, dayChange, monthChange,
                stddev, riskIndex, zscore, momentum, score, signal, signalClass,
                sma5, vals, avg5, avgPrev5
            };
        });

        return stats;
    }

    // ─── Render All ────────────────────────────────────────────────────────────
    function renderAllAnalyses(data, stats) {
        renderKPICards(stats);                         // Nova 01 (Antiga 01)
        renderTrendChart(data, activeMetalFilter);     // Nova 02 (Antiga 05)
        setupMetalFilters(data);
        renderRanking(stats);                          // Nova 03 (Antiga 08)
        renderOpportunityScore(stats);                 // Nova 04 (Antiga 09)
        renderWeekComparison(stats);                   // Nova 05 (Antiga 10)
        renderMomentum(stats);                         // Nova 06 (Antiga 12)
        renderSMAChart(data, stats);                   // Nova 07 (Antiga 14)
        renderAlerts(stats);                           // Nova 08 (Antiga 19)
        renderChannelBars(stats);                      // Nova 09 (Antiga 03)
    }

    function setupMetalFilters(data) {
        document.querySelectorAll('.btn-metal-filter').forEach(btn => {
            // Remove old listeners by cloning
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });
        document.querySelectorAll('.btn-metal-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-metal-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeMetalFilter = btn.dataset.metal;
                renderTrendChart(data, activeMetalFilter);
            });
        });
    }

    // ── ANÁLISE 01: KPI Cards + Sinalizadores ──
    function renderKPICards(stats) {
        const container = document.getElementById('kpi-cards');
        if (!container) return;

        const icons = { cobre: 'fa-bolt', aluminio: 'fa-layer-group', zinco: 'fa-atom', chumbo: 'fa-weight-hanging', estanho: 'fa-microchip', niquel: 'fa-gem' };
        const signalIcons = { 'VENDER': 'fa-arrow-up-right-dots', 'ATENÇÃO': 'fa-eye', 'RETER': 'fa-pause', 'ACUMULAR': 'fa-cart-shopping' };

        container.innerHTML = METALS.map(m => {
            const s = stats[m];
            if (!s) return '';
            const upColor  = s.dayChange >= 0 ? '#2AD07A' : '#ff4d4d';
            const upIcon   = s.dayChange >= 0 ? 'fa-caret-up' : 'fa-caret-down';
            return `
            <div class="kpi-card">
                <div class="kpi-header">
                    <div class="kpi-icon">
                        <i class="fa-solid ${icons[m]}" style="color:${METAL_COLORS[m]};"></i>
                    </div>
                    <span class="signal-badge ${s.signalClass}">
                        <i class="fa-solid ${signalIcons[s.signal]}"></i> ${s.signal}
                    </span>
                </div>
                <div class="kpi-name">${METAL_LABELS[m]}</div>
                <div class="kpi-price">US$ ${fmtPrice(s.current)}</div>
                <div class="kpi-change" style="color:${upColor};">
                    <i class="fa-solid ${upIcon}"></i> ${Math.abs(s.dayChange).toFixed(2)}% hoje
                </div>
                <div class="kpi-footer">
                    <span>↓ US$ ${fmtPrice(s.min)}</span>
                    <span style="color:#555;">|</span>
                    <span>↑ US$ ${fmtPrice(s.max)}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ── ANÁLISE 02: Noble Basket Index ──
    function renderNobleBasket(data, stats) {
        const nbiVals = data.map(row => {
            let v = 0, ok = true;
            for (const [m, w] of Object.entries(NBI_WEIGHTS)) {
                if (row[m] === null || isNaN(row[m])) { ok = false; break; }
                v += row[m] * w;
            }
            return ok ? v : null;
        }).filter(v => v !== null);

        if (!nbiVals.length) return;

        const curr  = nbiVals[nbiVals.length - 1];
        const prev2 = nbiVals.length > 1 ? nbiVals[nbiVals.length - 2] : curr;
        const chg   = ((curr - prev2) / prev2) * 100;

        document.getElementById('nbi-value').textContent = `US$ ${fmtPrice(curr)}`;
        const chgEl = document.getElementById('nbi-change');
        chgEl.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% vs. dia anterior`;
        chgEl.style.color = chg >= 0 ? '#2AD07A' : '#ff4d4d';

        const barsEl = document.getElementById('nbi-bars');
        if (barsEl) {
            barsEl.innerHTML = Object.entries(NBI_WEIGHTS).map(([m, w]) => {
                const s = stats[m];
                if (!s) return '';
                return `
                <div class="nbi-bar-item">
                    <span class="nbi-bar-label">${METAL_LABELS[m]} (${(w*100).toFixed(0)}%)</span>
                    <div class="nbi-bar-track">
                        <div class="nbi-bar-fill" style="width:${w*100*3}%;max-width:100%;background:${METAL_COLORS[m]};"></div>
                    </div>
                    <span class="nbi-bar-val">US$ ${fmtPrice(s.current)}</span>
                </div>`;
            }).join('');
        }

        destroyChart('nbiChart');
        const ctx = document.getElementById('nbiChart');
        if (ctx && nbiVals.length > 1) {
            const labels = data.slice(-nbiVals.length).map(r => r.dia);
            chartInstances['nbiChart'] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Noble Basket Index (US$/t)',
                        data: nbiVals,
                        borderColor: '#2AD07A',
                        backgroundColor: 'rgba(42,208,122,0.08)',
                        tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 5
                    }]
                },
                options: { ...baseChartOpts }
            });
        }
    }

    // ── ANÁLISE 03: Canal de Preços ──
    function renderChannelBars(stats) {
        const el = document.getElementById('canal-bars');
        if (!el) return;

        el.innerHTML = METALS.map(m => {
            const s = stats[m];
            if (!s) return '';
            const pct   = Math.max(0, Math.min(100, s.channelPos));
            const color = pct >= 85 ? '#ff4d4d' : pct >= 60 ? '#ff9900' : pct >= 30 ? '#ffcc00' : '#2AD07A';
            return `
            <div class="canal-item">
                <div class="canal-header">
                    <span class="canal-name" style="color:${METAL_COLORS[m]};">${METAL_LABELS[m]}</span>
                    <span class="canal-pct" style="color:${color};">${pct.toFixed(1)}% do canal</span>
                    <span class="signal-badge ${s.signalClass}">${s.signal}</span>
                </div>
                <div class="canal-track">
                    <div class="canal-fill" style="width:${pct}%;background:${color};"></div>
                </div>
                <div class="canal-labels">
                    <span>Mín: US$ ${fmtPrice(s.min)}</span>
                    <span><strong>Atual: US$ ${fmtPrice(s.current)}</strong></span>
                    <span>Máx: US$ ${fmtPrice(s.max)}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ── ANÁLISE 05: Tendência de Preços ──
    function renderTrendChart(data, metal) {
        destroyChart('trendChart');
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        const labels = data.map(r => r.dia);
        const values = data.map(r => r[metal]);
        const color  = METAL_COLORS[metal];

        chartInstances['trendChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: `${METAL_LABELS[metal]} (US$/t)`,
                    data: values,
                    borderColor: color,
                    backgroundColor: color + '18',
                    tension: 0.35, fill: true, pointRadius: 3, pointHoverRadius: 7,
                    pointBackgroundColor: color
                }]
            },
            options: deepMerge(baseChartOpts, {
                plugins: { tooltip: { callbacks: { label: ctx => `US$ ${fmtPrice(ctx.raw)}/t` } } }
            })
        });
    }

    // ── ANÁLISE 06: Variação Diária ──
    function renderDailyVariation(stats) {
        destroyChart('varDiariaChart');
        const ctx = document.getElementById('varDiariaChart');
        if (ctx) {
            const changes = METALS.map(m => stats[m] ? parseFloat(stats[m].dayChange.toFixed(2)) : 0);
            const colors  = changes.map(c => c >= 0 ? 'rgba(42,208,122,0.75)' : 'rgba(255,77,77,0.75)');
            chartInstances['varDiariaChart'] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: METALS.map(m => METAL_LABELS[m]),
                    datasets: [{
                        label: 'Variação Diária (%)',
                        data: changes,
                        backgroundColor: colors,
                        borderRadius: 6
                    }]
                },
                options: deepMerge(baseChartOpts, {
                    plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%` } } }
                })
            });
        }

        const listEl = document.getElementById('var-diaria-list');
        if (listEl) {
            const sorted = [...METALS].sort((a, b) => (stats[b]?.dayChange || 0) - (stats[a]?.dayChange || 0));
            listEl.innerHTML = sorted.map(m => {
                const s = stats[m];
                if (!s) return '';
                const up = s.dayChange >= 0;
                return `
                <div class="var-item">
                    <span style="color:${METAL_COLORS[m]};font-weight:700;font-size:0.88rem;">${METAL_LABELS[m]}</span>
                    <span style="color:${up ? '#2AD07A' : '#ff4d4d'};font-weight:700;font-size:0.9rem;">
                        <i class="fa-solid ${up ? 'fa-caret-up' : 'fa-caret-down'}"></i>
                        ${Math.abs(s.dayChange).toFixed(2)}%
                    </span>
                    <span style="color:#666;font-size:0.8rem;">US$ ${fmtPrice(s.current)}</span>
                </div>`;
            }).join('');
        }
    }

    // ── ANÁLISE 07: Volatilidade ──
    function renderVolatility(stats) {
        destroyChart('volatChart');
        const ctx = document.getElementById('volatChart');
        if (!ctx) return;

        const labels  = METALS.map(m => METAL_LABELS[m]);
        const ampAbs  = METALS.map(m => stats[m] ? parseFloat((stats[m].max - stats[m].min).toFixed(2)) : 0);
        const ampPct  = METALS.map(m => {
            const s = stats[m];
            return (s && s.min) ? parseFloat(((s.max - s.min) / s.min * 100).toFixed(2)) : 0;
        });

        chartInstances['volatChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Amplitude Absoluta (US$/t)', data: ampAbs, backgroundColor: 'rgba(42,208,122,0.65)', yAxisID: 'y', borderRadius: 5 },
                    { label: 'Amplitude % (Max-Min/Min)', data: ampPct, backgroundColor: 'rgba(255,153,0,0.65)', yAxisID: 'y1', borderRadius: 5 }
                ]
            },
            options: {
                ...baseChartOpts,
                scales: {
                    x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y:  { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.04)' }, position: 'left',  title: { display: true, text: 'US$/t', color: '#aaa' } },
                    y1: { ticks: { color: '#ff9900' }, grid: { drawOnChartArea: false }, position: 'right', title: { display: true, text: '%', color: '#ff9900' } }
                }
            }
        });
    }

    // ── ANÁLISE 08: Ranking de Performance ──
    function renderRanking(stats) {
        const el = document.getElementById('ranking-container');
        if (!el) return;

        const ranked = METALS
            .filter(m => stats[m])
            .map(m => ({ m, chg: stats[m].monthChange, s: stats[m] }))
            .sort((a, b) => b.chg - a.chg);

        const medals = ['🥇', '🥈', '🥉'];
        el.innerHTML = ranked.map((item, i) => {
            const isPos = item.chg >= 0;
            const barW  = Math.min(100, Math.abs(item.chg) * 10);
            return `
            <div class="rank-item ${i === 0 ? 'rank-first' : ''}">
                <span class="rank-pos">${medals[i] || (i + 1) + 'º'}</span>
                <div class="rank-bar-wrap">
                    <div style="display:flex;justify-content:space-between;margin-bottom:7px;">
                        <strong style="color:${METAL_COLORS[item.m]};font-size:0.95rem;">${METAL_LABELS[item.m]}</strong>
                        <span style="color:${isPos ? '#2AD07A' : '#ff4d4d'};font-weight:700;">
                            ${isPos ? '+' : ''}${item.chg.toFixed(2)}%
                        </span>
                    </div>
                    <div style="background:rgba(255,255,255,0.05);border-radius:4px;height:7px;overflow:hidden;">
                        <div style="height:100%;width:${barW}%;background:${isPos ? '#2AD07A' : '#ff4d4d'};border-radius:4px;transition:width 1s;"></div>
                    </div>
                    <small style="color:#555;font-size:0.75rem;margin-top:4px;display:block;">Primeiro dia do mês → Hoje</small>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="color:#aaa;font-size:0.8rem;">US$ ${fmtPrice(item.s.current)}</div>
                    <div style="color:#555;font-size:0.72rem;">Média: US$ ${fmtPrice(item.s.avg)}</div>
                </div>
            </div>`;
        }).join('');
    }

    // ── ANÁLISE 09: Score de Oportunidade ──
    function renderOpportunityScore(stats) {
        destroyChart('scoreChart');
        const ctx = document.getElementById('scoreChart');
        if (ctx) {
            const scores = METALS.map(m => stats[m] ? parseFloat(stats[m].score.toFixed(1)) : 0);
            const colors = scores.map(s => s >= 75 ? 'rgba(255,77,77,0.8)' : s >= 55 ? 'rgba(255,153,0,0.8)' : s >= 35 ? 'rgba(255,204,0,0.8)' : 'rgba(42,208,122,0.8)');
            chartInstances['scoreChart'] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: METALS.map(m => METAL_LABELS[m]),
                    datasets: [{ label: 'Score (0–100)', data: scores, backgroundColor: colors, borderRadius: 8 }]
                },
                options: deepMerge(baseChartOpts, { scales: { y: { min: 0, max: 100 } } })
            });
        }

        const listEl = document.getElementById('score-list');
        if (listEl) {
            const sorted = [...METALS].filter(m => stats[m]).sort((a, b) => stats[b].score - stats[a].score);
            listEl.innerHTML = sorted.map(m => {
                const s = stats[m];
                const sc = s.score;
                const color = sc >= 75 ? '#ff4d4d' : sc >= 55 ? '#ff9900' : sc >= 35 ? '#ffcc00' : '#2AD07A';
                const label = sc >= 75 ? '🔴 VENDER AGORA' : sc >= 55 ? '🟠 ATENÇÃO' : sc >= 35 ? '🟡 RETER' : '🟢 ACUMULAR';
                return `
                <div class="score-item">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <strong style="color:${METAL_COLORS[m]};font-size:0.9rem;">${METAL_LABELS[m]}</strong>
                        <span style="font-size:1.3rem;font-weight:900;color:${color};">${sc.toFixed(0)}</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:4px;height:5px;overflow:hidden;margin-bottom:7px;">
                        <div style="height:100%;width:${sc}%;background:${color};border-radius:4px;"></div>
                    </div>
                    <small style="color:#666;font-size:0.78rem;">${label}</small>
                </div>`;
            }).join('');
        }
    }

    // ── ANÁLISE 05: Semana Atual vs Anterior ──
    function renderWeekComparison(stats) {
        destroyChart('semanaChart');
        const ctx = document.getElementById('semanaChart');
        if (!ctx) return;

        const labels = METALS.map(m => METAL_LABELS[m]);
        const last5  = METALS.map(m => stats[m] ? parseFloat(stats[m].avg5.toFixed(2))     : 0);
        const prev5  = METALS.map(m => stats[m] ? parseFloat(stats[m].avgPrev5.toFixed(2)) : 0);

        // Color each "Semana Atual" bar: green if up, red if down vs prev week
        const currentColors = METALS.map((m, i) => {
            if (!stats[m]) return 'rgba(100,100,100,0.5)';
            return last5[i] >= prev5[i] ? 'rgba(42,208,122,0.85)' : 'rgba(255,77,77,0.85)';
        });
        const currentBorders = METALS.map((m, i) => {
            if (!stats[m]) return 'rgba(100,100,100,0.8)';
            return last5[i] >= prev5[i] ? 'rgba(42,208,122,1)' : 'rgba(255,77,77,1)';
        });


        const customDatalabelsSemana = {
            id: 'customDatalabelsSemana',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (meta.hidden) return;
                    meta.data.forEach((point, idx) => {
                        const val = dataset.data[idx];
                        if (!val) return;
                        
                        if (i === 0) { // Semana Atual
                            const prevVal = prev5[idx] || 0;
                            const diff = val - prevVal;
                            const pct = prevVal ? ((diff / prevVal) * 100).toFixed(1) : '0.0';
                            const arrow = diff >= 0 ? '\u25b2' : '\u25bc';
                            const sign = diff >= 0 ? '+' : '';
                            const color = val >= prevVal ? '#2AD07A' : '#ff4d4d';
                            
                            ctx.save();
                            ctx.font = 'bold 10px Lato, sans-serif';
                            ctx.fillStyle = color;
                            ctx.textAlign = 'center';
                            ctx.fillText(arrow + ' US$ ' + fmtPrice(val), point.x, point.y - 18);
                            ctx.fillText(sign + pct + '%', point.x, point.y - 6);
                            ctx.restore();
                        } else if (i === 1) { // Semana Anterior
                            ctx.save();
                            ctx.font = '9px Lato, sans-serif';
                            ctx.fillStyle = '#aaaaaa';
                            ctx.textAlign = 'center';
                            ctx.fillText('US$ ' + fmtPrice(val), point.x, point.y - 6);
                            ctx.restore();
                        }
                    });
                });
            }
        };

        chartInstances['semanaChart'] = new Chart(ctx, {
            type: 'bar',
            plugins: [customDatalabelsSemana],
            data: {
                labels,
                datasets: [
                    {
                        label: 'Semana Atual (Media 5d)',
                        data: last5,
                        backgroundColor: currentColors,
                        borderColor: currentBorders,
                        borderWidth: 2,
                        borderRadius: 6,
                        order: 1
                    },
                    {
                        label: 'Semana Anterior (Media 5d)',
                        data: prev5,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderColor: 'rgba(255,255,255,0.35)',
                        borderWidth: 2,
                        borderRadius: 6,
                        order: 2
                    }
                ]
            },
            options: deepMerge(baseChartOpts, {
                layout: { padding: { top: 55 } },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ccc',
                            font: { family: 'Lato', size: 12 },
                            padding: 18,
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const i = context.dataIndex;
                                const val = context.raw;
                                const diff = last5[i] - prev5[i];
                                const pct  = prev5[i] ? ((diff / prev5[i]) * 100).toFixed(2) : '0.00';
                                const arrow = diff >= 0 ? '\u25b2' : '\u25bc';
                                const sign  = diff >= 0 ? '+' : '';
                                if (context.datasetIndex === 0) {
                                    return [
                                        ' Atual: US$ ' + fmtPrice(val) + '/t',
                                        ' ' + arrow + ' ' + sign + pct + '% vs semana anterior'
                                    ];
                                }
                                return ' Anterior: US$ ' + fmtPrice(val) + '/t';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#aaa', font: { size: 12, weight: 'bold' } },
                        grid: { color: 'rgba(255,255,255,0.04)' }
                    },
                    y: {
                        ticks: {
                            color: '#888',
                            font: { size: 11 },
                            callback: v => 'US$ ' + fmtPrice(v)
                        },
                        grid: { color: 'rgba(255,255,255,0.06)' }
                    }
                }
            })
        });

        // ── Render directional badges below the chart ──
        const badges = document.getElementById('semana-badges');
        if (!badges) return;
        badges.innerHTML = METALS.map((m, i) => {
            if (!stats[m]) return '';
            const diff   = last5[i] - prev5[i];
            const pct    = prev5[i] ? ((diff / prev5[i]) * 100) : 0;
            const isUp   = diff >= 0;
            const arrow  = isUp ? '▲' : '▼';
            const color  = isUp ? '#2AD07A' : '#ff4d4d';
            const bgClr  = isUp ? 'rgba(42,208,122,0.12)' : 'rgba(255,77,77,0.12)';
            const border = isUp ? 'rgba(42,208,122,0.4)' : 'rgba(255,77,77,0.4)';
            const sign   = isUp ? '+' : '';
            return `
            <div style="
                background:${bgClr};
                border:1px solid ${border};
                border-radius:10px;
                padding:10px 16px;
                min-width:110px;
                text-align:center;
                flex:1 1 110px;
                max-width:160px;
            ">
                <div style="font-size:0.75rem;color:#aaa;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;">${METAL_LABELS[m]}</div>
                <div style="font-size:1.6rem;color:${color};line-height:1;">${arrow}</div>
                <div style="font-size:1rem;color:${color};font-weight:700;margin-top:2px;">${sign}${fmtBRL(pct)}%</div>
                <div style="font-size:0.7rem;color:#666;margin-top:3px;">US$ ${fmtPrice(last5[i])}</div>
            </div>`;
        }).join('');
    }

    // ── ANÁLISE 11: Melhor Dia da Semana ──
    function renderBestDayOfWeek(data) {
        destroyChart('diaSemanaChart');
        const ctx = document.getElementById('diaSemanaChart');
        if (!ctx) return;

        const mesSel  = document.getElementById('mes-selector');
        const mesVal  = mesSel ? mesSel.value : `${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
        const [mesN, anoN] = mesVal.split('-').map(Number);

        const dow = { 'Seg': { sum: 0, cnt: 0 }, 'Ter': { sum: 0, cnt: 0 }, 'Qua': { sum: 0, cnt: 0 }, 'Qui': { sum: 0, cnt: 0 }, 'Sex': { sum: 0, cnt: 0 } };
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        data.forEach(row => {
            const d = parseInt(row.dia);
            if (isNaN(d) || !row.cobre) return;
            const dt   = new Date(anoN, mesN - 1, d);
            const name = dayNames[dt.getDay()];
            if (dow[name]) { dow[name].sum += row.cobre; dow[name].cnt++; }
        });

        const workDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
        const avgs     = workDays.map(d => dow[d].cnt > 0 ? parseFloat((dow[d].sum / dow[d].cnt).toFixed(2)) : null);
        const maxAvg   = Math.max(...avgs.filter(v => v !== null));
        const colors   = avgs.map(v => v === maxAvg ? 'rgba(42,208,122,0.9)' : 'rgba(42,208,122,0.25)');

        chartInstances['diaSemanaChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: workDays,
                datasets: [{ label: 'Média do Cobre (US$/t)', data: avgs, backgroundColor: colors, borderRadius: 8 }]
            },
            options: deepMerge(baseChartOpts, {
                plugins: { tooltip: { callbacks: { label: ctx => `US$ ${fmtPrice(ctx.raw)}/t` } } }
            })
        });
    }

    // ── ANÁLISE 12: Momentum ──
    function renderMomentum(stats) {
        const el = document.getElementById('momentum-grid');
        if (!el) return;

        el.innerHTML = METALS.map(m => {
            const s = stats[m];
            if (!s) return '';
            const mom   = s.momentum;
            const up    = mom >= 0;
            const color = up ? '#2AD07A' : '#ff4d4d';
            const icon  = up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            const label = Math.abs(mom) > 2 ? (up ? 'Alta Expressiva' : 'Queda Expressiva') : Math.abs(mom) > 0.5 ? (up ? 'Leve Alta' : 'Leve Queda') : 'Estável';
            return `
            <div class="momentum-card">
                <div style="color:${METAL_COLORS[m]};font-weight:700;font-size:0.9rem;margin-bottom:10px;">${METAL_LABELS[m]}</div>
                <div style="font-size:2rem;color:${color};margin-bottom:6px;"><i class="fa-solid ${icon}"></i></div>
                <div style="font-size:1.4rem;font-weight:900;color:${color};">${up ? '+' : ''}${mom.toFixed(2)}%</div>
                <small style="color:#666;margin-top:4px;display:block;">${label}</small>
                <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);font-size:0.72rem;color:#555;">
                    <div>Ult.5d: US$ ${fmtPrice(s.avg5)}</div>
                    <div>Ant.: US$ ${fmtPrice(s.avgPrev5)}</div>
                </div>
            </div>`;
        }).join('');
    }

    // ── ANÁLISE 13: Dólar ──
    function renderDolarChart(data) {
        destroyChart('dolarChart');
        const ctx = document.getElementById('dolarChart');
        if (!ctx) return;

        const dolarRows = data.filter(r => r.dolar !== null);
        if (!dolarRows.length) {
            ctx.closest('.chart-container').innerHTML = '<p style="color:#666;text-align:center;padding:40px 20px;">Dados do câmbio não disponíveis neste período.</p>';
            return;
        }

        chartInstances['dolarChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dolarRows.map(r => r.dia),
                datasets: [{
                    label: 'Dólar (BRL/USD)',
                    data: dolarRows.map(r => r.dolar),
                    borderColor: '#f5c518',
                    backgroundColor: 'rgba(245,197,24,0.08)',
                    tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 6
                }]
            },
            options: deepMerge(baseChartOpts, {
                plugins: { tooltip: { callbacks: { label: ctx => `R$ ${fmtPrice(ctx.raw)}` } } }
            })
        });
    }

    // ── ANÁLISE 14: SMA-5 ──
    function renderSMAChart(data, stats) {
        destroyChart('smaChart');
        const ctx = document.getElementById('smaChart');
        if (!ctx || !stats['cobre']) return;

        const s = stats['cobre'];
        chartInstances['smaChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(r => r.dia),
                datasets: [
                    {
                        label: 'Cobre (US$/t)',
                        data: data.map(r => r.cobre),
                        borderColor: METAL_COLORS['cobre'],
                        backgroundColor: METAL_COLORS['cobre'] + '15',
                        tension: 0.3, fill: false, pointRadius: 2, pointHoverRadius: 5
                    },
                    {
                        label: 'SMA-5 dias',
                        data: s.sma5,
                        borderColor: 'rgba(255,255,255,0.6)',
                        borderDash: [6, 4],
                        backgroundColor: 'transparent',
                        tension: 0.3, fill: false, pointRadius: 0
                    }
                ]
            },
            options: { ...baseChartOpts }
        });
    }

    // ── ANÁLISE 15: Preço Atual vs. Média Mensal ──
    function renderVsMedia(stats) {
        destroyChart('vsMediaChart');
        const ctx = document.getElementById('vsMediaChart');
        if (!ctx) return;

        const currents = METALS.map(m => stats[m] ? parseFloat(stats[m].current.toFixed(2)) : 0);
        const avgs     = METALS.map(m => stats[m] ? parseFloat(stats[m].avg.toFixed(2)) : 0);
        // Color current bar by above/below average
        const curColors = METALS.map((m, i) => currents[i] >= avgs[i] ? 'rgba(42,208,122,0.75)' : 'rgba(255,153,0,0.75)');

        chartInstances['vsMediaChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: METALS.map(m => METAL_LABELS[m]),
                datasets: [
                    { label: 'Preço Atual', data: currents, backgroundColor: curColors, borderRadius: 5 },
                    { label: 'Média Mensal', data: avgs, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5, borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1 }
                ]
            },
            options: { ...baseChartOpts }
        });
    }

    // ── ANÁLISE 16: Índice de Risco (Polar Area) ──
    function renderRiskChart(stats) {
        destroyChart('riscoChart');
        const ctx = document.getElementById('riscoChart');
        if (!ctx) return;

        const risks = METALS.map(m => stats[m] ? parseFloat(stats[m].riskIndex.toFixed(2)) : 0);
        chartInstances['riscoChart'] = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: METALS.map(m => METAL_LABELS[m]),
                datasets: [{
                    data: risks,
                    backgroundColor: METALS.map(m => METAL_COLORS[m] + 'aa'),
                    borderColor: METALS.map(m => METAL_COLORS[m]),
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#ccc', font: { family: 'Lato', size: 12 } } },
                    tooltip: { callbacks: { label: ctx => ` Risco: ${ctx.raw}% (CV)` } }
                },
                scales: {
                    r: {
                        ticks: { color: '#888', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255,255,255,0.07)' }
                    }
                }
            }
        });
    }

    // ── ANÁLISE 17: Radar Comparativo ──
    function renderRadar(stats) {
        destroyChart('radarChart');
        const ctx = document.getElementById('radarChart');
        if (!ctx) return;

        const datasets = METALS.map(m => {
            const s = stats[m];
            if (!s) return null;
            return {
                label: METAL_LABELS[m],
                data: [
                    s.channelPos,                                                // Canal
                    Math.max(0, Math.min(100, (s.momentum + 5) / 10 * 100)),    // Momentum
                    Math.max(0, Math.min(100, (s.dayChange + 2) / 4 * 100)),     // Var.Dia
                    s.score,                                                     // Score
                    Math.min(100, s.riskIndex * 15)                             // Volatilidade
                ],
                borderColor: METAL_COLORS[m],
                backgroundColor: METAL_COLORS[m] + '28',
                pointBackgroundColor: METAL_COLORS[m],
                pointRadius: 4
            };
        }).filter(Boolean);

        chartInstances['radarChart'] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Canal (%)', 'Momentum', 'Var. Dia', 'Score', 'Volatilidade'],
                datasets
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#ccc', font: { family: 'Lato', size: 11 } } } },
                scales: {
                    r: {
                        min: 0, max: 100,
                        ticks: { color: '#888', backdropColor: 'transparent', stepSize: 25, font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.08)' },
                        pointLabels: { color: '#ccc', font: { size: 12 } }
                    }
                }
            }
        });
    }

    // ── ANÁLISE 18: Z-Score ──
    function renderZscore(stats) {
        const el = document.getElementById('zscore-container');
        if (!el) return;

        const sorted = [...METALS].filter(m => stats[m]).sort((a, b) => stats[b].zscore - stats[a].zscore);

        el.innerHTML = sorted.map(m => {
            const s = stats[m];
            const z = s.zscore;
            const color = z > 1 ? '#ff4d4d' : z > 0 ? '#ffcc00' : z > -1 ? '#ff9900' : '#2AD07A';
            const pct   = Math.max(0, Math.min(100, 50 + z * 25)); // Center=50%, 1 std = 25%
            const label = z > 1.5 ? 'Muito acima da média — VENDER' : z > 0.5 ? 'Acima da média — Momento favorável' : z < -1.5 ? 'Muito abaixo da média — ACUMULAR' : z < -0.5 ? 'Abaixo da média — Aguardar' : 'Na média — Neutro';
            return `
            <div class="zscore-item">
                <div class="zscore-name" style="color:${METAL_COLORS[m]};">${METAL_LABELS[m]}</div>
                <div class="zscore-bar-wrap">
                    <div style="position:relative;width:100%;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
                        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:rgba(255,255,255,0.2);"></div>
                        ${z >= 0
                            ? `<div style="position:absolute;left:50%;top:0;height:100%;width:${Math.min(50, Math.abs(z)*25)}%;background:${color};border-radius:0 4px 4px 0;"></div>`
                            : `<div style="position:absolute;right:${100 - (50)}%;top:0;height:100%;width:${Math.min(50, Math.abs(z)*25)}%;background:${color};border-radius:4px 0 0 4px;right:50%;"></div>`
                        }
                    </div>
                    <small style="color:#555;font-size:0.72rem;margin-top:5px;display:block;">${label}</small>
                </div>
                <div class="zscore-val" style="color:${color};">${z >= 0 ? '+' : ''}${z.toFixed(2)}σ</div>
            </div>`;
        }).join('');
    }

    // ── ANÁLISE 19: Alertas de Preço ──
    function renderAlerts(stats) {
        const el = document.getElementById('alertas-grid');
        if (!el) return;

        const saved = JSON.parse(localStorage.getItem('apex_price_alerts') || '{}');

        el.innerHTML = METALS.map(m => {
            const s         = stats[m];
            if (!s) return '';
            const alertVal  = saved[m] ? parseFloat(saved[m]) : null;
            const triggered = alertVal !== null && s.current >= alertVal;
            return `
            <div class="alerta-card ${triggered ? 'alerta-triggered' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <strong style="color:${METAL_COLORS[m]};font-size:0.95rem;">${METAL_LABELS[m]}</strong>
                    ${triggered ? '<span class="badge-triggered">🔔 ALERTA!</span>' : ''}
                </div>
                <p style="font-size:0.82rem;color:#888;margin-bottom:10px;">Atual: <strong style="color:#ddd;">US$ ${fmtPrice(s.current)}</strong></p>
                ${alertVal ? `<p style="font-size:0.78rem;color:#666;margin-bottom:10px;">Alvo: US$ ${fmtPrice(alertVal)} | Gap: ${((s.current - alertVal) / alertVal * 100).toFixed(1)}%</p>` : ''}
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="number" class="alert-input" data-metal="${m}"
                        value="${alertVal || ''}" placeholder="Preço alvo (US$)" step="10"
                        style="flex:1;padding:8px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-family:inherit;">
                    <button class="btn-set-alert" data-metal="${m}"
                        style="padding:8px 12px;background:${METAL_COLORS[m]}33;color:${METAL_COLORS[m]};border:1px solid ${METAL_COLORS[m]}55;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.82rem;white-space:nowrap;transition:all 0.2s;">
                        Definir
                    </button>
                </div>
            </div>`;
        }).join('');

        el.querySelectorAll('.btn-set-alert').forEach(btn => {
            btn.addEventListener('click', () => {
                const metal  = btn.dataset.metal;
                const input  = el.querySelector(`.alert-input[data-metal="${metal}"]`);
                const alerts = JSON.parse(localStorage.getItem('apex_price_alerts') || '{}');
                if (input.value) { alerts[metal] = input.value; } else { delete alerts[metal]; }
                localStorage.setItem('apex_price_alerts', JSON.stringify(alerts));
                renderAlerts(stats);
            });
        });
    }

    // ── ANÁLISE 20: Resumo Executivo ──
    function renderResumo(stats) {
        const el = document.getElementById('resumo-executivo');
        if (!el) return;

        const sorted = METALS.filter(m => stats[m]).map(m => ({ m, s: stats[m] })).sort((a, b) => b.s.score - a.s.score);

        const groups = {
            'VENDER':   { items: [], color: '#ff4d4d',  icon: 'fa-arrow-up-right-dots', label: 'VENDER AGORA' },
            'ATENÇÃO':  { items: [], color: '#ff9900',  icon: 'fa-eye',                 label: 'ATENÇÃO — Perto do Topo' },
            'RETER':    { items: [], color: '#ffcc00',  icon: 'fa-pause',               label: 'RETER — Aguardar Alta' },
            'ACUMULAR': { items: [], color: '#2AD07A',  icon: 'fa-cart-shopping',       label: 'ACUMULAR — Preço em Baixa' }
        };
        sorted.forEach(x => { if (groups[x.s.signal]) groups[x.s.signal].items.push(x); });

        el.innerHTML = Object.entries(groups).map(([key, g]) => {
            if (!g.items.length) return '';
            return `
            <div class="resumo-group" style="border-color:${g.color}30;">
                <div class="resumo-group-header" style="background:${g.color}15;color:${g.color};">
                    <i class="fa-solid ${g.icon}"></i>
                    <strong>${g.label}</strong>
                </div>
                <div class="resumo-group-body">
                    ${g.items.map(x => `
                    <div class="resumo-item">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="width:8px;height:8px;border-radius:50%;background:${METAL_COLORS[x.m]};flex-shrink:0;"></div>
                            <span style="color:${METAL_COLORS[x.m]};font-weight:700;font-size:0.9rem;">${METAL_LABELS[x.m]}</span>
                        </div>
                        <div style="text-align:right;">
                            <div style="color:#ddd;font-size:0.85rem;">US$ ${fmtPrice(x.s.current)}</div>
                            <div style="color:#555;font-size:0.72rem;">Score: ${x.s.score.toFixed(0)} · Canal: ${x.s.channelPos.toFixed(0)}%</div>
                        </div>
                    </div>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    // =========================================================================
    // SETTINGS — Configurar Homepage
    // =========================================================================
    async function initSettings() {
        try {
            const res      = await fetch('/api/settings');
            const settings = await res.json();

            document.querySelectorAll('.toggle-switch input[data-key]').forEach(toggle => {
                const key     = toggle.dataset.key;
                toggle.checked = settings[key] !== 'false';
            });
        } catch(e) {
            console.warn('Não foi possível carregar settings:', e);
        }

        // Configuração Local - Painel Admin
        const toggleLME = document.getElementById('toggle-relatorio-lme');
        const navLME = document.querySelector('a.nav-item[data-target="lme-excel-report"]');
        
        if (toggleLME && navLME) {
            // Load state
            const showLME = localStorage.getItem('admin_show_relatorio_lme') !== 'false';
            toggleLME.checked = showLME;
            navLME.style.display = showLME ? 'flex' : 'none';

            // Change event for immediate feedback
            toggleLME.addEventListener('change', (e) => {
                const isVisible = e.target.checked;
                localStorage.setItem('admin_show_relatorio_lme', isVisible ? 'true' : 'false');
                navLME.style.display = isVisible ? 'flex' : 'none';
                
                // If we hide it while being active, go to dashboard
                if (!isVisible && navLME.classList.contains('active')) {
                    document.querySelector('a.nav-item[data-target="home-config"]')?.click();
                }
            });
        }

        const btnSave = document.getElementById('btn-save-settings');
        const msgEl   = document.getElementById('settings-msg');

        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                const settings = {};
                document.querySelectorAll('.toggle-switch input[data-key]').forEach(t => {
                    settings[t.dataset.key] = t.checked ? 'true' : 'false';
                });

                try {
                    const res = await fetch('/api/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(settings)
                    });

                    if (res.ok) {
                        msgEl.textContent = '✅ Configurações salvas!';
                        msgEl.style.color = '#2AD07A';
                        msgEl.style.display = 'block';
                        setTimeout(() => msgEl.style.display = 'none', 5000);
                    } else {
                        throw new Error('API error');
                    }
                } catch(e) {
                    msgEl.textContent = '❌ Erro ao salvar. Tente novamente.';
                    msgEl.style.color = '#ff4d4d';
                    msgEl.style.display = 'block';
                }
            });
        }
    }

    // =========================================================================
    // GALERIA
    // =========================================================================
    async function initGaleria() {
        const formGal   = document.getElementById('form-galeria');
        const urlInput  = document.getElementById('gal-url');
        const preview   = document.getElementById('gal-preview');
        const prevImg   = document.getElementById('gal-preview-img');

        if (urlInput) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                if (url && (url.startsWith('http') || url.startsWith('//'))) {
                    prevImg.src = url;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            });
        }

        await renderGaleriaAdmin();

        if (formGal) {
            formGal.addEventListener('submit', async (e) => {
                e.preventDefault();
                const url    = document.getElementById('gal-url').value.trim();
                const titulo = document.getElementById('gal-titulo').value.trim();
                const ordem  = parseInt(document.getElementById('gal-ordem').value) || 0;

                const res = await fetch('/api/galeria', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, titulo, ordem })
                });

                if (res.ok) {
                    formGal.reset();
                    if (preview) preview.style.display = 'none';
                    await renderGaleriaAdmin();
                } else {
                    _apexNotify('Atenção', '❌ Erro ao adicionar foto. Verifique os dados.', 'error');
                }
            });
        }
    }

    async function renderGaleriaAdmin() {
        const grid = document.getElementById('galeria-admin-grid');
        if (!grid) return;

        grid.innerHTML = '<p style="color:#888;grid-column:1/-1;padding:20px;text-align:center;">Carregando...</p>';

        try {
            const res   = await fetch('/api/galeria');
            const items = await res.json();

            if (!items.length) {
                grid.innerHTML = '<p style="color:#555;grid-column:1/-1;padding:30px;text-align:center;"><i class="fa-solid fa-image" style="font-size:2rem;display:block;margin-bottom:10px;"></i>Nenhuma foto cadastrada. Adicione a primeira!</p>';
                return;
            }

            grid.innerHTML = items.map(item => `
                <div class="gal-admin-item" title="${item.titulo}">
                    <img src="${item.url}" alt="${item.titulo}" loading="lazy"
                         onerror="this.src='https://placehold.co/300x200/0a1911/2AD07A?text=Erro'">
                    <div class="gal-admin-overlay">
                        <p>${item.titulo}</p>
                        <button class="btn-delete btn-del-gal" data-id="${item.id}" style="width:auto;padding:6px 12px;margin-top:4px;">
                            <i class="fa-solid fa-trash"></i> Remover
                        </button>
                    </div>
                </div>
            `).join('');

            grid.querySelectorAll('.btn-del-gal').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Remover esta foto da galeria?')) return;
                    await fetch(`/api/galeria/${btn.dataset.id}`, { method: 'DELETE' });
                    await renderGaleriaAdmin();
                });
            });
        } catch(e) {
            grid.innerHTML = '<p style="color:#f55;grid-column:1/-1;padding:20px;">Erro ao carregar galeria.</p>';
        }
    }

    // =========================================================================
    // MATERIAIS
    // =========================================================================
    function initMateriais() {
        const form             = document.getElementById('form-material');
        const listContainer    = document.getElementById('materiais-list');
        const btnAddLocation   = document.getElementById('btn-add-location');
        const locationsWrapper = document.getElementById('locations-wrapper');

        async function renderMateriais() {
            if (!listContainer) return;
            listContainer.innerHTML = '<p style="color:#888;">Carregando...</p>';
            try {
                const res  = await fetch('/api/materiais');
                const mats = await res.json();
                listContainer.innerHTML = '';

                if (!mats.length) {
                    listContainer.innerHTML = '<p style="color:#666;grid-column:1/-1;">Nenhum material cadastrado ainda.</p>';
                    return;
                }

                mats.forEach(mat => {
                    const div      = document.createElement('div');
                    div.className  = 'mat-item';
                    const locsText = mat.locais && mat.locais.length ? `<p style="font-size:0.75rem;color:#555;margin-top:8px;">${mat.locais.length} locais de coleta.</p>` : '';
                    const imgHtml  = mat.imagem ? `<img src="${mat.imagem}" alt="${mat.nome}" style="width:100%;height:120px;object-fit:cover;">` : '';
                    div.innerHTML  = `
                        ${imgHtml}
                        <div class="mat-content">
                            <h4>${mat.nome}</h4>
                            <p>${mat.descricao}</p>
                            ${locsText}
                            <button class="btn-delete" data-id="${mat.id}" style="margin-top:12px;"><i class="fa-solid fa-trash"></i> Remover</button>
                        </div>`;
                    listContainer.appendChild(div);
                });

                listContainer.querySelectorAll('.btn-delete').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Remover este material?')) return;
                        await fetch(`/api/materiais/${btn.dataset.id}`, { method: 'DELETE' });
                        renderMateriais();
                    });
                });
            } catch(err) {
                listContainer.innerHTML = '<p style="color:#f55;">Erro ao carregar materiais.</p>';
            }
        }

        function createLocationField() {
            const div       = document.createElement('div');
            div.className   = 'location-item';
            div.innerHTML   = `
                <button type="button" class="btn-remove-loc"><i class="fa-solid fa-xmark"></i></button>
                <div class="form-group"><label>Título do Local</label><input type="text" class="loc-title" required placeholder="Ex: Indústria"></div>
                <div class="form-group" style="margin-bottom:0;"><label>Descrição</label><textarea class="loc-desc" rows="2" required placeholder="Descrição detalhada..."></textarea></div>`;
            div.querySelector('.btn-remove-loc').addEventListener('click', () => div.remove());
            if (locationsWrapper) locationsWrapper.appendChild(div);
        }

        if (btnAddLocation) {
            btnAddLocation.addEventListener('click', createLocationField);
            createLocationField();
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nome     = document.getElementById('mat-name').value;
                const imagem   = document.getElementById('mat-image').value.trim();
                const descricao = document.getElementById('mat-desc').value;
                const locais   = [];
                document.querySelectorAll('.location-item').forEach(item => {
                    locais.push({ titulo: item.querySelector('.loc-title').value, desc: item.querySelector('.loc-desc').value });
                });

                const res = await fetch('/api/materiais', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, imagem, descricao, locais })
                });

                if (res.ok) {
                    form.reset();
                    if (locationsWrapper) locationsWrapper.innerHTML = '';
                    createLocationField();
                    renderMateriais();
                    _apexNotify('Sistema', '✅ Material cadastrado com sucesso!', 'info');
                } else {
                    _apexNotify('Atenção', '❌ Erro ao salvar material.', 'error');
                }
            });
        }

        renderMateriais();
    }

    // =========================================================================
    // SOLUÇÕES
    // =========================================================================
    function initSolucoes() {
        const formSolucao      = document.getElementById('form-solucao');
        const solucoesAdminList = document.getElementById('solucoes-admin-list');
        const btnCancelSolucao  = document.getElementById('btn-cancel-solucao');
        const solIdInput        = document.getElementById('sol-id');
        const solTituloInput    = document.getElementById('sol-titulo');
        const solImgInput       = document.getElementById('sol-img');
        const solDescInput      = document.getElementById('sol-desc');

        async function renderSolucoesAdmin() {
            if (!solucoesAdminList) return;
            solucoesAdminList.innerHTML = '<p style="color:#888;">Carregando...</p>';
            try {
                const res   = await fetch('/api/solucoes');
                const items = await res.json();
                solucoesAdminList.innerHTML = '';

                if (!items.length) {
                    solucoesAdminList.innerHTML = '<p style="color:#666;padding:10px 0;">Nenhuma solução cadastrada.</p>';
                    return;
                }

                items.forEach(s => {
                    const div       = document.createElement('div');
                    div.className   = 'noticia-admin-item';
                    div.style.alignItems = 'center';
                    div.innerHTML   = `
                        <div style="margin-right:14px;flex-shrink:0;">
                            <img src="${s.img}" alt="${s.nome}" style="width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(42,208,122,0.4));">
                        </div>
                        <div class="noticia-admin-info" style="flex:1;">
                            <strong>${s.nome}</strong>
                            <small style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;display:block;">${s.descricao}</small>
                        </div>
                        <div style="display:flex;gap:6px;flex-shrink:0;">
                            <button class="btn-primary btn-edit-solucao" data-id="${s.id}" style="padding:6px 10px;width:auto;"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn-delete btn-delete-solucao" data-id="${s.id}" style="padding:6px 10px;margin-top:0;"><i class="fa-solid fa-trash"></i></button>
                        </div>`;
                    solucoesAdminList.appendChild(div);
                });

                solucoesAdminList.querySelectorAll('.btn-edit-solucao').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const res = await fetch('/api/solucoes');
                        const all = await res.json();
                        const sol = all.find(x => x.id == btn.dataset.id);
                        if (sol) {
                            solIdInput.value     = sol.id;
                            solTituloInput.value = sol.nome;
                            solImgInput.value    = sol.img;
                            solDescInput.value   = sol.descricao;
                            if (btnCancelSolucao) btnCancelSolucao.style.display = 'inline-flex';
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    });
                });

                solucoesAdminList.querySelectorAll('.btn-delete-solucao').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Remover esta solução?')) return;
                        await fetch(`/api/solucoes/${btn.dataset.id}`, { method: 'DELETE' });
                        renderSolucoesAdmin();
                    });
                });
            } catch(err) {
                solucoesAdminList.innerHTML = '<p style="color:#f55;">Erro ao carregar soluções.</p>';
            }
        }

        if (formSolucao) {
            formSolucao.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id       = solIdInput.value;
                const nome     = solTituloInput.value.trim();
                const img      = solImgInput.value.trim();
                const descricao = solDescInput.value.trim();
                const method   = id ? 'PUT' : 'POST';
                const url      = id ? `/api/solucoes/${id}` : '/api/solucoes';

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, img, descricao })
                });

                if (res.ok) {
                    formSolucao.reset();
                    solIdInput.value = '';
                    if (btnCancelSolucao) btnCancelSolucao.style.display = 'none';
                    renderSolucoesAdmin();
                    _apexNotify('Sistema', '✅ Solução salva com sucesso!', 'info');
                } else {
                    _apexNotify('Atenção', '❌ Erro ao salvar a solução.', 'error');
                }
            });
        }

        if (btnCancelSolucao) {
            btnCancelSolucao.addEventListener('click', () => {
                formSolucao.reset();
                solIdInput.value = '';
                btnCancelSolucao.style.display = 'none';
            });
        }

        renderSolucoesAdmin();
    }

    // =========================================================================
    // NOTÍCIAS
    // =========================================================================
    function initNoticias() {
        const formNoticia       = document.getElementById('form-noticia');
        const noticiasAdminList = document.getElementById('noticias-admin-list');

        async function renderNoticiasAdmin() {
            if (!noticiasAdminList) return;
            noticiasAdminList.innerHTML = '<p style="color:#888;">Carregando...</p>';
            try {
                const res   = await fetch('/api/noticias');
                const items = await res.json();
                noticiasAdminList.innerHTML = '';

                if (!items.length) {
                    noticiasAdminList.innerHTML = '<p style="color:#666;padding:10px 0;">Nenhuma notícia publicada ainda.</p>';
                    return;
                }

                items.forEach(n => {
                    const div   = document.createElement('div');
                    div.className = 'noticia-admin-item';
                    const dataF = n.data_pub ? new Date(n.data_pub + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
                    div.innerHTML = `
                        <div class="noticia-admin-info">
                            ${n.categoria ? `<span class="noticia-admin-cat">${n.categoria}</span>` : ''}
                            <strong>${n.titulo}</strong>
                            <small>${dataF}</small>
                            ${n.url ? `<a href="${n.url}" target="_blank" class="noticia-admin-link"><i class="fa-solid fa-external-link-alt"></i> Ver fonte</a>` : ''}
                        </div>
                        <button class="btn-delete btn-delete-noticia" data-id="${n.id}"><i class="fa-solid fa-trash"></i></button>`;
                    noticiasAdminList.appendChild(div);
                });

                noticiasAdminList.querySelectorAll('.btn-delete-noticia').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Remover esta notícia?')) return;
                        await fetch(`/api/noticias/${btn.dataset.id}`, { method: 'DELETE' });
                        renderNoticiasAdmin();
                    });
                });
            } catch(err) {
                noticiasAdminList.innerHTML = '<p style="color:#f55;">Erro ao carregar notícias.</p>';
            }
        }

        if (formNoticia) {
            const inputData = document.getElementById('not-data');
            if (inputData && !inputData.value) inputData.value = new Date().toISOString().split('T')[0];

            formNoticia.addEventListener('submit', async (e) => {
                e.preventDefault();
                const titulo    = document.getElementById('not-titulo').value.trim();
                const url       = document.getElementById('not-url').value.trim();
                const resumo    = document.getElementById('not-resumo').value.trim();
                const data      = document.getElementById('not-data').value;
                const categoria = document.getElementById('not-categoria').value;

                const res = await fetch('/api/noticias', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ titulo, url, resumo, data, categoria })
                });

                if (res.ok) {
                    formNoticia.reset();
                    const dEl = document.getElementById('not-data');
                    if (dEl) dEl.value = new Date().toISOString().split('T')[0];
                    renderNoticiasAdmin();
                    _apexNotify('Sistema', '✅ Notícia publicada!', 'info');
                } else {
                    _apexNotify('Atenção', '❌ Erro ao publicar notícia.', 'error');
                }
            });
        }

        renderNoticiasAdmin();
    }

    // =========================================================================
    // CONFIGURAÇÃO DE E-MAIL LME E TABELAS DE PREÇOS
    // =========================================================================
    async function initLMEEmailConfig() {
        const schedAtivo    = document.getElementById('sched-ativo');
        const schedHorario  = document.getElementById('sched-horario');
        const formScheduler = document.getElementById('form-scheduler-config');

        const resendApiKey  = document.getElementById('resend-api-key');
        const resendFrom    = document.getElementById('resend-from');
        const formResend    = document.getElementById('form-resend-config');
        const btnToggleKey  = document.getElementById('btn-toggle-resend-key');
        
        if (btnToggleKey && resendApiKey) {
            btnToggleKey.addEventListener('click', () => {
                if (resendApiKey.type === 'password') {
                    resendApiKey.type = 'text';
                    btnToggleKey.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                } else {
                    resendApiKey.type = 'password';
                    btnToggleKey.innerHTML = '<i class="fa-solid fa-eye"></i>';
                }
            });
        }

        const btnEnviarTest = document.getElementById('btn-enviar-teste-lme');
        const testEmailMsg  = document.getElementById('test-email-msg');

        const formDest      = document.getElementById('form-destinatario');
        const destId        = document.getElementById('dest-id');
        const destNome      = document.getElementById('dest-nome');
        const destEmail     = document.getElementById('dest-email');
        const destFormTitle = document.getElementById('destinatario-form-title');
        const btnCancelDest = document.getElementById('btn-cancel-destinatario');
        const listDest      = document.getElementById('lme-destinatarios-list');

        // ─── 1. MÓDULO LME ──────────────────────────────────────────────────
        async function loadConfigLME() {
            try {
                const res = await fetch('/api/settings');
                const settings = await res.json();

                if (schedAtivo) schedAtivo.checked = settings.lme_envio_ativo === 'true';
                if (schedHorario) schedHorario.value = settings.lme_envio_horario || '14:00';

                const diasStr = settings.lme_envio_dias !== undefined ? settings.lme_envio_dias : '1,2,3,4,5';
                const diasArr = diasStr.split(',');
                document.querySelectorAll('.sched-dia').forEach(chk => { chk.checked = diasArr.includes(chk.value); });

                if (resendApiKey) resendApiKey.value = settings.lme_resend_api_key || '';
                if (resendFrom) resendFrom.value = settings.lme_resend_from || 'josetiago@lme.lat';

                loadDestinatariosLME();
            } catch (err) {
                console.error('Erro ao carregar configurações LME:', err);
            }
        }

        async function loadDestinatariosLME() {
            if (!listDest) return;
            try {
                const res = await fetch('/api/lme/destinatarios?tipo=lme');
                const items = await res.json();
                listDest.innerHTML = '';

                if (!items.length) {
                    listDest.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; color:#aaa;">Nenhum destinatário LME cadastrado.</td></tr>';
                    return;
                }

                items.forEach(d => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #444';
                    tr.innerHTML = `
                        <td style="padding: 10px;">${d.nome}</td>
                        <td style="padding: 10px; color:#bbb;">${d.email}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button class="btn-edit-dest" data-id="${d.id}" data-nome="${d.nome}" data-email="${d.email}" style="background: none; border: none; color: #3498db; cursor: pointer; margin-right: 10px; font-size:1.1rem;" title="Editar"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn-delete-dest" data-id="${d.id}" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size:1.1rem;" title="Remover"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    listDest.appendChild(tr);
                });

                listDest.querySelectorAll('.btn-delete-dest').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Remover este destinatário LME?')) return;
                        await fetch(`/api/lme/destinatarios/${btn.dataset.id}`, { method: 'DELETE' });
                        loadDestinatariosLME();
                    });
                });

                listDest.querySelectorAll('.btn-edit-dest').forEach(btn => {
                    btn.addEventListener('click', () => {
                        destId.value = btn.dataset.id;
                        destNome.value = btn.dataset.nome;
                        destEmail.value = btn.dataset.email;
                        if (destFormTitle) destFormTitle.innerHTML = '<i class="fa-solid fa-user-pen"></i> Editar Destinatário LME';
                        if (btnCancelDest) btnCancelDest.style.display = 'inline-block';
                        destNome.focus();
                    });
                });
            } catch (err) {
                console.error(err);
            }
        }

        if (formScheduler) {
            formScheduler.addEventListener('submit', async (e) => {
                e.preventDefault();
                const selectedDias = Array.from(document.querySelectorAll('.sched-dia:checked')).map(chk => chk.value).join(',');
                const data = {
                    lme_envio_ativo: schedAtivo.checked ? 'true' : 'false',
                    lme_envio_horario: schedHorario.value,
                    lme_envio_dias: selectedDias
                };
                const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (res.ok) _apexNotify('Sistema', '✅ Agendamento LME salvo com sucesso!', 'info');
            });
        }

        if (formResend) {
            formResend.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = {
                    lme_resend_api_key: resendApiKey.value.trim(),
                    lme_resend_from:    resendFrom.value.trim()
                };
                const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (res.ok) _apexNotify('Sistema', '✅ Resend API salvo com sucesso!', 'info');
            });
        }

        if (btnEnviarTest) {
            btnEnviarTest.addEventListener('click', async () => {
                testEmailMsg.style.display = 'block';
                testEmailMsg.style.color = '#fff';
                testEmailMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando e-mail...';
                btnEnviarTest.disabled = true;

                try {
                    const res = await fetch('/api/lme/enviar-email-manual', { method: 'POST' });
                    const result = await res.json();
                    if (res.ok) {
                        testEmailMsg.style.color = '#2AD07A';
                        testEmailMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + (result.message || 'Relatório enviado!');
                    } else {
                        testEmailMsg.style.color = '#ff4d4d';
                        testEmailMsg.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (result.error || 'Erro.');
                    }
                } catch (err) {
                    testEmailMsg.style.color = '#ff4d4d';
                    testEmailMsg.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Erro de rede.';
                } finally {
                    btnEnviarTest.disabled = false;
                }
            });
        }

        if (formDest) {
            formDest.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = destId.value;
                const nome = destNome.value.trim();
                const email = destEmail.value.trim();
                const url = id ? `/api/lme/destinatarios/${id}` : '/api/lme/destinatarios';
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, tipo: 'lme' }) });
                if (res.ok) {
                    destId.value = ''; destNome.value = ''; destEmail.value = '';
                    if (btnCancelDest) btnCancelDest.style.display = 'none';
                    if (destFormTitle) destFormTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Destinatário LME';
                    loadDestinatariosLME();
                }
            });
        }

        if (btnCancelDest) {
            btnCancelDest.addEventListener('click', () => {
                destId.value = ''; destNome.value = ''; destEmail.value = '';
                btnCancelDest.style.display = 'none';
                if (destFormTitle) destFormTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Destinatário LME';
            });
        }

        // ─── 2. MÓDULO TABELA GERAL COMPLETA & TABELA DO FORNECEDOR ──────────
        async function loadConfigTabelas() {
            try {
                const res = await fetch('/api/settings');
                const settings = await res.json();

                // Geral
                const geralAtivo = document.getElementById('sched-geral-ativo');
                const geralHorario = document.getElementById('sched-geral-horario');
                if (geralAtivo) geralAtivo.checked = settings.tabela_geral_envio_ativo === 'true';
                if (geralHorario) geralHorario.value = settings.tabela_geral_envio_horario || '08:00';
                const geralDiasStr = settings.tabela_geral_envio_dias !== undefined ? settings.tabela_geral_envio_dias : '1,2,3,4,5';
                const geralDiasArr = geralDiasStr.split(',');
                document.querySelectorAll('.sched-geral-dia').forEach(chk => { chk.checked = geralDiasArr.includes(chk.value); });

                // Fornecedor
                const fornAtivo = document.getElementById('sched-forn-ativo');
                const fornHorario = document.getElementById('sched-forn-horario');
                if (fornAtivo) fornAtivo.checked = settings.tabela_fornecedor_envio_ativo === 'true';
                if (fornHorario) fornHorario.value = settings.tabela_fornecedor_envio_horario || '09:00';
                const fornDiasStr = settings.tabela_fornecedor_envio_dias !== undefined ? settings.tabela_fornecedor_envio_dias : '1,2,3,4,5';
                const fornDiasArr = fornDiasStr.split(',');
                document.querySelectorAll('.sched-forn-dia').forEach(chk => { chk.checked = fornDiasArr.includes(chk.value); });

                loadDestinatariosTabela('tabela_geral', 'dest-geral-list', 'dest-geral-id', 'dest-geral-nome', 'dest-geral-email', 'dest-geral-title');
                loadDestinatariosTabela('tabela_fornecedor', 'dest-forn-list', 'dest-forn-id', 'dest-forn-nome', 'dest-forn-email', 'dest-forn-title');
            } catch (err) {
                console.error('Erro ao carregar configurações de tabelas:', err);
            }
        }

        async function loadDestinatariosTabela(tipo, listId, inputId, inputNome, inputEmail, titleId) {
            const listEl = document.getElementById(listId);
            if (!listEl) return;
            try {
                const res = await fetch(`/api/lme/destinatarios?tipo=${tipo}`);
                const items = await res.json();
                listEl.innerHTML = '';

                if (!items.length) {
                    listEl.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:#aaa;">Nenhum destinatário cadastrado.</td></tr>';
                    return;
                }

                items.forEach(d => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                    tr.innerHTML = `
                        <td style="padding: 8px 10px;">${d.nome}</td>
                        <td style="padding: 8px 10px; color:#bbb;">${d.email}</td>
                        <td style="padding: 8px 10px; text-align: center;">
                            <button class="btn-edit-tb-dest" data-id="${d.id}" data-nome="${d.nome}" data-email="${d.email}" style="background: none; border: none; color: #3498db; cursor: pointer; margin-right: 8px;"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn-del-tb-dest" data-id="${d.id}" style="background: none; border: none; color: #e74c3c; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    listEl.appendChild(tr);
                });

                listEl.querySelectorAll('.btn-del-tb-dest').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Remover destinatário?')) return;
                        await fetch(`/api/lme/destinatarios/${btn.dataset.id}`, { method: 'DELETE' });
                        loadDestinatariosTabela(tipo, listId, inputId, inputNome, inputEmail, titleId);
                    });
                });

                listEl.querySelectorAll('.btn-edit-tb-dest').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.getElementById(inputId).value = btn.dataset.id;
                        document.getElementById(inputNome).value = btn.dataset.nome;
                        document.getElementById(inputEmail).value = btn.dataset.email;
                        document.getElementById(titleId).innerHTML = '<i class="fa-solid fa-user-pen"></i> Editar Destinatário';
                        document.getElementById(inputNome).focus();
                    });
                });
            } catch (err) {
                console.error(err);
            }
        }

        // Submits Tabela Geral
        const formSchedGeral = document.getElementById('form-sched-tabela-geral');
        if (formSchedGeral) {
            formSchedGeral.addEventListener('submit', async (e) => {
                e.preventDefault();
                const ativo = document.getElementById('sched-geral-ativo').checked ? 'true' : 'false';
                const horario = document.getElementById('sched-geral-horario').value;
                const dias = Array.from(document.querySelectorAll('.sched-geral-dia:checked')).map(c => c.value).join(',');
                const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tabela_geral_envio_ativo: ativo, tabela_geral_envio_horario: horario, tabela_geral_envio_dias: dias }) });
                if (res.ok) _apexNotify('Sistema', '✅ Agendamento da Tabela Geral salvo com sucesso!', 'info');
            });
        }

        const formDestGeral = document.getElementById('form-destinatario-geral');
        if (formDestGeral) {
            formDestGeral.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('dest-geral-id').value;
                const nome = document.getElementById('dest-geral-nome').value.trim();
                const email = document.getElementById('dest-geral-email').value.trim();
                const url = id ? `/api/lme/destinatarios/${id}` : '/api/lme/destinatarios';
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, tipo: 'tabela_geral' }) });
                if (res.ok) {
                    document.getElementById('dest-geral-id').value = '';
                    document.getElementById('dest-geral-nome').value = '';
                    document.getElementById('dest-geral-email').value = '';
                    document.getElementById('dest-geral-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Destinatário';
                    loadDestinatariosTabela('tabela_geral', 'dest-geral-list', 'dest-geral-id', 'dest-geral-nome', 'dest-geral-email', 'dest-geral-title');
                }
            });
        }

        // Submits Tabela Fornecedor
        const formSchedForn = document.getElementById('form-sched-tabela-forn');
        if (formSchedForn) {
            formSchedForn.addEventListener('submit', async (e) => {
                e.preventDefault();
                const ativo = document.getElementById('sched-forn-ativo').checked ? 'true' : 'false';
                const horario = document.getElementById('sched-forn-horario').value;
                const dias = Array.from(document.querySelectorAll('.sched-forn-dia:checked')).map(c => c.value).join(',');
                const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tabela_fornecedor_envio_ativo: ativo, tabela_fornecedor_envio_horario: horario, tabela_fornecedor_envio_dias: dias }) });
                if (res.ok) _apexNotify('Sistema', '✅ Agendamento da Tabela Fornecedor salvo com sucesso!', 'info');
            });
        }

        const formDestForn = document.getElementById('form-destinatario-forn');
        if (formDestForn) {
            formDestForn.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('dest-forn-id').value;
                const nome = document.getElementById('dest-forn-nome').value.trim();
                const email = document.getElementById('dest-forn-email').value.trim();
                const url = id ? `/api/lme/destinatarios/${id}` : '/api/lme/destinatarios';
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, tipo: 'tabela_fornecedor' }) });
                if (res.ok) {
                    document.getElementById('dest-forn-id').value = '';
                    document.getElementById('dest-forn-nome').value = '';
                    document.getElementById('dest-forn-email').value = '';
                    document.getElementById('dest-forn-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Destinatário';
                    loadDestinatariosTabela('tabela_fornecedor', 'dest-forn-list', 'dest-forn-id', 'dest-forn-nome', 'dest-forn-email', 'dest-forn-title');
                }
            });
        }

        // Carrega as configurações dos 3 módulos
        await loadConfigLME();
        await loadConfigTabelas();
    }

    // =========================================================================
    // RELATÓRIO DIÁRIO LME (WHATSAPP/EMAIL)
    // =========================================================================
    async function initRelatorioDiario() {
        const btnGerar = document.getElementById('btn-gerar-imagem-wpp');
        const btnCopiar = document.getElementById('btn-copiar-texto');
        if (!btnGerar) return;

        let weeksData = [];
        let currentSelectedWeek = null;
        const selectMes = document.getElementById('rel-filter-mes');
        const selectSemana = document.getElementById('rel-week-selector');
        const btnVerHistorico = document.getElementById('btn-ver-historico');

        if (btnVerHistorico) {
            btnVerHistorico.addEventListener('click', async (e) => {
                e.preventDefault();
                const originalContent = btnVerHistorico.innerHTML;
                btnVerHistorico.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';
                btnVerHistorico.disabled = true;
                try {
                    await loadRelatorioMeses(true);
                } finally {
                    btnVerHistorico.innerHTML = originalContent;
                    btnVerHistorico.disabled = false;
                }
            });
        }

        async function loadRelatorioMeses(force = false) {
            try {
                function gerarMesesFallback() {
                    const meses = [];
                    const now = new Date();
                    for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const ano = d.getFullYear();
                        const mes = String(d.getMonth() + 1).padStart(2, '0');
                        const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                        meses.push({ valor: `${ano}-${mes}`, texto: `${nomes[d.getMonth()]}/${ano}` });
                    }
                    return meses;
                }

                let mesesDisponiveis = [];
                try {
                    const url = '/api/lme/meses' + (force ? '?_ts=' + Date.now() : '');
                    const resMeses = await fetch(url);
                    if (resMeses.ok) {
                        mesesDisponiveis = await resMeses.json();
                    }
                } catch (fetchErr) {
                    console.warn('Falha ao buscar meses via API, usando fallback:', fetchErr);
                }

                if (!mesesDisponiveis || mesesDisponiveis.length === 0) {
                    mesesDisponiveis = gerarMesesFallback();
                }

                if (selectMes) {
                    selectMes.innerHTML = mesesDisponiveis.map(m =>
                        '<option value="' + m.valor + '">' + m.texto + '</option>'
                    ).join('');
                    const mesToFetch = mesesDisponiveis[0].valor;
                    selectMes.value = mesToFetch;
                    await loadRelatorioSemanas(mesToFetch, force);
                }
            } catch (e) {
                console.error('Erro ao carregar meses do relatório', e);
            }
        }

        async function loadRelatorioSemanas(mes, force = false) {
            if (selectSemana) selectSemana.innerHTML = '<option>Carregando semanas...</option>';
            try {
                const url = '/api/lme/relatorio-semanal?mes=' + mes + (force ? '&_ts=' + Date.now() : '');
                const res = await fetch(url);
                if (!res.ok) {
                    if (selectSemana) selectSemana.innerHTML = '<option value="">Erro ao carregar semanas</option>';
                    return;
                }
                const data = await res.json();
                weeksData = data.semanas || [];
                if (weeksData.length === 0) {
                    if (selectSemana) selectSemana.innerHTML = '<option value="">Nenhuma semana disponível</option>';
                    return;
                }

                if (selectSemana) {
                    selectSemana.innerHTML = weeksData.map((wk, idx) =>
                        '<option value="' + idx + '">Semana de ' + (wk.label || 'sem data') + '</option>'
                    ).join('');
                    selectSemana.value = 0;
                }
                currentSelectedWeek = weeksData[0];
                renderRelatorioDiario(currentSelectedWeek);
            } catch (e) {
                console.error('Erro ao carregar semanas do relatório', e);
                if (selectSemana) selectSemana.innerHTML = '<option value="">Erro de conexão</option>';
            }
        }

        if (selectMes) {
            selectMes.addEventListener('change', async (e) => {
                await loadRelatorioSemanas(e.target.value);
            });
        }

        if (selectSemana) {
            selectSemana.addEventListener('change', (e) => {
                const idx = parseInt(e.target.value, 10);
                if (!isNaN(idx) && weeksData[idx]) {
                    currentSelectedWeek = weeksData[idx];
                    renderRelatorioDiario(currentSelectedWeek);
                }
            });
        }

        await loadRelatorioMeses();

        btnGerar.addEventListener('click', async () => {
            const captureArea = document.getElementById('capture-area');
            // Mostrar rodapé com timestamp
            const now = new Date();
            const ts = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                + ' às '
                + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const rodape = document.getElementById('rel-rodape');
            if (rodape) {
                rodape.textContent = `Relatório gerado em: ${ts} — ApexTech Metais`;
                rodape.style.display = 'block';
            }

            // Backup styling to prevent mobile layout distortion
            const originalWidth = captureArea.style.width;
            const originalMaxWidth = captureArea.style.maxWidth;
            captureArea.style.width = '800px';
            captureArea.style.maxWidth = 'none';

            // Delay to allow DOM layout to update
            await new Promise(r => setTimeout(r, 100));

            try {
                const canvas = await html2canvas(captureArea, { 
                    scale: 2, 
                    useCORS: true, 
                    allowTaint: false, 
                    scrollY: 0, 
                    windowHeight: captureArea.scrollHeight,
                    width: 800
                });
                const imgData = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'Relatorio_LME_ApexTech.png';
                link.href = imgData;
                link.click();
            } finally {
                // Restore styling
                captureArea.style.width = originalWidth;
                captureArea.style.maxWidth = originalMaxWidth;
                // Ocultar rodapé após download
                if (rodape) rodape.style.display = 'none';
            }
        });

        btnCopiar.addEventListener('click', () => {
            if (!currentSelectedWeek) return;
            const week = currentSelectedWeek;
            const comp = week.computed || {};
            const d = week.days || [];
            const lastDate = d[d.length - 1]?.data || '';
            let txt = `*COTAÇÃO LME - APEXTECH METAIS*\n`;
            txt += `Semana de ${d[0]?.data} a ${lastDate}\n\n`;
            txt += `*Variação Diária (Grupo 6):*\n`;
            
            const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];
            metals.forEach(m => {
                const osc = comp['OSCILAÇÃO R$']?.[m] ?? 0;
                const setinha = osc >= 0 ? '⬆' : '⬇';
                const money = 'R$ ' + Math.abs(osc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                txt += `- ${m.toUpperCase()}: ${setinha} ${money}\n`;
            });

            const dolarOsc = comp['OSCILAÇÃO R$']?.['dolar'] ?? 0;
            const dSetinha = dolarOsc >= 0 ? '⬆' : '⬇';
            const dMoney = '$ ' + Math.abs(dolarOsc).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
            txt += `- DÓLAR: ${dSetinha} ${dMoney}\n`;

            navigator.clipboard.writeText(txt).then(() => {
                _apexNotify('Sistema', 'Resumo copiado para a área de transferência!', 'info');
            }).catch(err => {
                _apexNotify('Atenção', 'Erro ao copiar texto.', 'error');
                console.error(err);
            });
        });

        const btnPdf = document.getElementById('btn-relatorio-pdf');
        const btnExcel = document.getElementById('btn-relatorio-excel');
        
        if (btnPdf) {
            btnPdf.addEventListener('click', async () => {
                const captureArea = document.getElementById('capture-area');

                // Mostrar rodapé com timestamp
                const nowTs = new Date();
                const tsStr = nowTs.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    + ' às '
                    + nowTs.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const rodape = document.getElementById('rel-rodape');
                if (rodape) {
                    rodape.textContent = `Relatório gerado em: ${tsStr}`;
                    rodape.style.display = 'block';
                }

                // Correção do Bug do SVG Preto:
                const logoImg = captureArea.querySelector('.rel-logo img');
                let originalSrc = '';
                if (logoImg && logoImg.src.endsWith('.svg')) {
                    try {
                        originalSrc = logoImg.src;
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = logoImg.naturalWidth || 400;
                        tempCanvas.height = logoImg.naturalHeight || 133;
                        const tCtx = tempCanvas.getContext('2d');
                        tCtx.fillStyle = '#ffffff'; // Fundo branco p/ segurança
                        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                        tCtx.drawImage(logoImg, 0, 0, tempCanvas.width, tempCanvas.height);
                        logoImg.src = tempCanvas.toDataURL('image/png');
                    } catch (svgErr) {
                        console.warn('Erro ao converter logo SVG para PNG (CORS/Taint fallback):', svgErr);
                        if (originalSrc) {
                            logoImg.src = originalSrc;
                            originalSrc = '';
                        }
                    }
                }

                // Backup styling to prevent mobile layout distortion
                const originalWidth = captureArea.style.width;
                const originalMaxWidth = captureArea.style.maxWidth;
                captureArea.style.width = '800px';
                captureArea.style.maxWidth = 'none';

                // Delay to allow DOM layout to update
                await new Promise(r => setTimeout(r, 100));

                try {
                    // Captura a altura TOTAL do conteúdo
                    const canvas = await html2canvas(captureArea, {
                        scale: 2,
                        backgroundColor: '#ffffff',
                        useCORS: true,
                        allowTaint: false,
                        scrollY: 0,
                        windowHeight: captureArea.scrollHeight,
                        height: captureArea.scrollHeight,
                        width: 800
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const { jsPDF } = window.jspdf;

                    // Calcular dimensões: usar largura A4, mas altura proporcional ao conteúdo total para não quebrar a página
                    const pdfWidthMm = 210; // A4 largura em mm
                    const pdfHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

                    // Criar PDF vertical de página única sem cortes
                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: [pdfWidthMm, pdfHeightMm]
                    });
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);

                    // Nome de arquivo dinâmico (ex: relatorio-lme-DD-MM-AAAA.pdf)
                    let dateStr = '';
                    if (currentSelectedWeek) {
                        const week = currentSelectedWeek;
                        const d = week.days || [];
                        if (d.length > 0 && d[0].data) {
                            const parts = d[0].data.split('/');
                            if (parts.length >= 2) {
                                const day = parts[0].padStart(2, '0');
                                const month = parts[1].padStart(2, '0');
                                let year = parts[2] || '';
                                if (!year) {
                                    const filterMes = document.getElementById('rel-filter-mes');
                                    year = new Date().getFullYear();
                                    if (filterMes && filterMes.value && filterMes.value.includes('-')) {
                                        year = filterMes.value.split('-')[1];
                                    }
                                }
                                dateStr = `${day}-${month}-${year}`;
                            }
                        }
                    }
                    if (!dateStr) {
                        const now = new Date();
                        const day = String(now.getDate()).padStart(2, '0');
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const year = now.getFullYear();
                        dateStr = `${day}-${month}-${year}`;
                    }
                    const filename = `Relatorio_LME.pdf`;
                    pdf.save(filename);
                } finally {
                    // Restaura o SVG original após gerar o PDF
                    if (originalSrc) {
                        logoImg.src = originalSrc;
                    }
                    // Restore styling
                    captureArea.style.width = originalWidth;
                    captureArea.style.maxWidth = originalMaxWidth;
                    // Ocultar rodapé após exportação
                    if (rodape) rodape.style.display = 'none';
                }
            });
        }

        if (btnExcel) {
            btnExcel.addEventListener('click', async () => {
                if (!currentSelectedWeek) return;
                const block = currentSelectedWeek;
                btnExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
                try {
                    const res = await fetch('/api/lme/gerar-excel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            semana: block,
                            mesLabel: 'Relatório Diário LME'
                        })
                    });

                    if (res.ok) {
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'Relatorio_LME_ApexTech.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                    } else {
                        _apexNotify('Atenção', 'Erro ao gerar Excel.', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    _apexNotify('Atenção', 'Erro na conexão com o servidor.', 'error');
                } finally {
                    btnExcel.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
                }
            });
        }
    }

    function renderRelatorioDiario(week) {
        const d = week.days || [];
        const comp = week.computed || {};
        
        const firstDate = d[0]?.data || '';
        const lastDate = d[d.length - 1]?.data || '';
        
        // Helper to get ISO week
        function getISOWeek(date) {
            const dObj = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = dObj.getUTCDay() || 7;
            dObj.setUTCDate(dObj.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(dObj.getUTCFullYear(), 0, 1));
            return Math.ceil((((dObj - yearStart) / 86400000) + 1) / 7);
        }

        // Tentar obter a data da semana a partir do primeiro dia útil dela
        let referenceDate = new Date();
        if (d.length > 0 && d[0].data && d[0].data !== '—') {
            const parts = d[0].data.split('/');
            if (parts.length >= 2) {
                const selectMes = document.getElementById('rel-filter-mes');
                let yr = new Date().getFullYear();
                if (selectMes && selectMes.value && selectMes.value.includes('-')) {
                    yr = parseInt(selectMes.value.split('-')[1], 10);
                }
                const monthMap = {
                    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
                    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
                };
                const monthAbbr = parts[1].toLowerCase().replace('.', '').trim();
                const monthNum = monthMap[monthAbbr] || parseInt(parts[1], 10) || (new Date().getMonth() + 1);
                const dayNum = parseInt(parts[0], 10) || 1;
                referenceDate = new Date(yr, monthNum - 1, dayNum);
            }
        }
        
        const dataTexto = `${week.label || ''}`;
        const weekNum = getISOWeek(referenceDate);
        
        document.getElementById('rel-date-range').textContent = dataTexto;
        document.getElementById('rel-week-number').textContent = weekNum;

        const tbody = document.getElementById('rel-tbody');
        tbody.innerHTML = '';
        
        const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel', 'dolar'];
        
        const formatUsd = (val) => {
            if (val === null || val === undefined || val === 'feriado' || isNaN(val)) return '-';
            return '$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        };
        const formatBrl = (val, dec = 3) => {
            if (val === null || val === undefined || val === 'feriado' || isNaN(val)) return '-';
            return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };
        const formatPct = (val) => {
            if (val === null || val === undefined || isNaN(val)) return '-';
            return (val * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
        };

        // Função reutilizável para formatar indicadores de variação
        function formatVariacaoCell(element, value, type, decimals = 3) {
            if (!element) return;
            if (value === null || value === undefined || isNaN(value)) {
                element.textContent = '-';
                element.style.setProperty('color', '#000000', 'important');
                return;
            }
            
            const numVal = Number(value);
            let formattedText = '';
            
            if (type === 'percent') {
                formattedText = (numVal * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
            } else if (type === 'currency') {
                formattedText = 'R$ ' + Math.abs(numVal).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            } else {
                formattedText = numVal.toLocaleString('pt-BR');
            }

            let arrow = '';
            if (numVal > 0) {
                arrow = `<span style="color: #2E7D32 !important; margin-right: 4px; font-weight: bold;">▲</span>`;
            } else if (numVal < 0) {
                arrow = `<span style="color: #D32F2F !important; margin-right: 4px; font-weight: bold;">▼</span>`;
            }
            
            element.innerHTML = `${arrow}${formattedText}`;
            element.style.setProperty('color', '#000000', 'important'); // Texto sempre em preto
        }

        // Fix 1: Indicar feriado na label da média semanal se semana teve < 5 dias úteis
        const mediaLabelEl = document.querySelector('.rel-summary-body .rel-label-col');
        if (mediaLabelEl) {
            if (week.numDias !== undefined && week.numDias < 5) {
                mediaLabelEl.innerHTML = `MÉDIA SEMANAL <span style="font-size:0.65em;font-weight:normal;opacity:0.7;font-style:italic">(${week.numDias} dias úteis)</span>`;
            } else {
                mediaLabelEl.textContent = 'MÉDIA SEMANAL';
            }
        }

        d.forEach(day => {
            if (!day.data) return;
            const tr = document.createElement('tr');
            let colsHtml = `<td class="font-bold rel-label-col">${day.data}</td>`;
            metals.forEach(m => {
                const val = day[m];
                const colClass = `rel-col-${m}`;
                if (m === 'dolar') {
                    colsHtml += `<td class="${colClass}">${formatBrl(val, 4)}</td>`;
                } else {
                    colsHtml += `<td class="${colClass}">${formatUsd(val)}</td>`;
                }
            });
            tr.innerHTML = colsHtml;
            tbody.appendChild(tr);
        });

        metals.forEach(m => {
            const isDolar = (m === 'dolar');
            const elMedia = document.getElementById('rel-media-' + m);
            if (elMedia) {
                if (isDolar) {
                    elMedia.textContent = formatBrl(comp['MEDIA SEMANAL']?.[m], 4);
                } else {
                    elMedia.textContent = formatUsd(comp['MEDIA SEMANAL']?.[m]);
                }
            }
            if (m !== 'dolar') {
                const elLme = document.getElementById('rel-lme-' + m);
                if (elLme) elLme.textContent = formatBrl(comp['100% LME']?.[m], 3);
            }
            const elAnt = document.getElementById('rel-ant-' + m);
            if (elAnt) {
                if (isDolar) {
                    elAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 4);
                } else {
                    elAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 3);
                }
            }
            const elFech = document.getElementById('rel-fech-' + m);
            formatVariacaoCell(elFech, comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.[m], 'percent');
            const elOscPct = document.getElementById('rel-osc-pct-' + m);
            formatVariacaoCell(elOscPct, comp['OSCILAÇÃO %']?.[m], 'percent');

            const oscRs = comp['OSCILAÇÃO R$']?.[m] ?? 0;
            const elOscRs = document.getElementById('rel-osc-rs-' + m);
            formatVariacaoCell(elOscRs, oscRs, 'currency', isDolar ? 4 : 3);

            const elMensal = document.getElementById('rel-mensal-' + m);
            if (elMensal) {
                if (isDolar) {
                    elMensal.textContent = formatBrl(comp['MEDIA MENSAL']?.[m], 4);
                } else {
                    elMensal.textContent = formatBrl(comp['MEDIA MENSAL']?.[m], 3);
                }
            }

            const elCompAnt = document.getElementById('rel-comp-ant-' + m);
            if (elCompAnt) {
                if (isDolar) {
                    elCompAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 4);
                } else {
                    elCompAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 3);
                }
            }
            
            // CORREÇÃO CRÍTICA: LME ATUAL é o valor de '100% LME' (R$/kg) da semana em curso, não a média semanal bruta em US$/t!
            const elCompAtu = document.getElementById('rel-comp-atu-' + m);
            if (elCompAtu) {
                if (isDolar) {
                    elCompAtu.textContent = formatBrl(comp['MEDIA SEMANAL']?.[m], 4);
                } else {
                    elCompAtu.textContent = formatBrl(comp['100% LME']?.[m], 3);
                }
            }
            const elCompOsc = document.getElementById('rel-comp-osc-' + m);
            formatVariacaoCell(elCompOsc, oscRs, 'currency', isDolar ? 4 : 3);
        });

        // Aplica overrides de cores nas linhas específicas por label
        const summaryRows = document.querySelectorAll('.rel-summary-body tr');
        summaryRows.forEach(row => {
            const firstCell = row.cells[0];
            if (!firstCell) return;
            const text = firstCell.textContent.trim().toUpperCase();

            // Limpa classes anteriores para evitar duplicar/acumular em re-renders
            row.classList.remove('row-lme100', 'row-fechamento-anterior', 'row-oscilacao-rs', 'row-semana-anterior');

            if (text.includes("100% LME")) {
                row.classList.add('row-lme100');
            } else if (text.includes("FECHAMENTO %") && text.includes("SEMANA ANTERIOR")) {
                row.classList.add('row-fechamento-anterior');
            } else if (text.includes("OSCILAÇÃO R$")) {
                row.classList.add('row-oscilacao-rs');
            } else if (text === "SEMANA ANTERIOR") {
                row.classList.add('row-semana-anterior');
            }
        });

        renderRelatorioCharts(week);
        renderRelatorioBase(week);
    }

    function renderRelatorioCharts(week) {
        const comp = week.computed || {};

        // ── helpers ──────────────────────────────────────────────────────────
        const fmtR = v =>
            'R$ ' + Number(Math.abs(v)).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

        // Plugin inline de rótulos acima das barras
        const datalabelPlugin = {
            id: 'apexBarLabels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (meta.hidden) return;
                    meta.data.forEach((bar, idx) => {
                        const val = dataset.data[idx];
                        if (val === 0 || val == null) return;
                        
                        ctx.save();
                        ctx.font = 'bold 9px Arial';
                        ctx.fillStyle = '#111';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        
                        // Rotaciona para desenhar verticalmente
                        ctx.translate(bar.x, bar.y - 6);
                        ctx.rotate(-Math.PI / 2);
                        
                        const prefix = dataset.label === 'Semana Anterior' ? 'Ant: ' : 'Atu: ';
                        const label = prefix + 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                        
                        ctx.fillText(label, 0, 0);
                        ctx.restore();
                    });
                });
            }
        };

        // ── Configuração comum dos dois gráficos ─────────────────────────────
        function buildBarChart(canvasId, labels, dataAnt, dataAtu) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            // Destruir instância anterior se existir
            const key = '__apexChart_' + canvasId;
            if (window[key]) { window[key].destroy(); }

            const bgAnt = [];
            const borderAnt = [];
            const bgAtu = [];
            const borderAtu = [];

            for (let i = 0; i < labels.length; i++) {
                const valAtu = dataAtu[i] || 0;
                const valAnt = dataAnt[i] || 0;
                if (valAtu > valAnt) {
                    // Atual foi melhor (Verde), Anterior foi pior (Vermelho)
                    bgAtu.push('#27ae60');
                    borderAtu.push('#1e8449');
                    bgAnt.push('#e74c3c');
                    borderAnt.push('#c0392b');
                } else {
                    // Atual foi pior (Vermelho), Anterior foi melhor (Verde)
                    bgAtu.push('#e74c3c');
                    borderAtu.push('#c0392b');
                    bgAnt.push('#27ae60');
                    borderAnt.push('#1e8449');
                }
            }

            window[key] = new Chart(ctx, {
                type: 'bar',
                plugins: [datalabelPlugin],
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Semana Anterior',
                            data: dataAnt,
                            backgroundColor: bgAnt,
                            borderColor: borderAnt,
                            borderWidth: 1,
                            borderRadius: 3,
                            barPercentage: 0.75,
                            categoryPercentage: 0.8
                        },
                        {
                            label: 'Semana Atual',
                            data: dataAtu,
                            backgroundColor: bgAtu,
                            borderColor: borderAtu,
                            borderWidth: 1,
                            borderRadius: 3,
                            barPercentage: 0.75,
                            categoryPercentage: 0.8
                        }
                    ]
                },
                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 90, right: 8, left: 8 } },
                    plugins: {
                        legend: { display: false },          // legenda feita no HTML
                        tooltip: {
                            callbacks: {
                                label: ctx => fmtR(ctx.parsed.y)
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#222', font: { size: 10, weight: 'bold' } },
                            grid: { display: false }
                        },
                        y: {
                            ticks: {
                                color: '#444',
                                font: { size: 9 },
                                callback: v => 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
                            },
                            grid: { color: '#e8e8e8' }
                        }
                    }
                }
            });
        }

        // ── Grupo 1: Cobre · Zinco · Alumínio · Chumbo ───────────────────────
        const group1 = [
            { key: 'cobre',    label: 'COBRE' },
            { key: 'zinco',    label: 'ZINCO' },
            { key: 'aluminio', label: 'ALUMÍNIO' },
            { key: 'chumbo',   label: 'CHUMBO' }
        ];
        buildBarChart(
            'relChartLines',
            group1.map(m => m.label),
            group1.map(m => comp['SEMANA ANTERIOR']?.[m.key] || 0),
            group1.map(m => comp['100% LME']?.[m.key]        || 0)
        );

        // ── Grupo 2: Estanho · Níquel ─────────────────────────────────────────
        const group2 = [
            { key: 'estanho', label: 'ESTANHO' },
            { key: 'niquel',  label: 'NÍQUEL' }
        ];
        buildBarChart(
            'relChartOsc',
            group2.map(m => m.label),
            group2.map(m => comp['SEMANA ANTERIOR']?.[m.key] || 0),
            group2.map(m => comp['100% LME']?.[m.key]        || 0)
        );

        // ── Cards de comparação ───────────────────────────────────────────────
        function buildCards(containerId, group) {
            const el = document.getElementById(containerId);
            if (!el) return;
            el.innerHTML = group.map(m => {
                const atual    = comp['100% LME']?.[m.key]        || 0;
                const anterior = comp['SEMANA ANTERIOR']?.[m.key] || 0;
                const diff     = atual - anterior;
                const isUp     = diff > 0;
                const isDown   = diff < 0;
                const arrow    = isUp ? '↑' : isDown ? '↓' : '–';
                const color    = isUp ? '#1a7f4b' : isDown ? '#c0392b' : '#555';
                const bg       = isUp ? '#e9f7f0' : isDown ? '#fdecea' : '#f5f5f5';
                const border   = isUp ? '#a8dfc4' : isDown ? '#f5b8b2' : '#ddd';
                return `
                <div class="rel-card-metal" style="border-color:${border}; background:${bg};">
                    <div class="rel-card-metal-name">${m.label}</div>
                    <div class="rel-card-metal-val" style="color:${color};">
                        ${arrow} ${fmtR(atual)}
                    </div>
                    <div class="rel-card-metal-prev">era ${fmtR(anterior)}</div>
                    <div class="rel-card-metal-diff" style="color:${color};">
                        ${isUp ? '+' : isDown ? '-' : ''}${fmtR(diff)}
                    </div>
                </div>`;
            }).join('');
        }

        buildCards('rel-cards-group1', group1);
        buildCards('rel-cards-group2', group2);
    }

    function renderRelatorioBase(week) {
        const comp = week.computed || {};
        const tbody = document.getElementById('rel-base-tbody');
        tbody.innerHTML = '';
        const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];

        for (let p = 90; p <= 110; p++) {
            const tr = document.createElement('tr');
            if (p < 100) tr.className = 'row-below';
            else if (p === 100) tr.className = 'row-100pct';
            else tr.className = 'row-above';

            const pLabel = p === 100 ? '<strong>100%</strong>' : p + '%';
            let colsHtml = `<td>${pLabel}</td>`;

            metals.forEach(m => {
                // Base SEMPRE = SEMANA ANTERIOR congelada; null na 1ª semana do mês — exibe '-'
                const lme = comp['SEMANA ANTERIOR']?.[m] ?? null;
                const colClass = `rel-col-${m}`;
                if (lme === null) {
                    colsHtml += `<td class="${colClass}">-</td>`;
                } else {
                    const baseVal = lme * (p / 100);
                    const fmt = 'R$ ' + baseVal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                    colsHtml += `<td class="${colClass}">${fmt}</td>`;
                }
            });

            tr.innerHTML = colsHtml;
            tbody.appendChild(tr);
        }
    }

    // =========================================================================
    // HISTÓRICO DO RELATÓRIO DIÁRIO LME (WHATSAPP/EMAIL)
    // =========================================================================
    async function initRelatorioDiarioHistorico() {
        const btnVerHistorico = document.getElementById('btn-ver-historico');
        const btnVoltar = document.getElementById('btn-historico-voltar');
        if (!btnVerHistorico) return;

        const sectionDiario = document.getElementById('relatorio-diario');
        const sectionHistorico = document.getElementById('relatorio-diario-historico');
        const selectMes = document.getElementById('rel-hist-filter-mes');
        const selectSemana = document.getElementById('rel-hist-week-selector');

        const btnGerar = document.getElementById('btn-hist-gerar-imagem-wpp');
        const btnCopiar = document.getElementById('btn-hist-copiar-texto');
        const btnPdf = document.getElementById('btn-hist-relatorio-pdf');
        const btnExcel = document.getElementById('btn-hist-relatorio-excel');

        let weeksData = [];
        let currentSelectedWeek = null;



        // Alternar de volta
        btnVoltar.addEventListener('click', () => {
            sectionHistorico.classList.remove('active');
            sectionDiario.classList.add('active');
            window.dispatchEvent(new Event('resize'));
        });

        async function loadHistoricoMeses() {
            try {
                // Gera lista de meses dos últimos 12 meses como fallback
                function gerarMesesFallback() {
                    const meses = [];
                    const now = new Date();
                    for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const ano = d.getFullYear();
                        const mes = String(d.getMonth() + 1).padStart(2, '0');
                        const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                        meses.push({ valor: `${ano}-${mes}`, texto: `${nomes[d.getMonth()]}/${ano}` });
                    }
                    return meses;
                }

                let mesesDisponiveis = [];
                try {
                    const resMeses = await fetch('/api/lme/meses');
                    if (resMeses.ok) {
                        mesesDisponiveis = await resMeses.json();
                    }
                } catch (fetchErr) {
                    console.warn('Falha ao buscar meses via API, usando fallback:', fetchErr);
                }

                // Usa fallback se a API retornar vazio
                if (!mesesDisponiveis || mesesDisponiveis.length === 0) {
                    mesesDisponiveis = gerarMesesFallback();
                }

                selectMes.innerHTML = mesesDisponiveis.map(m =>
                    '<option value="' + m.valor + '">' + m.texto + '</option>'
                ).join('');

                const mesToFetch = mesesDisponiveis[0].valor;
                selectMes.value = mesToFetch;
                await loadHistoricoSemanas(mesToFetch);
            } catch (e) {
                console.error('Erro ao carregar meses do histórico', e);
                selectMes.innerHTML = '<option value="">Erro ao carregar meses</option>';
            }
        }

        async function loadHistoricoSemanas(mes) {
            selectSemana.innerHTML = '<option>Carregando semanas...</option>';
            try {
                const res = await fetch('/api/lme/relatorio-semanal?mes=' + mes);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    console.error('Erro na API semanas:', errData);
                    selectSemana.innerHTML = '<option value="">Erro ao carregar semanas</option>';
                    return;
                }
                const data = await res.json();
                weeksData = data.semanas || [];
                if (weeksData.length === 0) {
                    selectSemana.innerHTML = '<option value="">Nenhuma semana disponível</option>';
                    return;
                }

                selectSemana.innerHTML = weeksData.map((wk, idx) =>
                    '<option value="' + idx + '">Semana de ' + (wk.label || 'sem data') + '</option>'
                ).join('');

                selectSemana.value = 0;
                currentSelectedWeek = weeksData[0];
                renderRelatorioDiarioHistorico(currentSelectedWeek);
            } catch (e) {
                console.error('Erro ao carregar semanas do histórico', e);
                selectSemana.innerHTML = '<option value="">Erro de conexão</option>';
            }
        }

        selectMes.addEventListener('change', async (e) => {
            await loadHistoricoSemanas(e.target.value);
        });

        selectSemana.addEventListener('change', (e) => {
            const idx = parseInt(e.target.value, 10);
            if (!isNaN(idx) && weeksData[idx]) {
                currentSelectedWeek = weeksData[idx];
                renderRelatorioDiarioHistorico(currentSelectedWeek);
            }
        });

        // Ações de exportação do histórico (usando o capture-area-historico e currentSelectedWeek)
        if (btnGerar) {
            btnGerar.addEventListener('click', async () => {
                if (!currentSelectedWeek) return;
                const captureArea = document.getElementById('capture-area-historico');
                const now = new Date();
                const ts = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    + ' às '
                    + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const rodape = document.getElementById('rel-hist-rodape');
                if (rodape) {
                    rodape.textContent = `Relatório gerado em: ${ts} — ApexTech Metais`;
                    rodape.style.display = 'block';
                }

                const originalWidth = captureArea.style.width;
                const originalMaxWidth = captureArea.style.maxWidth;
                captureArea.style.width = '800px';
                captureArea.style.maxWidth = 'none';

                await new Promise(r => setTimeout(r, 100));

                try {
                    const canvas = await html2canvas(captureArea, { 
                        scale: 2, 
                        useCORS: true, 
                        allowTaint: false, 
                        scrollY: 0, 
                        windowHeight: captureArea.scrollHeight,
                        width: 800
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `Relatorio_LME_Historico_${currentSelectedWeek.label.replace(/[\/\s]/g, '_')}.png`;
                    link.href = imgData;
                    link.click();
                } finally {
                    captureArea.style.width = originalWidth;
                    captureArea.style.maxWidth = originalMaxWidth;
                    if (rodape) rodape.style.display = 'none';
                }
            });
        }

        if (btnCopiar) {
            btnCopiar.addEventListener('click', () => {
                if (!currentSelectedWeek) return;
                const comp = currentSelectedWeek.computed || {};
                const d = currentSelectedWeek.days || [];
                const lastDate = d[d.length - 1]?.data || '';
                let txt = `*COTAÇÃO LME HISTÓRICO - APEXTECH METAIS*\n`;
                txt += `Semana de ${d[0]?.data} a ${lastDate}\n\n`;
                txt += `*Variação Diária (Grupo 6):*\n`;
                
                const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];
                metals.forEach(m => {
                    const osc = comp['OSCILAÇÃO R$']?.[m] ?? 0;
                    const setinha = osc >= 0 ? '⬆' : '⬇';
                    const money = 'R$ ' + Math.abs(osc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    txt += `- ${m.toUpperCase()}: ${setinha} ${money}\n`;
                });

                const dolarOsc = comp['OSCILAÇÃO R$']?.['dolar'] ?? 0;
                const dSetinha = dolarOsc >= 0 ? '⬆' : '⬇';
                const dMoney = '$ ' + Math.abs(dolarOsc).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                txt += `- DÓLAR: ${dSetinha} ${dMoney}\n`;

                navigator.clipboard.writeText(txt).then(() => {
                    _apexNotify('Sistema', 'Resumo histórico copiado!', 'info');
                }).catch(err => {
                    _apexNotify('Atenção', 'Erro ao copiar texto.', 'error');
                    console.error(err);
                });
            });
        }

        if (btnPdf) {
            btnPdf.addEventListener('click', async () => {
                if (!currentSelectedWeek) return;
                const captureArea = document.getElementById('capture-area-historico');
                const nowTs = new Date();
                const tsStr = nowTs.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    + ' às '
                    + nowTs.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const rodape = document.getElementById('rel-hist-rodape');
                if (rodape) {
                    rodape.textContent = `Relatório gerado em: ${tsStr}`;
                    rodape.style.display = 'block';
                }

                const logoImg = captureArea.querySelector('.rel-logo img');
                let originalSrc = '';
                if (logoImg && logoImg.src.endsWith('.svg')) {
                    try {
                        originalSrc = logoImg.src;
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = logoImg.naturalWidth || 400;
                        tempCanvas.height = logoImg.naturalHeight || 133;
                        const tCtx = tempCanvas.getContext('2d');
                        tCtx.fillStyle = '#ffffff';
                        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                        tCtx.drawImage(logoImg, 0, 0, tempCanvas.width, tempCanvas.height);
                        logoImg.src = tempCanvas.toDataURL('image/png');
                    } catch (svgErr) {
                        console.warn('Erro ao converter logo SVG', svgErr);
                        if (originalSrc) {
                            logoImg.src = originalSrc;
                            originalSrc = '';
                        }
                    }
                }

                const originalWidth = captureArea.style.width;
                const originalMaxWidth = captureArea.style.maxWidth;
                captureArea.style.width = '800px';
                captureArea.style.maxWidth = 'none';

                await new Promise(r => setTimeout(r, 100));

                try {
                    const canvas = await html2canvas(captureArea, {
                        scale: 2,
                        backgroundColor: '#ffffff',
                        useCORS: true,
                        allowTaint: false,
                        scrollY: 0,
                        windowHeight: captureArea.scrollHeight,
                        height: captureArea.scrollHeight,
                        width: 800
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const { jsPDF } = window.jspdf;

                    const pdfWidthMm = 210;
                    const pdfHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: [pdfWidthMm, pdfHeightMm]
                    });
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
                    pdf.save(`Relatorio_LME_Historico_${currentSelectedWeek.label.replace(/[\/\s]/g, '_')}.pdf`);
                } finally {
                    if (originalSrc) {
                        logoImg.src = originalSrc;
                    }
                    captureArea.style.width = originalWidth;
                    captureArea.style.maxWidth = originalMaxWidth;
                    if (rodape) rodape.style.display = 'none';
                }
            });
        }

        if (btnExcel) {
            btnExcel.addEventListener('click', async () => {
                if (!currentSelectedWeek) return;
                btnExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
                try {
                    const res = await fetch('/api/lme/gerar-excel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            semana: currentSelectedWeek,
                            mesLabel: 'Relatório Histórico LME'
                        })
                    });

                    if (res.ok) {
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Relatorio_LME_Historico_${currentSelectedWeek.label.replace(/[\/\s]/g, '_')}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                    } else {
                        _apexNotify('Atenção', 'Erro ao gerar Excel do histórico.', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    _apexNotify('Atenção', 'Erro na conexão com o servidor.', 'error');
                } finally {
                    btnExcel.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
                }
            });
        }
    }

    function renderRelatorioDiarioHistorico(week) {
        const d = week.days || [];
        const comp = week.computed || {};
        
        const firstDate = d[0]?.data || '';
        const lastDate = d[d.length - 1]?.data || '';
        
        function getISOWeek(date) {
            const dObj = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = dObj.getUTCDay() || 7;
            dObj.setUTCDate(dObj.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(dObj.getUTCFullYear(), 0, 1));
            return Math.ceil((((dObj - yearStart) / 86400000) + 1) / 7);
        }

        // Tentar obter a data da semana a partir do primeiro dia útil dela
        let referenceDate = new Date();
        if (d.length > 0 && d[0].data && d[0].data !== '—') {
            const parts = d[0].data.split('/');
            if (parts.length >= 2) {
                const selectMes = document.getElementById('rel-hist-filter-mes');
                let yr = new Date().getFullYear();
                if (selectMes && selectMes.value && selectMes.value.includes('-')) {
                    yr = parseInt(selectMes.value.split('-')[1], 10);
                }
                const monthMap = {
                    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
                    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
                };
                const monthAbbr = parts[1].toLowerCase().replace('.', '').trim();
                const monthNum = monthMap[monthAbbr] || parseInt(parts[1], 10) || (new Date().getMonth() + 1);
                const dayNum = parseInt(parts[0], 10) || 1;
                referenceDate = new Date(yr, monthNum - 1, dayNum);
            }
        }
        
        const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const dataTexto = `${week.label}`;
        const weekNum = getISOWeek(referenceDate);
        
        document.getElementById('rel-hist-date-range').textContent = dataTexto;
        document.getElementById('rel-hist-week-number').textContent = weekNum;

        const tbody = document.getElementById('rel-hist-tbody');
        tbody.innerHTML = '';
        
        const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel', 'dolar'];
        
        const formatUsd = (val) => {
            if (val === null || val === undefined || val === 'feriado' || isNaN(val)) return '-';
            return '$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        };
        const formatBrl = (val, dec = 3) => {
            if (val === null || val === undefined || val === 'feriado' || isNaN(val)) return '-';
            return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };
        const formatPct = (val) => {
            if (val === null || val === undefined || isNaN(val)) return '-';
            return (val * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
        };

        function formatVariacaoCell(element, value, type, decimals = 3) {
            if (!element) return;
            if (value === null || value === undefined || isNaN(value)) {
                element.textContent = '-';
                element.style.setProperty('color', '#000000', 'important');
                return;
            }
            
            const numVal = Number(value);
            let formattedText = '';
            
            if (type === 'percent') {
                formattedText = (numVal * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
            } else if (type === 'currency') {
                formattedText = 'R$ ' + Math.abs(numVal).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            } else {
                formattedText = numVal.toLocaleString('pt-BR');
            }

            let arrow = '';
            if (numVal > 0) {
                arrow = `<span style="color: #2E7D32 !important; margin-right: 4px; font-weight: bold;">▲</span>`;
            } else if (numVal < 0) {
                arrow = `<span style="color: #D32F2F !important; margin-right: 4px; font-weight: bold;">▼</span>`;
            }
            
            element.innerHTML = `${arrow}${formattedText}`;
            element.style.setProperty('color', '#000000', 'important');
        }

        const mediaLabelEl = document.querySelector('#relatorio-diario-historico .rel-summary-body .rel-label-col');
        if (mediaLabelEl) {
            if (week.numDias !== undefined && week.numDias < 5) {
                mediaLabelEl.innerHTML = `MÉDIA SEMANAL <span style="font-size:0.65em;font-weight:normal;opacity:0.7;font-style:italic">(${week.numDias} dias úteis)</span>`;
            } else {
                mediaLabelEl.textContent = 'MÉDIA SEMANAL';
            }
        }

        d.forEach(day => {
            if (!day.data) return;
            const tr = document.createElement('tr');
            let colsHtml = `<td class="font-bold rel-label-col">${day.data}</td>`;
            metals.forEach(m => {
                const val = day[m];
                const colClass = `rel-col-${m}`;
                if (m === 'dolar') {
                    colsHtml += `<td class="${colClass}">${formatBrl(val, 4)}</td>`;
                } else {
                    colsHtml += `<td class="${colClass}">${formatUsd(val)}</td>`;
                }
            });
            tr.innerHTML = colsHtml;
            tbody.appendChild(tr);
        });

        metals.forEach(m => {
            const isDolar = (m === 'dolar');
            const elMedia = document.getElementById('rel-hist-media-' + m);
            if (elMedia) {
                if (isDolar) {
                    elMedia.textContent = formatBrl(comp['MEDIA SEMANAL']?.[m], 4);
                } else {
                    elMedia.textContent = formatUsd(comp['MEDIA SEMANAL']?.[m]);
                }
            }
            if (m !== 'dolar') {
                const elLme = document.getElementById('rel-hist-lme-' + m);
                if (elLme) elLme.textContent = formatBrl(comp['100% LME']?.[m], 3);
            }
            const elAnt = document.getElementById('rel-hist-ant-' + m);
            if (elAnt) {
                if (isDolar) {
                    elAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 4);
                } else {
                    elAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 3);
                }
            }
            const elFech = document.getElementById('rel-hist-fech-' + m);
            formatVariacaoCell(elFech, comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.[m], 'percent');
            const elOscPct = document.getElementById('rel-hist-osc-pct-' + m);
            formatVariacaoCell(elOscPct, comp['OSCILAÇÃO %']?.[m], 'percent');

            const oscRs = comp['OSCILAÇÃO R$']?.[m] ?? 0;
            const elOscRs = document.getElementById('rel-hist-osc-rs-' + m);
            formatVariacaoCell(elOscRs, oscRs, 'currency', isDolar ? 4 : 3);

            const elMensal = document.getElementById('rel-hist-mensal-' + m);
            if (elMensal) {
                if (isDolar) {
                    elMensal.textContent = formatBrl(comp['MEDIA MENSAL']?.[m], 4);
                } else {
                    elMensal.textContent = formatBrl(comp['MEDIA MENSAL']?.[m], 3);
                }
            }

            const elCompAnt = document.getElementById('rel-hist-comp-ant-' + m);
            if (elCompAnt) {
                if (isDolar) {
                    elCompAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 4);
                } else {
                    elCompAnt.textContent = formatBrl(comp['SEMANA ANTERIOR']?.[m], 3);
                }
            }
            
            const elCompAtu = document.getElementById('rel-hist-comp-atu-' + m);
            if (elCompAtu) {
                if (isDolar) {
                    elCompAtu.textContent = formatBrl(comp['MEDIA SEMANAL']?.[m], 4);
                } else {
                    elCompAtu.textContent = formatBrl(comp['100% LME']?.[m], 3);
                }
            }
            const elCompOsc = document.getElementById('rel-hist-comp-osc-' + m);
            formatVariacaoCell(elCompOsc, oscRs, 'currency', isDolar ? 4 : 3);
        });

        const summaryRows = document.querySelectorAll('#relatorio-diario-historico .rel-summary-body tr');
        summaryRows.forEach(row => {
            const firstCell = row.cells[0];
            if (!firstCell) return;
            const text = firstCell.textContent.trim().toUpperCase();

            row.classList.remove('row-lme100', 'row-fechamento-anterior', 'row-oscilacao-rs', 'row-semana-anterior');

            if (text.includes("100% LME")) {
                row.classList.add('row-lme100');
            } else if (text.includes("FECHAMENTO %") && text.includes("SEMANA ANTERIOR")) {
                row.classList.add('row-fechamento-anterior');
            } else if (text.includes("OSCILAÇÃO R$")) {
                row.classList.add('row-oscilacao-rs');
            } else if (text === "SEMANA ANTERIOR") {
                row.classList.add('row-semana-anterior');
            }
        });

        renderRelatorioDiarioHistoricoCharts(week);
        renderRelatorioDiarioHistoricoBase(week);
    }

    function renderRelatorioDiarioHistoricoCharts(week) {
        const comp = week.computed || {};

        const fmtR = v =>
            'R$ ' + Number(Math.abs(v)).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

        const datalabelPlugin = {
            id: 'apexBarLabelsHist',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (meta.hidden) return;
                    meta.data.forEach((bar, idx) => {
                        const val = dataset.data[idx];
                        if (val === 0 || val == null) return;
                        
                        ctx.save();
                        ctx.font = 'bold 9px Arial';
                        ctx.fillStyle = '#111';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        
                        ctx.translate(bar.x, bar.y - 6);
                        ctx.rotate(-Math.PI / 2);
                        
                        const prefix = dataset.label === 'Semana Anterior' ? 'Ant: ' : 'Atu: ';
                        const label = prefix + 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                        
                        ctx.fillText(label, 0, 0);
                        ctx.restore();
                    });
                });
            }
        };

        function buildBarChart(canvasId, labels, dataAnt, dataAtu) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            const key = '__apexChart_' + canvasId;
            if (window[key]) { window[key].destroy(); }

            const bgAnt = [];
            const borderAnt = [];
            const bgAtu = [];
            const borderAtu = [];

            for (let i = 0; i < labels.length; i++) {
                const valAtu = dataAtu[i] || 0;
                const valAnt = dataAnt[i] || 0;
                if (valAtu > valAnt) {
                    bgAtu.push('#27ae60');
                    borderAtu.push('#1e8449');
                    bgAnt.push('#e74c3c');
                    borderAnt.push('#c0392b');
                } else {
                    bgAtu.push('#e74c3c');
                    borderAtu.push('#c0392b');
                    bgAnt.push('#27ae60');
                    borderAnt.push('#1e8449');
                }
            }

            window[key] = new Chart(ctx, {
                type: 'bar',
                plugins: [datalabelPlugin],
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Semana Anterior',
                            data: dataAnt,
                            backgroundColor: bgAnt,
                            borderColor: borderAnt,
                            borderWidth: 1,
                            borderRadius: 3,
                            barPercentage: 0.75,
                            categoryPercentage: 0.8
                        },
                        {
                            label: 'Semana Atual',
                            data: dataAtu,
                            backgroundColor: bgAtu,
                            borderColor: borderAtu,
                            borderWidth: 1,
                            borderRadius: 3,
                            barPercentage: 0.75,
                            categoryPercentage: 0.8
                        }
                    ]
                },
                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 90, right: 8, left: 8 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => fmtR(ctx.parsed.y)
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#222', font: { size: 10, weight: 'bold' } },
                            grid: { display: false }
                        },
                        y: {
                            ticks: {
                                color: '#444',
                                font: { size: 9 },
                                callback: v => 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
                            },
                            grid: { color: '#e8e8e8' }
                        }
                    }
                }
            });
        }

        const group1 = [
            { key: 'cobre',    label: 'COBRE' },
            { key: 'zinco',    label: 'ZINCO' },
            { key: 'aluminio', label: 'ALUMÍNIO' },
            { key: 'chumbo',   label: 'CHUMBO' }
        ];
        buildBarChart(
            'rel-hist-ChartLines',
            group1.map(m => m.label),
            group1.map(m => comp['SEMANA ANTERIOR']?.[m.key] || 0),
            group1.map(m => comp['100% LME']?.[m.key]        || 0)
        );

        const group2 = [
            { key: 'estanho', label: 'ESTANHO' },
            { key: 'niquel',  label: 'NÍQUEL' }
        ];
        buildBarChart(
            'rel-hist-ChartOsc',
            group2.map(m => m.label),
            group2.map(m => comp['SEMANA ANTERIOR']?.[m.key] || 0),
            group2.map(m => comp['100% LME']?.[m.key]        || 0)
        );

        function buildCards(containerId, group) {
            const el = document.getElementById(containerId);
            if (!el) return;
            el.innerHTML = group.map(m => {
                const atual    = comp['100% LME']?.[m.key]        || 0;
                const anterior = comp['SEMANA ANTERIOR']?.[m.key] || 0;
                const diff     = atual - anterior;
                const isUp     = diff > 0;
                const isDown   = diff < 0;
                const arrow    = isUp ? '↑' : isDown ? '↓' : '–';
                const color    = isUp ? '#1a7f4b' : isDown ? '#c0392b' : '#555';
                const bg       = isUp ? '#e9f7f0' : isDown ? '#fdecea' : '#f5f5f5';
                const border   = isUp ? '#a8dfc4' : isDown ? '#f5b8b2' : '#ddd';
                return `
                <div class="rel-card-metal" style="border-color:${border}; background:${bg};">
                    <div class="rel-card-metal-name">${m.label}</div>
                    <div class="rel-card-metal-val" style="color:${color};">
                        ${arrow} ${fmtR(atual)}
                    </div>
                    <div class="rel-card-metal-prev">era ${fmtR(anterior)}</div>
                    <div class="rel-card-metal-diff" style="color:${color};">
                        ${isUp ? '+' : isDown ? '-' : ''}${fmtR(diff)}
                    </div>
                </div>`;
            }).join('');
        }

        buildCards('rel-hist-cards-group1', group1);
        buildCards('rel-hist-cards-group2', group2);
    }

    function renderRelatorioDiarioHistoricoBase(week) {
        const comp = week.computed || {};
        const tbody = document.getElementById('rel-hist-base-tbody');
        tbody.innerHTML = '';
        const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];

        for (let p = 90; p <= 110; p++) {
            const tr = document.createElement('tr');
            if (p < 100) tr.className = 'row-below';
            else if (p === 100) tr.className = 'row-100pct';
            else tr.className = 'row-above';

            const pLabel = p === 100 ? '<strong>100%</strong>' : p + '%';
            let colsHtml = `<td>${pLabel}</td>`;

            metals.forEach(m => {
                const lme = comp['SEMANA ANTERIOR']?.[m] ?? null;
                const colClass = `rel-col-${m}`;
                if (lme === null) {
                    colsHtml += `<td class="${colClass}">-</td>`;
                } else {
                    const baseVal = lme * (p / 100);
                    const fmt = 'R$ ' + baseVal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                    colsHtml += `<td class="${colClass}">${fmt}</td>`;
                }
            });

            tr.innerHTML = colsHtml;
            tbody.appendChild(tr);
        }
    }


    // ─────────────────────────────────────────────────────────────────────────
    // APEX GESTÃO — SISTEMA DE PERMISSÕES, ANÁLISE, FINANCEIRO E ESTOQUE
    // ─────────────────────────────────────────────────────────────────────────
    let currentSimulatedRole = sessionStorage.getItem('apex_user_role') || 'Administrador';
    let localFornecedores = [];
    let localMateriais = [];
    let localPrecos = [];
    let localAmostras = [];
    let localPlanejamento = [];
    let activeAmostraIdForDesmonte = null;

    // --- Role Switcher & Permissões ---
    window.switchSimulatedRole = function(role) {
        currentSimulatedRole = role;
        sessionStorage.setItem('apex_user_role', role);
        document.getElementById('simulated-role-indicator').textContent = role;

        const roles = ['admin', 'lab', 'compras', 'producao', 'financeiro', 'diretoria'];
        roles.forEach(r => {
            const el = document.getElementById(`sim-${r}`);
            if (el) el.classList.remove('active');
        });
        
        const mapRoleToBtn = {
            'Administrador': 'sim-admin',
            'Laboratório': 'sim-lab',
            'Compras': 'sim-compras',
            'Produção': 'sim-producao',
            'Financeiro': 'sim-financeiro',
            'Diretoria': 'sim-diretoria'
        };
        const activeBtn = document.getElementById(mapRoleToBtn[role]);
        if (activeBtn) activeBtn.classList.add('active');

        applyRolePermissions();
    };

    function applyRolePermissions() {
        const role = currentSimulatedRole;

        // Se por acaso as permissões ainda não carregaram ou o role não existir, falha fechado (deny all exceto admin)
        let permissoes = globalRolePermissions[role] || [];
        if (role === 'Administrador') {
            // Admin vê tudo.
            permissoes = ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_laboratorio", "view_planejamento", "view_estoque", "view_bi", "edit_financeiro", "edit_producao", "view_usuarios", "view_permissoes", "view_financeiro", "view_pedidos", "view_clientes", "view_estrategico", "view_site"];
        }

        const temPermissao = (p) => permissoes.includes(p);

        // Funções auxiliares para esconder/mostrar navegação
        const setNav = (idOrSelector, isVisible) => {
            const el = document.getElementById(idOrSelector) || document.querySelector(idOrSelector);
            if (el) el.style.display = isVisible ? 'flex' : 'none';
        };

        // Tabs Visibility (Apex Gestão)
        setNav('nav-fornecedores', temPermissao('view_fornecedores'));
        setNav('nav-clientes', temPermissao('view_clientes'));
        setNav('nav-materiais', temPermissao('view_catalogo'));
        setNav('nav-precos', temPermissao('view_precos'));
        setNav('nav-amostras', temPermissao('view_laboratorio'));
        setNav('nav-planejamento', temPermissao('view_planejamento'));
        setNav('nav-planejamento-estrategicov3', temPermissao('view_estrategico'));
        setNav('nav-estoque', temPermissao('view_estoque'));
        setNav('nav-bi', temPermissao('view_bi'));
        setNav('nav-usuarios', temPermissao('view_usuarios'));
        setNav('nav-permissoes', temPermissao('view_permissoes'));
        setNav('nav-financeiro', temPermissao('view_financeiro'));
        setNav('nav-pedidos-venda', temPermissao('view_pedidos') || role === 'Administrador');

        // Tabs Visibility (LME - como os originais não tem ID, usamos querySelector)
        setNav('.nav-item[data-target="dashboard"]', temPermissao('view_lme'));
        setNav('.nav-item[data-target="relatorio-diario"]', temPermissao('view_lme'));
        
        // Site Config (Agrupados)
        setNav('.nav-item[data-target="home-config"]', temPermissao('view_site'));
        setNav('.nav-item[data-target="galeria-admin"]', temPermissao('view_site'));
        setNav('.nav-item[data-target="materiais"]', temPermissao('view_site'));
        setNav('.nav-item[data-target="solucoes"]', temPermissao('view_site'));
        setNav('.nav-item[data-target="noticias"]', temPermissao('view_site'));
        setNav('.nav-item[data-target="lme-email-config"]', temPermissao('view_site') || temPermissao('view_lme'));
        setNav('.nav-item[data-target="tabela-email-config"]', temPermissao('view_site') || temPermissao('view_precos'));

        // Oculta a seção ativa se o usuário perdeu acesso a ela e redireciona para a primeira disponível
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.style.display === 'none') {
            activeNav.classList.remove('active');
            const targetSec = document.getElementById(activeNav.dataset.target);
            if (targetSec) targetSec.classList.remove('active');

            const firstAvailable = document.querySelector('.nav-item[style="display: flex;"]');
            if (firstAvailable) {
                firstAvailable.classList.add('active');
                const targetFirst = document.getElementById(firstAvailable.dataset.target);
                if (targetFirst) targetFirst.classList.add('active');
            }
        }

        // Restrito Financeiro (Valores, margens, custos)
        const restritoFin = document.querySelectorAll('.restrito-financeiro');
        restritoFin.forEach(el => {
            // Alguns elementos podem usar flex ou table-cell ou block, então restauramos o valor limpo '' em vez de fixar
            el.style.display = temPermissao('edit_financeiro') ? '' : 'none';
        });

        // Restrito Produção (PCP)
        const restritoProd = document.querySelectorAll('.restrito-producao');
        restritoProd.forEach(el => {
            el.style.display = temPermissao('edit_producao') ? '' : 'none';
        });

        // Atualiza botões no desmonte se aberto
        if (activeAmostraIdForDesmonte) {
            const amostra = localAmostras.find(x => x.id === activeAmostraIdForDesmonte);
            if (amostra) renderizarBotoesAcoesAmostra(amostra.status);
        }
    }

    // --- 1. FORNECEDORES ---
    window.initApexFornecedores = function() {
        carregarFornecedores();
    };

    let fornPaginaAtual = 1;
    let fornTotalPaginas = 1;
    let fornTotalReg = 0;

    window.carregarFornecedores = async function(pagina = 1, termoBusca = '') {
        fornPaginaAtual = pagina;
        try {
            const query = `page=${pagina}&limit=50` + (termoBusca ? `&search=${encodeURIComponent(termoBusca)}` : '');
            const [resForn, resAmo] = await Promise.allSettled([
                fetch(`/api/fornecedores?${query}`),
                fetch('/api/amostras')
            ]);
            if (resForn.status === 'fulfilled' && resForn.value.ok) {
                const data = await resForn.value.json();
                if (data && data.data && Array.isArray(data.data)) {
                    localFornecedores = data.data;
                    window.localFornecedores = localFornecedores;
                    fornTotalReg = data.total;
                    fornTotalPaginas = data.totalPages || 1;
                } else if (Array.isArray(data)) {
                    localFornecedores = data;
                    window.localFornecedores = localFornecedores;
                    fornTotalReg = data.length;
                    fornTotalPaginas = 1;
                }
            }
            if (resAmo.status === 'fulfilled' && resAmo.value.ok) {
                localAmostras = await resAmo.value.json();
            }
            renderFornecedores();
            popularSeletoresFornecedores();
            atualizarControlesPaginacaoFornecedores();
        } catch (err) {
            console.error('Erro ao buscar fornecedores:', err);
        }
    };

    window.mudarPaginaFornecedores = function(delta) {
        const novaPagina = fornPaginaAtual + delta;
        if (novaPagina >= 1 && novaPagina <= fornTotalPaginas) {
            const searchEl = document.getElementById('fornecedores-search');
            window.carregarFornecedores(novaPagina, searchEl ? searchEl.value : '');
        }
    };

    function atualizarControlesPaginacaoFornecedores() {
        const elAtual = document.getElementById('forn-pag-atual');
        const elTotal = document.getElementById('forn-pag-total');
        const elReg = document.getElementById('forn-total-reg');
        const btnPrev = document.getElementById('btn-forn-prev');
        const btnNext = document.getElementById('btn-forn-next');

        if (elAtual) elAtual.textContent = fornPaginaAtual;
        if (elTotal) elTotal.textContent = fornTotalPaginas;
        if (elReg) elReg.textContent = fornTotalReg;
        if (btnPrev) btnPrev.disabled = fornPaginaAtual <= 1;
        if (btnNext) btnNext.disabled = fornPaginaAtual >= fornTotalPaginas;
    }

    function renderFornecedores() {
        const body = document.getElementById('fornecedores-table-body');
        if (!body) return;
        body.innerHTML = '';
        if (!localFornecedores || !localFornecedores.length) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#5a738e;"><i class="fa-solid fa-users-slash"></i> Nenhum fornecedor encontrado.</td></tr>';
            return;
        }
        localFornecedores.forEach(f => {
            const razao = f.nome || f.razao_social || '-';
            const fantasia = f.apelido || f.nome_fantasia || '-';
            const contato = f.comprador || f.contato || '-';
            const telefone = f.fone1 || f.telefone || '-';

            const amostrasForn = (localAmostras || []).filter(a => a.fornecedor_id === f.id);
            let amostrasHtml = '<span style="color:#666;font-style:italic;font-size:0.8rem;">Nenhuma</span>';
            if (amostrasForn.length > 0) {
                amostrasHtml = `<select style="background:#0d1a24; color:#4fc3f7; border:1px solid #1e3a5f; padding:6px; border-radius:6px; font-size:0.85rem; cursor:pointer; min-width:120px;" onchange="if(this.value) window.abrirAmostraPorNumero(this.value); this.value='';">
                    <option value="">${amostrasForn.length} Amostra(s) ▾</option>
                    ${amostrasForn.map(a => `<option value="${a.numero_amostra}">${a.numero_amostra}</option>`).join('')}
                </select>`;
            }

            const emailForn = (f.email || '').trim();
            const btnEmailHtml = emailForn 
                ? `<button style="background:#1b4332;border:none;color:#2AD07A;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:4px;" onclick="enviarTabelaPrecosEmail('fornecedor', '${emailForn}')" title="Enviar Tabela (Fornecedor) para ${emailForn}"><i class="fa-solid fa-paper-plane"></i> Tabela</button>`
                : `<button style="background:#1c252e;border:1px solid #334155;color:#64748b;padding:6px 10px;border-radius:6px;cursor:not-allowed;margin-right:4px;" disabled title="Sem e-mail cadastrado"><i class="fa-solid fa-paper-plane"></i> Tabela</button>`;

            const tr = document.createElement('tr');
            tr.title = 'Clique na linha para editar este fornecedor (exceto botões e selects)';
            tr.style.cursor = 'pointer';
            tr.onclick = (e) => {
                if (e.target.closest('button') || e.target.closest('select')) return;
                editarFornecedor(f.id);
            };
            tr.innerHTML = `
                <td style="padding:10px 12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;" title="${razao}"><strong style="color:#fff;">${razao}</strong></td>
                <td style="padding:10px 12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${fantasia}">${fantasia}</td>
                <td style="padding:10px 12px; white-space:nowrap;">${f.cnpj || '-'}</td>
                <td style="padding:10px 12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;" title="${contato}">${contato}</td>
                <td style="padding:10px 12px; white-space:nowrap;">${telefone}</td>
                <td style="padding:10px 12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${f.email || '-'}">${f.email || '-'}</td>
                <td style="padding:10px 12px; white-space:nowrap; text-align:center;">${amostrasHtml}</td>
                <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                    ${btnEmailHtml}
                    <button style="background:#1e3a5f;border:none;color:#4fc3f7;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:4px;" onclick="editarFornecedor(${f.id})" title="Editar"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button style="background:#3a1515;border:none;color:#ff6b6b;padding:6px 10px;border-radius:6px;cursor:pointer;" onclick="deletarFornecedor(${f.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    window.abrirModalFornecedor = function() {
        document.getElementById('form-fornecedor-apex').reset();
        document.getElementById('forn-id').value = '';
        document.getElementById('modal-fornecedor').style.display = 'flex';
    };

    window.fecharModalFornecedor = function() {
        document.getElementById('modal-fornecedor').style.display = 'none';
        if (window.quickOpenedFromPlanning) {
            window.quickOpenedFromPlanning = false;
            if (window.abrirModalPlanejamentoCompra) {
                window.abrirModalPlanejamentoCompra(window.mrpLastTipoOpened || 'COMPRA_VENDA');
            }
        }
    };

    window.editarFornecedor = function(id) {
        const f = localFornecedores.find(x => x.id === id);
        if (!f) { _apexNotify('Sistema', 'Fornecedor não encontrado na lista local. Recarregue a página.', 'info'); return; }
        document.getElementById('modal-forn-titulo').textContent = 'Editar Fornecedor';
        document.getElementById('forn-id').value = f.id;
        document.getElementById('forn-codfor').value = f.codfor || '';
        // Suporta tanto colunas reais (nome) quanto aliases (razao_social)
        document.getElementById('forn-razao').value = f.nome || f.razao_social || '';
        document.getElementById('forn-fantasia').value = f.apelido || f.nome_fantasia || '';
        document.getElementById('forn-cnpj').value = f.cnpj || '';
        document.getElementById('forn-cpf').value = f.cpf || '';
        document.getElementById('forn-ie').value = f.ie || '';
        document.getElementById('forn-contato').value = f.comprador || f.contato || '';
        document.getElementById('forn-telefone').value = f.fone1 || f.telefone || '';
        document.getElementById('forn-fone2').value = f.fone2 || '';
        document.getElementById('forn-whatsapp').value = f.whatsapp || '';
        document.getElementById('forn-celular').value = f.celular || '';
        document.getElementById('forn-email').value = f.email || '';
        document.getElementById('forn-endereco').value = f.endereco || '';
        document.getElementById('forn-numero').value = f.numero || '';
        document.getElementById('forn-bairro').value = f.bairro || '';
        document.getElementById('forn-cidade').value = f.cidade || '';
        document.getElementById('forn-uf').value = f.uf || '';
        document.getElementById('forn-cep').value = f.cep || '';
        document.getElementById('forn-obs').value = f.complemento || f.observacoes || '';
        document.getElementById('forn-condicao').value = f.condicao_pagamento || '';
        document.getElementById('forn-tabela').value = f.tabela || '';
        document.getElementById('forn-filial').value = f.filial || '';
        document.getElementById('modal-fornecedor').style.display = 'flex';
    };

    window.salvarFornecedor = async function(e) {
        e.preventDefault();
        const id = document.getElementById('forn-id').value;
        const data = {
            razao_social: document.getElementById('forn-razao').value,
            nome_fantasia: document.getElementById('forn-fantasia').value,
            cnpj: document.getElementById('forn-cnpj').value,
            cpf: document.getElementById('forn-cpf').value,
            ie: document.getElementById('forn-ie').value,
            contato: document.getElementById('forn-contato').value,
            telefone: document.getElementById('forn-telefone').value,
            fone2: document.getElementById('forn-fone2').value,
            whatsapp: document.getElementById('forn-whatsapp').value,
            celular: document.getElementById('forn-celular').value,
            email: document.getElementById('forn-email').value,
            endereco: document.getElementById('forn-endereco').value,
            numero: document.getElementById('forn-numero').value,
            bairro: document.getElementById('forn-bairro').value,
            cidade: document.getElementById('forn-cidade').value,
            uf: document.getElementById('forn-uf').value,
            cep: document.getElementById('forn-cep').value,
            observacoes: document.getElementById('forn-obs').value,
            condicao_pagamento: document.getElementById('forn-condicao').value,
            tabela: document.getElementById('forn-tabela').value,
            filial: document.getElementById('forn-filial').value
        };
        const btn = e.target.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }
        try {
            const url = id ? `/api/fornecedores/${id}` : '/api/fornecedores';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            fecharModalFornecedor();
            carregarFornecedores();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao salvar fornecedor: ' + err.message, 'error');
            console.error('Erro ao salvar fornecedor:', err);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Fornecedor'; }
        }
    };

    window.deletarFornecedor = async function(id) {
        if (!confirm('Deseja realmente excluir este fornecedor?')) return;
        try {
            await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' });
            carregarFornecedores();
        } catch (err) {
            console.error(err);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // CLIENTES — CRUD COMPLETO
    // ═══════════════════════════════════════════════════════════
    let localClientes = [];

    window.initApexClientes = async function() {
        await carregarClientes();
    };

    let cliPaginaAtual = 1;
    let cliTotalPaginas = 1;
    let cliTotalReg = 0;

    window.carregarClientes = async function(pagina = 1, termoBusca = '') {
        cliPaginaAtual = pagina;
        try {
            const query = `page=${pagina}&limit=50` + (termoBusca ? `&search=${encodeURIComponent(termoBusca)}` : '');
            const res = await fetch(`/api/clientes?${query}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.data && Array.isArray(data.data)) {
                    localClientes = data.data;
                    cliTotalReg = data.total;
                    cliTotalPaginas = data.totalPages || 1;
                } else if (Array.isArray(data)) {
                    localClientes = data;
                    cliTotalReg = data.length;
                    cliTotalPaginas = 1;
                }
            }
            renderClientes();
            atualizarControlesPaginacaoClientes();
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
        }
    };

    window.mudarPaginaClientes = function(delta) {
        const novaPagina = cliPaginaAtual + delta;
        if (novaPagina >= 1 && novaPagina <= cliTotalPaginas) {
            const searchEl = document.getElementById('clientes-search');
            window.carregarClientes(novaPagina, searchEl ? searchEl.value : '');
        }
    };

    function atualizarControlesPaginacaoClientes() {
        const elAtual = document.getElementById('cli-pag-atual');
        const elTotal = document.getElementById('cli-pag-total');
        const elReg = document.getElementById('cli-total-reg');
        const btnPrev = document.getElementById('btn-cli-prev');
        const btnNext = document.getElementById('btn-cli-next');

        if (elAtual) elAtual.textContent = cliPaginaAtual;
        if (elTotal) elTotal.textContent = cliTotalPaginas;
        if (elReg) elReg.textContent = cliTotalReg;
        if (btnPrev) btnPrev.disabled = cliPaginaAtual <= 1;
        if (btnNext) btnNext.disabled = cliPaginaAtual >= cliTotalPaginas;
    }

    function renderClientes() {
        const body = document.getElementById('clientes-table-body');
        if (!body) return;
        body.innerHTML = '';
        if (!localClientes.length) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#5a738e;"><i class="fa-solid fa-users-slash"></i> Nenhum cliente cadastrado.</td></tr>';
            return;
        }
        localClientes.forEach(c => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para editar este cliente';
            tr.onclick = (e) => {
                if (e.target.closest('button')) return;
                editarCliente(c.id);
            };
            tr.innerHTML = `
                <td style="padding:10px 12px;"><strong style="color:#fff;">${c.nome || '-'}</strong></td>
                <td style="padding:10px 12px;color:#aaa;">${c.fantasia || '-'}</td>
                <td style="padding:10px 12px;">${c.cnpj || c.cpf || '-'}</td>
                <td style="padding:10px 12px;">${c.telefone1 || '-'}</td>
                <td style="padding:10px 12px;">${c.email || '-'}</td>
                <td style="padding:10px 12px;">${c.cidade || '-'}${c.uf ? '/' + c.uf : ''}</td>
                <td style="padding:10px 12px;">
                    <span style="padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; background:${c.status === 'ATIVO' ? '#0d3020' : '#2a1515'}; color:${c.status === 'ATIVO' ? '#2AD07A' : '#ff6b6b'};">${c.status || 'ATIVO'}</span>
                </td>
                <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                    <button style="background:#3a2000;border:none;color:#e07b39;padding:6px 12px;border-radius:6px;cursor:pointer;margin-right:4px;font-size:0.82rem;" onclick="editarCliente(${c.id})" title="Editar"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button style="background:#3a1515;border:none;color:#ff6b6b;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.82rem;" onclick="deletarCliente(${c.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    window.abrirModalCliente = function() {
        document.getElementById('form-cliente-apex').reset();
        document.getElementById('cli-id').value = '';
        document.getElementById('modal-cli-titulo').textContent = 'Novo Cliente';
        document.getElementById('modal-cliente').style.display = 'flex';
    };

    window.fecharModalCliente = function() {
        document.getElementById('modal-cliente').style.display = 'none';
    };

    window.editarCliente = function(id) {
        const c = localClientes.find(x => x.id === id);
        if (!c) return;
        document.getElementById('modal-cli-titulo').textContent = 'Editar Cliente';
        document.getElementById('cli-id').value = c.id;
        document.getElementById('cli-codigo').value = c.codigo || '';
        document.getElementById('cli-nome').value = c.nome || '';
        document.getElementById('cli-fantasia').value = c.fantasia || '';
        document.getElementById('cli-status').value = c.status || 'ATIVO';
        document.getElementById('cli-tipo').value = c.tipo_cliente || '';
        document.getElementById('cli-cnpj').value = c.cnpj || '';
        document.getElementById('cli-cpf').value = c.cpf || '';
        document.getElementById('cli-ie').value = c.ie || c.rg || '';
        document.getElementById('cli-tel1').value = c.telefone1 || '';
        document.getElementById('cli-tel2').value = c.telefone2 || '';
        document.getElementById('cli-contato-com').value = c.contato_comercial || '';
        document.getElementById('cli-contato-fin').value = c.contato_financeiro || '';
        document.getElementById('cli-email').value = c.email || '';
        document.getElementById('cli-endereco').value = c.endereco || '';
        document.getElementById('cli-numero').value = c.numero || '';
        document.getElementById('cli-bairro').value = c.bairro || '';
        document.getElementById('cli-cidade').value = c.cidade || '';
        document.getElementById('cli-uf').value = c.uf || '';
        document.getElementById('cli-pais').value = c.pais || '';
        document.getElementById('cli-cep').value = c.cep || '';
        document.getElementById('cli-vendedor').value = c.vendedor || '';
        document.getElementById('cli-dias').value = (c.dias !== undefined && c.dias !== null) ? c.dias : '0';
        document.getElementById('cli-filial').value = c.filial || '';
        document.getElementById('modal-cliente').style.display = 'flex';
    };

    window.salvarCliente = async function(e) {
        e.preventDefault();
        const id = document.getElementById('cli-id').value;
        const data = {
            codigo: document.getElementById('cli-codigo').value || null,
            nome: document.getElementById('cli-nome').value,
            fantasia: document.getElementById('cli-fantasia').value,
            status: document.getElementById('cli-status').value,
            tipo_cliente: document.getElementById('cli-tipo').value,
            cnpj: document.getElementById('cli-cnpj').value,
            cpf: document.getElementById('cli-cpf').value,
            ie: document.getElementById('cli-ie').value,
            telefone1: document.getElementById('cli-tel1').value,
            telefone2: document.getElementById('cli-tel2').value,
            contato_comercial: document.getElementById('cli-contato-com').value,
            contato_financeiro: document.getElementById('cli-contato-fin').value,
            email: document.getElementById('cli-email').value,
            endereco: document.getElementById('cli-endereco').value,
            numero: document.getElementById('cli-numero').value,
            bairro: document.getElementById('cli-bairro').value,
            cidade: document.getElementById('cli-cidade').value,
            uf: document.getElementById('cli-uf').value,
            pais: document.getElementById('cli-pais').value,
            cep: document.getElementById('cli-cep').value,
            vendedor: document.getElementById('cli-vendedor').value,
            dias: (document.getElementById('cli-dias').value || '').trim() || '0',
            filial: document.getElementById('cli-filial').value
        };
        const btn = e.target.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }
        try {
            const url = id ? `/api/clientes/${id}` : '/api/clientes';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            const savedData = await res.clone().json().catch(() => ({}));
            fecharModalCliente();
            await carregarClientes();
            if (!id && window.clienteCadastradoCallback) {
                const targetId = savedData.id || (localClientes[0] ? localClientes[0].id : null);
                if (targetId) window.clienteCadastradoCallback(targetId);
                window.clienteCadastradoCallback = null;
            }
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao salvar cliente: ' + err.message, 'error');
            console.error('Erro ao salvar cliente:', err);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Cliente'; }
        }
    };

    window.deletarCliente = async function(id) {
        if (!confirm('Deseja realmente excluir este cliente?')) return;
        try {
            await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
            carregarClientes();
        } catch (err) {
            console.error(err);
        }
    };

    window.filtrarClientes = function() {
        const search = document.getElementById('clientes-search')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('#clientes-table-body tr');
        rows.forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
        });
    };

    window.filtrarFornecedores = function() {
        const search = document.getElementById('fornecedores-search').value.toLowerCase();
        const selectedRadio = document.querySelector('input[name="fornFilter"]:checked');
        const colIndex = selectedRadio ? selectedRadio.value : 'all';
        const rows = document.querySelectorAll('#fornecedores-table-body tr');
        
        rows.forEach(row => {
            let match = false;
            if (colIndex === 'all') {
                const text = row.textContent.toLowerCase();
                match = text.includes(search);
            } else {
                const cells = row.querySelectorAll('td');
                if (cells.length > colIndex) {
                    const text = cells[colIndex].textContent.toLowerCase().trim();
                    // Conforme solicitado, busca pelas iniciais do termo na coluna específica
                    match = text.startsWith(search) || text.includes(search);
                }
            }
            row.style.display = match ? '' : 'none';
        });
    };

    async function popularSeletoresFornecedores() {
        const amoF = document.getElementById('amo-fornecedor');
        const plF = document.getElementById('pl-fornecedor');
        const getNomeFornecedor = (f) => f.nome || f.nome_fantasia || f.apelido || `Fornecedor #${f.id}`;
        
        try {
            if (amoF && amoF.tomselect) amoF.tomselect.destroy();
            if (plF && plF.tomselect) plF.tomselect.destroy();

            const res = await fetch('/api/fornecedores?limit=9999');
            if (!res.ok) return;
            const data = await res.json();
            const todos = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
            
            if (amoF) {
                amoF.innerHTML = '<option value="">Selecione o Fornecedor...</option>';
                todos.forEach(f => {
                    amoF.innerHTML += `<option value="${f.id}">${getNomeFornecedor(f)}</option>`;
                });
                new TomSelect(amoF, { create: false, sortField: { field: "text", direction: "asc" } });
            }
            if (plF) {
                plF.innerHTML = '<option value="">Selecione o Fornecedor...</option>';
                todos.forEach(f => {
                    plF.innerHTML += `<option value="${f.id}">${getNomeFornecedor(f)}</option>`;
                });
                new TomSelect(plF, { create: false, sortField: { field: "text", direction: "asc" } });
            }
        } catch (e) {
            console.error('Erro popularSeletoresFornecedores', e);
        }
    }

    // --- 2. CATALOGO DE MATERIAIS ---
    window.initApexMateriais = function() {
        carregarMateriais();
    };

    async function carregarMateriais() {
        try {
            const res = await fetch('/api/materiais-catalogo');
            localMateriais = await res.json();
            window.localMateriais = localMateriais;
            renderMateriais();
            popularSeletoresCategorias();
            popularSeletoresMateriais();
        } catch (err) {
            console.error(err);
        }
    }

    function renderMateriais() {
        const body = document.getElementById('materiais-table-body');
        if (!body) return;
        body.innerHTML = '';
        localMateriais.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:12px;"><strong>${m.nome}</strong></td>
                <td style="padding:12px;">${m.unidade}</td>
                <td style="padding:12px;"><span class="badge-status em-analise" style="background:${m.cor || '#1e4e8c'};">${m.categoria}</span></td>
                <td style="padding:12px;">${m.ncm || '-'}</td>
                <td style="padding:12px;"><div style="width:24px; height:24px; border-radius:50%; background:${m.cor || '#fff'}; border:1px solid #444;"></div></td>
                <td style="padding:12px;">${m.observacoes || '-'}</td>
                <td style="padding:12px; text-align:center;">
                    <button class="btn-refresh" style="background:none; border:none; color:#3e7cb1; margin-right:8px;" onclick="editarMaterial(${m.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-refresh" style="background:none; border:none; color:#ff4d4d;" onclick="deletarMaterial(${m.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    let ncmTimeout = null;

    window.buscarNcmPorNome = function(e) {
        if (e) e.preventDefault();
        const nome = document.getElementById('mat-nome').value;
        if (!nome) {
            _apexNotify('Sistema', 'Por favor, digite o nome do material primeiro.', 'info');
            return;
        }
        executarBuscaNcm(nome);
    };

    window.autoBuscarNcm = function(valor) {
        clearTimeout(ncmTimeout);
        if (!valor || valor.trim().length < 2) {
            fecharNcmDropdown();
            return;
        }
        ncmTimeout = setTimeout(() => {
            executarBuscaNcm(valor);
        }, 400);
    };

    window.buscarNcmManual = function() {
        const valor = document.getElementById('mat-ncm').value;
        if (!valor) {
            _apexNotify('Sistema', 'Digite um termo ou código para buscar.', 'info');
            return;
        }
        executarBuscaNcm(valor);
    };

    async function executarBuscaNcm(termo) {
        const dropdown = document.getElementById('ncm-resultados-dropdown');
        if (!dropdown) return;
        
        try {
            const res = await fetch(`/api/ncm/buscar?q=${encodeURIComponent(termo)}`);
            const resultados = await res.json();
            
            let html = '';
            
            if (resultados.length === 0) {
                html += `<div style="padding:10px; color:#aaa; font-style:italic; font-size:0.85rem;">Nenhum NCM encontrado na base</div>`;
            } else {
                html += resultados.map(n => `
                    <div style="padding:10px; cursor:pointer; border-bottom:1px solid #223547; transition:background 0.2s;" 
                         onclick="selecionarNcm('${n.codigo}', '${n.descricao.replace(/'/g, "\\'")}')"
                         onmouseover="this.style.background='rgba(30, 78, 140, 0.4)'"
                         onmouseout="this.style.background='none'">
                        <span style="color:#2AD07A; font-weight:bold; font-size:0.85rem;">${formatarCodigoNcm(n.codigo)}</span><br>
                        <small style="color:#ddd; font-size:0.75rem;">${n.descricao}</small>
                    </div>
                `).join('');
            }

            // Sempre adiciona a opção de usar o valor digitado manualmente
            const termoSanitizado = termo.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `
                <div style="padding:10px; cursor:pointer; background:#1a3045; border-top:1px solid #3e7cb1;" 
                     onclick="usarNcmManual('${termoSanitizado}')"
                     onmouseover="this.style.background='rgba(30, 78, 140, 0.6)'"
                     onmouseout="this.style.background='#1a3045'">
                    <span style="color:#4fc3f7; font-weight:bold; font-size:0.85rem;"><i class="fa-solid fa-keyboard"></i> Usar NCM manual: ${termo}</span>
                </div>
            `;
            
            dropdown.innerHTML = html;
            dropdown.style.display = 'block';
        } catch (err) {
            console.error('Erro ao buscar NCM:', err);
        }
    }

    window.usarNcmManual = function(valor) {
        const input = document.getElementById('mat-ncm');
        if (input) {
            // Formata o valor manual se parecer com um número de 8 dígitos
            input.value = formatarCodigoNcm(valor);
        }
        fecharNcmDropdown();
    };

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('ncm-resultados-dropdown');
        const input = document.getElementById('mat-ncm');
        const btnBusca = document.querySelector('button[onclick="buscarNcmManual()"]');
        
        if (dropdown && dropdown.style.display === 'block') {
            if (!dropdown.contains(e.target) && e.target !== input && e.target !== btnBusca && (!btnBusca || !btnBusca.contains(e.target))) {
                fecharNcmDropdown();
            }
        }
    });

    window.selecionarNcm = function(codigo, descricao) {
        const input = document.getElementById('mat-ncm');
        if (input) {
            input.value = formatarCodigoNcm(codigo);
        }
        fecharNcmDropdown();
    };

    function fecharNcmDropdown() {
        const dropdown = document.getElementById('ncm-resultados-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }

    function formatarCodigoNcm(codigo) {
        const limpo = codigo.replace(/\D/g, '');
        if (limpo.length === 8) {
            return `${limpo.substring(0,4)}.${limpo.substring(4,6)}.${limpo.substring(6,8)}`;
        }
        return codigo;
    }

    // Fechar dropdown de NCM ao clicar fora do modal
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('ncm-resultados-dropdown');
        const inputNcm = document.getElementById('mat-ncm');
        if (dropdown && e.target !== dropdown && e.target !== inputNcm && !dropdown.contains(e.target)) {
            fecharNcmDropdown();
        }
    });

    window.abrirModalMaterial = function() {
        document.getElementById('form-material-apex').reset();
        document.getElementById('mat-id').value = '';
        document.getElementById('modal-material-titulo').textContent = 'Cadastro de Material';
        fecharNcmDropdown();
        popularSeletoresCategorias();
        selecionarCategoriaBadge(null);
        document.getElementById('modal-material').style.display = 'flex';
        // Sync color preview
        const corInput = document.getElementById('mat-cor');
        const corPreview = document.getElementById('mat-cor-preview');
        if (corInput && corPreview) {
            corInput.addEventListener('input', () => { corPreview.textContent = corInput.value; }, { once: false });
            corPreview.textContent = corInput.value;
        }
    };

    window.fecharModalMaterial = function() {
        fecharNcmDropdown();
        document.getElementById('modal-material').style.display = 'none';
        if (window.quickOpenedFromPlanning) {
            window.quickOpenedFromPlanning = false;
            if (window.abrirModalPlanejamentoCompra) {
                window.abrirModalPlanejamentoCompra(window.mrpLastTipoOpened || 'COMPRA_VENDA');
            }
        }
    };

    window.editarMaterial = function(id) {
        const m = localMateriais.find(x => x.id === id);
        if (!m) return;
        document.getElementById('mat-id').value = m.id;
        document.getElementById('mat-nome').value = m.nome;
        document.getElementById('mat-ncm').value = m.ncm || '';
        document.getElementById('mat-cor').value = m.cor || '#3e7cb1';
        const corPreview = document.getElementById('mat-cor-preview');
        if (corPreview) corPreview.textContent = m.cor || '#3e7cb1';
        document.getElementById('mat-obs').value = m.observacoes || '';
        document.getElementById('modal-material-titulo').textContent = 'Editar Material';
        popularSeletoresCategorias();
        selecionarCategoriaBadge(m.categoria);
        // Set unidade select
        const unSelect = document.getElementById('mat-unidade');
        if (unSelect) { unSelect.value = m.unidade || 'kg'; }
        document.getElementById('modal-material').style.display = 'flex';
        // Sync color preview
        const corInput = document.getElementById('mat-cor');
        if (corInput) corInput.addEventListener('input', () => { if(corPreview) corPreview.textContent = corInput.value; }, { once: false });
    };

    function selecionarCategoriaBadge(cat) {
        const select = document.getElementById('mat-categoria');
        const badges = document.querySelectorAll('.cat-badge-btn');
        const infoDiv = document.getElementById('mat-categoria-selecionada');
        const nomeSpan = document.getElementById('mat-categoria-nome-display');
        badges.forEach(b => {
            const isSelected = b.dataset.cat === cat;
            b.style.background = isSelected ? (b.dataset.color || '#1e4e8c') : 'rgba(255,255,255,0.05)';
            b.style.borderColor = isSelected ? (b.dataset.color || '#1e4e8c') : 'rgba(255,255,255,0.12)';
            b.style.color = isSelected ? '#fff' : '#a0b4c8';
            b.style.fontWeight = isSelected ? '700' : '400';
            b.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';
        });
        if (select) select.value = cat || '';
        if (infoDiv) infoDiv.style.display = cat ? 'block' : 'none';
        if (nomeSpan && cat) nomeSpan.textContent = cat;
    }
    window.selecionarCategoriaBadge = selecionarCategoriaBadge;

    window.salvarMaterial = async function(e) {
        e.preventDefault();
        const id = document.getElementById('mat-id').value;
        const data = {
            nome: document.getElementById('mat-nome').value,
            categoria: document.getElementById('mat-categoria').value,
            unidade: document.getElementById('mat-unidade').value,
            ncm: document.getElementById('mat-ncm').value,
            cor: document.getElementById('mat-cor').value,
            observacoes: document.getElementById('mat-obs').value
        };

        try {
            const url = id ? `/api/materiais-catalogo/${id}` : '/api/materiais-catalogo';
            const method = id ? 'PUT' : 'POST';
            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                _apexNotify('Atenção', 'Erro ao salvar material: ' + (errData.error || resp.statusText), 'error');
                return;
            }
            fecharModalMaterial();
            await carregarMateriais();
            // Reload the pricing table so the new material/category appears immediately
            if (window.carregarPrecos) await window.carregarPrecos();
        } catch (err) {
            console.error(err);
            _apexNotify('Atenção', 'Erro de conexão ao salvar material: ' + err.message, 'error');
        }
    };

    window.deletarMaterial = async function(id) {
        if (!confirm('Excluir este material do catálogo? O preço correspondente também será removido.')) return;
        try {
            await fetch(`/api/materiais-catalogo/${id}`, { method: 'DELETE' });
            await carregarMateriais();
            // Reload the pricing table so the deleted material/category is removed
            if (window.carregarPrecos) await window.carregarPrecos();
        } catch (err) {
            console.error(err);
        }
    };

    window.filtrarMateriais = function() {
        const search = document.getElementById('materiais-search').value.toLowerCase();
        const rows = document.querySelectorAll('#materiais-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(search) ? '' : 'none';
        });
    };

    function popularSeletoresMateriais() {
        const prcM = document.getElementById('prc-material');
        const plM = document.getElementById('pl-material-result');
        if (prcM) {
            prcM.innerHTML = '';
            localMateriais.forEach(m => {
                const c = (m.categoria || '').toUpperCase();
                if (c.includes('LIGA') || c.includes('RESIDUO') || c.includes('RESÍDUO')) return;
                prcM.innerHTML += `<option value="${m.id}">${m.nome} (${m.categoria})</option>`;
            });
        }
        if (plM) {
            plM.innerHTML = '';
            localMateriais.forEach(m => {
                plM.innerHTML += `<option value="${m.id}">${m.nome}</option>`;
            });
        }
    }

    function popularSeletoresCategorias() {
        const matCat = document.getElementById('mat-categoria');
        const badgesDiv = document.getElementById('mat-categoria-badges');
        if (!matCat) return;
        
        let cats = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
        if (settingsPrecos && settingsPrecos['categorias_materiais']) {
            try {
                cats = JSON.parse(settingsPrecos['categorias_materiais']);
            } catch(e) {}
        }
        
        localMateriais.forEach(m => {
            if (m.categoria && !cats.includes(m.categoria)) {
                cats.push(m.categoria);
            }
        });

        // Atualiza o select oculto
        const currentVal = matCat.value;
        matCat.innerHTML = cats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        if (currentVal && cats.includes(currentVal)) matCat.value = currentVal;

        // Renderiza badges visuais
        if (badgesDiv) {
            const catsDefault = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
            const corPaleta = {
                'Alumínio': '#5a92b5', 'Cobre': '#e07b39', 'Tomada/Conectores': '#d4b896',
                'Aço': '#7ea374', 'Chumbo': '#7a8a99', 'Latão/Bronze': '#c8a240',
                'Zamac': '#8a7ba8', 'Outros': '#6b7280'
            };
            badgesDiv.innerHTML = cats.map(cat => {
                const cor = settingsPrecos && settingsPrecos[`cor_categoria_${cat}`]
                    ? settingsPrecos[`cor_categoria_${cat}`]
                    : (corPaleta[cat] || '#1e4e8c');
                const isCustom = !catsDefault.includes(cat);
                const actionsHtml = isCustom ? `
                    <span class="cat-badge-actions" style="display:none; margin-left:5px; gap:3px; align-items:center;">
                        <span onclick="event.stopPropagation(); renomearCategoria('${cat.replace(/'/g, "\\'")}')"
                            title="Renomear grupo" style="cursor:pointer; font-size:0.75rem; color:#ffd54f; padding:1px 4px; border-radius:3px;"
                            onmouseover="this.style.background='rgba(255,213,79,0.15)'" onmouseout="this.style.background='none'"
                        >✎</span>
                        <span onclick="event.stopPropagation(); excluirCategoria('${cat.replace(/'/g, "\\'")}')"
                            title="Excluir grupo" style="cursor:pointer; font-size:0.82rem; color:#ff5555; padding:1px 4px; border-radius:3px;"
                            onmouseover="this.style.background='rgba(255,85,85,0.15)'" onmouseout="this.style.background='none'"
                        >×</span>
                    </span>` : '';
                return `<button type="button" class="cat-badge-btn"
                    data-cat="${cat}" data-color="${cor}" data-custom="${isCustom}"
                    onclick="selecionarCategoriaBadge('${cat.replace(/'/g, "\\'")}')"
                    onmouseover="this.style.borderColor='${cor}'; this.style.color='${cor}'; this.style.background='rgba(255,255,255,0.08)'; const a=this.querySelector('.cat-badge-actions'); if(a) a.style.display='inline-flex';"
                    onmouseout="if(document.getElementById('mat-categoria').value !== '${cat.replace(/'/g, "\\'")}'){ this.style.borderColor='rgba(255,255,255,0.12)'; this.style.color='#a0b4c8'; this.style.background='rgba(255,255,255,0.05)'; } const a=this.querySelector('.cat-badge-actions'); if(a) a.style.display='none';"
                    style="display:inline-flex; align-items:center; padding:7px 14px; border-radius:20px; border:1.5px solid rgba(255,255,255,0.12);
                        background:rgba(255,255,255,0.05); color:#a0b4c8; font-size:0.83rem;
                        cursor:pointer; transition:all 0.18s ease; white-space:nowrap;
                        font-family:inherit; letter-spacing:0.3px;"
                >
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${cor}; margin-right:6px; flex-shrink:0;"></span>
                    ${cat}
                    ${actionsHtml}
                </button>`;
            }).join('');
        }
    }

    window.adicionarNovaCategoriaPrompt = async function() {
        const nova = prompt('Nome do novo grupo/categoria:');
        if (!nova) return;
        const trim = nova.trim();
        if (trim === '') return;
        
        let cats = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
        if (settingsPrecos && settingsPrecos['categorias_materiais']) {
            try { cats = JSON.parse(settingsPrecos['categorias_materiais']); } catch(e) {}
        }

        if (!cats.some(c => c.toLowerCase() === trim.toLowerCase())) {
            cats.push(trim);
            try {
                await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 'categorias_materiais': JSON.stringify(cats) })
                });
                settingsPrecos['categorias_materiais'] = JSON.stringify(cats);
            } catch(err) { console.error('Erro ao salvar nova categoria:', err); }
        }
        
        popularSeletoresCategorias();
        selecionarCategoriaBadge(trim);
    };

    window.excluirCategoria = async function(cat) {
        const materiaisDoGrupo = localMateriais.filter(m => m.categoria === cat);
        if (materiaisDoGrupo.length > 0) {
            const confirmMsg = `O grupo "${cat}" possui ${materiaisDoGrupo.length} material(is) vinculado(s):\n${materiaisDoGrupo.map(m => '  • ' + m.nome).join('\n')}\n\nExcluir o grupo também removerá esses materiais e seus preços. Deseja continuar?`;
            if (!confirm(confirmMsg)) return;
            for (const m of materiaisDoGrupo) {
                await fetch(`/api/materiais-catalogo/${m.id}`, { method: 'DELETE' });
            }
        } else {
            if (!confirm(`Excluir o grupo "${cat}"?`)) return;
        }

        let cats = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
        if (settingsPrecos && settingsPrecos['categorias_materiais']) {
            try { cats = JSON.parse(settingsPrecos['categorias_materiais']); } catch(e) {}
        }
        cats = cats.filter(c => c !== cat);

        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 'categorias_materiais': JSON.stringify(cats) })
            });
            settingsPrecos['categorias_materiais'] = JSON.stringify(cats);
        } catch(err) { console.error('Erro ao excluir categoria:', err); }

        await carregarMateriais();
        if (window.carregarPrecos) await window.carregarPrecos();
        // Se o grupo excluído estava selecionado, limpa
        const select = document.getElementById('mat-categoria');
        if (select && select.value === cat) selecionarCategoriaBadge(null);
        popularSeletoresCategorias();
    };

    window.renomearCategoria = async function(cat) {
        const novoNome = prompt(`Novo nome para o grupo "${cat}":`, cat);
        if (!novoNome || novoNome.trim() === '' || novoNome.trim() === cat) return;
        const trim = novoNome.trim();

        // Atualiza a lista de categorias
        let cats = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
        if (settingsPrecos && settingsPrecos['categorias_materiais']) {
            try { cats = JSON.parse(settingsPrecos['categorias_materiais']); } catch(e) {}
        }
        const idx = cats.indexOf(cat);
        if (idx !== -1) cats[idx] = trim;

        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 'categorias_materiais': JSON.stringify(cats) })
            });
            settingsPrecos['categorias_materiais'] = JSON.stringify(cats);
        } catch(err) { console.error('Erro ao renomear categoria:', err); }

        // Atualiza a categoria de todos os materiais desse grupo
        const materiaisDoGrupo = localMateriais.filter(m => m.categoria === cat);
        for (const m of materiaisDoGrupo) {
            await fetch(`/api/materiais-catalogo/${m.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...m, categoria: trim })
            });
        }

        await carregarMateriais();
        if (window.carregarPrecos) await window.carregarPrecos();
        popularSeletoresCategorias();
        selecionarCategoriaBadge(trim);
    };

    window.calcularPorcentagemDeEntregar = function() {
        const venda = parseFloat(document.getElementById('prc-venda').value) || 0;
        const entregar = parseFloat(document.getElementById('prc-entregar').value) || 0;
        const pctInput = document.getElementById('prc-entregar-pct');
        if (pctInput) {
            if (venda > 0) {
                pctInput.value = ((entregar / venda) * 100).toFixed(1);
            } else {
                pctInput.value = '';
            }
        }
    };

    window.calcularPorcentagemDeColetar = function() {
        const venda = parseFloat(document.getElementById('prc-venda').value) || 0;
        const coletar = parseFloat(document.getElementById('prc-coletar').value) || 0;
        const pctInput = document.getElementById('prc-coletar-pct');
        if (pctInput) {
            if (venda > 0) {
                pctInput.value = ((coletar / venda) * 100).toFixed(1);
            } else {
                pctInput.value = '';
            }
        }
    };

    window.calcularValorDeEntregar = function() {
        const venda = parseFloat(document.getElementById('prc-venda').value) || 0;
        const pct = parseFloat(document.getElementById('prc-entregar-pct').value) || 0;
        const valInput = document.getElementById('prc-entregar');
        if (valInput) {
            valInput.value = ((venda * pct) / 100).toFixed(2);
        }
    };

    window.calcularValorDeColetar = function() {
        const venda = parseFloat(document.getElementById('prc-venda').value) || 0;
        const pct = parseFloat(document.getElementById('prc-coletar-pct').value) || 0;
        const valInput = document.getElementById('prc-coletar');
        if (valInput) {
            valInput.value = ((venda * pct) / 100).toFixed(2);
        }
    };

    window.calcularValoresDeAcordoComPorcentagem = function() {
        const venda = parseFloat(document.getElementById('prc-venda').value) || 0;
        
        const pctEntregar = parseFloat(document.getElementById('prc-entregar-pct').value) || 0;
        const valEntregar = document.getElementById('prc-entregar');
        if (valEntregar && pctEntregar > 0) {
            valEntregar.value = ((venda * pctEntregar) / 100).toFixed(2);
        } else if (valEntregar) {
            window.calcularPorcentagemDeEntregar();
        }

        const pctColetar = parseFloat(document.getElementById('prc-coletar-pct').value) || 0;
        const valColetar = document.getElementById('prc-coletar');
        if (valColetar && pctColetar > 0) {
            valColetar.value = ((venda * pctColetar) / 100).toFixed(2);
        } else if (valColetar) {
            window.calcularPorcentagemDeColetar();
        }
    };

    // --- 3. TABELA DE PREÇOS ---
    let settingsPrecos = {};
    let visualizacaoTabelaPrecos = 'completa';

    window.initApexPrecos = function() {
        window.carregarPrecos();
    };

    window.carregarPrecos = async function() {
        try {
            const res = await fetch('/api/tabela-precos', { cache: 'no-store' });
            localPrecos = await res.json();
            
            try {
                const resSet = await fetch('/api/settings');
                settingsPrecos = await resSet.json();
            } catch (e) {
                console.error('Erro ao carregar settings para precos:', e);
            }

            renderTabelaPrecos();
        } catch (err) {
            console.error(err);
        }
    };

    window.alterarCorCategoria = async function(cat, cor) {
        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [`cor_categoria_${cat}`]: cor })
            });
            settingsPrecos[`cor_categoria_${cat}`] = cor;
            renderTabelaPrecos();
        } catch (err) {
            console.error('Erro ao atualizar cor da categoria:', err);
        }
    };

    window.alterarVisualizacaoTabela = function(tipo) {
        visualizacaoTabelaPrecos = tipo;
        renderTabelaPrecos();
    };

    window.alternarModoApresentacao = function() {
        const view = document.getElementById('tabela-precos-view');
        if (!view) return;
        
        const ativo = view.classList.toggle('modo-apresentacao-ativo');
        
        const btnToggle = document.getElementById('btn-toggle-apresentacao');
        const btnFechar = document.getElementById('btn-fechar-apresentacao');
        
        if (ativo) {
            if (btnToggle) btnToggle.style.display = 'none';
            if (btnFechar) btnFechar.style.display = 'inline-flex';
            window.addEventListener('keydown', escApresentacaoHandler);
        } else {
            if (btnToggle) btnToggle.style.display = 'inline-flex';
            if (btnFechar) btnFechar.style.display = 'none';
            window.removeEventListener('keydown', escApresentacaoHandler);
        }
    };

    function escApresentacaoHandler(e) {
        if (e.key === 'Escape') {
            window.alternarModoApresentacao();
        }
    }

    function renderTabelaPrecos() {
        const container = document.getElementById('tabela-precos-categorias-container');
        if (!container) return;
        container.innerHTML = '';

        // Agrupar por categorias
        let categorias = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
        if (settingsPrecos && settingsPrecos['categorias_materiais']) {
            try {
                categorias = JSON.parse(settingsPrecos['categorias_materiais']);
            } catch(e) {}
        }
        localPrecos.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) {
                categorias.push(p.material_categoria);
            }
        });
        const showCompleta = visualizacaoTabelaPrecos === 'completa';

        categorias.forEach(cat => {
            const precosCat = localPrecos.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;

            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = settingsPrecos[`cor_categoria_${cat}`] || '#1e4e8c';

            const box = document.createElement('div');
            box.className = 'categoria-preco-box';
            box.style.borderColor = corCategoria;
            box.innerHTML = `
                <div class="categoria-preco-header" style="background: ${corCategoria};">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${cat.toUpperCase()}</span>
                        <input type="color" value="${corCategoria}" title="Alterar cor do cabeçalho" style="border:none; background:none; cursor:pointer; width:22px; height:22px; padding:0; outline:none; border-radius:4px; vertical-align:middle;" onchange="alterarCorCategoria('${cat}', this.value)">
                    </div>
                    <button type="button" class="restrito-financeiro" onclick="abrirModalVigenciaGeral()" title="Clique para alterar a vigência geral com calendário" style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.32)'" onmouseout="this.style.background='rgba(255,255,255,0.18)'"><i class="fa-solid fa-calendar-days"></i> VIGÊNCIA ATÉ: ${validadeStr} <i class="fa-solid fa-pen-to-square" style="font-size:0.78rem; opacity:0.8;"></i></button>
                </div>
                <div class="categoria-preco-observacao">
                    <i class="fa-solid fa-circle-info"></i> Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg. | OBS: Variação de preço conforme atualização de mercado.
                </div>
                <div style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#172635; text-align:left;">
                                <th style="padding:10px;">Descrição</th>
                                <th style="padding:10px; text-align:right;">Preço Entregar (R$/kg)</th>
                                <th style="padding:10px; text-align:right;">Preço Coletar (R$/kg)</th>
                                ${showCompleta ? `
                                <th style="padding:10px; text-align:right; color: #ffeb3b;">Venda Ref (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color: #aaa;">Comissão (%)</th>
                                <th style="padding:10px; text-align:right; color: #aaa;">PIS/COFINS (%)</th>
                                <th style="padding:10px; text-align:right; color: #aaa;">FIDC (%)</th>
                                <th style="padding:10px; text-align:right; color: #aaa;">ICMS (%)</th>
                                <th style="padding:10px; text-align:right; color: #aaa;">Frete Coleta (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color: #4fc3f7;">Venda Líquida (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#2AD07A;">Lucro Líq. Ent.</th>
                                <th style="padding:10px; text-align:right; color:#2AD07A;">Margem Líq. Ent (%)</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Lucro Líq. Col.</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Margem Líq. Col (%)</th>
                                ` : ''}
                                <th style="padding:10px;">NCM</th>
                                <th style="padding:10px; text-align:center; width:150px; min-width:150px; position:sticky; right:0; background:#172635; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${precosCat.map((p, idx) => {
                                const comissao = parseFloat(p.comissao || 0);
                                const pisCofins = parseFloat(p.pis_cofins || 0);
                                const fidc = parseFloat(p.fidc || 0);
                                const icms = parseFloat(p.icms || 0);
                                const freteColeta = parseFloat(p.frete_coleta || 0);

                                const totalDedPct = comissao + pisCofins + fidc + icms;
                                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;

                                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;

                                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;

                                const bgRow = idx % 2 === 0 ? 'background:#0d1826;' : 'background:#16273b;';
                                const bgHover = '#1f4068';

                                return `
                                    <tr style="${bgRow} border-bottom:1px solid #1e3650; transition:background 0.15s;" onmouseover="this.style.background='${bgHover}'" onmouseout="this.style.background='${idx % 2 === 0 ? '#0d1826' : '#16273b'}'">
                                        <td style="padding:10px; color:#fff;"><strong>${p.material_nome}</strong></td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_entregar)}</td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_coletar)}</td>
                                        ${showCompleta ? `
                                        <td style="padding:10px; text-align:right; color: #ffeb3b; font-weight: bold;">R$ ${fmtBRL(p.venda_ref)}</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(comissao)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(pisCofins)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(fidc)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(icms)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">R$ ${fmtBRL(freteColeta)}</td>
                                        <td style="padding:10px; text-align:right; color:#4fc3f7; font-weight:bold;">R$ ${fmtBRL(vendaLiquida)}</td>
                                        <td style="padding:10px; text-align:right; color:#2AD07A;">R$ ${fmtBRL(lucroEnt)}</td>
                                        <td style="padding:10px; text-align:right; color:#2AD07A; font-weight:bold;">${fmtBRL(margemEnt)}%</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1;">R$ ${fmtBRL(lucroCol)}</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1; font-weight:bold;">${fmtBRL(margemCol)}%</td>
                                        ` : ''}
                                        <td style="padding:10px; color:#fff; font-weight:bold;">${p.material_ncm || '-'}</td>
                                        <td style="padding:6px 8px; text-align:center; position:sticky; right:0; background:${idx % 2 === 0 ? '#0d1826' : '#16273b'}; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">
                                            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                <button class="btn-secondary restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#1e4e8c; color:#fff; border:1px solid #3e7cb1; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px; font-weight:600; white-space:nowrap;" onclick="editarPreco(${p.id})" title="Editar valores deste material">
                                                    <i class="fa-solid fa-pen-to-square"></i> Editar
                                                </button>
                                                <button class="btn-danger restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#c0392b; color:#fff; border:1px solid #e74c3c; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px; font-weight:600; white-space:nowrap;" onclick="deletarPreco(${p.id})" title="Excluir item da tabela">
                                                    <i class="fa-solid fa-trash"></i> Excluir
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:#131c26;">
                                <td colspan="${showCompleta ? 16 : 5}" style="padding:10px; text-align:right; font-style:italic; color:#aaa;">
                                    DEMAIS MATERIAIS PREÇO SOBRE ANÁLISE (FOTO)
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(box);
        });
        applyRolePermissions();
    }

    window.abrirModalPreco = function() {
        document.getElementById('form-preco-apex').reset();
        document.getElementById('prc-id').value = '';
        document.getElementById('prc-entregar-pct').value = '';
        document.getElementById('prc-coletar-pct').value = '';
        document.getElementById('modal-preco').style.display = 'flex';
        window.calcularMargemLiquidaModal();
    };

    window.fecharModalPreco = function() {
        document.getElementById('modal-preco').style.display = 'none';
    };

    window.calcularMargemLiquidaModal = function() {
        const parseVal = id => parseFloat(String(document.getElementById(id)?.value || '0').replace(',', '.')) || 0;
        const vendaRef = parseVal('prc-venda');
        const precoEnt = parseVal('prc-entregar');
        const precoCol = parseVal('prc-coletar');
        const comissao = parseVal('prc-comissao');
        const pisCofins = parseVal('prc-piscofins');
        const fidc = parseVal('prc-fidc');
        const icms = parseVal('prc-icms');
        const freteColeta = parseVal('prc-frete-coleta');

        const pctDeducoesTotal = comissao + pisCofins + fidc + icms;
        const valDeducoes = vendaRef * (pctDeducoesTotal / 100);
        const vendaLiquida = vendaRef - valDeducoes;

        const lucroEnt = vendaLiquida - precoEnt;
        const margemEnt = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;

        const lucroCol = vendaLiquida - precoCol - freteColeta;
        const margemCol = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;

        const elDedPct = document.getElementById('prc-live-deducoes-pct');
        const elVendaLiq = document.getElementById('prc-live-venda-liquida');
        const elFreteDisp = document.getElementById('prc-live-frete-display');
        const elMargEnt = document.getElementById('prc-live-margem-entrega');
        const elLucrEnt = document.getElementById('prc-live-lucro-entrega');
        const elMargCol = document.getElementById('prc-live-margem-coleta');
        const elLucrCol = document.getElementById('prc-live-lucro-coleta');

        if (elDedPct) elDedPct.textContent = `${fmtBRL(pctDeducoesTotal)}% (R$ ${fmtBRL(valDeducoes)}/kg)`;
        if (elVendaLiq) elVendaLiq.textContent = `R$ ${fmtBRL(vendaLiquida)}/kg`;
        if (elFreteDisp) elFreteDisp.textContent = `R$ ${fmtBRL(freteColeta)}/kg`;

        if (elMargEnt) {
            elMargEnt.textContent = `${fmtBRL(margemEnt)}%`;
            elMargEnt.style.color = margemEnt >= 15 ? '#2AD07A' : (margemEnt >= 5 ? '#f0b800' : '#ff4d4d');
        }
        if (elLucrEnt) elLucrEnt.textContent = `Lucro: R$ ${fmtBRL(lucroEnt)}/kg`;

        if (elMargCol) {
            elMargCol.textContent = `${fmtBRL(margemCol)}%`;
            elMargCol.style.color = margemCol >= 15 ? '#4fc3f7' : (margemCol >= 5 ? '#f0b800' : '#ff4d4d');
        }
        if (elLucrCol) elLucrCol.textContent = `Lucro: R$ ${fmtBRL(lucroCol)}/kg`;
    };

    window.editarPreco = function(id) {
        const p = localPrecos.find(x => x.id === id);
        if (!p) return;
        document.getElementById('prc-id').value = p.id;
        document.getElementById('prc-material').value = p.material_id;
        document.getElementById('prc-entregar').value = parseFloat(p.preco_entregar || 0).toFixed(2);
        document.getElementById('prc-coletar').value = parseFloat(p.preco_coletar || 0).toFixed(2);
        document.getElementById('prc-venda').value = parseFloat(p.venda_ref || 0).toFixed(2);
        document.getElementById('prc-comissao').value = parseFloat(p.comissao || 0).toFixed(2);
        document.getElementById('prc-piscofins').value = parseFloat(p.pis_cofins || 0).toFixed(2);
        document.getElementById('prc-fidc').value = parseFloat(p.fidc || 0).toFixed(2);
        document.getElementById('prc-icms').value = parseFloat(p.icms || 0).toFixed(2);
        document.getElementById('prc-frete-coleta').value = parseFloat(p.frete_coleta || 0).toFixed(2);
        document.getElementById('prc-validade').value = p.validade ? p.validade.split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('modal-preco').style.display = 'flex';
        window.calcularPorcentagemDeEntregar();
        window.calcularPorcentagemDeColetar();
        window.calcularMargemLiquidaModal();
    };

    window.salvarPreco = async function(e) {
        e.preventDefault();
        const id = document.getElementById('prc-id').value;
        const parseVal = v => parseFloat(String(v || '0').replace(',', '.')) || 0;

        const data = {
            material_id: document.getElementById('prc-material').value,
            preco_entregar: parseVal(document.getElementById('prc-entregar').value),
            preco_coletar: parseVal(document.getElementById('prc-coletar').value),
            venda_ref: parseVal(document.getElementById('prc-venda').value),
            comissao: parseVal(document.getElementById('prc-comissao').value),
            pis_cofins: parseVal(document.getElementById('prc-piscofins').value),
            fidc: parseVal(document.getElementById('prc-fidc').value),
            icms: parseVal(document.getElementById('prc-icms').value),
            frete_coleta: parseVal(document.getElementById('prc-frete-coleta').value),
            validade: document.getElementById('prc-validade').value,
            aplicar_todos: true
        };

        const btn = e.target.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }

        try {
            const url = id ? `/api/tabela-precos/${id}` : '/api/tabela-precos';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            fecharModalPreco();
            carregarPrecos();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao salvar preço: ' + err.message, 'error');
            console.error(err);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar'; }
        }
    };

    // ─── Calendário Visual Interativo de Vigência ───
    let calVigenciaAno = 2026;
    let calVigenciaMes = 6;
    let calVigenciaDataSelecionada = new Date().toISOString().split('T')[0];
    const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    window.renderCalendarioVigencia = function() {
        const titulo = document.getElementById('cal-vigencia-titulo');
        const grid = document.getElementById('cal-vigencia-grid');
        const preview = document.getElementById('cal-vigencia-data-formatada');
        const inputHidden = document.getElementById('input-vigencia-geral-data');
        if (!grid) return;

        if (titulo) {
            titulo.textContent = `${mesesNomes[calVigenciaMes]} ${calVigenciaAno}`;
        }

        const firstDay = new Date(calVigenciaAno, calVigenciaMes, 1).getDay();
        const totalDays = new Date(calVigenciaAno, calVigenciaMes + 1, 0).getDate();
        const prevMonthTotalDays = new Date(calVigenciaAno, calVigenciaMes, 0).getDate();

        let html = '';

        for (let i = firstDay - 1; i >= 0; i--) {
            const diaPrev = prevMonthTotalDays - i;
            html += `<div style="background:#0d1824; color:#3a526a; padding:11px 0; text-align:center; font-size:0.9rem; user-select:none;">${diaPrev}</div>`;
        }

        for (let day = 1; day <= totalDays; day++) {
            const monthStr = String(calVigenciaMes + 1).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            const ymd = `${calVigenciaAno}-${monthStr}-${dayStr}`;

            const isSelected = ymd === calVigenciaDataSelecionada;
            const bgCell = isSelected ? '#2AD07A' : '#132232';
            const textCell = isSelected ? '#000' : '#fff';
            const fontWeight = isSelected ? 'bold' : '500';

            html += `
                <div onclick="selecionarDiaCalendarioVigencia('${ymd}')"
                     style="background:${bgCell}; color:${textCell}; font-weight:${fontWeight}; padding:11px 0; text-align:center; font-size:0.92rem; cursor:pointer; transition:all 0.15s; border-radius:4px;"
                     onmouseover="if('${ymd}'!=='${calVigenciaDataSelecionada}') this.style.background='#1e3b56'"
                     onmouseout="if('${ymd}'!=='${calVigenciaDataSelecionada}') this.style.background='#132232'">
                    ${day}
                </div>
            `;
        }

        const totalCellsSoFar = firstDay + totalDays;
        const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
        for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
            html += `<div style="background:#0d1824; color:#3a526a; padding:11px 0; text-align:center; font-size:0.9rem; user-select:none;">${nextDay}</div>`;
        }

        grid.innerHTML = html;

        if (inputHidden) inputHidden.value = calVigenciaDataSelecionada;
        if (preview) preview.textContent = window.formatarDataSemFuso(calVigenciaDataSelecionada);
    };

    window.navCalendarioVigencia = function(dir) {
        calVigenciaMes += dir;
        if (calVigenciaMes < 0) {
            calVigenciaMes = 11;
            calVigenciaAno--;
        } else if (calVigenciaMes > 11) {
            calVigenciaMes = 0;
            calVigenciaAno++;
        }
        renderCalendarioVigencia();
    };

    window.selecionarDiaCalendarioVigencia = function(ymd) {
        calVigenciaDataSelecionada = ymd;
        renderCalendarioVigencia();
    };

    window.abrirModalVigenciaGeral = function(tipo = 'vigente') {
        window.vigenciaGeralTipoAtual = tipo;
        let dataAtual = new Date().toISOString().split('T')[0];
        if (tipo === 'vigente' && localPrecos.length) dataAtual = localPrecos[0].validade.split('T')[0];
        else if (tipo === 'residuo' && localPrecosResiduos.length) dataAtual = localPrecosResiduos[0].validade.split('T')[0];
        else if (tipo === 'liga' && localPrecosLigas.length) dataAtual = localPrecosLigas[0].validade.split('T')[0];
        else if (tipo === 'volume' && localPrecosVolume.length) dataAtual = localPrecosVolume[0].validade.split('T')[0];
        else if (tipo === 'fundicao' && localPrecosFundicao.length) dataAtual = localPrecosFundicao[0].validade.split('T')[0];

        calVigenciaDataSelecionada = dataAtual;
        const parts = dataAtual.split('-');
        if (parts.length === 3) {
            calVigenciaAno = parseInt(parts[0]);
            calVigenciaMes = parseInt(parts[1]) - 1;
        }
        renderCalendarioVigencia();
        document.getElementById('modal-vigencia-geral').style.display = 'flex';
    };

    window.fecharModalVigenciaGeral = function() {
        document.getElementById('modal-vigencia-geral').style.display = 'none';
    };

    window.salvarVigenciaGeralModal = async function() {
        const novaData = calVigenciaDataSelecionada || document.getElementById('input-vigencia-geral-data').value;
        if (!novaData) {
            _apexNotify('Sistema', 'Por favor, clique em um dia no calendário.', 'info');
            return;
        }
        const tipo = window.vigenciaGeralTipoAtual || 'vigente';
        let url = '/api/tabela-precos-validade-geral';
        if (tipo === 'residuo') url = '/api/tabela-precos-residuos-validade';
        else if (tipo === 'liga') url = '/api/tabela-precos-ligas-validade';
        else if (tipo === 'volume') url = '/api/tabela-precos-volume-validade';
        else if (tipo === 'fundicao') url = '/api/tabela-precos-fundicao-validade';

        const btn = document.getElementById('btn-salvar-vigencia-geral');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spin fa-spinner"></i> Salvando...'; }
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ validade: novaData })
            });
            if (!res.ok) throw new Error(await res.text());
            fecharModalVigenciaGeral();
            _apexNotify('Sistema', 'Vigência atualizada para todos os materiais com sucesso!', 'info');
            if (tipo === 'vigente') await carregarPrecos();
            else if (tipo === 'residuo') carregarPrecosResiduos();
            else if (tipo === 'liga') carregarPrecosLigas();
            else if (tipo === 'volume') carregarPrecosVolume();
            else if (tipo === 'fundicao') carregarPrecosFundicao();
        } catch (err) {
            _apexNotify('Atenção', 'Erro ao atualizar vigência geral: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Aplicar e Salvar Vigência'; }
        }
    };

    window.alterarValidadeGeralPrompt = function() {
        abrirModalVigenciaGeral('vigente');
    };

    window.deletarPreco = async function(id) {
        if (!confirm('Excluir este preço?')) return;
        try {
            await fetch(`/api/tabela-precos/${id}`, { method: 'DELETE' });
            carregarPrecos();
        } catch (err) {
            console.error(err);
        }
    };

    window.exportarTabelaPrecosExcel = function() {
        _apexNotify('Sistema', 'Tabela de Preços exportada com sucesso (LME-ApexTech-Precos.xlsx)', 'info');
    };

    function gerarHtmlTabelaPrecosParaPdf(precos, dataUltimaAtualizacao, settings, logoBase64, modo = 'fornecedor') {
        const activeSettings = settings || settingsPrecos || {};
        const isCompleta = modo === 'completa';
        let categorias = ["Alumínio", "Cobre", "Tomada/Conectores", "Chumbo", "Latão/Bronze", "Zamac", "Aço", "Outros"];
        if (activeSettings && activeSettings['categorias_materiais']) {
            try {
                categorias = JSON.parse(activeSettings['categorias_materiais']);
            } catch(e) {}
        }
        precos.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) {
                categorias.push(p.material_categoria);
            }
        });


        const tituloPdf = isCompleta ? 'Tabela Geral de Preços Vigente (Visão Completa)' : 'Tabela de Preços Vigente';
        const maxWidthContainer = '100%';
        // Marca d'água aplicada diretamente no container (zero elementos extras, zero altura extra)
        const wmStyle = logoBase64
            ? `background-image: url('${logoBase64}'); background-repeat: repeat; background-size: 200px auto; background-position: 0 0;`
            : '';

        let html = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 25px; color: #333; background-color: #ffffff; ${wmStyle} width: ${maxWidthContainer}; margin: 0 auto; box-sizing: border-box; position: relative;">
                <div style="position: relative; z-index: 1;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e4e8c; padding-bottom: 20px; margin-bottom: 25px;">
                        <div>
                            <img src="assets/img/apexlogo.png" alt="ApexTech Metais" style="height: 60px;">
                        </div>
                        <div style="text-align: right;">
                            <h1 style="margin: 0; color: #1e4e8c; font-size: ${isCompleta ? '1.6rem' : '1.8rem'}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${tituloPdf}</h1>
                            <p style="margin: 6px 0 0 0; font-size: 0.95rem; color: #666; font-weight: 500;">Última Atualização: <span style="color: #1e4e8c; font-weight: bold;">${dataUltimaAtualizacao}</span></p>
                        </div>
                    </div>

                    <!-- Diretrizes -->
                    <div style="background: #f4f7fa; border-left: 5px solid #1e4e8c; border-radius: 4px; padding: 15px; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <h4 style="margin: 0 0 10px 0; color: #1e4e8c; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                            ⚠️ Diretrizes Gerais de Compra
                        </h4>
                        <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; color: #444; line-height: 1.5;">
                            <li>Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg.</li>
                            <li>OBS: Variação de preço conforme atualização de mercado.</li>
                            <li style="font-weight: bold; color: #c0392b;">DEMAIS MATERIAIS PREÇO SOBRE ANÁLISE (FOTO)</li>
                        </ul>
                    </div>
        `;

        categorias.forEach(cat => {
            const precosCat = precos.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;

            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = (activeSettings && activeSettings[`cor_categoria_${cat}`]) || '#1e4e8c';

            html += `
                <div style="margin-bottom: 30px; border: 1px solid ${corCategoria}; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="background: ${corCategoria}; color: #ffffff; padding: 10px 15px; font-weight: bold; display: flex; justify-content: space-between; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <span>${cat}</span>
                        <span style="font-size: 0.85rem; font-weight: normal; opacity: 0.9;">VIGÊNCIA ATÉ: ${validadeStr}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: ${isCompleta ? '0.75rem' : '0.8rem'}; text-align: left;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #ddd;">
                                <th style="padding: 8px; border: 1px solid #eee; font-weight: 600; color: #555;">Descrição</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">Preço Entregar (R$/kg)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">Preço Coletar (R$/kg)</th>
                                ${isCompleta ? `
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #d97706;">Venda Ref (R$/kg)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">Comissão (%)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">PIS/COFINS (%)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">FIDC (%)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">ICMS (%)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #555;">Frete Coleta</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #0284c7;">Venda Líq.</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #16a34a;">Lucro Líq. Ent.</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #16a34a;">Margem Ent (%)</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #2563eb;">Lucro Líq. Col.</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #eee; font-weight: 600; color: #2563eb;">Margem Col (%)</th>
                                ` : ''}
                                <th style="padding: 8px; border: 1px solid #eee; font-weight: 600; color: #555;">NCM</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            precosCat.forEach((p, idx) => {
                const comissao = parseFloat(p.comissao || 0);
                const pisCofins = parseFloat(p.pis_cofins || 0);
                const fidc = parseFloat(p.fidc || 0);
                const icms = parseFloat(p.icms || 0);
                const freteColeta = parseFloat(p.frete_coleta || 0);

                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;

                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;

                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;

                const bgRow = idx % 2 === 0 ? '#ffffff' : '#e3ebf3';
                html += `
                    <tr style="border-bottom: 1px solid #c8d3e0; background-color: ${bgRow}; page-break-inside: avoid;">
                        <td style="padding: 8px; border: 1px solid #c8d3e0; color: #111;"><strong>${p.material_nome}</strong></td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; font-weight: bold; color: #111;">R$ ${fmtBRL(p.preco_entregar)}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; font-weight: bold; color: #111;">R$ ${fmtBRL(p.preco_coletar)}</td>
                        ${isCompleta ? `
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; font-weight: bold; color: #d97706;">R$ ${fmtBRL(p.venda_ref)}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #444;">${fmtBRL(comissao)}%</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #444;">${fmtBRL(pisCofins)}%</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #444;">${fmtBRL(fidc)}%</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #444;">${fmtBRL(icms)}%</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #444;">R$ ${fmtBRL(freteColeta)}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; font-weight: bold; color: #0284c7;">R$ ${fmtBRL(vendaLiquida)}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #16a34a;">R$ ${fmtBRL(lucroEnt)}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; font-weight: bold; color: #16a34a;">${fmtBRL(margemEnt)}%</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; color: #2563eb;">R$ ${fmtBRL(lucroCol)}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #c8d3e0; font-weight: bold; color: #2563eb;">${fmtBRL(margemCol)}%</td>
                        ` : ''}
                        <td style="padding: 8px; border: 1px solid #c8d3e0; color: #111; font-weight: bold;">${p.material_ncm || '-'}</td>
                    </tr>
                `;
            });

            html += `
                            <tr style="background: #fafafa;">
                                <td colspan="${isCompleta ? 15 : 4}" style="padding: 10px; text-align: right; font-style: italic; color: #777; border: 1px solid #eee;">
                                    DEMAIS MATERIAIS PREÇO SOBRE ANÁLISE (FOTO)
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });

        // Footer with CEO Jose Tiago and date
        html += `
                    <div style="margin-top: 40px; border-top: 2px solid #ddd; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #555;">
                        <div style="font-weight: bold; color: #1e4e8c; font-size: 0.95rem;">
                            ✅ Aprovado pelo CEO Jose Tiago
                        </div>
                        <div style="text-align: right; color: #888;">
                            Documento oficial ApexTech Metais • Gerado em: ${new Date().toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        return html;
    }

    window.gerarPdfTabelaPrecosBase64 = async function(modo) {
        const modoPDF = modo || visualizacaoTabelaPrecos || 'fornecedor';
        let precos = localPrecos;
        if (!precos || precos.length === 0) {
            const res = await fetch('/api/tabela-precos', { cache: 'no-store' });
            precos = await res.json();
        }
        
        let lastUpdate = '';
        let settings = {};
        try {
            const resSet = await fetch('/api/settings');
            settings = await resSet.json();
            lastUpdate = settings.tabela_precos_ultima_atualizacao || '';
        } catch (e) {
            console.error(e);
        }
        if (!lastUpdate) {
            const today = new Date();
            lastUpdate = today.toLocaleDateString('pt-BR');
        }

        const isCompleta = modoPDF === 'completa';
        
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
        } catch(e) {
            console.warn('Logo watermark não carregou, usando fallback:', e);
        }

        // Reduz opacidade da logo para 7% (marca d'água sutil) via canvas
        let fadedLogo = null;
        if (logoWatermarkBase64) {
            fadedLogo = await new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const c = document.createElement('canvas');
                    c.width = img.width; c.height = img.height;
                    const ctx = c.getContext('2d');
                    ctx.globalAlpha = 0.07;
                    ctx.drawImage(img, 0, 0);
                    resolve(c.toDataURL('image/png'));
                };
                img.onerror = () => resolve(null);
                img.src = logoWatermarkBase64;
            });
        }

        const htmlContent = gerarHtmlTabelaPrecosParaPdf(precos, lastUpdate, settings, fadedLogo, modoPDF);
        return await renderHtmlToPdfBase64(htmlContent, modoPDF === 'completa');
    };

    window.exportarTabelaPrecosPdf = async function(modo) {
        const modoPDF = modo || visualizacaoTabelaPrecos || 'fornecedor';
        const isCompleta = modoPDF === 'completa';
        const btnSelector = isCompleta ? '.btn-secondary[onclick*="exportarTabelaPrecosPdf(\'completa\')"]' : '.btn-secondary[onclick*="exportarTabelaPrecosPdf(\'fornecedor\')"]';
        const btn = document.querySelector(btnSelector) || document.querySelector('.btn-secondary[onclick*="exportarTabelaPrecosPdf"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando PDF...';
        }
        try {
            const base64 = await window.gerarPdfTabelaPrecosBase64(modoPDF);
            if (!base64) {
                _apexNotify('Atenção', 'Erro ao gerar o PDF da tabela de preços.', 'error');
                return;
            }
            const linkSource = `data:application/pdf;base64,${base64}`;
            const downloadLink = document.createElement("a");
            downloadLink.href = linkSource;
            const nomeArquivo = isCompleta ? 'Tabela_de_Precos_Geral_Completa.pdf' : 'Tabela_de_Precos_Fornecedor.pdf';
            downloadLink.download = nomeArquivo;
            downloadLink.click();
        } catch (err) {
            console.error(err);
            _apexNotify('Atenção', 'Erro ao exportar PDF: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = isCompleta 
                    ? '<i class="fa-solid fa-file-pdf" style="color: #ff4d4d;"></i> PDF Tabela Geral' 
                    : '<i class="fa-solid fa-file-pdf" style="color: #2AD07A;"></i> PDF Fornecedor';
            }
        }
    };

    window.enviarTabelaPrecosEmail = async function(modo, emailDestino) {
        const testEmailMsg = document.getElementById('test-email-msg');
        const modoPDF = modo || visualizacaoTabelaPrecos || 'fornecedor';
        const isCompleta = modoPDF === 'completa';
        const nomeModo = isCompleta ? 'Geral Completa' : 'Fornecedor';

        const btnPreco = document.querySelector(`.btn-secondary[onclick="enviarTabelaPrecosEmail('${modoPDF}')"]`) || document.querySelector('.btn-secondary[onclick*="enviarTabelaPrecosEmail"]');
        const btnConfig = document.getElementById('btn-enviar-tabela-preco') || document.getElementById('btn-enviar-tabela-completa') || document.getElementById('btn-enviar-tabela-fornecedor');
        
        const setUIState = (loading, msg = '', color = '#fff') => {
            if (testEmailMsg) {
                testEmailMsg.style.display = loading || msg ? 'block' : 'none';
                testEmailMsg.style.color = color;
                testEmailMsg.innerHTML = msg;
            }
            if (btnPreco) btnPreco.disabled = loading;
            if (btnConfig) btnConfig.disabled = loading;
        };

        const destText = emailDestino ? `para ${emailDestino}` : 'para os destinatários cadastrados';
        setUIState(true, `<i class="fa-solid fa-spinner fa-spin"></i> Gerando PDF (${nomeModo}) e enviando ${destText}...`);

        try {
            const pdfBase64 = await window.gerarPdfTabelaPrecosBase64(modoPDF);
            if (!pdfBase64) {
                throw new Error('Falha ao gerar o PDF da tabela de preços.');
            }

            const res = await fetch('/api/tabela-precos/enviar-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfBase64, modo: modoPDF, email: emailDestino })
            });

            const result = await res.json();
            if (res.ok) {
                setUIState(false, '<i class="fa-solid fa-circle-check"></i> ' + (result.message || `Tabela de preços (${nomeModo}) enviada com sucesso!`), '#2AD07A');
                _apexNotify('Sistema', `✅ Tabela de preços (${nomeModo}) enviada por e-mail ${destText} com sucesso!`, 'info');
            } else {
                throw new Error(result.error || 'Erro desconhecido ao enviar e-mail.');
            }
        } catch (err) {
            console.error(err);
            setUIState(false, '<i class="fa-solid fa-circle-exclamation"></i> ' + err.message, '#ff4d4d');
            _apexNotify('Atenção', '❌ Erro ao enviar e-mail: ' + err.message, 'error');
        }
    };

    // --- 3b. TABELA DE PREÇOS — RESÍDUOS ---
    let localPrecosResiduos = [];
    let settingsPrecosResiduos = {};
    let visualizacaoResiduos = 'completa';

    window.initApexPrecosResiduos = function() {
        window.carregarPrecosResiduos();
    };

    window.carregarPrecosResiduos = async function() {
        try {
            const res = await fetch('/api/tabela-precos-residuos', { cache: 'no-store' });
            localPrecosResiduos = await res.json();
            try {
                const resSet = await fetch('/api/settings');
                settingsPrecosResiduos = await resSet.json();
            } catch(e) {}
            renderTabelaPrecosResiduos();
        } catch(err) { console.error('Erro carregarPrecosResiduos:', err); }
    };

    window.alterarVisualizacaoResiduo = function(tipo) {
        visualizacaoResiduos = tipo;
        renderTabelaPrecosResiduos();
    };

    function renderTabelaPrecosResiduos() {
        const container = document.getElementById('residuos-precos-categorias-container');
        if (!container) return;
        container.innerHTML = '';

        const categorias = [];
        localPrecosResiduos.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) {
                categorias.push(p.material_categoria);
            }
        });
        if (categorias.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:60px; color:#aaa;"><i class="fa-solid fa-recycle" style="font-size:2rem; margin-bottom:16px; display:block; color:#2AD07A;"></i>Nenhum resíduo cadastrado ainda. Clique em <strong>Novo Item de Preço</strong> para começar.</div>';
            return;
        }

        const showCompleta = visualizacaoResiduos === 'completa';

        categorias.forEach(cat => {
            const precosCat = localPrecosResiduos.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = settingsPrecosResiduos[`cor_categoria_residuo_${cat}`] || '#2AD07A';

            const box = document.createElement('div');
            box.className = 'categoria-preco-box';
            box.style.borderColor = corCategoria;
            box.innerHTML = `
                <div class="categoria-preco-header" style="background: ${corCategoria};">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${cat.toUpperCase()}</span>
                        <input type="color" value="${corCategoria}" title="Alterar cor" style="border:none; background:none; cursor:pointer; width:22px; height:22px; padding:0; outline:none; border-radius:4px; vertical-align:middle;" onchange="alterarCorCategoriaResiduo('${cat}', this.value)">
                    </div>
                    <button type="button" class="restrito-financeiro" onclick="alterarValidadeGeralResiduo()" style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-calendar-days"></i> VIGÊNCIA ATÉ: ${validadeStr} <i class="fa-solid fa-pen-to-square" style="font-size:0.78rem;"></i>
                    </button>
                </div>
                <div class="categoria-preco-observacao">
                    <i class="fa-solid fa-circle-info"></i> Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg. | OBS: Variação de preço conforme atualização de mercado.
                </div>
                <div style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#172635; text-align:left;">
                                <th style="padding:10px;">Descrição</th>
                                <th style="padding:10px; text-align:right;">Preço Entregar (R$/kg)</th>
                                <th style="padding:10px; text-align:right;">Preço Coletar (R$/kg)</th>
                                ${showCompleta ? `
                                <th style="padding:10px; text-align:right; color:#ffeb3b;">Venda Ref (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Comissão (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">PIS/COFINS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">FIDC (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">ICMS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Frete Coleta (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#4fc3f7;">Venda Líquida (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#2AD07A;">Lucro Líq. Ent.</th>
                                <th style="padding:10px; text-align:right; color:#2AD07A;">Margem Líq. Ent (%)</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Lucro Líq. Col.</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Margem Líq. Col (%)</th>
                                ` : ''}
                                <th style="padding:10px;">NCM</th>
                                <th style="padding:10px; text-align:center; width:150px; min-width:150px; position:sticky; right:0; background:#172635; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${precosCat.map((p, idx) => {
                                const comissao = parseFloat(p.comissao || 0);
                                const pisCofins = parseFloat(p.pis_cofins || 0);
                                const fidc = parseFloat(p.fidc || 0);
                                const icms = parseFloat(p.icms || 0);
                                const freteColeta = parseFloat(p.frete_coleta || 0);
                                const totalDedPct = comissao + pisCofins + fidc + icms;
                                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const bgRow = idx % 2 === 0 ? 'background:#0d1826;' : 'background:#16273b;';
                                return `
                                    <tr style="${bgRow} border-bottom:1px solid #1e3650; transition:background 0.15s;" onmouseover="this.style.background='#1f4068'" onmouseout="this.style.background='${idx % 2 === 0 ? '#0d1826' : '#16273b'}'">
                                        <td style="padding:10px; color:#fff;"><strong>${p.material_nome}</strong></td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_entregar)}</td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_coletar)}</td>
                                        ${showCompleta ? `
                                        <td style="padding:10px; text-align:right; color:#ffeb3b; font-weight:bold;">R$ ${fmtBRL(p.venda_ref)}</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(comissao)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(pisCofins)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(fidc)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(icms)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">R$ ${fmtBRL(freteColeta)}</td>
                                        <td style="padding:10px; text-align:right; color:#4fc3f7; font-weight:bold;">R$ ${fmtBRL(vendaLiquida)}</td>
                                        <td style="padding:10px; text-align:right; color:#2AD07A;">R$ ${fmtBRL(lucroEnt)}</td>
                                        <td style="padding:10px; text-align:right; color:#2AD07A; font-weight:bold;">${fmtBRL(margemEnt)}%</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1;">R$ ${fmtBRL(lucroCol)}</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1; font-weight:bold;">${fmtBRL(margemCol)}%</td>
                                        ` : ''}
                                        <td style="padding:10px; color:#fff; font-weight:bold;">${p.material_ncm || '-'}</td>
                                        <td style="padding:6px 8px; text-align:center; position:sticky; right:0; background:${idx % 2 === 0 ? '#0d1826' : '#16273b'}; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">
                                            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                <button class="btn-secondary restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#1a5c38; color:#fff; border:1px solid #2AD07A; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="editarPrecoResiduo(${p.id})"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                                                <button class="btn-danger restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#c0392b; color:#fff; border:1px solid #e74c3c; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="deletarPrecoResiduo(${p.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:#131c26;">
                                <td colspan="${showCompleta ? 16 : 5}" style="padding:10px; text-align:right; font-style:italic; color:#aaa;">DEMAIS RESÍDUOS PREÇO SOBRE ANÁLISE (FOTO)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(box);
        });
        applyRolePermissions();
    }

    window.alterarCorCategoriaResiduo = async function(cat, cor) {
        try {
            await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [`cor_categoria_residuo_${cat}`]: cor }) });
            settingsPrecosResiduos[`cor_categoria_residuo_${cat}`] = cor;
            renderTabelaPrecosResiduos();
        } catch(e) { console.error(e); }
    };

    window.popularSelectMateriaisModal = function(idSelect) {
        const el = document.getElementById(idSelect);
        if (!el) return;
        const mats = window.localMateriais && window.localMateriais.length > 0
            ? window.localMateriais
            : localMateriais;
            
        let filteredMats = mats;
        if (idSelect === 'prc-res-material-id') {
            filteredMats = mats.filter(m => {
                const c = (m.categoria || '').toUpperCase();
                return c.includes('RESIDUO') || c.includes('RESÍDUO') || c.includes('PLÁSTICO');
            });
        } else if (idSelect === 'prc-lig-material-id') {
            filteredMats = mats.filter(m => {
                const c = (m.categoria || '').toUpperCase();
                return c.includes('LIGA') || c.includes('ESTANHO') || c.includes('SOLDA');
            });
        }
        
        el.innerHTML = '<option value="">Selecione um material...</option>' + 
            filteredMats.map(m => `<option value="${m.id}">${m.nome} (${m.categoria || 'Sem Categoria'})</option>`).join('');
    };

    window.abrirModalPrecoResiduo = function() {
        document.getElementById('form-preco-residuo-apex').reset();
        document.getElementById('prc-res-id').value = '';
        popularSelectMateriaisModal('prc-res-material-id');
        document.getElementById('modal-preco-residuo').style.display = 'flex';
        calcularMargemLiquidaModalResiduo();
    };


    window.fecharModalPrecoResiduo = function() {
        document.getElementById('modal-preco-residuo').style.display = 'none';
    };

    window.calcularPorcentagemDeEntregarResiduo = function() {
        const venda = parseFloat(document.getElementById('prc-res-venda')?.value) || 0;
        const entregar = parseFloat(document.getElementById('prc-res-entregar')?.value) || 0;
        const pctEl = document.getElementById('prc-res-entregar-pct');
        if (pctEl && venda > 0) pctEl.value = ((entregar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalResiduo();
    };

    window.calcularValorDeEntregarResiduo = function() {
        const venda = parseFloat(document.getElementById('prc-res-venda')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-res-entregar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-res-entregar');
        if (entEl && venda > 0) entEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalResiduo();
    };

    window.calcularPorcentagemDeColetarResiduo = function() {
        const venda = parseFloat(document.getElementById('prc-res-venda')?.value) || 0;
        const coletar = parseFloat(document.getElementById('prc-res-coletar')?.value) || 0;
        const pctEl = document.getElementById('prc-res-coletar-pct');
        if (pctEl && venda > 0) pctEl.value = ((coletar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalResiduo();
    };

    window.calcularValorDeColetarResiduo = function() {
        const venda = parseFloat(document.getElementById('prc-res-venda')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-res-coletar-pct')?.value) || 0;
        const colEl = document.getElementById('prc-res-coletar');
        if (colEl && venda > 0) colEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalResiduo();
    };

    window.calcularValoresDeAcordoComPorcentagemResiduo = function() {
        const venda = parseFloat(document.getElementById('prc-res-venda')?.value) || 0;
        const pctEnt = parseFloat(document.getElementById('prc-res-entregar-pct')?.value) || 0;
        const pctCol = parseFloat(document.getElementById('prc-res-coletar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-res-entregar');
        const colEl = document.getElementById('prc-res-coletar');
        if (venda > 0) {
            if (pctEnt > 0 && entEl) entEl.value = ((pctEnt / 100) * venda).toFixed(2);
            if (pctCol > 0 && colEl) colEl.value = ((pctCol / 100) * venda).toFixed(2);
        }
        window.calcularPorcentagemDeEntregarResiduo();
        window.calcularPorcentagemDeColetarResiduo();
        window.calcularMargemLiquidaModalResiduo();
    };

    window.atualizarPreviewDataResiduo = function() {
        const val = document.getElementById('prc-res-validade')?.value;
        const preview = document.getElementById('prc-res-data-preview');
        if (preview) {
            if (val) {
                const [y, m, d] = val.split('-');
                preview.textContent = `${d}/${m}/${y}`;
            } else {
                preview.textContent = '--/--/----';
            }
        }
    };

    window.calcularMargemLiquidaModalResiduo = function() {

        const parseVal = id => parseFloat(String(document.getElementById(id)?.value || '0').replace(',', '.')) || 0;
        const vendaRef = parseVal('prc-res-venda');
        const precoEnt = parseVal('prc-res-entregar');
        const precoCol = parseVal('prc-res-coletar');
        const comissao = parseVal('prc-res-comissao');
        const pisCofins = parseVal('prc-res-piscofins');
        const fidc = parseVal('prc-res-fidc');
        const icms = parseVal('prc-res-icms');
        const freteColeta = parseVal('prc-res-frete-coleta');
        const pctTotal = comissao + pisCofins + fidc + icms;
        const valDeducoes = vendaRef * (pctTotal / 100);
        const vendaLiquida = vendaRef - valDeducoes;
        const lucroEnt = vendaLiquida - precoEnt;
        const margemEnt = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;
        const lucroCol = vendaLiquida - precoCol - freteColeta;
        const margemCol = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;
        const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        set('prc-res-live-deducoes', `${fmtBRL(pctTotal)}% (R$ ${fmtBRL(valDeducoes)}/kg)`);
        set('prc-res-live-venda-liq', `R$ ${fmtBRL(vendaLiquida)}/kg`);
        set('prc-res-live-frete', `R$ ${fmtBRL(freteColeta)}/kg`);
        const elME = document.getElementById('prc-res-live-margem-ent');
        if (elME) { elME.textContent = `${fmtBRL(margemEnt)}%`; elME.style.color = margemEnt >= 15 ? '#2AD07A' : (margemEnt >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-res-live-lucro-ent', `Lucro: R$ ${fmtBRL(lucroEnt)}/kg`);
        const elMC = document.getElementById('prc-res-live-margem-col');
        if (elMC) { elMC.textContent = `${fmtBRL(margemCol)}%`; elMC.style.color = margemCol >= 15 ? '#4fc3f7' : (margemCol >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-res-live-lucro-col', `Lucro: R$ ${fmtBRL(lucroCol)}/kg`);
    };

    window.editarPrecoResiduo = function(id) {
        const p = localPrecosResiduos.find(x => x.id === id);
        if (!p) return;
        popularSelectMateriaisModal('prc-res-material-id');
        document.getElementById('prc-res-id').value = p.id;
        document.getElementById('prc-res-material-id').value = p.material_id;
        document.getElementById('prc-res-entregar').value = parseFloat(p.preco_entregar || 0).toFixed(2);
        document.getElementById('prc-res-coletar').value = parseFloat(p.preco_coletar || 0).toFixed(2);
        document.getElementById('prc-res-venda').value = parseFloat(p.venda_ref || 0).toFixed(2);
        document.getElementById('prc-res-comissao').value = parseFloat(p.comissao || 0).toFixed(2);
        document.getElementById('prc-res-piscofins').value = parseFloat(p.pis_cofins || 0).toFixed(2);
        document.getElementById('prc-res-fidc').value = parseFloat(p.fidc || 0).toFixed(2);
        document.getElementById('prc-res-icms').value = parseFloat(p.icms || 0).toFixed(2);
        document.getElementById('prc-res-frete-coleta').value = parseFloat(p.frete_coleta || 0).toFixed(2);
        document.getElementById('prc-res-validade').value = p.validade ? p.validade.split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('modal-preco-residuo').style.display = 'flex';
        window.calcularPorcentagemDeEntregarResiduo();
        window.calcularPorcentagemDeColetarResiduo();
        window.atualizarPreviewDataResiduo();
        calcularMargemLiquidaModalResiduo();
    };

    window.salvarPrecoResiduo = async function(e) {
        e.preventDefault();
        const id = document.getElementById('prc-res-id').value;
        const parseVal = v => parseFloat(String(v || '0').replace(',', '.')) || 0;
        const data = {
            material_id: parseInt(document.getElementById('prc-res-material-id').value),
            preco_entregar: parseVal(document.getElementById('prc-res-entregar').value),
            preco_coletar: parseVal(document.getElementById('prc-res-coletar').value),
            venda_ref: parseVal(document.getElementById('prc-res-venda').value),
            comissao: parseVal(document.getElementById('prc-res-comissao').value),
            pis_cofins: parseVal(document.getElementById('prc-res-piscofins').value),
            fidc: parseVal(document.getElementById('prc-res-fidc').value),
            icms: parseVal(document.getElementById('prc-res-icms').value),
            frete_coleta: parseVal(document.getElementById('prc-res-frete-coleta').value),
            validade: document.getElementById('prc-res-validade').value,
            aplicar_todos: true,
        };
        const btn = e.target.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }
        try {
            const url = id ? `/api/tabela-precos-residuos/${id}` : '/api/tabela-precos-residuos';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error(await res.text());
            fecharModalPrecoResiduo();
            carregarPrecosResiduos();
        } catch(err) {
            _apexNotify('Atenção', 'Erro ao salvar preço do resíduo: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar'; }
        }
    };

    window.deletarPrecoResiduo = async function(id) {
        if (!confirm('Excluir este preço de resíduo?')) return;
        try {
            await fetch(`/api/tabela-precos-residuos/${id}`, { method: 'DELETE' });
            carregarPrecosResiduos();
        } catch(err) { console.error(err); }
    };

    window.alterarValidadeGeralResiduo = async function() {
        abrirModalVigenciaGeral('residuo');
    };

    window.exportarTabelaResiduo = function() {
        _apexNotify('Sistema', 'Tabela de Resíduos exportada com sucesso!', 'info');
    };

    // --- 3c. TABELA DE PREÇOS — LIGAS ---
    let localPrecosLigas = [];
    let settingsPrecosLigas = {};
    let visualizacaoLigas = 'completa';

    window.initApexPrecosLigas = function() {
        window.carregarPrecosLigas();
    };

    window.carregarPrecosLigas = async function() {
        try {
            const res = await fetch('/api/tabela-precos-ligas', { cache: 'no-store' });
            localPrecosLigas = await res.json();
            try {
                const resSet = await fetch('/api/settings');
                settingsPrecosLigas = await resSet.json();
            } catch(e) {}
            renderTabelaPrecosLigas();
        } catch(err) { console.error('Erro carregarPrecosLigas:', err); }
    };

    window.alterarVisualizacaoLiga = function(tipo) {
        visualizacaoLigas = tipo;
        renderTabelaPrecosLigas();
    };

    function renderTabelaPrecosLigas() {
        const container = document.getElementById('ligas-precos-categorias-container');
        if (!container) return;
        container.innerHTML = '';

        const categorias = [];
        localPrecosLigas.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) {
                categorias.push(p.material_categoria);
            }
        });
        if (categorias.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:60px; color:#aaa;"><i class="fa-solid fa-atom" style="font-size:2rem; margin-bottom:16px; display:block; color:#4fc3f7;"></i>Nenhuma liga cadastrada ainda. Clique em <strong>Novo Item de Preço</strong> para começar.</div>';
            return;
        }

        const showCompleta = visualizacaoLigas === 'completa';

        categorias.forEach(cat => {
            const precosCat = localPrecosLigas.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = settingsPrecosLigas[`cor_categoria_liga_${cat}`] || '#1e88e5';

            const box = document.createElement('div');
            box.className = 'categoria-preco-box';
            box.style.borderColor = corCategoria;
            box.innerHTML = `
                <div class="categoria-preco-header" style="background: ${corCategoria};">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${cat.toUpperCase()}</span>
                        <input type="color" value="${corCategoria}" title="Alterar cor" style="border:none; background:none; cursor:pointer; width:22px; height:22px; padding:0; outline:none; border-radius:4px; vertical-align:middle;" onchange="alterarCorCategoriaLiga('${cat}', this.value)">
                    </div>
                    <button type="button" class="restrito-financeiro" onclick="alterarValidadeGeralLiga()" style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-calendar-days"></i> VIGÊNCIA ATÉ: ${validadeStr} <i class="fa-solid fa-pen-to-square" style="font-size:0.78rem;"></i>
                    </button>
                </div>
                <div class="categoria-preco-observacao">
                    <i class="fa-solid fa-circle-info"></i> Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg. | OBS: Variação de preço conforme atualização de mercado.
                </div>
                <div style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#172635; text-align:left;">
                                <th style="padding:10px;">Descrição</th>
                                <th style="padding:10px; text-align:right;">Preço Entregar (R$/kg)</th>
                                <th style="padding:10px; text-align:right;">Preço Coletar (R$/kg)</th>
                                ${showCompleta ? `
                                <th style="padding:10px; text-align:right; color:#ffeb3b;">Venda Ref (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Comissão (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">PIS/COFINS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">FIDC (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">ICMS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Frete Coleta (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#4fc3f7;">Venda Líquida (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#2AD07A;">Lucro Líq. Ent.</th>
                                <th style="padding:10px; text-align:right; color:#2AD07A;">Margem Líq. Ent (%)</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Lucro Líq. Col.</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Margem Líq. Col (%)</th>
                                ` : ''}
                                <th style="padding:10px;">NCM</th>
                                <th style="padding:10px; text-align:center; width:150px; min-width:150px; position:sticky; right:0; background:#172635; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${precosCat.map((p, idx) => {
                                const comissao = parseFloat(p.comissao || 0);
                                const pisCofins = parseFloat(p.pis_cofins || 0);
                                const fidc = parseFloat(p.fidc || 0);
                                const icms = parseFloat(p.icms || 0);
                                const freteColeta = parseFloat(p.frete_coleta || 0);
                                const totalDedPct = comissao + pisCofins + fidc + icms;
                                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const bgRow = idx % 2 === 0 ? 'background:#0d1826;' : 'background:#16273b;';
                                return `
                                    <tr style="${bgRow} border-bottom:1px solid #1e3650; transition:background 0.15s;" onmouseover="this.style.background='#1f4068'" onmouseout="this.style.background='${idx % 2 === 0 ? '#0d1826' : '#16273b'}'">
                                        <td style="padding:10px; color:#fff;"><strong>${p.material_nome}</strong></td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_entregar)}</td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_coletar)}</td>
                                        ${showCompleta ? `
                                        <td style="padding:10px; text-align:right; color:#ffeb3b; font-weight:bold;">R$ ${fmtBRL(p.venda_ref)}</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(comissao)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(pisCofins)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(fidc)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(icms)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">R$ ${fmtBRL(freteColeta)}</td>
                                        <td style="padding:10px; text-align:right; color:#4fc3f7; font-weight:bold;">R$ ${fmtBRL(vendaLiquida)}</td>
                                        <td style="padding:10px; text-align:right; color:#2AD07A;">R$ ${fmtBRL(lucroEnt)}</td>
                                        <td style="padding:10px; text-align:right; color:#2AD07A; font-weight:bold;">${fmtBRL(margemEnt)}%</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1;">R$ ${fmtBRL(lucroCol)}</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1; font-weight:bold;">${fmtBRL(margemCol)}%</td>
                                        ` : ''}
                                        <td style="padding:10px; color:#fff; font-weight:bold;">${p.material_ncm || '-'}</td>
                                        <td style="padding:6px 8px; text-align:center; position:sticky; right:0; background:${idx % 2 === 0 ? '#0d1826' : '#16273b'}; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">
                                            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                <button class="btn-secondary restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#1a3a5c; color:#fff; border:1px solid #4fc3f7; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="editarPrecoLiga(${p.id})"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                                                <button class="btn-danger restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#c0392b; color:#fff; border:1px solid #e74c3c; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="deletarPrecoLiga(${p.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:#131c26;">
                                <td colspan="${showCompleta ? 16 : 5}" style="padding:10px; text-align:right; font-style:italic; color:#aaa;">DEMAIS LIGAS PREÇO SOBRE ANÁLISE (FOTO)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(box);
        });
        applyRolePermissions();
    }

    window.alterarCorCategoriaLiga = async function(cat, cor) {
        try {
            await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [`cor_categoria_liga_${cat}`]: cor }) });
            settingsPrecosLigas[`cor_categoria_liga_${cat}`] = cor;
            renderTabelaPrecosLigas();
        } catch(e) { console.error(e); }
    };

    window.abrirModalPrecoLiga = function() {
        document.getElementById('form-preco-liga-apex').reset();
        document.getElementById('prc-lig-id').value = '';
        if(window.popularSelectMateriaisModal) window.popularSelectMateriaisModal('prc-lig-material-id');
        document.getElementById('modal-preco-liga').style.display = 'flex';
        calcularMargemLiquidaModalLiga();
    };

    window.fecharModalPrecoLiga = function() {
        document.getElementById('modal-preco-liga').style.display = 'none';
    };

    window.calcularPorcentagemDeEntregarLiga = function() {
        const venda = parseFloat(document.getElementById('prc-lig-venda')?.value) || 0;
        const entregar = parseFloat(document.getElementById('prc-lig-entregar')?.value) || 0;
        const pctEl = document.getElementById('prc-lig-entregar-pct');
        if (pctEl && venda > 0) pctEl.value = ((entregar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalLiga();
    };

    window.calcularValorDeEntregarLiga = function() {
        const venda = parseFloat(document.getElementById('prc-lig-venda')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-lig-entregar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-lig-entregar');
        if (entEl && venda > 0) entEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalLiga();
    };

    window.calcularPorcentagemDeColetarLiga = function() {
        const venda = parseFloat(document.getElementById('prc-lig-venda')?.value) || 0;
        const coletar = parseFloat(document.getElementById('prc-lig-coletar')?.value) || 0;
        const pctEl = document.getElementById('prc-lig-coletar-pct');
        if (pctEl && venda > 0) pctEl.value = ((coletar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalLiga();
    };

    window.calcularValorDeColetarLiga = function() {
        const venda = parseFloat(document.getElementById('prc-lig-venda')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-lig-coletar-pct')?.value) || 0;
        const colEl = document.getElementById('prc-lig-coletar');
        if (colEl && venda > 0) colEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalLiga();
    };

    window.calcularValoresDeAcordoComPorcentagemLiga = function() {
        const venda = parseFloat(document.getElementById('prc-lig-venda')?.value) || 0;
        const pctEnt = parseFloat(document.getElementById('prc-lig-entregar-pct')?.value) || 0;
        const pctCol = parseFloat(document.getElementById('prc-lig-coletar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-lig-entregar');
        const colEl = document.getElementById('prc-lig-coletar');
        if (venda > 0) {
            if (pctEnt > 0 && entEl) entEl.value = ((pctEnt / 100) * venda).toFixed(2);
            if (pctCol > 0 && colEl) colEl.value = ((pctCol / 100) * venda).toFixed(2);
        }
        window.calcularPorcentagemDeEntregarLiga();
        window.calcularPorcentagemDeColetarLiga();
        window.calcularMargemLiquidaModalLiga();
    };

    window.atualizarPreviewDataLiga = function() {
        const val = document.getElementById('prc-lig-validade')?.value;
        const preview = document.getElementById('prc-lig-data-preview');
        if (preview) {
            if (val) {
                const [y, m, d] = val.split('-');
                preview.textContent = `${d}/${m}/${y}`;
            } else {
                preview.textContent = '--/--/----';
            }
        }
    };

    window.calcularMargemLiquidaModalLiga = function() {

        const parseVal = id => parseFloat(String(document.getElementById(id)?.value || '0').replace(',', '.')) || 0;
        const vendaRef = parseVal('prc-lig-venda');
        const precoEnt = parseVal('prc-lig-entregar');
        const precoCol = parseVal('prc-lig-coletar');
        const comissao = parseVal('prc-lig-comissao');
        const pisCofins = parseVal('prc-lig-piscofins');
        const fidc = parseVal('prc-lig-fidc');
        const icms = parseVal('prc-lig-icms');
        const freteColeta = parseVal('prc-lig-frete-coleta');
        const pctTotal = comissao + pisCofins + fidc + icms;
        const valDeducoes = vendaRef * (pctTotal / 100);
        const vendaLiquida = vendaRef - valDeducoes;
        const lucroEnt = vendaLiquida - precoEnt;
        const margemEnt = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;
        const lucroCol = vendaLiquida - precoCol - freteColeta;
        const margemCol = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;
        const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        set('prc-lig-live-deducoes', `${fmtBRL(pctTotal)}% (R$ ${fmtBRL(valDeducoes)}/kg)`);
        set('prc-lig-live-venda-liq', `R$ ${fmtBRL(vendaLiquida)}/kg`);
        set('prc-lig-live-frete', `R$ ${fmtBRL(freteColeta)}/kg`);
        const elME = document.getElementById('prc-lig-live-margem-ent');
        if (elME) { elME.textContent = `${fmtBRL(margemEnt)}%`; elME.style.color = margemEnt >= 15 ? '#2AD07A' : (margemEnt >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-lig-live-lucro-ent', `Lucro: R$ ${fmtBRL(lucroEnt)}/kg`);
        const elMC = document.getElementById('prc-lig-live-margem-col');
        if (elMC) { elMC.textContent = `${fmtBRL(margemCol)}%`; elMC.style.color = margemCol >= 15 ? '#4fc3f7' : (margemCol >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-lig-live-lucro-col', `Lucro: R$ ${fmtBRL(lucroCol)}/kg`);
    };

    window.editarPrecoLiga = function(id) {
        const p = localPrecosLigas.find(x => x.id === id);
        if (!p) return;
        if(window.popularSelectMateriaisModal) window.popularSelectMateriaisModal('prc-lig-material-id');
        document.getElementById('prc-lig-id').value = p.id;
        document.getElementById('prc-lig-material-id').value = p.material_id;
        document.getElementById('prc-lig-entregar').value = parseFloat(p.preco_entregar || 0).toFixed(2);
        document.getElementById('prc-lig-coletar').value = parseFloat(p.preco_coletar || 0).toFixed(2);
        document.getElementById('prc-lig-venda').value = parseFloat(p.venda_ref || 0).toFixed(2);
        document.getElementById('prc-lig-comissao').value = parseFloat(p.comissao || 0).toFixed(2);
        document.getElementById('prc-lig-piscofins').value = parseFloat(p.pis_cofins || 0).toFixed(2);
        document.getElementById('prc-lig-fidc').value = parseFloat(p.fidc || 0).toFixed(2);
        document.getElementById('prc-lig-icms').value = parseFloat(p.icms || 0).toFixed(2);
        document.getElementById('prc-lig-frete-coleta').value = parseFloat(p.frete_coleta || 0).toFixed(2);
        document.getElementById('prc-lig-validade').value = p.validade ? p.validade.split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('modal-preco-liga').style.display = 'flex';
        window.calcularPorcentagemDeEntregarLiga();
        window.calcularPorcentagemDeColetarLiga();
        window.atualizarPreviewDataLiga();
        calcularMargemLiquidaModalLiga();
    };

    window.salvarPrecoLiga = async function(e) {
        e.preventDefault();
        const id = document.getElementById('prc-lig-id').value;
        const parseVal = v => parseFloat(String(v || '0').replace(',', '.')) || 0;
        const data = {
            material_id: parseInt(document.getElementById('prc-lig-material-id').value),
            preco_entregar: parseVal(document.getElementById('prc-lig-entregar').value),
            preco_coletar: parseVal(document.getElementById('prc-lig-coletar').value),
            venda_ref: parseVal(document.getElementById('prc-lig-venda').value),
            comissao: parseVal(document.getElementById('prc-lig-comissao').value),
            pis_cofins: parseVal(document.getElementById('prc-lig-piscofins').value),
            fidc: parseVal(document.getElementById('prc-lig-fidc').value),
            icms: parseVal(document.getElementById('prc-lig-icms').value),
            frete_coleta: parseVal(document.getElementById('prc-lig-frete-coleta').value),
            validade: document.getElementById('prc-lig-validade').value,
            aplicar_todos: true,
        };
        const btn = e.target.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }
        try {
            const url = id ? `/api/tabela-precos-ligas/${id}` : '/api/tabela-precos-ligas';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error(await res.text());
            fecharModalPrecoLiga();
            carregarPrecosLigas();
        } catch(err) {
            _apexNotify('Atenção', 'Erro ao salvar preço da liga: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar'; }
        }
    };

    window.deletarPrecoLiga = async function(id) {
        if (!confirm('Excluir este preço de liga?')) return;
        try {
            await fetch(`/api/tabela-precos-ligas/${id}`, { method: 'DELETE' });
            carregarPrecosLigas();
        } catch(err) { console.error(err); }
    };

    window.alterarValidadeGeralLiga = async function() {
        abrirModalVigenciaGeral('liga');
    };

    window.exportarTabelaLiga = function() {
        _apexNotify('Sistema', 'Tabela de Ligas exportada com sucesso!', 'info');
    };

    // =============================================================================
    // --- 3c. TABELA DE PREÇOS — VOLUME ---
    // =============================================================================
    let localPrecosVolume = [];
    let settingsPrecosVolume = {};
    let visualizacaoVolume = 'completa';

    window.initApexPrecosVolume = function() {
        window.carregarPrecosVolume();
    };

    window.carregarPrecosVolume = async function() {
        try {
            const res = await fetch('/api/tabela-precos-volume', { cache: 'no-store' });
            localPrecosVolume = await res.json();
            try {
                const resSet = await fetch('/api/settings');
                settingsPrecosVolume = await resSet.json();
            } catch(e) {}
            renderTabelaPrecosVolume();
        } catch(err) { console.error('Erro carregarPrecosVolume:', err); }
    };

    window.alterarVisualizacaoVolume = function(tipo) {
        visualizacaoVolume = tipo;
        renderTabelaPrecosVolume();
    };

    function renderTabelaPrecosVolume() {
        const container = document.getElementById('volume-precos-categorias-container');
        if (!container) return;
        container.innerHTML = '';
        const categorias = [];
        localPrecosVolume.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) categorias.push(p.material_categoria);
        });
        if (categorias.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:60px; color:#aaa;"><i class="fa-solid fa-boxes-stacked" style="font-size:2rem; margin-bottom:16px; display:block; color:#f97316;"></i>Nenhum item de volume cadastrado ainda. Clique em <strong>Novo Item de Preço</strong> para começar.</div>';
            return;
        }
        const showCompleta = visualizacaoVolume === 'completa';
        categorias.forEach(cat => {
            const precosCat = localPrecosVolume.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = settingsPrecosVolume[`cor_categoria_volume_${cat}`] || '#f97316';
            const box = document.createElement('div');
            box.className = 'categoria-preco-box';
            box.style.borderColor = corCategoria;
            box.innerHTML = `
                <div class="categoria-preco-header" style="background: ${corCategoria};">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${cat.toUpperCase()}</span>
                        <input type="color" value="${corCategoria}" title="Alterar cor" style="border:none; background:none; cursor:pointer; width:22px; height:22px; padding:0; outline:none; border-radius:4px; vertical-align:middle;" onchange="alterarCorCategoriaVolume('${cat}', this.value)">
                    </div>
                    <button type="button" class="restrito-financeiro" onclick="alterarValidadeGeralVolume()" style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-calendar-days"></i> VIGÊNCIA ATÉ: ${validadeStr} <i class="fa-solid fa-pen-to-square" style="font-size:0.78rem;"></i>
                    </button>
                </div>
                <div class="categoria-preco-observacao">
                    <i class="fa-solid fa-circle-info"></i> Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg. | OBS: Variação de preço conforme atualização de mercado.
                </div>
                <div style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#172635; text-align:left;">
                                <th style="padding:10px;">Descrição</th>
                                <th style="padding:10px; text-align:right;">Preço Entregar (R$/kg)</th>
                                <th style="padding:10px; text-align:right;">Preço Coletar (R$/kg)</th>
                                ${showCompleta ? `
                                <th style="padding:10px; text-align:right; color:#ffeb3b;">Venda Ref (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Comissão (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">PIS/COFINS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">FIDC (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">ICMS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Frete Coleta (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#4fc3f7;">Venda Líquida (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#f97316;">Lucro Líq. Ent.</th>
                                <th style="padding:10px; text-align:right; color:#f97316;">Margem Líq. Ent (%)</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Lucro Líq. Col.</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Margem Líq. Col (%)</th>
                                ` : ''}
                                <th style="padding:10px;">NCM</th>
                                <th style="padding:10px; text-align:center; width:150px; min-width:150px; position:sticky; right:0; background:#172635; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${precosCat.map((p, idx) => {
                                const comissao = parseFloat(p.comissao || 0);
                                const pisCofins = parseFloat(p.pis_cofins || 0);
                                const fidc = parseFloat(p.fidc || 0);
                                const icms = parseFloat(p.icms || 0);
                                const freteColeta = parseFloat(p.frete_coleta || 0);
                                const totalDedPct = comissao + pisCofins + fidc + icms;
                                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const bgRow = idx % 2 === 0 ? 'background:#0d1826;' : 'background:#16273b;';
                                return `
                                    <tr style="${bgRow} border-bottom:1px solid #1e3650; transition:background 0.15s;" onmouseover="this.style.background='#1f4068'" onmouseout="this.style.background='${idx % 2 === 0 ? '#0d1826' : '#16273b'}'">
                                        <td style="padding:10px; color:#fff;"><strong>${p.material_nome}</strong></td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_entregar)}</td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_coletar)}</td>
                                        ${showCompleta ? `
                                        <td style="padding:10px; text-align:right; color:#ffeb3b; font-weight:bold;">R$ ${fmtBRL(p.venda_ref)}</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(comissao)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(pisCofins)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(fidc)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(icms)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">R$ ${fmtBRL(freteColeta)}</td>
                                        <td style="padding:10px; text-align:right; color:#4fc3f7; font-weight:bold;">R$ ${fmtBRL(vendaLiquida)}</td>
                                        <td style="padding:10px; text-align:right; color:#f97316;">R$ ${fmtBRL(lucroEnt)}</td>
                                        <td style="padding:10px; text-align:right; color:#f97316; font-weight:bold;">${fmtBRL(margemEnt)}%</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1;">R$ ${fmtBRL(lucroCol)}</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1; font-weight:bold;">${fmtBRL(margemCol)}%</td>
                                        ` : ''}
                                        <td style="padding:10px; color:#fff; font-weight:bold;">${p.material_ncm || '-'}</td>
                                        <td style="padding:6px 8px; text-align:center; position:sticky; right:0; background:${idx % 2 === 0 ? '#0d1826' : '#16273b'}; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">
                                            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                <button class="btn-secondary restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#4a2900; color:#fff; border:1px solid #f97316; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="editarPrecoVolume(${p.id})"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                                                <button class="btn-danger restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#c0392b; color:#fff; border:1px solid #e74c3c; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="deletarPrecoVolume(${p.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:#131c26;">
                                <td colspan="${showCompleta ? 16 : 5}" style="padding:10px; text-align:right; font-style:italic; color:#aaa;">DEMAIS MATERIAIS DE VOLUME PREÇO SOBRE ANÁLISE (FOTO)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(box);
        });
        applyRolePermissions();
    }

    window.alterarCorCategoriaVolume = async function(cat, cor) {
        try {
            await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [`cor_categoria_volume_${cat}`]: cor }) });
            settingsPrecosVolume[`cor_categoria_volume_${cat}`] = cor;
            renderTabelaPrecosVolume();
        } catch(e) { console.error(e); }
    };

    window.abrirModalPrecoVolume = function() {
        const hoje = new Date(); hoje.setMonth(hoje.getMonth() + 1);
        const validadeDefault = hoje.toISOString().split('T')[0];
        const [vy, vm, vd] = validadeDefault.split('-');
        const dataPreviewDefault = `${vd}/${vm}/${vy}`;
        const html = `
        <div id="modal-preco-volume" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#101a24;border:1px solid #f97316;border-radius:12px;padding:18px 22px 16px;width:540px;max-width:96vw;max-height:92vh;overflow-y:auto;">
                <h3 style="margin-top:0;border-bottom:1px solid #2d3f52;padding-bottom:8px;color:#fff;font-size:1rem;">
                    <i class="fa-solid fa-boxes-stacked" style="color:#f97316;"></i> Definir Preço — Volume
                </h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label style="font-size:0.8rem;">Material *</label>
                        <select id="prc-vol-material-id" class="noble-input" onchange="calcularMargemLiquidaModalVolume()"><option value="">Selecione...</option></select>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.8rem;">Preço Venda Ref. (R\$/kg) *</label>
                        <input id="prc-vol-venda-ref" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularValoresDeAcordoComPorcentagemVolume()">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label>Preço Entregar (R\$/kg) *</label>
                        <input id="prc-vol-entregar" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularPorcentagemDeEntregarVolume()">
                    </div>
                    <div class="form-group">
                        <label>Preço Entregar (%)</label>
                        <input id="prc-vol-entregar-pct" type="number" step="0.1" class="noble-input" placeholder="Ex: 90" oninput="calcularValorDeEntregarVolume()">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label>Preço Coletar (R\$/kg) *</label>
                        <input id="prc-vol-coletar" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularPorcentagemDeColetarVolume()">
                    </div>
                    <div class="form-group">
                        <label>Preço Coletar (%)</label>
                        <input id="prc-vol-coletar-pct" type="number" step="0.1" class="noble-input" placeholder="Ex: 85" oninput="calcularValorDeColetarVolume()">
                    </div>
                </div>
                <div style="background:#162432;padding:8px 12px;border-radius:8px;border:1px solid #7c3a12;margin-bottom:10px;">
                    <div style="font-weight:bold;color:#f97316;font-size:0.8rem;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                        <i class="fa-solid fa-percent"></i> Composição Fiscal &amp; Deduções (% e R\$/kg)
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                        <div class="form-group">
                            <label style="font-size:0.75rem;">Comissão (%)</label>
                            <input id="prc-vol-comissao" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalVolume()">
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.75rem;">PIS/COFINS (%)</label>
                            <input id="prc-vol-piscofins" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalVolume()">
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.75rem;">FIDC (%)</label>
                            <input id="prc-vol-fidc" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalVolume()">
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.75rem;">ICMS (%)</label>
                            <input id="prc-vol-icms" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalVolume()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.75rem;">Frete Coleta (R\$/kg)</label>
                        <input id="prc-vol-frete" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularMargemLiquidaModalVolume()">
                    </div>
                </div>
                <div style="background:#0a1622;padding:8px 12px;border-radius:8px;border-left:4px solid #f97316;margin-bottom:10px;">
                    <div style="font-size:0.8rem;text-transform:uppercase;font-weight:bold;color:#aaa;margin-bottom:6px;">
                        <i class="fa-solid fa-calculator" style="color:#f97316;"></i> Simulação de Margem Líquida Real
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:0.82rem;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #1a2a3a;">
                        <div>
                            <span style="color:#888;">Total Deduções:</span>
                            <div style="color:#ff6b6b;font-weight:bold;" id="prc-vol-live-deducoes">0.00% (R\$ 0,00)</div>
                        </div>
                        <div>
                            <span style="color:#888;">Venda Líquida:</span>
                            <div style="color:#ffeb3b;font-weight:bold;" id="prc-vol-live-venda-liq">R\$ 0,00/kg</div>
                        </div>
                        <div>
                            <span style="color:#888;">Frete Coleta:</span>
                            <div style="color:#aaa;font-weight:bold;" id="prc-vol-live-frete">R\$ 0,00/kg</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem;">
                        <div style="background:#0f251d;padding:8px;border-radius:6px;border:1px solid #1a4d36;">
                            <span style="color:#a8e6cf;font-size:0.75rem;text-transform:uppercase;font-weight:bold;">Margem Líquida Entrega</span>
                            <div style="font-size:1.05rem;font-weight:bold;color:#2AD07A;" id="prc-vol-live-margem-ent">0.00%</div>
                            <div style="font-size:0.75rem;color:#aaa;" id="prc-vol-live-lucro-ent">Lucro: R\$ 0,00/kg</div>
                        </div>
                        <div style="background:#2a1800;padding:8px;border-radius:6px;border:1px solid #7c3a12;">
                            <span style="color:#ffd4a3;font-size:0.75rem;text-transform:uppercase;font-weight:bold;">Margem Líquida Coleta</span>
                            <div style="font-size:1.05rem;font-weight:bold;color:#f97316;" id="prc-vol-live-margem-col">0.00%</div>
                            <div style="font-size:0.75rem;color:#aaa;" id="prc-vol-live-lucro-col">Lucro: R\$ 0,00/kg</div>
                        </div>
                    </div>
                </div>
                <div class="form-group" style="margin-top:4px;">
                    <label style="font-size:0.8rem;">Válido Até * <span style="color:#aaa;font-size:0.75rem;font-weight:normal;">(aplicado a todos os materiais)</span></label>
                    <input id="prc-vol-validade" type="date" class="noble-input" value="${validadeDefault}" onchange="atualizarPreviewDataVolume()">
                    <div style="display:flex;justify-content:space-between;align-items:center;background:#162738;padding:8px 12px;border-radius:6px;border:1px solid #7c3a12;margin-top:6px;">
                        <span style="color:#aaa;font-size:0.82rem;">Data Selecionada:</span>
                        <strong id="prc-vol-data-preview" style="color:#f97316;font-size:0.95rem;">${dataPreviewDefault}</strong>
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:14px;">
                    <button onclick="salvarPrecoVolume()" class="btn-primary" style="flex:1;background:linear-gradient(135deg,#f97316,#ea580c);"><i class="fa-solid fa-save"></i> Salvar</button>
                    <button onclick="document.getElementById('modal-preco-volume').remove()" class="btn-secondary" style="flex:1;">Cancelar</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.popularSelectMateriaisModal('prc-vol-material-id');
        setTimeout(() => window.calcularMargemLiquidaModalVolume(), 50);
    };

    window.calcularPorcentagemDeEntregarVolume = function() {
        const venda = parseFloat(document.getElementById('prc-vol-venda-ref')?.value) || 0;
        const entregar = parseFloat(document.getElementById('prc-vol-entregar')?.value) || 0;
        const pctEl = document.getElementById('prc-vol-entregar-pct');
        if (pctEl && venda > 0) pctEl.value = ((entregar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalVolume();
    };
    window.calcularValorDeEntregarVolume = function() {
        const venda = parseFloat(document.getElementById('prc-vol-venda-ref')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-vol-entregar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-vol-entregar');
        if (entEl && venda > 0) entEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalVolume();
    };
    window.calcularPorcentagemDeColetarVolume = function() {
        const venda = parseFloat(document.getElementById('prc-vol-venda-ref')?.value) || 0;
        const coletar = parseFloat(document.getElementById('prc-vol-coletar')?.value) || 0;
        const pctEl = document.getElementById('prc-vol-coletar-pct');
        if (pctEl && venda > 0) pctEl.value = ((coletar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalVolume();
    };
    window.calcularValorDeColetarVolume = function() {
        const venda = parseFloat(document.getElementById('prc-vol-venda-ref')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-vol-coletar-pct')?.value) || 0;
        const colEl = document.getElementById('prc-vol-coletar');
        if (colEl && venda > 0) colEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalVolume();
    };
    window.calcularValoresDeAcordoComPorcentagemVolume = function() {
        const venda = parseFloat(document.getElementById('prc-vol-venda-ref')?.value) || 0;
        const pctEnt = parseFloat(document.getElementById('prc-vol-entregar-pct')?.value) || 0;
        const pctCol = parseFloat(document.getElementById('prc-vol-coletar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-vol-entregar');
        const colEl = document.getElementById('prc-vol-coletar');
        if (venda > 0) {
            if (pctEnt > 0 && entEl) entEl.value = ((pctEnt / 100) * venda).toFixed(2);
            if (pctCol > 0 && colEl) colEl.value = ((pctCol / 100) * venda).toFixed(2);
        }
        window.calcularPorcentagemDeEntregarVolume();
        window.calcularPorcentagemDeColetarVolume();
        window.calcularMargemLiquidaModalVolume();
    };
    window.atualizarPreviewDataVolume = function() {
        const val = document.getElementById('prc-vol-validade')?.value;
        const preview = document.getElementById('prc-vol-data-preview');
        if (preview) {
            if (val) { const [y, m, d] = val.split('-'); preview.textContent = `${d}/${m}/${y}`; }
            else { preview.textContent = '--/--/----'; }
        }
    };
    window.calcularMargemLiquidaModalVolume = function() {
        const parseVal = id => parseFloat(String(document.getElementById(id)?.value || '0').replace(',', '.')) || 0;
        const vendaRef = parseVal('prc-vol-venda-ref');
        const precoEnt = parseVal('prc-vol-entregar');
        const precoCol = parseVal('prc-vol-coletar');
        const comissao = parseVal('prc-vol-comissao');
        const pisCofins = parseVal('prc-vol-piscofins');
        const fidc = parseVal('prc-vol-fidc');
        const icms = parseVal('prc-vol-icms');
        const freteColeta = parseVal('prc-vol-frete');
        const pctTotal = comissao + pisCofins + fidc + icms;
        const valDeducoes = vendaRef * (pctTotal / 100);
        const vendaLiquida = vendaRef - valDeducoes;
        const lucroEnt = vendaLiquida - precoEnt;
        const margemEnt = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;
        const lucroCol = vendaLiquida - precoCol - freteColeta;
        const margemCol = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const fmtN = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        set('prc-vol-live-deducoes', `${fmtN(pctTotal)}% (R$ ${fmtN(valDeducoes)}/kg)`);
        set('prc-vol-live-venda-liq', `R$ ${fmtN(vendaLiquida)}/kg`);
        set('prc-vol-live-frete', `R$ ${fmtN(freteColeta)}/kg`);
        const elME = document.getElementById('prc-vol-live-margem-ent');
        if (elME) { elME.textContent = `${fmtN(margemEnt)}%`; elME.style.color = margemEnt >= 15 ? '#2AD07A' : (margemEnt >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-vol-live-lucro-ent', `Lucro: R$ ${fmtN(lucroEnt)}/kg`);
        const elMC = document.getElementById('prc-vol-live-margem-col');
        if (elMC) { elMC.textContent = `${fmtN(margemCol)}%`; elMC.style.color = margemCol >= 15 ? '#f97316' : (margemCol >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-vol-live-lucro-col', `Lucro: R$ ${fmtN(lucroCol)}/kg`);
    };


    window.salvarPrecoVolume = async function() {
        const parseVal = v => parseFloat(String(v || '0').replace(',', '.')) || 0;
        const body = {
            material_id: parseInt(document.getElementById('prc-vol-material-id').value) || null,
            preco_entregar: parseVal(document.getElementById('prc-vol-entregar').value),
            preco_coletar:  parseVal(document.getElementById('prc-vol-coletar').value),
            venda_ref:      parseVal(document.getElementById('prc-vol-venda-ref').value),
            validade: document.getElementById('prc-vol-validade').value,
            aplicar_todos: true,
            comissao:       parseVal(document.getElementById('prc-vol-comissao').value),
            pis_cofins:     parseVal(document.getElementById('prc-vol-piscofins').value),
            fidc:           parseVal(document.getElementById('prc-vol-fidc').value),
            icms:           parseVal(document.getElementById('prc-vol-icms').value),
            frete_coleta:   parseVal(document.getElementById('prc-vol-frete').value)
        };
        if (!body.material_id || !body.validade) return _apexNotify('Atenção', 'Material e validade são obrigatórios.', 'warning');
        const btn = document.querySelector('#modal-preco-volume .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }
        try {
            const res = await fetch('/api/tabela-precos-volume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error(await res.text());
            document.getElementById('modal-preco-volume')?.remove();
            _apexNotify('Sucesso', 'Item de volume salvo com sucesso!', 'success');
            window.carregarPrecosVolume();
        } catch(err) {
            _apexNotify('Erro', err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar'; }
        }
    };


    window.editarPrecoVolume = function(id) {
        const p = localPrecosVolume.find(x => x.id === id);
        if (!p) return;
        window.abrirModalPrecoVolume();
        setTimeout(() => {
            document.getElementById('prc-vol-material-id').value = p.material_id;
            document.getElementById('prc-vol-entregar').value = parseFloat(p.preco_entregar || 0).toFixed(2);
            document.getElementById('prc-vol-coletar').value = parseFloat(p.preco_coletar || 0).toFixed(2);
            document.getElementById('prc-vol-venda-ref').value = parseFloat(p.venda_ref || 0).toFixed(2);
            document.getElementById('prc-vol-validade').value = p.validade ? p.validade.split('T')[0] : '';
            document.getElementById('prc-vol-comissao').value = parseFloat(p.comissao || 0).toFixed(2);
            document.getElementById('prc-vol-piscofins').value = parseFloat(p.pis_cofins || 0).toFixed(2);
            document.getElementById('prc-vol-fidc').value = parseFloat(p.fidc || 0).toFixed(2);
            document.getElementById('prc-vol-icms').value = parseFloat(p.icms || 0).toFixed(2);
            document.getElementById('prc-vol-frete').value = parseFloat(p.frete_coleta || 0).toFixed(2);
            window.calcularPorcentagemDeEntregarVolume();
            window.calcularPorcentagemDeColetarVolume();
            window.atualizarPreviewDataVolume();
            window.calcularMargemLiquidaModalVolume();
            const btn = document.querySelector('#modal-preco-volume .btn-primary');
            if (btn) { btn.onclick = () => atualizarPrecoVolume(id); btn.innerHTML = '<i class="fa-solid fa-save"></i> Atualizar'; }
        }, 150);
    };

    window.atualizarPrecoVolume = async function(id) {
        const body = {
            material_id: document.getElementById('prc-vol-material-id').value,
            preco_entregar: document.getElementById('prc-vol-entregar').value,
            preco_coletar: document.getElementById('prc-vol-coletar').value,
            venda_ref: document.getElementById('prc-vol-venda-ref').value,
            validade: document.getElementById('prc-vol-validade').value,
            aplicar_todos: true,
            comissao: document.getElementById('prc-vol-comissao').value,
            pis_cofins: document.getElementById('prc-vol-piscofins').value,
            fidc: document.getElementById('prc-vol-fidc').value,
            icms: document.getElementById('prc-vol-icms').value,
            frete_coleta: document.getElementById('prc-vol-frete').value
        };
        try {
            const res = await fetch(`/api/tabela-precos-volume/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error(await res.text());
            document.getElementById('modal-preco-volume')?.remove();
            _apexNotify('Sucesso', 'Item de volume atualizado!', 'success');
            window.carregarPrecosVolume();
        } catch(e) { _apexNotify('Erro', e.message, 'error'); }
    };

    window.deletarPrecoVolume = async function(id) {
        if (!confirm('Confirma exclusão deste item de volume?')) return;
        try {
            await fetch(`/api/tabela-precos-volume/${id}`, { method: 'DELETE' });
            _apexNotify('Sucesso', 'Item excluído!', 'success');
            window.carregarPrecosVolume();
        } catch(e) { _apexNotify('Erro', e.message, 'error'); }
    };

    window.alterarValidadeGeralVolume = async function() {
        abrirModalVigenciaGeral('volume');
    };

    window.exportarTabelaVolume = function() {
        _apexNotify('Sistema', 'Tabela de Volume exportada com sucesso!', 'info');
    };

    window.exportarTabelaVolumePdf = async function(modo) {
        const isCompleta = modo === 'completa';
        const btnId = isCompleta ? 'btn-pdf-volume-completa' : 'btn-pdf-volume-fornecedor';
        const btn = document.getElementById(btnId);
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...'; }
        try {
            let settings = {};
            try { const r = await fetch('/api/settings'); settings = await r.json(); } catch(e) {}
            const lastUpdate = settings.tabela_precos_ultima_atualizacao || new Date().toLocaleDateString('pt-BR');
            let logoBase64 = null;
            try {
                const lr = await fetch('/assets/img/logo%20(2).png');
                if (lr.ok) {
                    const blob = await lr.blob();
                    logoBase64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
                }
            } catch(e) {}
            const html = gerarHtmlTabelaGenericaParaPdf(localPrecosVolume, lastUpdate, settings, logoBase64, modo, 'Volume', '#f97316', 'DEMAIS MATERIAIS DE VOLUME PREÇO SOBRE ANÁLISE (FOTO)', 'cor_categoria_volume_');
            const base64 = await renderHtmlToPdfBase64(html, isCompleta);
            if (!base64) return _apexNotify('Atenção', 'Erro ao gerar PDF.', 'error');
            const a = document.createElement('a'); a.href = `data:application/pdf;base64,${base64}`;
            a.download = isCompleta ? 'Tabela_Volume_Geral.pdf' : 'Tabela_Volume_Fornecedor.pdf'; a.click();
        } catch(e) { _apexNotify('Erro', e.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = isCompleta ? '<i class="fa-solid fa-file-pdf" style="color:#ff4d4d;"></i> PDF Geral' : '<i class="fa-solid fa-file-pdf" style="color:#f97316;"></i> PDF Fornecedor'; } }
    };

    // =============================================================================
    // --- 3d. TABELA DE PREÇOS — FUNDIÇÃO ---
    // =============================================================================
    let localPrecosFundicao = [];
    let settingsPrecosFundicao = {};
    let visualizacaoFundicao = 'completa';

    window.initApexPrecosFundicao = function() {
        window.carregarPrecosFundicao();
    };

    window.carregarPrecosFundicao = async function() {
        try {
            const res = await fetch('/api/tabela-precos-fundicao', { cache: 'no-store' });
            localPrecosFundicao = await res.json();
            try { const rs = await fetch('/api/settings'); settingsPrecosFundicao = await rs.json(); } catch(e) {}
            renderTabelaPrecosFundicao();
        } catch(err) { console.error('Erro carregarPrecosFundicao:', err); }
    };

    window.alterarVisualizacaoFundicao = function(tipo) {
        visualizacaoFundicao = tipo;
        renderTabelaPrecosFundicao();
    };

    function renderTabelaPrecosFundicao() {
        const container = document.getElementById('fundicao-precos-categorias-container');
        if (!container) return;
        container.innerHTML = '';
        const categorias = [];
        localPrecosFundicao.forEach(p => { if (p.material_categoria && !categorias.includes(p.material_categoria)) categorias.push(p.material_categoria); });
        if (categorias.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:60px; color:#aaa;"><i class="fa-solid fa-fire-flame-curved" style="font-size:2rem; margin-bottom:16px; display:block; color:#ef4444;"></i>Nenhum item de fundição cadastrado ainda. Clique em <strong>Novo Item de Preço</strong> para começar.</div>';
            return;
        }
        const showCompleta = visualizacaoFundicao === 'completa';
        categorias.forEach(cat => {
            const precosCat = localPrecosFundicao.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = settingsPrecosFundicao[`cor_categoria_fundicao_${cat}`] || '#ef4444';
            const box = document.createElement('div');
            box.className = 'categoria-preco-box';
            box.style.borderColor = corCategoria;
            box.innerHTML = `
                <div class="categoria-preco-header" style="background: ${corCategoria};">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${cat.toUpperCase()}</span>
                        <input type="color" value="${corCategoria}" title="Alterar cor" style="border:none; background:none; cursor:pointer; width:22px; height:22px; padding:0; outline:none; border-radius:4px; vertical-align:middle;" onchange="alterarCorCategoriaFundicao('${cat}', this.value)">
                    </div>
                    <button type="button" class="restrito-financeiro" onclick="alterarValidadeGeralFundicao()" style="background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-calendar-days"></i> VIGÊNCIA ATÉ: ${validadeStr} <i class="fa-solid fa-pen-to-square" style="font-size:0.78rem;"></i>
                    </button>
                </div>
                <div class="categoria-preco-observacao">
                    <i class="fa-solid fa-circle-info"></i> Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg. | OBS: Variação de preço conforme atualização de mercado.
                </div>
                <div style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#172635; text-align:left;">
                                <th style="padding:10px;">Descrição</th>
                                <th style="padding:10px; text-align:right;">Preço Entregar (R$/kg)</th>
                                <th style="padding:10px; text-align:right;">Preço Coletar (R$/kg)</th>
                                ${showCompleta ? `
                                <th style="padding:10px; text-align:right; color:#ffeb3b;">Venda Ref (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Comissão (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">PIS/COFINS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">FIDC (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">ICMS (%)</th>
                                <th style="padding:10px; text-align:right; color:#aaa;">Frete Coleta (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#4fc3f7;">Venda Líquida (R$/kg)</th>
                                <th style="padding:10px; text-align:right; color:#ef4444;">Lucro Líq. Ent.</th>
                                <th style="padding:10px; text-align:right; color:#ef4444;">Margem Líq. Ent (%)</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Lucro Líq. Col.</th>
                                <th style="padding:10px; text-align:right; color:#3e7cb1;">Margem Líq. Col (%)</th>
                                ` : ''}
                                <th style="padding:10px;">NCM</th>
                                <th style="padding:10px; text-align:center; width:150px; min-width:150px; position:sticky; right:0; background:#172635; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${precosCat.map((p, idx) => {
                                const comissao = parseFloat(p.comissao || 0), pisCofins = parseFloat(p.pis_cofins || 0), fidc = parseFloat(p.fidc || 0), icms = parseFloat(p.icms || 0), freteColeta = parseFloat(p.frete_coleta || 0);
                                const totalDedPct = comissao + pisCofins + fidc + icms;
                                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                                const bgRow = idx % 2 === 0 ? 'background:#0d1826;' : 'background:#16273b;';
                                return `
                                    <tr style="${bgRow} border-bottom:1px solid #1e3650; transition:background 0.15s;" onmouseover="this.style.background='#1f4068'" onmouseout="this.style.background='${idx % 2 === 0 ? '#0d1826' : '#16273b'}'">
                                        <td style="padding:10px; color:#fff;"><strong>${p.material_nome}</strong></td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_entregar)}</td>
                                        <td style="padding:10px; text-align:right; color:#e0e8f0; font-weight:600;">R$ ${fmtBRL(p.preco_coletar)}</td>
                                        ${showCompleta ? `
                                        <td style="padding:10px; text-align:right; color:#ffeb3b; font-weight:bold;">R$ ${fmtBRL(p.venda_ref)}</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(comissao)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(pisCofins)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(fidc)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">${fmtBRL(icms)}%</td>
                                        <td style="padding:10px; text-align:right; color:#ccc;">R$ ${fmtBRL(freteColeta)}</td>
                                        <td style="padding:10px; text-align:right; color:#4fc3f7; font-weight:bold;">R$ ${fmtBRL(vendaLiquida)}</td>
                                        <td style="padding:10px; text-align:right; color:#ef4444;">R$ ${fmtBRL(lucroEnt)}</td>
                                        <td style="padding:10px; text-align:right; color:#ef4444; font-weight:bold;">${fmtBRL(margemEnt)}%</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1;">R$ ${fmtBRL(lucroCol)}</td>
                                        <td style="padding:10px; text-align:right; color:#3e7cb1; font-weight:bold;">${fmtBRL(margemCol)}%</td>
                                        ` : ''}
                                        <td style="padding:10px; color:#fff; font-weight:bold;">${p.material_ncm || '-'}</td>
                                        <td style="padding:6px 8px; text-align:center; position:sticky; right:0; background:${idx % 2 === 0 ? '#0d1826' : '#16273b'}; z-index:2; box-shadow:-3px 0 6px rgba(0,0,0,0.4); border-left:1px solid #283e56;">
                                            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                <button class="btn-secondary restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#5c1a1a; color:#fff; border:1px solid #ef4444; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="editarPrecoFundicao(${p.id})"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                                                <button class="btn-danger restrito-financeiro" style="padding:5px 9px; font-size:0.78rem; background:#c0392b; color:#fff; border:1px solid #e74c3c; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="deletarPrecoFundicao(${p.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:#131c26;"><td colspan="${showCompleta ? 16 : 5}" style="padding:10px; text-align:right; font-style:italic; color:#aaa;">DEMAIS MATERIAIS DE FUNDIÇÃO PREÇO SOBRE ANÁLISE (FOTO)</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(box);
        });
        applyRolePermissions();
    }

    window.alterarCorCategoriaFundicao = async function(cat, cor) {
        try {
            await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [`cor_categoria_fundicao_${cat}`]: cor }) });
            settingsPrecosFundicao[`cor_categoria_fundicao_${cat}`] = cor;
            renderTabelaPrecosFundicao();
        } catch(e) { console.error(e); }
    };

    window.abrirModalPrecoFundicao = function() {
        const hoje = new Date(); hoje.setMonth(hoje.getMonth() + 1);
        const validadeDefault = hoje.toISOString().split('T')[0];
        const [fy, fm, fd] = validadeDefault.split('-');
        const dataPreviewDefault = `${fd}/${fm}/${fy}`;
        const html = `
        <div id="modal-preco-fundicao" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#101a24;border:1px solid #ef4444;border-radius:12px;padding:18px 22px 16px;width:540px;max-width:96vw;max-height:92vh;overflow-y:auto;">
                <h3 style="margin-top:0;border-bottom:1px solid #2d3f52;padding-bottom:8px;color:#fff;font-size:1rem;">
                    <i class="fa-solid fa-fire-flame-curved" style="color:#ef4444;"></i> Definir Preço — Fundição
                </h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label style="font-size:0.8rem;">Material *</label>
                        <select id="prc-fund-material-id" class="noble-input" onchange="calcularMargemLiquidaModalFundicao()"><option value="">Selecione...</option></select>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.8rem;">Preço Venda Ref. (R\$/kg) *</label>
                        <input id="prc-fund-venda-ref" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularValoresDeAcordoComPorcentagemFundicao()">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label>Preço Entregar (R\$/kg) *</label>
                        <input id="prc-fund-entregar" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularPorcentagemDeEntregarFundicao()">
                    </div>
                    <div class="form-group">
                        <label>Preço Entregar (%)</label>
                        <input id="prc-fund-entregar-pct" type="number" step="0.1" class="noble-input" placeholder="Ex: 90" oninput="calcularValorDeEntregarFundicao()">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label>Preço Coletar (R\$/kg) *</label>
                        <input id="prc-fund-coletar" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularPorcentagemDeColetarFundicao()">
                    </div>
                    <div class="form-group">
                        <label>Preço Coletar (%)</label>
                        <input id="prc-fund-coletar-pct" type="number" step="0.1" class="noble-input" placeholder="Ex: 85" oninput="calcularValorDeColetarFundicao()">
                    </div>
                </div>
                <div style="background:#162432;padding:8px 12px;border-radius:8px;border:1px solid #7f1d1d;margin-bottom:10px;">
                    <div style="font-weight:bold;color:#ef4444;font-size:0.8rem;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                        <i class="fa-solid fa-percent"></i> Composição Fiscal &amp; Deduções (% e R\$/kg)
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                        <div class="form-group">
                            <label style="font-size:0.75rem;">Comissão (%)</label>
                            <input id="prc-fund-comissao" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalFundicao()">
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.75rem;">PIS/COFINS (%)</label>
                            <input id="prc-fund-piscofins" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalFundicao()">
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.75rem;">FIDC (%)</label>
                            <input id="prc-fund-fidc" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalFundicao()">
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.75rem;">ICMS (%)</label>
                            <input id="prc-fund-icms" type="number" step="0.1" class="noble-input" placeholder="0.0" oninput="calcularMargemLiquidaModalFundicao()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.75rem;">Frete Coleta (R\$/kg)</label>
                        <input id="prc-fund-frete" type="number" step="0.01" class="noble-input" placeholder="0.00" oninput="calcularMargemLiquidaModalFundicao()">
                    </div>
                </div>
                <div style="background:#0a1622;padding:8px 12px;border-radius:8px;border-left:4px solid #ef4444;margin-bottom:10px;">
                    <div style="font-size:0.8rem;text-transform:uppercase;font-weight:bold;color:#aaa;margin-bottom:6px;">
                        <i class="fa-solid fa-calculator" style="color:#ef4444;"></i> Simulação de Margem Líquida Real
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:0.82rem;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #1a2a3a;">
                        <div>
                            <span style="color:#888;">Total Deduções:</span>
                            <div style="color:#ff6b6b;font-weight:bold;" id="prc-fund-live-deducoes">0.00% (R\$ 0,00)</div>
                        </div>
                        <div>
                            <span style="color:#888;">Venda Líquida:</span>
                            <div style="color:#ffeb3b;font-weight:bold;" id="prc-fund-live-venda-liq">R\$ 0,00/kg</div>
                        </div>
                        <div>
                            <span style="color:#888;">Frete Coleta:</span>
                            <div style="color:#aaa;font-weight:bold;" id="prc-fund-live-frete">R\$ 0,00/kg</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem;">
                        <div style="background:#0f251d;padding:8px;border-radius:6px;border:1px solid #1a4d36;">
                            <span style="color:#a8e6cf;font-size:0.75rem;text-transform:uppercase;font-weight:bold;">Margem Líquida Entrega</span>
                            <div style="font-size:1.05rem;font-weight:bold;color:#2AD07A;" id="prc-fund-live-margem-ent">0.00%</div>
                            <div style="font-size:0.75rem;color:#aaa;" id="prc-fund-live-lucro-ent">Lucro: R\$ 0,00/kg</div>
                        </div>
                        <div style="background:#250f0f;padding:8px;border-radius:6px;border:1px solid #7f1d1d;">
                            <span style="color:#fca5a5;font-size:0.75rem;text-transform:uppercase;font-weight:bold;">Margem Líquida Coleta</span>
                            <div style="font-size:1.05rem;font-weight:bold;color:#ef4444;" id="prc-fund-live-margem-col">0.00%</div>
                            <div style="font-size:0.75rem;color:#aaa;" id="prc-fund-live-lucro-col">Lucro: R\$ 0,00/kg</div>
                        </div>
                    </div>
                </div>
                <div class="form-group" style="margin-top:4px;">
                    <label style="font-size:0.8rem;">Válido Até * <span style="color:#aaa;font-size:0.75rem;font-weight:normal;">(aplicado a todos os materiais)</span></label>
                    <input id="prc-fund-validade" type="date" class="noble-input" value="${validadeDefault}" onchange="atualizarPreviewDataFundicao()">
                    <div style="display:flex;justify-content:space-between;align-items:center;background:#162738;padding:8px 12px;border-radius:6px;border:1px solid #7f1d1d;margin-top:6px;">
                        <span style="color:#aaa;font-size:0.82rem;">Data Selecionada:</span>
                        <strong id="prc-fund-data-preview" style="color:#ef4444;font-size:0.95rem;">${dataPreviewDefault}</strong>
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:14px;">
                    <button onclick="salvarPrecoFundicao()" class="btn-primary" style="flex:1;background:linear-gradient(135deg,#ef4444,#dc2626);"><i class="fa-solid fa-save"></i> Salvar</button>
                    <button onclick="document.getElementById('modal-preco-fundicao').remove()" class="btn-secondary" style="flex:1;">Cancelar</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.popularSelectMateriaisModal('prc-fund-material-id');
        setTimeout(() => window.calcularMargemLiquidaModalFundicao(), 50);
    };

    window.calcularPorcentagemDeEntregarFundicao = function() {
        const venda = parseFloat(document.getElementById('prc-fund-venda-ref')?.value) || 0;
        const entregar = parseFloat(document.getElementById('prc-fund-entregar')?.value) || 0;
        const pctEl = document.getElementById('prc-fund-entregar-pct');
        if (pctEl && venda > 0) pctEl.value = ((entregar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalFundicao();
    };
    window.calcularValorDeEntregarFundicao = function() {
        const venda = parseFloat(document.getElementById('prc-fund-venda-ref')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-fund-entregar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-fund-entregar');
        if (entEl && venda > 0) entEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalFundicao();
    };
    window.calcularPorcentagemDeColetarFundicao = function() {
        const venda = parseFloat(document.getElementById('prc-fund-venda-ref')?.value) || 0;
        const coletar = parseFloat(document.getElementById('prc-fund-coletar')?.value) || 0;
        const pctEl = document.getElementById('prc-fund-coletar-pct');
        if (pctEl && venda > 0) pctEl.value = ((coletar / venda) * 100).toFixed(1);
        window.calcularMargemLiquidaModalFundicao();
    };
    window.calcularValorDeColetarFundicao = function() {
        const venda = parseFloat(document.getElementById('prc-fund-venda-ref')?.value) || 0;
        const pct = parseFloat(document.getElementById('prc-fund-coletar-pct')?.value) || 0;
        const colEl = document.getElementById('prc-fund-coletar');
        if (colEl && venda > 0) colEl.value = ((pct / 100) * venda).toFixed(2);
        window.calcularMargemLiquidaModalFundicao();
    };
    window.calcularValoresDeAcordoComPorcentagemFundicao = function() {
        const venda = parseFloat(document.getElementById('prc-fund-venda-ref')?.value) || 0;
        const pctEnt = parseFloat(document.getElementById('prc-fund-entregar-pct')?.value) || 0;
        const pctCol = parseFloat(document.getElementById('prc-fund-coletar-pct')?.value) || 0;
        const entEl = document.getElementById('prc-fund-entregar');
        const colEl = document.getElementById('prc-fund-coletar');
        if (venda > 0) {
            if (pctEnt > 0 && entEl) entEl.value = ((pctEnt / 100) * venda).toFixed(2);
            if (pctCol > 0 && colEl) colEl.value = ((pctCol / 100) * venda).toFixed(2);
        }
        window.calcularPorcentagemDeEntregarFundicao();
        window.calcularPorcentagemDeColetarFundicao();
        window.calcularMargemLiquidaModalFundicao();
    };
    window.atualizarPreviewDataFundicao = function() {
        const val = document.getElementById('prc-fund-validade')?.value;
        const preview = document.getElementById('prc-fund-data-preview');
        if (preview) {
            if (val) { const [y, m, d] = val.split('-'); preview.textContent = `${d}/${m}/${y}`; }
            else { preview.textContent = '--/--/----'; }
        }
    };
    window.calcularMargemLiquidaModalFundicao = function() {
        const parseVal = id => parseFloat(String(document.getElementById(id)?.value || '0').replace(',', '.')) || 0;
        const vendaRef = parseVal('prc-fund-venda-ref');
        const precoEnt = parseVal('prc-fund-entregar');
        const precoCol = parseVal('prc-fund-coletar');
        const comissao = parseVal('prc-fund-comissao');
        const pisCofins = parseVal('prc-fund-piscofins');
        const fidc = parseVal('prc-fund-fidc');
        const icms = parseVal('prc-fund-icms');
        const freteColeta = parseVal('prc-fund-frete');
        const pctTotal = comissao + pisCofins + fidc + icms;
        const valDeducoes = vendaRef * (pctTotal / 100);
        const vendaLiquida = vendaRef - valDeducoes;
        const lucroEnt = vendaLiquida - precoEnt;
        const margemEnt = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;
        const lucroCol = vendaLiquida - precoCol - freteColeta;
        const margemCol = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const fmtN = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        set('prc-fund-live-deducoes', `${fmtN(pctTotal)}% (R$ ${fmtN(valDeducoes)}/kg)`);
        set('prc-fund-live-venda-liq', `R$ ${fmtN(vendaLiquida)}/kg`);
        set('prc-fund-live-frete', `R$ ${fmtN(freteColeta)}/kg`);
        const elME = document.getElementById('prc-fund-live-margem-ent');
        if (elME) { elME.textContent = `${fmtN(margemEnt)}%`; elME.style.color = margemEnt >= 15 ? '#2AD07A' : (margemEnt >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-fund-live-lucro-ent', `Lucro: R$ ${fmtN(lucroEnt)}/kg`);
        const elMC = document.getElementById('prc-fund-live-margem-col');
        if (elMC) { elMC.textContent = `${fmtN(margemCol)}%`; elMC.style.color = margemCol >= 15 ? '#ef4444' : (margemCol >= 5 ? '#f0b800' : '#ff4d4d'); }
        set('prc-fund-live-lucro-col', `Lucro: R$ ${fmtN(lucroCol)}/kg`);
    };


    window.salvarPrecoFundicao = async function() {
        const parseVal = v => parseFloat(String(v || '0').replace(',', '.')) || 0;
        const body = {
            material_id: parseInt(document.getElementById('prc-fund-material-id').value) || null,
            preco_entregar: parseVal(document.getElementById('prc-fund-entregar').value),
            preco_coletar:  parseVal(document.getElementById('prc-fund-coletar').value),
            venda_ref:      parseVal(document.getElementById('prc-fund-venda-ref').value),
            validade: document.getElementById('prc-fund-validade').value,
            aplicar_todos: true,
            comissao:       parseVal(document.getElementById('prc-fund-comissao').value),
            pis_cofins:     parseVal(document.getElementById('prc-fund-piscofins').value),
            fidc:           parseVal(document.getElementById('prc-fund-fidc').value),
            icms:           parseVal(document.getElementById('prc-fund-icms').value),
            frete_coleta:   parseVal(document.getElementById('prc-fund-frete').value)
        };
        if (!body.material_id || !body.validade) return _apexNotify('Atenção', 'Material e validade são obrigatórios.', 'warning');
        const btn = document.querySelector('#modal-preco-fundicao .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }
        try {
            const res = await fetch('/api/tabela-precos-fundicao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error(await res.text());
            document.getElementById('modal-preco-fundicao')?.remove();
            _apexNotify('Sucesso', 'Item de fundição salvo!', 'success');
            window.carregarPrecosFundicao();
        } catch(err) {
            _apexNotify('Erro', err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar'; }
        }
    };


    window.editarPrecoFundicao = function(id) {
        const p = localPrecosFundicao.find(x => x.id === id);
        if (!p) return;
        window.abrirModalPrecoFundicao();
        setTimeout(() => {
            document.getElementById('prc-fund-material-id').value = p.material_id;
            document.getElementById('prc-fund-entregar').value = parseFloat(p.preco_entregar || 0).toFixed(2);
            document.getElementById('prc-fund-coletar').value = parseFloat(p.preco_coletar || 0).toFixed(2);
            document.getElementById('prc-fund-venda-ref').value = parseFloat(p.venda_ref || 0).toFixed(2);
            document.getElementById('prc-fund-validade').value = p.validade ? p.validade.split('T')[0] : '';
            document.getElementById('prc-fund-comissao').value = parseFloat(p.comissao || 0).toFixed(2);
            document.getElementById('prc-fund-piscofins').value = parseFloat(p.pis_cofins || 0).toFixed(2);
            document.getElementById('prc-fund-fidc').value = parseFloat(p.fidc || 0).toFixed(2);
            document.getElementById('prc-fund-icms').value = parseFloat(p.icms || 0).toFixed(2);
            document.getElementById('prc-fund-frete').value = parseFloat(p.frete_coleta || 0).toFixed(2);
            window.calcularPorcentagemDeEntregarFundicao();
            window.calcularPorcentagemDeColetarFundicao();
            window.atualizarPreviewDataFundicao();
            window.calcularMargemLiquidaModalFundicao();
            const btn = document.querySelector('#modal-preco-fundicao .btn-primary');
            if (btn) { btn.onclick = () => atualizarPrecoFundicao(id); btn.innerHTML = '<i class="fa-solid fa-save"></i> Atualizar'; }
        }, 150);
    };

    window.atualizarPrecoFundicao = async function(id) {
        const body = { material_id: document.getElementById('prc-fund-material-id').value, preco_entregar: document.getElementById('prc-fund-entregar').value, preco_coletar: document.getElementById('prc-fund-coletar').value, venda_ref: document.getElementById('prc-fund-venda-ref').value, validade: document.getElementById('prc-fund-validade').value,
            aplicar_todos: true, comissao: document.getElementById('prc-fund-comissao').value, pis_cofins: document.getElementById('prc-fund-piscofins').value, fidc: document.getElementById('prc-fund-fidc').value, icms: document.getElementById('prc-fund-icms').value, frete_coleta: document.getElementById('prc-fund-frete').value };
        try {
            const res = await fetch(`/api/tabela-precos-fundicao/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error(await res.text());
            document.getElementById('modal-preco-fundicao')?.remove();
            _apexNotify('Sucesso', 'Item de fundição atualizado!', 'success');
            window.carregarPrecosFundicao();
        } catch(e) { _apexNotify('Erro', e.message, 'error'); }
    };

    window.deletarPrecoFundicao = async function(id) {
        if (!confirm('Confirma exclusão deste item de fundição?')) return;
        try { await fetch(`/api/tabela-precos-fundicao/${id}`, { method: 'DELETE' }); _apexNotify('Sucesso', 'Item excluído!', 'success'); window.carregarPrecosFundicao(); } catch(e) { _apexNotify('Erro', e.message, 'error'); }
    };

    window.alterarValidadeGeralFundicao = async function() {
        abrirModalVigenciaGeral('fundicao');
    };

    window.exportarTabelaFundicao = function() { _apexNotify('Sistema', 'Tabela de Fundição exportada!', 'info'); };

    window.exportarTabelaFundicaoPdf = async function(modo) {
        const isCompleta = modo === 'completa';
        const btnId = isCompleta ? 'btn-pdf-fundicao-completa' : 'btn-pdf-fundicao-fornecedor';
        const btn = document.getElementById(btnId);
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...'; }
        try {
            let settings = {};
            try { const r = await fetch('/api/settings'); settings = await r.json(); } catch(e) {}
            const lastUpdate = settings.tabela_precos_ultima_atualizacao || new Date().toLocaleDateString('pt-BR');
            let logoBase64 = null;
            try { const lr = await fetch('/assets/img/logo%20(2).png'); if (lr.ok) { const blob = await lr.blob(); logoBase64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); } } catch(e) {}
            const html = gerarHtmlTabelaGenericaParaPdf(localPrecosFundicao, lastUpdate, settings, logoBase64, modo, 'Fundição', '#ef4444', 'DEMAIS MATERIAIS DE FUNDIÇÃO PREÇO SOBRE ANÁLISE (FOTO)', 'cor_categoria_fundicao_');
            const base64 = await renderHtmlToPdfBase64(html, isCompleta);
            if (!base64) return _apexNotify('Atenção', 'Erro ao gerar PDF.', 'error');
            const a = document.createElement('a'); a.href = `data:application/pdf;base64,${base64}`;
            a.download = isCompleta ? 'Tabela_Fundicao_Geral.pdf' : 'Tabela_Fundicao_Fornecedor.pdf'; a.click();
        } catch(e) { _apexNotify('Erro', e.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = isCompleta ? '<i class="fa-solid fa-file-pdf" style="color:#ff4d4d;"></i> PDF Geral' : '<i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF Fornecedor'; } }
    };

    // =============================================================================
    // --- HELPER: Gerador de HTML PDF Genérico (shared por Volume e Fundição) ---
    // =============================================================================
    function gerarHtmlTabelaGenericaParaPdf(precos, lastUpdate, settings, logoBase64, modo, titulo, corPrimaria, textoRodape, prefixoCor) {
        const isCompleta = modo === 'completa';
        const categorias = [];
        precos.forEach(p => { if (p.material_categoria && !categorias.includes(p.material_categoria)) categorias.push(p.material_categoria); });

        function gerarGridLogo(src) {
            if (!src) return '';
            const cols = isCompleta ? 6 : 4, rows = 16;
            let g = '<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;">';
            for (let r = 0; r < rows; r++) {
                g += '<div style="display:flex;justify-content:space-around;align-items:center;padding:18px 0;">';
                for (let c = 0; c < cols; c++) g += `<img src="${src}" alt="" style="width:140px;opacity:0.07;transform:rotate(-20deg);display:block;flex-shrink:0;" />`;
                g += '</div>';
            }
            return g + '</div>';
        }

        const tituloPdf = isCompleta ? `Tabela Geral — ${titulo} (Visão Completa)` : `Tabela de ${titulo}`;
        let html = `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:25px;color:#333;background:#fff;width:100%;margin:0 auto;box-sizing:border-box;position:relative;">
            ${gerarGridLogo(logoBase64)}
            <div style="position:relative;z-index:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${corPrimaria};padding-bottom:20px;margin-bottom:25px;">
                    <div><img src="assets/img/apexlogo.png" alt="ApexTech Metais" style="height:60px;"></div>
                    <div style="text-align:right;">
                        <h1 style="margin:0;color:${corPrimaria};font-size:${isCompleta ? '1.6rem' : '1.8rem'};font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${tituloPdf}</h1>
                        <p style="margin:6px 0 0 0;font-size:0.95rem;color:#666;font-weight:500;">Última Atualização: <span style="color:${corPrimaria};font-weight:bold;">${lastUpdate}</span></p>
                    </div>
                </div>
                <div style="background:#f4f7fa;border-left:5px solid ${corPrimaria};border-radius:4px;padding:15px;margin-bottom:30px;">
                    <h4 style="margin:0 0 10px 0;color:${corPrimaria};font-size:1rem;">⚠️ Diretrizes Gerais de Compra</h4>
                    <ul style="margin:0;padding-left:20px;font-size:0.85rem;color:#444;line-height:1.5;">
                        <li>Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg.</li>
                        <li>OBS: Variação de preço conforme atualização de mercado.</li>
                        <li style="font-weight:bold;color:#c0392b;">${textoRodape}</li>
                    </ul>
                </div>`;

        categorias.forEach(cat => {
            const precosCat = precos.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCat = (settings && settings[`${prefixoCor}${cat}`]) || corPrimaria;
            html += `<div style="margin-bottom:30px;page-break-inside:avoid;border:1px solid ${corCat};border-radius:6px;overflow:hidden;">
                <div style="background:${corCat};color:#fff;padding:10px 15px;font-weight:bold;display:flex;justify-content:space-between;font-size:0.95rem;text-transform:uppercase;">
                    <span>${cat}</span><span style="font-size:0.85rem;font-weight:normal;opacity:0.9;">VIGÊNCIA ATÉ: ${validadeStr}</span>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:${isCompleta ? '0.75rem' : '0.8rem'};text-align:left;">
                    <thead><tr style="background:#f8f9fa;border-bottom:2px solid #ddd;">
                        <th style="padding:8px;border:1px solid #eee;font-weight:600;color:#555;">Descrição</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Preço Entregar (R$/kg)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Preço Coletar (R$/kg)</th>
                        ${isCompleta ? `
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#d97706;">Venda Ref (R$/kg)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Comissão (%)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">PIS/COFINS (%)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">FIDC (%)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">ICMS (%)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Frete Coleta</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#0284c7;">Venda Líq.</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#16a34a;">Lucro Líq. Ent.</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#16a34a;">Margem Ent (%)</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#2563eb;">Lucro Líq. Col.</th>
                        <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#2563eb;">Margem Col (%)</th>
                        ` : ''}
                        <th style="padding:8px;border:1px solid #eee;font-weight:600;color:#555;">NCM</th>
                    </tr></thead>
                    <tbody>`;
            precosCat.forEach((p, idx) => {
                const comissao = parseFloat(p.comissao || 0), pisCofins = parseFloat(p.pis_cofins || 0), fidc = parseFloat(p.fidc || 0), icms = parseFloat(p.icms || 0), freteColeta = parseFloat(p.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                const bgRow = idx % 2 === 0 ? '#ffffff' : '#e3ebf3';
                html += `<tr style="border-bottom:1px solid #c8d3e0;background-color:${bgRow};page-break-inside:avoid;">
                    <td style="padding:8px;border:1px solid #c8d3e0;color:#111;"><strong>${p.material_nome}</strong></td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#111;">R$ ${fmtBRL(p.preco_entregar)}</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#111;">R$ ${fmtBRL(p.preco_coletar)}</td>
                    ${isCompleta ? `
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#d97706;">R$ ${fmtBRL(p.venda_ref)}</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(comissao)}%</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(pisCofins)}%</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(fidc)}%</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(icms)}%</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">R$ ${fmtBRL(freteColeta)}</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#0284c7;">R$ ${fmtBRL(vendaLiquida)}</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#16a34a;">R$ ${fmtBRL(lucroEnt)}</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#16a34a;">${fmtBRL(margemEnt)}%</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#2563eb;">R$ ${fmtBRL(lucroCol)}</td>
                    <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#2563eb;">${fmtBRL(margemCol)}%</td>
                    ` : ''}
                    <td style="padding:8px;border:1px solid #c8d3e0;color:#111;font-weight:bold;">${p.material_ncm || '-'}</td>
                </tr>`;
            });
            html += `<tr style="background:#fafafa;"><td colspan="${isCompleta ? 15 : 4}" style="padding:10px;text-align:right;font-style:italic;color:#777;border:1px solid #eee;">${textoRodape}</td></tr>
                    </tbody></table></div>`;
        });
        html += `<div style="margin-top:40px;border-top:2px solid #ddd;padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:#555;">
            <div style="font-weight:bold;color:${corPrimaria};font-size:0.95rem;">✅ Aprovado pelo CEO Jose Tiago</div>
            <div style="text-align:right;color:#888;">Documento oficial ApexTech Metais • Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </div></div></div>`;
        return html;
    }

    async function renderHtmlToPdfBase64(htmlContent, isCompleta) {
        if (!window.html2pdf) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '1084px'; // Exactly fits A4 landscape width with 5mm margins at 96 DPI
        tempDiv.style.background = '#ffffff';
        tempDiv.style.padding = '0';
        tempDiv.innerHTML = htmlContent;
        
        const opt = {
            margin:       [5, 5, 5, 5],
            filename:     'tabela.pdf',
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: 'css', avoid: 'tr' }
        };

        try {
            const pdfOutput = await html2pdf().set(opt).from(tempDiv).outputPdf('datauristring');
            return pdfOutput.split(',')[1];
        } catch(err) { 
            console.error('Erro ao gerar PDF:', err); 
            return null; 
        }
    }

    // --- 4. ANÁLISE DE AMOSTRAS & LAUDOS ---
    window.initApexAmostras = function() {
        carregarAmostras();
        carregarCotacoesDolarLME();
    };

    
// MODULE_EXTRACTED: // ─── COTAÇÕES AO VIVO DÓLAR & LME (USD / BRL) ─────────────────────────────

// ─── MOTOR DE NOTIFICAÇÕES DO SININHO (DIRETORIA / ADM) ─────────────────────
    window.atualizarNotificacoesAprovacao = function() {
        if (!Array.isArray(localAmostras)) return;

        const pendentes = localAmostras.filter(a => 
            a.decisao_diretoria === 'Aguardando' || a.status === 'Aguardando Decisão de Compra'
        );

        const count = pendentes.length;
        const bNav = document.getElementById('badge-nav-aprovacoes');
        const bHeader = document.getElementById('bell-counter-badge');
        const bellIcon = document.getElementById('bell-icon-animated');
        const listEl = document.getElementById('bell-notif-list');

        if (bNav) {
            bNav.textContent = count;
            bNav.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (bHeader) {
            bHeader.textContent = count;
            bHeader.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (bellIcon) {
            if (count > 0) {
                bellIcon.style.color = '#ff4d4d';
                bellIcon.classList.add('fa-bounce');
            } else {
                bellIcon.style.color = '#f0c040';
                bellIcon.classList.remove('fa-bounce');
            }
        }

        if (listEl) {
            if (count === 0) {
                listEl.innerHTML = '<div style="color:#aaa; font-size:0.8rem; text-align:center; padding:12px;"><i class="fa-solid fa-check-circle" style="color:#2AD07A;"></i> Nenhuma aprovação pendente no momento.</div>';
            } else {
                listEl.innerHTML = pendentes.map(p => `
                    <div style="background:#162432; border:1px solid #1e4e8c; border-radius:6px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.2s;" onclick="abrirAmostraEDesmonte(${p.id})" onmouseover="this.style.borderColor='#2AD07A'" onmouseout="this.style.borderColor='#1e4e8c'" title="Clique para abrir e ver os detalhes desta amostra">
                        <div>
                            <div style="font-weight:bold; color:#2AD07A; font-size:0.85rem; text-decoration:underline;">
                                <i class="fa-solid fa-up-right-from-square" style="font-size:0.75rem; margin-right:4px;"></i> ${p.numero_amostra} - ${p.nome_material || 'Material'}
                            </div>
                            <div style="font-size:0.75rem; color:#ccc; margin-top:2px;">Forn: ${p.fornecedor_nome}</div>
                            <div style="font-size:0.72rem; color:#888;">Peso: ${parseFloat(p.peso_inicial).toFixed(3)} kg</div>
                        </div>
                        <button type="button" class="btn-primary" style="padding:5px 10px; font-size:0.75rem; background:#2AD07A; color:#000; font-weight:bold; border:none; border-radius:4px; cursor:pointer;" onclick="event.stopPropagation(); abrirAmostraEDesmonte(${p.id});">
                            <i class="fa-solid fa-gavel"></i> Analisar
                        </button>
                    </div>
                `).join('');
            }
        }
    };

    window.togglePainelNotificacoes = function() {
        const p = document.getElementById('bell-dropdown-panel');
        if (!p) return;
        p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
    };

    window.abrirAmostraEDesmonte = function(id) {
        document.getElementById('bell-dropdown-panel').style.display = 'none';
        const navAmo = document.getElementById('nav-amostras') || document.querySelector('.nav-item[data-target="amostras-view"]');
        if (navAmo) navAmo.click();
        abrirAnaliseDesmonte(id);
    };

    // Polling automático a cada 10 segundos
    setInterval(() => {
        if (typeof carregarAmostras === 'function') carregarAmostras();
    }, 10000);

    async function popularSeletoresAmostras() {
        const selFornModal = document.getElementById('amo-fornecedor');
        const selFornFiltro = document.getElementById('amostras-filtro-fornecedor');
        if (!selFornModal) return;

        try {
            if (selFornModal && selFornModal.tomselect) selFornModal.tomselect.destroy();
            if (selFornFiltro && selFornFiltro.tomselect) selFornFiltro.tomselect.destroy();

            const res = await fetch('/api/fornecedores?limit=9999');
            if (!res.ok) return;
            const data = await res.json();
            const todos = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

            selFornModal.innerHTML = '<option value="">Selecione o Fornecedor...</option>';
            if (selFornFiltro) selFornFiltro.innerHTML = '<option value="">Todos os Fornecedores</option>';

            todos.forEach(f => {
                const fnome = f.apelido || f.nome || f.razao_social;
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = fnome + (f.cnpj ? ` (${f.cnpj})` : '');
                selFornModal.appendChild(opt);

                if (selFornFiltro) {
                    const optF = document.createElement('option');
                    optF.value = f.id;
                    optF.textContent = fnome;
                    selFornFiltro.appendChild(optF);
                }
            });

            new TomSelect(selFornModal, { create: false, sortField: { field: "text", direction: "asc" } });
            if (selFornFiltro) new TomSelect(selFornFiltro, { create: false, sortField: { field: "text", direction: "asc" } });

        } catch (e) {
            console.error('Erro popularSeletoresAmostras', e);
        }
    }

    function renderAmostras() {
        const body = document.getElementById('amostras-table-body');
        if (!body) return;
        body.innerHTML = '';
        localAmostras.forEach(a => {
            const dataFmt = new Date(a.data).toLocaleDateString('pt-BR');
            const statusClass = a.status.toLowerCase().replace(/ /g, '-');
            
            // Delete button check
            let deleteBtnHtml = '';
            if (currentSimulatedRole === 'Administrador' || currentSimulatedRole === 'Diretoria') {
                deleteBtnHtml = `<button class="btn-refresh" style="background:none; border:none; color:#ff4d4d; margin-left:4px;" onclick="window.deletarAmostra(${a.id})" title="Excluir Amostra"><i class="fa-solid fa-trash"></i></button>`;
            }

            let statusBadgeHtml = `<span class="badge-status ${statusClass}" style="cursor:pointer;" onclick="abrirAnaliseDesmonte(${a.id})" title="Clique para ver os detalhes">${a.status}</span>`;
            if (a.decisao_diretoria === 'Aprovado') {
                const dtDec = a.data_decisao ? new Date(a.data_decisao).toLocaleDateString('pt-BR') : '';
                statusBadgeHtml = `<span class="badge-status aprovado-compra-autorizada" style="background:rgba(42,208,122,0.15); color:#2AD07A; border:1px solid #2AD07A; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:inline-block; cursor:pointer;" onclick="abrirAnaliseDesmonte(${a.id})" title="Aprovado por ${a.autorizado_por || 'Diretoria'} em ${dtDec}. Clique para ver os detalhes.">
                    <i class="fa-solid fa-check-circle"></i> Aprovado por ${a.autorizado_por || 'Diretoria'}${dtDec ? ' (' + dtDec + ')' : ''}
                </span>`;
            } else if (a.decisao_diretoria === 'Aguardando' || a.status === 'Aguardando Decisão de Compra') {
                statusBadgeHtml = `<span class="badge-status aguardando-decisao-de-compra" style="background:rgba(240,180,0,0.15); color:#f0c040; border:1px solid #f0b800; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:inline-block; cursor:pointer;" onclick="abrirAnaliseDesmonte(${a.id})" title="Clique para analisar e aprovar">
                    <i class="fa-solid fa-clock"></i> Aguardando Aprovação Diretoria
                </span>`;
            }

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', a.id);
            tr.setAttribute('data-fornecedor-id', a.fornecedor_id);
            tr.setAttribute('data-data', a.data ? a.data.split('T')[0] : '');

            tr.innerHTML = `
                <td style="padding:12px; text-align:center;">
                    <input type="checkbox" class="chk-amostra-select" value="${a.id}">
                </td>
                <td style="padding:12px;">
                    <a href="#" onclick="event.preventDefault(); abrirAnaliseDesmonte(${a.id});" style="color:#2AD07A; font-weight:bold; text-decoration:underline;" title="Clique para ver os detalhes da amostra">${a.numero_amostra}</a>
                </td>
                <td style="padding:12px;">${dataFmt}</td>
                <td style="padding:12px;">${a.fornecedor_nome}</td>
                <td style="padding:12px; color:#2AD07A; font-weight:600; cursor:pointer;" onclick="abrirAnaliseDesmonte(${a.id})" title="Clique para ver os detalhes">${a.nome_material || '-'}</td>
                <td style="padding:12px;">${a.responsavel}</td>
                <td style="padding:12px; text-align:right;">${parseFloat(a.peso_inicial).toFixed(3)} kg</td>
                <td style="padding:12px; text-align:center;">${statusBadgeHtml}</td>
                <td style="padding:12px; text-align:center;">
                    <button class="btn-refresh" style="background:none; border:none; color:#2AD07A;" onclick="window.gerarLaudoPDF(${a.id})" title="Baixar Laudo PDF"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                </td>
                <td style="padding:12px; text-align:center; display:flex; align-items:center; justify-content:center; gap:4px;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.78rem;" onclick="abrirAnaliseDesmonte(${a.id})"><i class="fa-solid fa-vial"></i> Analisar</button>
                    <button class="btn-secondary" style="padding:4px 8px; font-size:0.78rem; background:#1e3a5f; color:#fff;" onclick="gerarEtiquetaQRAmostra(${a.id})" title="Imprimir Etiqueta com QR Code"><i class="fa-solid fa-qrcode"></i></button>
                    ${deleteBtnHtml}
                </td>
            `;
            body.appendChild(tr);
        });
    }

    window.alternarMarcarTodasAmostras = function(chkGlobal) {
        const checkboxes = document.querySelectorAll('.chk-amostra-select');
        checkboxes.forEach(chk => { chk.checked = chkGlobal.checked; });
    };

    window.filtrarAmostras = function() {
        const searchVal = (document.getElementById('amostras-search')?.value || '').toLowerCase();
        const fornFiltroVal = document.getElementById('amostras-filtro-fornecedor')?.value || '';
        const dtInicioVal = document.getElementById('amostras-data-inicio')?.value || '';
        const dtFimVal = document.getElementById('amostras-data-fim')?.value || '';

        const rows = document.querySelectorAll('#amostras-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const fornId = row.getAttribute('data-fornecedor-id') || '';
            const dtRow = row.getAttribute('data-data') || '';

            let matchText = !searchVal || text.includes(searchVal);
            let matchForn = !fornFiltroVal || fornId === fornFiltroVal;
            let matchDtInicio = !dtInicioVal || (dtRow >= dtInicioVal);
            let matchDtFim = !dtFimVal || (dtRow <= dtFimVal);

            row.style.display = (matchText && matchForn && matchDtInicio && matchDtFim) ? '' : 'none';
        });
    };

    window.abrirAmostraPorNumero = function(numero) {
        const navAmo = document.getElementById('nav-amostras') || document.querySelector('.nav-item[data-target="amostras-view"]');
        if (navAmo) {
            navAmo.click();
            const searchInput = document.getElementById('amostras-search');
            if (searchInput) {
                searchInput.value = numero;
                window.filtrarAmostras();
            }
        }
    };

    window.deletarAmostra = async function(id) {
        if (currentSimulatedRole !== 'Administrador' && currentSimulatedRole !== 'Diretoria') {
            _apexNotify('Atenção', 'Erro: Apenas o Administrador ou Diretoria podem excluir amostras.', 'error');
            return;
        }
        if (!confirm('Tem certeza de que deseja excluir permanentemente esta amostra e todas as suas análises de componentes?')) return;
        try {
            const res = await fetch(`/api/amostras/${id}?user_perfil=${currentSimulatedRole}`, { method: 'DELETE' });
            if (res.ok) {
                _apexNotify('Sistema', 'Amostra excluída com sucesso!', 'info');
                carregarAmostras();
                fecharAnaliseDesmonte();
            } else {
                const data = await res.json();
                _apexNotify('Atenção', 'Erro ao excluir: ' + (data.error || 'Erro desconhecido.'), 'error');
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.abrirModalAmostra = function() {
        const form = document.getElementById('form-amostra-apex');
        if (form) form.reset();
        const idEl = document.getElementById('amo-id');
        if (idEl) idEl.value = '';
        
        let nextNumber = 1;
        if (typeof localAmostras !== 'undefined' && localAmostras.length > 0) {
            let maxNum = 0;
            localAmostras.forEach(a => {
                if (a.numero_amostra) {
                    let match = a.numero_amostra.match(/\d+/);
                    if (match) {
                        let num = parseInt(match[0], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
            nextNumber = maxNum + 1;
        }
        const numEl = document.getElementById('amo-numero');
        if (numEl) numEl.value = "AM-" + nextNumber.toString().padStart(3, '0');
        
        const modal = document.getElementById('modal-amostra');
        if (modal) modal.style.display = 'flex';
        if (dataEl) {
            // Usa horário local (não UTC) para evitar erro de data com fuso -03:00
            const hoje = new Date();
            const ano  = hoje.getFullYear();
            const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
            const dia  = String(hoje.getDate()).padStart(2, '0');
            dataEl.value = `${ano}-${mes}-${dia}`;
        }
        // Limpa fotos acumuladas de sessões anteriores
        if (typeof window._limparFotosRecebimento === 'function') window._limparFotosRecebimento();
    };

    window.fecharModalAmostra = function() {
        const modal = document.getElementById('modal-amostra');
        if (modal) modal.style.display = 'none';
    };

    // ─── FOTOS DO RECEBIMENTO (Etapa 1 — Múltiplas fotos via arquivo ou webcam) ─────────────────
    let _fotosRecebimento = []; // Array de { base64, blob, nome }

    // Limpa o array ao abrir o modal (chamado em abrirModalAmostra)
    window._limparFotosRecebimento = function() {
        _fotosRecebimento = [];
        renderFotosRecebimentoPreview();
    };

    // Adiciona fotos via seleção de arquivo
    window.adicionarFotosRecebimento = function(input) {
        if (!input.files || input.files.length === 0) return;
        const tasks = Array.from(input.files).map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    _fotosRecebimento.push({ base64: reader.result, blob: file, nome: file.name });
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        });
        Promise.all(tasks).then(renderFotosRecebimentoPreview);
        input.value = ''; // Reset para permitir selecionar o mesmo arquivo novamente
    };

    // Abre a webcam e, ao confirmar, adiciona a foto ao array _fotosRecebimento
    window.abrirWebcamRecebimento = function() {
        if (!window._WCM) { _apexNotify('Sistema', 'Módulo de webcam não inicializado. Tente recarregar a página.', 'info'); return; }
        window._WCM.abrirParaRecebimento(function(img64, blob) {
            const nome = 'webcam_recebimento_' + Date.now() + '.jpg';
            _fotosRecebimento.push({ base64: img64, blob: blob, nome: nome });
            renderFotosRecebimentoPreview();
        });
    };


    // Renderiza as miniaturas na galeria do formulário
    function renderFotosRecebimentoPreview() {
        const container = document.getElementById('amo-fotos-preview');
        if (!container) return;
        if (_fotosRecebimento.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = _fotosRecebimento.map((f, i) => `
            <div style="position:relative; display:inline-block;">
                <img src="${f.base64}" style="width:72px; height:72px; object-fit:cover; border-radius:6px; border:2px solid #2AD07A; display:block;" title="${f.nome}">
                <button type="button" onclick="removerFotoRecebimento(${i})"
                    style="position:absolute; top:-6px; right:-6px; background:#e05050; border:none; color:#fff; border-radius:50%; width:18px; height:18px; font-size:10px; line-height:18px; text-align:center; cursor:pointer; padding:0;">✕</button>
            </div>
        `).join('');
    }

    window.removerFotoRecebimento = function(idx) {
        _fotosRecebimento.splice(idx, 1);
        renderFotosRecebimentoPreview();
    };

    window.salvarAmostra = async function(e) {
        e.preventDefault();
        const nomeMaterialEl = document.getElementById('amo-nome-material');

        const data = {
            numero_amostra: document.getElementById('amo-numero').value,
            nome_material: nomeMaterialEl ? nomeMaterialEl.value : '',
            data: document.getElementById('amo-data').value,
            fornecedor_id: document.getElementById('amo-fornecedor').value,
            responsavel: document.getElementById('amo-responsavel').value,
            peso_inicial: document.getElementById('amo-peso').value,
            observacoes: document.getElementById('amo-obs').value,
            foto_original: ''
        };

        try {
            const res = await fetch('/api/amostras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const newAmostra = await res.json();

            // Upload de todas as fotos acumuladas (via arquivo ou webcam)
            if (newAmostra && newAmostra.id && _fotosRecebimento.length > 0) {
                const formData = new FormData();
                formData.append('tipo', 'bruta');
                formData.append('etapa', 'Recebimento');
                for (const fotoObj of _fotosRecebimento) {
                    let blobToSend;
                    if (fotoObj.base64 && fotoObj.base64.startsWith('data:')) {
                        // Reconverter do base64 armazenado para garantir bytes íntegros
                        try {
                            const byteStr = atob(fotoObj.base64.split(',')[1]);
                            const mime    = fotoObj.base64.split(',')[0].split(':')[1].split(';')[0];
                            const ab = new ArrayBuffer(byteStr.length);
                            const ia = new Uint8Array(ab);
                            for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
                            blobToSend = new Blob([ab], { type: mime });
                        } catch(e) {
                            blobToSend = fotoObj.blob; // fallback
                        }
                    } else {
                        blobToSend = fotoObj.blob; // arquivo selecionado por input file
                    }
                    formData.append('fotos', blobToSend, fotoObj.nome);
                }
                await fetch(`/api/amostras/${newAmostra.id}/fotos`, {
                    method: 'POST',
                    body: formData
                });
            }

            // Limpa as fotos após salvar
            _fotosRecebimento = [];
            renderFotosRecebimentoPreview();

            fecharModalAmostra();
            carregarAmostras();
        } catch (err) {
            console.error('Erro ao salvar amostra:', err);
        }
    };


    // ─── NAVEGAÇÃO DE TELAS ESTILO ERP ENTERPRISE (SAP / ORACLE / SANKHYA) ──────
    // ─── NAVEGAÇÃO DE TELAS ESTILO ERP ENTERPRISE (SAP / ORACLE / SANKHYA) ──────
    window.mudarTelaEtapa = function(etapaNum) {
        const idMap = {
            1: 'tela-etapa-1',
            2: 'tela-etapa-2',
            3: 'tela-etapa-3',
            4: 'tela-etapa-4'
        };
        const targetId = idMap[etapaNum];
        if (!targetId) return;

        // Etapa 4: acesso restrito
        if (etapaNum === 4) {
            if (currentSimulatedRole !== 'Administrador' && currentSimulatedRole !== 'Diretoria') {
                _apexNotify('Sistema', '🔒 Acesso Restrito ao Nível de Diretoria / Administrador (ERP Security Level).\n\nUsuários operacionais do laboratório não possuem permissão para visualizar ou definir preços estratégicos.', 'info');
                return;
            }
            // Revela a tela 4 para Admin/Diretoria
            const el4 = document.getElementById('tela-etapa-4');
            if (el4) el4.style.display = 'block';
        }

        const el = document.getElementById(targetId);
        if (el) {
            // Garante que o elemento está visível antes de rolar
            if (el.style.display === 'none') el.style.display = 'block';
            // Scroll com pequeno offset do topo da janela
            const yOffset = -80;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }

        // Atualiza highlight visual do stepper
        for (let i = 1; i <= 4; i++) {
            const btn = document.getElementById(`btn-stepper-etapa-${i}`);
            if (btn) {
                btn.style.background = i === etapaNum ? '#1e4e8c' : '#101a24';
                btn.style.borderColor = i === etapaNum ? '#2AD07A' : '#1e3a5f';
                btn.style.borderWidth = i === etapaNum ? '2px' : '1px';
            }
        }
    };

    // ─── ETIQUETA QR CODE FISICA DE LOTE ─────────────────────────────────────────
    window.gerarEtiquetaQRAmostra = function(id) {
        const amostra = localAmostras.find(a => a.id === id);
        if (!amostra) return;

        document.getElementById('qr-amostra-codigo').textContent = amostra.numero_amostra;
        document.getElementById('qr-amostra-material').textContent = amostra.nome_material || 'Material Não Especificado';
        document.getElementById('qr-amostra-detalhes').textContent = `Fornecedor: ${amostra.fornecedor_nome} | Peso: ${parseFloat(amostra.peso_inicial).toFixed(3)} kg`;

        const qrCanvas = document.createElement('canvas');
        const payloadText = JSON.stringify({
            empresa: 'APEXTECH METAIS',
            amostra: amostra.numero_amostra,
            material: amostra.nome_material || '',
            fornecedor: amostra.fornecedor_nome,
            peso: amostra.peso_inicial,
            data: amostra.data
        });

        // Usar lib JS ou Canvas Fallback para QR Code
        if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
            window.QRCode.toDataURL(payloadText, { width: 200, margin: 1 }, function (err, url) {
                if (!err) document.getElementById('qr-code-img').src = url;
            });
        } else {
            // Fallback via API rápida de QR Code
            document.getElementById('qr-code-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payloadText)}`;
        }

        document.getElementById('modal-qr-etiqueta').style.display = 'flex';
    };

    window.fecharModalQREtiqueta = function() {
        document.getElementById('modal-qr-etiqueta').style.display = 'none';
    };

    window.imprimirEtiquetaArea = function() {
        const printArea = document.getElementById('etiqueta-print-area').outerHTML;
        const win = window.open('', '', 'width=600,height=600');
        win.document.write(`<html><head><title>Imprimir Etiqueta Lote</title></head><body onload="window.print();window.close();" style="display:flex;justify-content:center;align-items:center;height:100vh;">${printArea}</body></html>`);
        win.document.close();
    };

    // ─── EXPORTAÇÃO EM BATCH DE LAUDOS PDF EM ZIP ───────────────────────────────
    window.exportarLaudosEmLoteZip = async function() {
        const checkboxes = document.querySelectorAll('.chk-amostra-select:checked');
        if (checkboxes.length === 0) {
            _apexNotify('Sistema', 'Por favor, selecione ao menos uma amostra na tabela para exportar em lote.', 'info');
            return;
        }

        if (typeof JSZip === 'undefined') {
            _apexNotify('Sistema', 'Biblioteca JSZip não carregada.', 'info');
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder('LAUDOS_APEXTECH');

        _apexNotify('Sistema', `Iniciando geração de ${checkboxes.length} laudo(s) em PDF... Aguarde a conclusão.`, 'info');

        for (const chk of checkboxes) {
            const amostraId = parseInt(chk.value);
            const amostra = localAmostras.find(a => a.id === amostraId);
            if (!amostra) continue;

            try {
                // Abre geração temporária
                await window.gerarLaudoPDF(amostraId);
            } catch(e) {
                console.error(`Erro ao incluir amostra ${amostraId} no ZIP:`, e);
            }
        }
        _apexNotify('Sistema', 'Geração em lote finalizada com sucesso!', 'info');
    };

    // Detalhes do Desmonte
    let componentesActivos = [];

    window.abrirAnaliseDesmonte = async function(id) {
        activeAmostraIdForDesmonte = id;
        try {
            const res = await fetch(`/api/amostras/${id}`);
            const data = await res.json();
            const { amostra, componentes } = data;

            document.getElementById('analise-titulo-amostra').textContent = amostra.numero_amostra;
            const matNomeEl = document.getElementById('analise-material-nome');
            if (matNomeEl) matNomeEl.textContent = amostra.nome_material || 'Material não informado';
            document.getElementById('analise-fornecedor-nome').textContent = amostra.fornecedor_nome;
            document.getElementById('analise-peso-inicial').textContent = parseFloat(amostra.peso_inicial).toFixed(3);

            // Atualiza os nós visuais do Stepper de Etapas
            atualizarStepperAmostra(amostra.status, amostra.decisao_diretoria);

            componentesActivos = componentes.map((c, idx) => {
                const urls = c.foto ? [c.foto] : [];
                return {
                    material_id:  c.material_id,
                    peso:         parseFloat(c.peso),
                    percentual:   parseFloat(c.percentual),
                    dificuldade:  c.dificuldade || 'Fácil',
                    foto:         c.foto || '',
                    fotosUrl:     urls,
                    fotosBase64:  [],
                    fotosDbIds:   [],
                    observacoes:  c.observacoes || ''
                };
            });

            // Restaurar fotos do banco por componente_idx (garante que fotos anteriores não somem)
            try {
                const ftRes  = await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/fotos`);
                const ftList = await ftRes.json();
                if (Array.isArray(ftList)) {
                    ftList.forEach(f => {
                        const cidx = f.componente_idx;
                        if (cidx !== null && cidx !== undefined && componentesActivos[cidx]) {
                            const url = `/api/amostras/${activeAmostraIdForDesmonte}/fotos/${f.id}/img`;
                            if (!componentesActivos[cidx].fotosUrl.includes(url)) {
                                componentesActivos[cidx].fotosUrl.push(url);
                            }
                            if (!componentesActivos[cidx].fotosDbIds) componentesActivos[cidx].fotosDbIds = [];
                            if (!componentesActivos[cidx].fotosDbIds.includes(f.id)) {
                                componentesActivos[cidx].fotosDbIds.push(f.id);
                            }
                            // Atualiza fallback de foto do componente
                            componentesActivos[cidx].foto = componentesActivos[cidx].foto || url;
                        }
                    });
                }
            } catch(e) { console.warn('Erro ao restaurar fotos dos componentes:', e); }


            // Inicializa cronômetro com tempo já salvo (se houver) e inicia a contagem automaticamente
            resetCronometro();
            if (amostra.tempo_desmonte) {
                cronSegundos = parseInt(amostra.tempo_desmonte);
                atualizarCronometroDisplay();
            }
            if (!cronInterval) {
                window.toggleCronometro();
            }

            // Parecer Técnico
            document.getElementById('analise-parecer-tecnico').value = amostra.parecer_tecnico || '';

            // Decisão da Diretoria e campos de precificação autorizada
            const painelDir = document.getElementById('painel-decisao-diretoria');
            const hContainer = document.getElementById('decisao-historica-container');
            const bannerAutonomia = document.getElementById('banner-autonomia-compra');
            
            // Popula os inputs de precificação e obs. diretoria
            document.getElementById('dir-preco-entregar').value = amostra.preco_compra_entregar || '';
            document.getElementById('dir-preco-coletar').value = amostra.preco_compra_coletar || '';
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 30);
            document.getElementById('dir-preco-validade').value = amostra.preco_validade ? amostra.preco_validade.split('T')[0] : defaultDate.toISOString().split('T')[0];
            const dirObsEl = document.getElementById('dir-obs-diretoria');
            if (dirObsEl) dirObsEl.value = amostra.obs_diretoria || '';

            if (painelDir) {
                if (currentSimulatedRole === 'Administrador' || currentSimulatedRole === 'Diretoria') {
                    painelDir.style.display = 'block';
                } else {
                    painelDir.style.display = 'none';
                }

                if (amostra.decisao_diretoria && amostra.decisao_diretoria !== 'Aguardando') {
                    hContainer.style.display = 'block';
                    const adminNome = amostra.admin_aprovacao || amostra.autorizado_por || 'Admin';
                    document.getElementById('decisao-historica-status').textContent = `${amostra.decisao_diretoria} (por ${adminNome})`;
                    document.getElementById('decisao-historica-status').style.color = amostra.decisao_diretoria === 'Aprovado' ? '#2AD07A' : '#ff4d4d';
                    document.getElementById('decisao-historica-motivo').textContent = amostra.motivo_reprovacao ? `Motivo: ${amostra.motivo_reprovacao}` : '';
                } else {
                    hContainer.style.display = 'none';
                }
            }
            
            // Exibir quem analisou
            const tecnicoDiv = document.getElementById('analise-tecnico-nome');
            if (tecnicoDiv && amostra.tecnico_analise) {
                tecnicoDiv.textContent = `Analisado por: ${amostra.tecnico_analise}`;
                tecnicoDiv.style.display = 'block';
            } else if (tecnicoDiv) {
                tecnicoDiv.style.display = 'none';
            }

            // Exibir banner de autonomia com detalhes explícitos
            if (bannerAutonomia) {
                if (amostra.decisao_diretoria === 'Aprovado') {
                    bannerAutonomia.style.display = 'flex';
                    document.getElementById('autonomia-val-entregar').textContent = parseFloat(amostra.preco_compra_entregar || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    document.getElementById('autonomia-val-coletar').textContent = parseFloat(amostra.preco_compra_coletar || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    
                    const dataValFmt = amostra.preco_validade ? new Date(amostra.preco_validade).toLocaleDateString('pt-BR') : '--/--/----';
                    document.getElementById('autonomia-val-validade').textContent = dataValFmt;
                    document.getElementById('autonomia-val-diretor').textContent = amostra.admin_aprovacao || amostra.autorizado_por || 'Administrador';
                } else {
                    bannerAutonomia.style.display = 'none';
                }
            }

            renderizarBotoesAcoesAmostra(amostra.status);
            renderComponentesDesmonte();
            // Carregar fotos da amostra
            await carregarFotosAmostra(id);
            document.getElementById('analise-desmonte-container').style.display = 'block';
            document.getElementById('analise-desmonte-container').scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            console.error(err);
        }
    };

    function renderizarBotoesAcoesAmostra(status) {
        const btnLiberar = document.getElementById('btn-liberar-pcp');
        const btnProcessar = document.getElementById('btn-processar-pcp');

        if (btnLiberar) btnLiberar.style.display = 'none';
        if (btnProcessar) btnProcessar.style.display = 'none';

        if (status === 'Aguardando Liberação PCP' || status === 'Aprovado - Compra Autorizada') {
            if (btnLiberar) btnLiberar.style.display = '';
        } else if (status === 'Liberado para Produção') {
            if (btnProcessar) btnProcessar.style.display = '';
        }
    }

    window.fecharAnaliseDesmonte = function() {
        document.getElementById('analise-desmonte-container').style.display = 'none';
        activeAmostraIdForDesmonte = null;
        resetCronometro();
    };

    // Cronômetro
    let cronInterval = null;
    let cronSegundos = 0;

    window.toggleCronometro = function() {
        const btn = document.getElementById('btn-cron-start');
        if (cronInterval) {
            clearInterval(cronInterval);
            cronInterval = null;
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        } else {
            cronInterval = setInterval(() => {
                cronSegundos++;
                atualizarCronometroDisplay();
            }, 1000);
            btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
        }
    };

    window.resetCronometro = function() {
        if (cronInterval) {
            clearInterval(cronInterval);
            cronInterval = null;
        }
        cronSegundos = 0;
        atualizarCronometroDisplay();
        document.getElementById('manual-tempo-input').value = '';
        const btn = document.getElementById('btn-cron-start');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
    };

    function atualizarCronometroDisplay() {
        const min = Math.floor(cronSegundos / 60).toString().padStart(2, '0');
        const seg = (cronSegundos % 60).toString().padStart(2, '0');
        const display = document.getElementById('cronometro-display');
        if (display) display.textContent = `${min}:${seg}`;
    }

    window.ajustarTempoManualmente = function(val) {
        const min = parseInt(val) || 0;
        cronSegundos = min * 60;
        atualizarCronometroDisplay();
    };

    // Upload de Fotos (redireciona para webcam nativa)
    window.simularUploadFoto = function(idx) {
        if (typeof window.abrirWebcamModal === 'function') {
            window.abrirWebcamModal('separada', 'Desmonte');
        } else {
            const inp = document.getElementById('foto-input-bruta');
            if (inp) inp.click();
        }
    };

    function atualizarStepperAmostra(status, decisaoDiretoria) {
        const s1 = document.getElementById('step-node-1');
        const s2 = document.getElementById('step-node-2');
        const s3 = document.getElementById('step-node-3');
        const s4 = document.getElementById('step-node-4');
        if (!s1 || !s2 || !s3 || !s4) return;

        // Exibe todas as etapas em uma única página longa de forma contínua
        const t1 = document.getElementById('tela-etapa-1');
        const t2 = document.getElementById('tela-etapa-2');
        const t3 = document.getElementById('tela-etapa-3');
        const t4 = document.getElementById('tela-etapa-4');

        if (t1) t1.style.display = 'block';
        if (t2) t2.style.display = 'block';
        if (t3) t3.style.display = 'block';
        if (t4) {
            if (currentSimulatedRole === 'Administrador' || currentSimulatedRole === 'Diretoria') {
                t4.style.display = 'block';
            } else {
                t4.style.display = 'none'; // Segurança ERP para usuários comuns
            }
        }

        const setStepState = (el, active, completed, color = '#2AD07A') => {
            const badge = el.querySelector('span');
            if (completed) {
                el.style.borderLeftColor = color;
                el.style.background = 'rgba(42, 208, 122, 0.1)';
                if (badge) { badge.style.background = color; badge.style.color = '#000'; badge.innerHTML = '<i class="fa-solid fa-check"></i>'; }
            } else if (active) {
                el.style.borderLeftColor = '#3e7cb1';
                el.style.background = '#18324a';
                if (badge) { badge.style.background = '#3e7cb1'; badge.style.color = '#fff'; }
            } else {
                el.style.borderLeftColor = '#444';
                el.style.background = '#162432';
                if (badge) { badge.style.background = '#444'; badge.style.color = '#aaa'; }
            }
        };

        // Etapa 1 sempre concluída após criação do recebimento
        setStepState(s1, false, true);

        // Etapa 2: Desmonte (Ativa se Em Análise, Concluída se status for além de Em Análise)
        if (status === 'Em Análise') {
            setStepState(s2, true, false);
            setStepState(s3, false, false);
            setStepState(s4, false, false);
        } else {
            setStepState(s2, false, true);
            setStepState(s3, true, false);
            
            if (status === 'Aguardando Decisão de Compra') {
                setStepState(s3, false, true);
                setStepState(s4, true, false);
            } else if (decisaoDiretoria === 'Aprovado' || status === 'Aprovado - Compra Autorizada' || status === 'Aguardando Liberação PCP' || status === 'Liberado para Produção' || status === 'Processado') {
                setStepState(s3, false, true);
                setStepState(s4, false, true, '#2AD07A');
            } else if (decisaoDiretoria === 'Reprovado') {
                setStepState(s3, false, true);
                setStepState(s4, false, true, '#ff4d4d');
            }
        }
    }

    // ─── UPLOAD REAL DE FOTOS ───────────────────────────────────────────────────
    window.uploadFotos = async function(input, tipo, etapa) {
        if (!activeAmostraIdForDesmonte || !input.files || input.files.length === 0) return;
        const spinner = document.getElementById('foto-input-spinner');
        if (spinner) spinner.style.display = 'inline-flex';
        try {
            const formData = new FormData();
            formData.append('tipo', tipo || 'bruta');
            formData.append('etapa', etapa || 'Recebimento');
            for (const file of input.files) formData.append('fotos', file);
            const res = await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/fotos`, { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) {
                await carregarFotosAmostra(activeAmostraIdForDesmonte);
            } else {
                _apexNotify('Atenção', 'Erro ao enviar foto: ' + (result.error || 'desconhecido'), 'error');
            }
        } catch (err) {
            console.error('uploadFotos:', err);
        } finally {
            if (spinner) spinner.style.display = 'none';
            input.value = ''; // reset input
        }
    };

    async function carregarFotosAmostra(id) {
        try {
            const res  = await fetch(`/api/amostras/${id}/fotos`);
            const fotos = await res.json();
            renderFotosGallery(fotos, id);
        } catch (err) { console.error('carregarFotosAmostra:', err); }
    }

    function renderFotosGallery(fotos, amostraId) {
        const gallery     = document.getElementById('fotos-gallery');
        const placeholder = document.getElementById('fotos-placeholder');
        if (!gallery) return;
        // Remove thumbs anteriores mas mantém placeholder
        Array.from(gallery.children).forEach(el => { if (el.id !== 'fotos-placeholder') el.remove(); });
        if (!fotos || fotos.length === 0) {
            if (placeholder) placeholder.style.display = 'block';
            return;
        }
        if (placeholder) placeholder.style.display = 'none';

        // Ordenação cronológica estrita (Ordem em que foram tiradas: Recebimento -> Desmonte -> Componentes)
        const fotosOrdenadas = (fotos || []).slice().sort((a, b) => {
            const timeA = new Date(a.criado_em || 0).getTime() || a.id;
            const timeB = new Date(b.criado_em || 0).getTime() || b.id;
            return timeA - timeB;
        });

        fotosOrdenadas.forEach((foto, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative; width:125px; height:100px; border-radius:8px; overflow:hidden; border:2px solid #1e4e8c; flex-shrink:0; background:#0a141d;';
            const badge = document.createElement('span');
            const etapaTexto = foto.etapa || (foto.tipo === 'bruta' ? 'Recebimento' : 'Desmonte');
            if (etapaTexto.includes('Camada')) {
                badge.textContent = etapaTexto;
            } else {
                badge.textContent = `${index + 1}º ${etapaTexto}`;
            }
            
            let badgeBg = '#3e7cb1';
            if (etapaTexto === 'Recebimento') badgeBg = '#f0b800';
            else if (etapaTexto === 'Desmonte') badgeBg = '#3e7cb1';
            else if (etapaTexto === 'Viabilidade') badgeBg = '#9c27b0';
            else if (etapaTexto === 'Aprovação' || etapaTexto === 'Aprovação Adm') badgeBg = '#2AD07A';

            badge.style.cssText = `position:absolute;top:4px;left:4px;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:700;background:${badgeBg};color:#000;z-index:2;box-shadow:0 2px 4px rgba(0,0,0,0.5);`;
            
            const img = document.createElement('img');
            img.alt = foto.nome || 'Foto';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;cursor:pointer;';
            img.onerror = () => { img.src = 'assets/img/apexlogo.png'; };

            // Carrega a imagem via fetch (que injeta JWT pelo interceptor) e converte para blob URL
            const imgUrl = `/api/amostras/${amostraId}/fotos/${foto.id}/img`;
            (async () => {
                try {
                    const resp = await fetch(imgUrl);
                    if (!resp.ok) throw new Error('status ' + resp.status);
                    const blob = await resp.blob();
                    const objUrl = URL.createObjectURL(blob);
                    img.src = objUrl;
                    img.onclick = () => {
                        if (window._WCM && typeof window._WCM.ampliarSrc === 'function') {
                            window._WCM.ampliarSrc(objUrl);
                        }
                    };
                } catch(e) {
                    console.warn('[gallery] Erro ao carregar foto:', foto.id, e.message);
                    img.src = 'assets/img/apexlogo.png';
                }
            })();

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.title = 'Excluir foto';
            delBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(255,0,0,0.75);border:none;color:#fff;cursor:pointer;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;z-index:2;';
            delBtn.onclick = async () => {
                if (!confirm('Excluir esta foto?')) return;
                await fetch(`/api/amostras/${amostraId}/fotos/${foto.id}`, { method: 'DELETE' });
                await carregarFotosAmostra(amostraId);
            };
            wrapper.appendChild(badge);
            wrapper.appendChild(img);
            wrapper.appendChild(delBtn);
            gallery.appendChild(wrapper);
        });
    }

    
// MODULE_EXTRACTED: // ─── CALCULADORA FIDC ────────────────────────────────────────────────────────


// MODULE_EXTRACTED: // ─── TRILHA DE AUDITORIA ─────────────────────────────────────────────────────

// ─── PRÉVIA VISUAL DO LAUDO ─────────────────────────────────────────────────
    const previaLaudoItens = [];

    function adicionarPreviaLaudo(idx, imgBase64) {
        if (!imgBase64) return;
        const comp = componentesActivos[idx] || {};
        const nomeMaterial = comp.custom_name || (() => {
            const mat = localMateriais.find(m => m.id === comp.material_id);
            return mat ? mat.nome : 'Material';
        })();

        const item = {
            ts: Date.now(),
            nome: nomeMaterial,
            peso: comp.peso || 0,
            dificuldade: comp.dificuldade || 'Fácil',
            observacoes: comp.observacoes || '',
            img: imgBase64
        };
        previaLaudoItens.push(item);
        renderPreviaLaudo();
    }

    function renderPreviaLaudo() {
        const container = document.getElementById('previa-laudo-container');
        const grid = document.getElementById('previa-laudo-grid');
        if (!grid) return;
        container.style.display = previaLaudoItens.length > 0 ? 'block' : 'none';
        grid.innerHTML = previaLaudoItens.map((item, i) => `
            <div style="background:#0d1a24; border:1px solid #223547; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
                <div style="position:relative;">
                    <img src="${item.img}" style="width:100%; height:180px; object-fit:cover; display:block;">
                    <div style="position:absolute; top:8px; left:8px; background:rgba(13,26,36,0.85); border:1px solid #2AD07A; border-radius:20px; padding:2px 10px; font-size:0.72rem; color:#2AD07A; font-weight:bold;">
                        📸 #${i + 1} &nbsp;${new Date(item.ts).toLocaleTimeString('pt-BR')}
                    </div>
                </div>
                <div style="padding:12px;">
                    <div style="font-weight:bold; color:#fff; font-size:0.95rem; margin-bottom:6px;">${item.nome}</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                        <span style="background:#1e3a5f; color:#7ec8e3; border-radius:4px; padding:2px 8px; font-size:0.78rem;">⚖ ${parseFloat(item.peso).toFixed(3)} kg</span>
                        <span style="background:#1e3a20; color:#2AD07A; border-radius:4px; padding:2px 8px; font-size:0.78rem;">🔧 ${item.dificuldade}</span>
                    </div>
                    ${item.observacoes ? `<div style="color:#aaa; font-size:0.8rem; border-top:1px solid #223547; padding-top:8px;">${item.observacoes}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    window.limparPreviaLaudo = function() {
        previaLaudoItens.length = 0;
        renderPreviaLaudo();
    };

    window.alterarSelecaoMaterialComp = function(idx, val) {
        if (val === 'NEW') {
            componentesActivos[idx].material_id = 'NEW';
            componentesActivos[idx].custom_name = componentesActivos[idx].custom_name || '';
        } else {
            componentesActivos[idx].material_id = parseInt(val);
            delete componentesActivos[idx].custom_name;
        }
        renderComponentesDesmonte();
        if (val === 'NEW') {
            setTimeout(() => {
                const rows = document.querySelectorAll('#analise-componentes-body tr');
                if (rows[idx]) {
                    const inpCustom = rows[idx].querySelector('.inp-comp-custom');
                    if (inpCustom) inpCustom.focus();
                }
            }, 50);
        }
    };

    window.adicionarLinhaComponente = function() {
        componentesActivos.push({
            material_id: localMateriais[0] ? localMateriais[0].id : null,
            peso: 0.0,
            percentual: 0.0,
            dificuldade: 'Fácil',
            foto: '',
            fotosUrl: [],
            fotosBase64: [],
            observacoes: ''
        });
        renderComponentesDesmonte();
    };

    window.removerLinhaComponente = function(idx) {
        componentesActivos.splice(idx, 1);
        renderComponentesDesmonte();
    };

    window.atualizarComponenteData = function(idx, field, val) {
        if (field === 'material_id') {
            componentesActivos[idx].material_id = val === 'NEW' ? 'NEW' : parseInt(val);
        } else if (field === 'custom_name') {
            componentesActivos[idx].custom_name = val;
        } else if (field === 'peso') {
            componentesActivos[idx].peso = parseFloat(val) || 0.0;
        } else if (field === 'dificuldade') {
            componentesActivos[idx].dificuldade = val;
        } else if (field === 'foto') {
            componentesActivos[idx].foto = val;
        } else if (field === 'observacoes') {
            componentesActivos[idx].observacoes = val;
        }
        calcularAnaliseAmostra();
    };

    window.calcularAnaliseAmostra = function() {
        const pesoInicial = parseFloat(document.getElementById('analise-peso-inicial').textContent) || 0.0;
        
        // Executar cálculo centralizado no ApexEngine
        const resEngine = window.ApexEngine.calcularViabilidadeCompleta({
            pesoBruto: pesoInicial,
            componentes: componentesActivos,
            tabelaPrecos: fidcPrecosCache || [],
            margemPct: parseFloat(document.getElementById('fidc-margem')?.value || 100),
            dificuldadeBonusPct: parseFloat(document.getElementById('fidc-dificuldade')?.value || 0)
        });

        componentesActivos.forEach((c, idx) => {
            if (resEngine.componentes[idx]) {
                c.percentual = resEngine.componentes[idx].percentual;
            }
            const rows = document.querySelectorAll('#analise-componentes-body tr');
            if (rows[idx]) {
                const pctCell = rows[idx].querySelector('.val-comp-pct');
                if (pctCell) pctCell.textContent = fmtBRL(c.percentual) + ' %';
            }
        });

        if (resEngine.totalPesoRecuperado > pesoInicial) {
            _apexNotify('Sistema', 'Atenção: A soma do peso dos componentes não pode exceder o peso inicial da amostra!', 'info');
        }

        document.getElementById('resumo-peso-recuperado').textContent = resEngine.totalPesoRecuperado.toFixed(3);
        document.getElementById('resumo-peso-perda').textContent = resEngine.perdaFisicaKg.toFixed(3);
        document.getElementById('resumo-percentual-perda').textContent = fmtBRL(resEngine.percentualPerda);

        // Formula Química
        const formulaParts = componentesActivos.map(c => {
            const m = localMateriais.find(x => x.id === c.material_id);
            return `${c.percentual.toFixed(1)}% ${m ? m.nome : (c.custom_name || 'Desconhecido')}`;
        });
        if (resEngine.perdaFisicaKg > 0) {
            formulaParts.push(`${resEngine.percentualPerda.toFixed(1)}% Perda/Resíduos`);
        }
        document.getElementById('resumo-formula-quimica').textContent = formulaParts.join(' · ');

        if (window.recalcularFIDC) {
            window.recalcularFIDC();
        }
    };

    window.salvarAnaliseLaboratorial = async function() {
        if (!activeAmostraIdForDesmonte) return;
        calcularAnaliseAmostra();

        const pesoInicial = parseFloat(document.getElementById('analise-peso-inicial').textContent) || 0.0;
        const totalPesos = componentesActivos.reduce((sum, c) => sum + c.peso, 0);

        if (totalPesos > pesoInicial) {
            _apexNotify('Atenção', 'Erro: A soma do peso dos componentes é maior do que o peso total disponível.', 'error');
            return;
        }
        
        try {
            await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/componentes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    componentes: componentesActivos,
                    tempo_desmonte: cronSegundos,
                    parecer_tecnico: document.getElementById('analise-parecer-tecnico').value.trim(),
                    tecnico_analise: sessionStorage.getItem('apex_logged_user_name') || currentSimulatedRole
                })
            });
            // Muda status para sinalizar que precisa de decisão do Diretor
            await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Aguardando Decisão de Compra' })
            });
            // Disparo automático de e-mail ao Diretor
            try {
                const emailRes = await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/enviar-laudo-email`, { method: 'POST' });
                const emailData = await emailRes.json();
                const emailMsg = emailData.enviado
                    ? `E-mail enviado para ${emailData.destinatarios?.length || 0} destinatário(s).`
                    : `E-mail não enviado (${emailData.motivo || 'sem config'}).`;
                _apexNotify('Análise Salva com Sucesso!', 'A amostra foi enviada para decisão de compra pela Diretoria.\n\n' + emailMsg, 'success');
            } catch(e) {
                _apexNotify('Análise Salva com Sucesso!', 'A amostra foi enviada para decisão de compra pela Diretoria.', 'success');
            }
            fecharAnaliseDesmonte();
            carregarAmostras();
        } catch (err) {
            console.error(err);
        }
    };

    // Ações Diretoria
    window.abrirModalReprovacao = function() {
        document.getElementById('reprovacao-motivo-texto').value = '';
        document.getElementById('modal-reprovacao').style.display = 'flex';
    };

    window.fecharModalReprovacao = function() {
        document.getElementById('modal-reprovacao').style.display = 'none';
    };

    window.salvarDecisaoDiretoria = async function(decisao) {
        if (!activeAmostraIdForDesmonte) return;
        const motivo = document.getElementById('reprovacao-motivo-texto').value.trim();
        const precoEntregar = parseFloat(document.getElementById('dir-preco-entregar').value);
        const precoColetar = parseFloat(document.getElementById('dir-preco-coletar').value);
        const validade = document.getElementById('dir-preco-validade').value;
        const obsDir = (document.getElementById('dir-obs-diretoria') || {}).value || '';

        if (decisao === 'Reprovado' && !motivo) {
            _apexNotify('Sistema', 'Por favor, informe o motivo da reprovação.', 'info');
            return;
        }

        if (decisao === 'Aprovado') {
            if (isNaN(precoEntregar) || isNaN(precoColetar) || !validade) {
                _apexNotify('Sistema', 'Por favor, preencha os preços autorizados de compra (Entregar e Coletar) e a validade.', 'info');
                return;
            }
        }

        try {
            const res = await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/decisao`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decisao_diretoria: decisao,
                    motivo_reprovacao: motivo,
                    obs_diretoria: obsDir,
                    preco_compra_entregar: precoEntregar,
                    preco_compra_coletar: precoColetar,
                    preco_validade: validade,
                    user_perfil: currentSimulatedRole,
                    user_nome: sessionStorage.getItem('apex_logged_user_name') || currentSimulatedRole
                })
            });
            const data = await res.json();
            if (res.ok) {
                const emoji = decisao === 'Aprovado' ? '✅' : '❌';
                _apexNotify('Sistema', `${emoji} Decisão da Diretoria registrada: ${decisao}\n\nEsta decisão foi permanentemente registrada no laudo da amostra.`, 'info');
                fecharModalReprovacao();
                fecharAnaliseDesmonte();
                carregarAmostras();
            } else {
                _apexNotify('Atenção', 'Erro: ' + (data.error || 'Não foi possível registrar a decisão.'), 'error');
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.liberarLoteParaPCP = async function() {
        if (!activeAmostraIdForDesmonte) return;
        try {
            await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Liberado para Produção' })
            });
            _apexNotify('Sistema', 'Lote Aprovado e Liberado para Produção/PCP!', 'info');
            fecharAnaliseDesmonte();
            carregarAmostras();
        } catch (err) {
            console.error(err);
        }
    };

    window.confirmarProcessamentoIndustrial = async function() {
        if (!activeAmostraIdForDesmonte) return;
        try {
            await fetch(`/api/amostras/${activeAmostraIdForDesmonte}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Processado' })
            });
            _apexNotify('Sistema', 'Processamento confirmado! Componentes recuperados adicionados ao estoque.', 'info');
            fecharAnaliseDesmonte();
            carregarAmostras();
            carregarEstoque();
        } catch (err) {
            console.error(err);
        }
    };

    window.gerarLaudoPDF = async function(id) {
        const amostraId = id || activeAmostraIdForDesmonte;
        if (!amostraId) return;

        try {
            const res = await fetch(`/api/amostras/${amostraId}`);
            const data = await res.json();
            const { amostra, componentes } = data;

            // Carregar dados completos do Fornecedor vinculado
            let fornecedorObj = null;
            try {
                const fRes = await fetch('/api/fornecedores');
                const fList = await fRes.json();
                fornecedorObj = (fList || []).find(x => x.id === amostra.fornecedor_id);
            } catch(e) { console.warn('Erro ao carregar dados do fornecedor:', e); }

            // Carregar fotos registradas da amostra (por etapa)
            let fotosAmostraList = [];
            try {
                const ftRes = await fetch(`/api/amostras/${amostraId}/fotos`);
                const ftData = await ftRes.json();
                if (Array.isArray(ftData)) fotosAmostraList = ftData;
            } catch(e) { console.warn('Erro ao carregar fotos:', e); }

            // Carregar logo do cabeçalho
            let logoBase64 = null;
            try {
                const logoRes = await fetch('/assets/img/apexlogo.png');
                const logoBlob = await logoRes.blob();
                logoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(logoBlob);
                });
            } catch(e) { console.warn('Logo cabeçalho não carregado:', e); }

            // Carregar Marca d'Água: logo (2).png
            let watermarkBase64 = null;
            try {
                const wRes = await fetch('/assets/img/logo (2).png');
                const wBlob = await wRes.blob();
                watermarkBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(wBlob);
                });
            } catch(e) {
                console.warn('Watermark logo (2).png não carregado:', e);
                watermarkBase64 = logoBase64;
            }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            let currentPageNum = 1;

            function drawWatermark() {
                if (watermarkBase64) {
                    try {
                        pdf.saveGraphicsState();
                        pdf.setGState(new pdf.GState({ opacity: 0.09 }));
                        pdf.addImage(watermarkBase64, 'PNG', 25, 60, 160, 160, '', 'FAST');
                        pdf.restoreGraphicsState();
                    } catch(e) { console.warn(e); }
                }
            }

            function drawFooter(pageNum = 1) {
                pdf.setFillColor(13, 36, 22);
                pdf.rect(0, 283, 210, 14, 'F');
                pdf.setFillColor(42, 208, 122);
                pdf.rect(0, 283, 210, 1.5, 'F');
                pdf.setTextColor(42, 208, 122);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7.5);
                pdf.text('APEXTECH METAIS ERP', 15, 289);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(140, 210, 160);
                pdf.text('Tecnologia e Sustentabilidade na Reciclagem de Metais', 60, 289);
                pdf.setTextColor(255, 255, 255);
                pdf.text('Página ' + pageNum, 195, 289, { align: 'right' });
                pdf.setFontSize(7);
                pdf.setTextColor(120, 180, 140);
                pdf.text('Laudo No. APX-' + (amostra.numero_amostra || '') + '  |  ' + new Date().toLocaleDateString('pt-BR'), 15, 293);
            }

            function drawHeader() {
                pdf.setFillColor(13, 36, 22);
                pdf.rect(0, 0, 210, 42, 'F');
                pdf.setFillColor(42, 208, 122);
                pdf.rect(0, 42, 210, 2.5, 'F');

                if (logoBase64) {
                    try { pdf.addImage(logoBase64, 'PNG', 10, 5, 68, 23, '', 'FAST'); } catch(e) {}
                } else {
                    pdf.setTextColor(42, 208, 122);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(20);
                    pdf.text('APEXTECH METAIS', 15, 20);
                }

                pdf.setTextColor(140, 210, 160);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7.5);
                pdf.text('TECNOLOGIA E SUSTENTABILIDADE NA RECICLAGEM DE METAIS', 15, 32);
                pdf.text('www.apextechmetais.com.br  |  sac@apextechmetais.com.br', 15, 37);

                pdf.setTextColor(42, 208, 122);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.text('No. LAUDO: APX-' + (amostra.numero_amostra || ''), 195, 14, { align: 'right' });
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(255, 255, 255);
                pdf.text('EMISSÃO: ' + new Date().toLocaleDateString('pt-BR'), 195, 20, { align: 'right' });
                const decStatus = amostra.decisao_diretoria || 'AGUARDANDO';
                const sc = decStatus === 'Aprovado' ? [42, 208, 122] : decStatus === 'Reprovado' ? [255, 80, 80] : [220, 200, 60];
                pdf.setTextColor(...sc);
                pdf.setFont('helvetica', 'bold');
                pdf.text(decStatus.toUpperCase(), 195, 26, { align: 'right' });
            }

            function checarNovaPagina(necessarioMm = 20) {
                if (y + necessarioMm > 275) {
                    drawFooter(currentPageNum);
                    pdf.addPage();
                    currentPageNum++;
                    drawWatermark();
                    drawHeader();
                    y = 50;
                }
            }

            drawWatermark();
            drawHeader();

            let y = 50;

            // ─── SEÇÃO 1: DADOS COMPLETOS DO FORNECEDOR E REGISTRO DO LOTE ─────────
            pdf.setFillColor(13, 36, 22);
            pdf.rect(15, y, 180, 8, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text('DADOS COMPLETOS DO FORNECEDOR E REGISTRO DO LOTE', 17, y + 5.5);
            y += 12;

            const fnome = fornecedorObj ? (fornecedorObj.nome || fornecedorObj.apelido || amostra.fornecedor_nome) : (amostra.fornecedor_nome || '---');
            const fcnpj = fornecedorObj ? (fornecedorObj.cnpj || '---') : '---';
            const fcomp = fornecedorObj ? (fornecedorObj.comprador || '---') : '---';
            const ftel  = fornecedorObj ? ((fornecedorObj.fone1 || '') + ' ' + (fornecedorObj.email || '')).trim() : '---';
            const fend  = fornecedorObj ? ((fornecedorObj.endereco || '') + ' ' + (fornecedorObj.complemento || '')).trim() : '---';

            pdf.setFontSize(8.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(50, 50, 50);
            pdf.text('Fornecedor:', 17, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(fnome.toUpperCase(), 42, y);

            pdf.setFont('helvetica', 'bold');
            pdf.text('CNPJ/CPF:', 138, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(fcnpj, 160, y);
            y += 6;

            pdf.setFont('helvetica', 'bold');
            pdf.text('Material Recebido:', 17, y);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(10, 120, 50);
            pdf.text((amostra.nome_material || 'Material não informado').toUpperCase(), 48, y);
            pdf.setTextColor(50, 50, 50);

            pdf.setFont('helvetica', 'bold');
            pdf.text('Data Lote:', 138, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(new Date(amostra.data).toLocaleDateString('pt-BR'), 160, y);
            y += 6;

            pdf.setFont('helvetica', 'bold');
            pdf.text('Comprador / Contato:', 17, y);
            pdf.setFont('helvetica', 'normal');
            // Trunca para não sobrepor o campo Peso Inicial à direita
            const compTel = fcomp + (ftel ? ' (' + ftel + ')' : '');
            pdf.text(pdf.splitTextToSize(compTel, 110)[0], 52, y);

            pdf.setFont('helvetica', 'bold');
            pdf.text('Peso Inicial:', 138, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(parseFloat(amostra.peso_inicial || 0).toLocaleString('pt-BR') + ' kg', 160, y);
            y += 6;

            pdf.setFont('helvetica', 'bold');
            pdf.text('Responsável Téc:', 17, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(amostra.responsavel || 'Eng. Roberto', 48, y);

            if (fend) {
                pdf.setFont('helvetica', 'bold');
                pdf.text('Endereço:', 138, y);
                pdf.setFont('helvetica', 'normal');
                pdf.text(pdf.splitTextToSize(fend, 38)[0], 156, y);
            }
            y += 6;

            if (amostra.observacoes) {
                pdf.setFont('helvetica', 'bold');
                pdf.text('Observações:', 17, y);
                pdf.setFont('helvetica', 'normal');
                pdf.text(pdf.splitTextToSize(amostra.observacoes, 155)[0], 42, y);
                y += 6;
            }
            y += 2;

            pdf.setDrawColor(42, 208, 122);
            pdf.setLineWidth(0.5);
            pdf.line(15, y, 195, y);
            y += 6;

            // ─── SEÇÃO 2: REGISTRO FOTOGRÁFICO POR ETAPA E COMPONENTE ──────────────────────────────────
            checarNovaPagina(50);
            pdf.setFillColor(13, 36, 22);
            pdf.rect(15, y, 180, 8, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text('RASTREABILIDADE E REGISTRO FOTOGRÁFICO POR ETAPA', 17, y + 5.5);
            y += 12;

            // ── Helper: carrega uma imagem da API e retorna base64 ──
            async function _loadImgB64(url) {
                try {
                    const r = await fetch(url);
                    if (!r.ok) return null;
                    const blob = await r.blob();
                    return await new Promise(res => { const rd = new FileReader(); rd.onloadend = () => res(rd.result); rd.readAsDataURL(blob); });
                } catch(e) { return null; }
            }

            // ── Helper: desenha um bloco de foto no PDF ──
            function _drawFotoBloco(srcB64, label, bY, bH) {
                pdf.setFillColor(248, 252, 249);
                pdf.setDrawColor(13, 36, 22);
                pdf.setLineWidth(0.3);
                pdf.rect(15, bY, 180, bH, 'FD');
                pdf.setDrawColor(42, 208, 122);
                pdf.rect(17, bY + 3, 55, bH - 6);
                if (srcB64) {
                    try { pdf.addImage(srcB64, 'JPEG', 18, bY + 4, 53, bH - 8, '', 'FAST'); }
                    catch(e) { try { pdf.addImage(srcB64, 'PNG', 18, bY + 4, 53, bH - 8, '', 'FAST'); } catch(_) {} }
                } else {
                    pdf.setFillColor(220, 220, 220); pdf.rect(18, bY + 4, 53, bH - 8, 'F');
                    pdf.setTextColor(130, 130, 130); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
                    pdf.text('Sem foto', 30, bY + (bH / 2));
                }
                pdf.setTextColor(50, 50, 50); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
                pdf.text(pdf.splitTextToSize(label, 110), 76, bY + 9);
            }

            // ── ETAPA 1 — RECEBIMENTO ──
            {
                const blocoH = 42;
                checarNovaPagina(blocoH + 6);
                pdf.setFillColor(20, 60, 35); pdf.rect(15, y, 180, 6, 'F');
                pdf.setTextColor(42, 208, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
                pdf.text('ETAPA 1 — PRODUTO BRUTO & RECEBIMENTO', 17, y + 4.3);
                y += 8;
                checarNovaPagina(blocoH + 4);

                // Filtra fotos do Recebimento sem componente (fotos gerais de entrada do lote)
                const recebimentoFotos = fotosAmostraList.filter(f =>
                    (f.etapa || 'Recebimento') === 'Recebimento' &&
                    (f.componente_idx === null || f.componente_idx === undefined)
                );

                // Foto principal: foto_original da amostra OU, se vazia, a 1ª foto do banco
                let fotoOrigFinal = null;
                if (amostra.foto_original) {
                    fotoOrigFinal = await _loadImgB64(amostra.foto_original).catch(() => amostra.foto_original);
                }
                // Se foto_original vazio e existem fotos no banco, usa a primeira
                let recebimentoExtras = recebimentoFotos; // fotos adicionais a exibir abaixo
                if (!fotoOrigFinal && recebimentoFotos.length > 0) {
                    const primeiraFoto = recebimentoFotos[0];
                    fotoOrigFinal = await _loadImgB64(`/api/amostras/${amostraId}/fotos/${primeiraFoto.id}/img`);
                    recebimentoExtras = recebimentoFotos.slice(1); // as demais ficam como extras
                }

                const infoTextoRec = [
                    `Produto: ${(amostra.nome_material || 'Não informado').toUpperCase()}`,
                    `Código: APX-${amostra.numero_amostra || '000'}`,
                    `Data: ${new Date(amostra.data).toLocaleDateString('pt-BR')}`,
                    `Peso Bruto: ${parseFloat(amostra.peso_inicial || 0).toFixed(3)} kg`,
                    `Responsável: ${amostra.responsavel || '---'}`,
                    `Obs: ${(amostra.observacoes || 'Sem observações.').substring(0, 60)}`
                ].join('\n');

                _drawFotoBloco(fotoOrigFinal, infoTextoRec, y, blocoH);
                y += blocoH + 4;

                // Fotos adicionais do Recebimento (2ª em diante)
                for (const f of recebimentoExtras) {
                    checarNovaPagina(blocoH + 4);
                    const b64 = await _loadImgB64(`/api/amostras/${amostraId}/fotos/${f.id}/img`);
                    if (b64) { _drawFotoBloco(b64, `Foto Recebimento — ${f.nome || 'Lote Bruto'}`, y, blocoH); y += blocoH + 4; }
                }
            }

            // ── ETAPA 2 — DESMONTE: uma subseção por componente com TODAS as suas fotos ──
            {
                pdf.setFillColor(20, 60, 35); pdf.rect(15, y, 180, 6, 'F');
                pdf.setTextColor(42, 208, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
                pdf.text('ETAPA 2 — DESMONTE FÍSICO & TRIAGEM DE COMPONENTES', 17, y + 4.3);
                y += 8;

                // Agrupa fotos por componente_idx
                const fotosPorComp = {};
                for (const f of fotosAmostraList) {
                    if (f.componente_idx !== null && f.componente_idx !== undefined) {
                        if (!fotosPorComp[f.componente_idx]) fotosPorComp[f.componente_idx] = [];
                        fotosPorComp[f.componente_idx].push(f);
                    }
                }
                // Fotos do Desmonte não vinculadas a componente específico
                const fotosDesmonteGeral = fotosAmostraList.filter(f =>
                    (f.etapa || 'Desmonte') === 'Desmonte' && (f.componente_idx === null || f.componente_idx === undefined)
                );

                if (componentes && componentes.length > 0) {
                    for (let cIdx = 0; cIdx < componentes.length; cIdx++) {
                        const comp = componentes[cIdx];
                        const nomeComp = comp.material_nome || `Componente ${cIdx + 1}`;
                        const fotasComp = fotosPorComp[cIdx] || [];
                        const blocoH = 42;
                        // Cabeçalho do componente
                        checarNovaPagina(blocoH + 12);
                        pdf.setFillColor(30, 78, 140); pdf.rect(15, y, 180, 5, 'F');
                        pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
                        pdf.text(`COMPONENTE ${cIdx + 1}: ${nomeComp.toUpperCase()} — ${parseFloat(comp.peso).toFixed(3)} kg (${parseFloat(comp.percentual).toFixed(1)}%)`, 17, y + 3.5);
                        y += 7;

                        if (fotasComp.length === 0) {
                            // Sem fotos para este componente
                            checarNovaPagina(blocoH + 4);
                            _drawFotoBloco(null, `${nomeComp} | ${parseFloat(comp.peso).toFixed(3)} kg — ${parseFloat(comp.percentual).toFixed(1)}%\nDificuldade: ${comp.dificuldade || 'Fácil'}\nObs: ${(comp.observacoes || '').substring(0, 60) || 'Sem observações.'}`, y, blocoH);
                            y += blocoH + 4;
                        } else {
                            // Exibe TODAS as fotos do componente
                            for (let fIdx = 0; fIdx < fotasComp.length; fIdx++) {
                                const f = fotasComp[fIdx];
                                checarNovaPagina(blocoH + 4);
                                const b64 = await _loadImgB64(`/api/amostras/${amostraId}/fotos/${f.id}/img`);
                                const label = [
                                    `${nomeComp} — Foto ${fIdx + 1}/${fotasComp.length}`,
                                    `Peso: ${parseFloat(comp.peso).toFixed(3)} kg (${parseFloat(comp.percentual).toFixed(1)}%)`,
                                    `Dificuldade: ${comp.dificuldade || 'Fácil'}`,
                                    `Obs: ${(comp.observacoes || 'Sem observações.').substring(0, 60)}`
                                ].join('\n');
                                _drawFotoBloco(b64, label, y, blocoH);
                                y += blocoH + 4;
                            }
                        }
                    }
                }
                // Fotos de Desmonte gerais (não vinculadas a componente)
                for (const f of fotosDesmonteGeral) {
                    checarNovaPagina(42 + 4);
                    const b64 = await _loadImgB64(`/api/amostras/${amostraId}/fotos/${f.id}/img`);
                    if (b64) { _drawFotoBloco(b64, `Desmonte Geral — ${f.nome || 'Foto'}`, y, 42); y += 46; }
                }
            }

            // ── ETAPA 3 & 4: Viabilidade e Aprovação ──
            for (const etapaKey of ['Viabilidade', 'Aprovação']) {
                const fotasEtapa = fotosAmostraList.filter(f => f.etapa === etapaKey);
                if (fotasEtapa.length === 0) continue;
                checarNovaPagina(50);
                pdf.setFillColor(20, 60, 35); pdf.rect(15, y, 180, 6, 'F');
                pdf.setTextColor(42, 208, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
                pdf.text(`ETAPA — ${etapaKey.toUpperCase()}`, 17, y + 4.3);
                y += 8;
                for (const f of fotasEtapa) {
                    checarNovaPagina(42 + 4);
                    const b64 = await _loadImgB64(`/api/amostras/${amostraId}/fotos/${f.id}/img`);
                    if (b64) { _drawFotoBloco(b64, `${etapaKey} — ${f.nome || 'Foto'}`, y, 42); y += 46; }
                }
            }


            // ─── SEÇÃO 3: RESULTADO DA ANÁLISE FÍSICA E DESMONTE ────────────────────
            checarNovaPagina(55); // Garante 55mm livres para o bloco completo

            pdf.setFillColor(13, 36, 22);
            pdf.rect(15, y, 180, 8, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text('RESULTADO DA ANÁLISE FÍSICA E DESMONTE', 17, y + 5.5);

            let tableY = y + 11; // Inicia a tabela 11mm abaixo da barra de título

            // Cabeçalho da Tabela de Componentes (Altura 7mm)
            pdf.setFillColor(20, 60, 35);
            pdf.rect(15, tableY, 180, 7, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text('Material Recuperado', 18, tableY + 4.8);
            pdf.text('Peso Liq.', 110, tableY + 4.8);
            pdf.text('Rendimento', 145, tableY + 4.8);
            pdf.text('Dificuldade', 170, tableY + 4.8);
            
            tableY += 10.0; // Avança 10mm (7mm da caixa + 3mm de margem livre)

            let sumPeso = 0;
            pdf.setFont('helvetica', 'normal');

            if (componentes && componentes.length > 0) {
                componentes.forEach((c, idx) => {
                    checarNovaPagina(8);
                    if (idx % 2 === 0) {
                        pdf.setFillColor(238, 250, 242);
                        pdf.rect(15, tableY, 180, 7, 'F');
                    }
                    pdf.setTextColor(50, 50, 50);
                    pdf.setFontSize(8.5);
                    pdf.text((c.material_nome || '?') + ' (' + (c.material_categoria || '') + ')', 18, tableY + 4.8);
                    pdf.text(parseFloat(c.peso).toLocaleString('pt-BR') + ' kg', 110, tableY + 4.8);
                    pdf.text(fmtBRL(c.percentual) + ' %', 148, tableY + 4.8);
                    if (c.dificuldade) {
                        const dc = c.dificuldade === 'Alta' ? [200,50,50] : c.dificuldade === 'Média' ? [180,130,0] : [30,130,60];
                        pdf.setTextColor(...dc);
                        pdf.setFontSize(7.5);
                        pdf.text(c.dificuldade, 172, tableY + 4.8);
                    }
                    sumPeso += parseFloat(c.peso);
                    tableY += 8.5;
                });
            }

            // Linha de Perda Física / Resíduos Industriais (Altura 7mm, posicionada 10mm abaixo do cabeçalho)
            const perda = parseFloat(amostra.peso_inicial || 0) - sumPeso;
            const pctPerda = parseFloat(amostra.peso_inicial || 0) > 0 ? (perda / parseFloat(amostra.peso_inicial)) * 100 : 0;
            
            pdf.setFillColor(255, 240, 240);
            pdf.rect(15, tableY, 180, 7, 'F');
            pdf.setTextColor(180, 40, 40);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text('Resíduos Industriais / Perda Física', 18, tableY + 4.8);
            pdf.text((perda > 0 ? perda : 0).toLocaleString('pt-BR') + ' kg', 110, tableY + 4.8);
            pdf.text(fmtBRL(pctPerda > 0 ? pctPerda : 0) + ' %', 148, tableY + 4.8);
            
            tableY += 12;
            y = tableY; // Atualiza o ponteiro global y com o valor acumulado em tableY

            // Consolidação química
            checarNovaPagina(20);
            pdf.setFillColor(13, 36, 22);
            pdf.rect(15, y, 180, 15, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text('COMPOSIÇÃO CONSOLIDADA / FÓRMULA QUÍMICA:', 18, y + 5);
            pdf.setFont('courier', 'normal');
            pdf.setTextColor(170, 255, 200);
            pdf.setFontSize(7.5);
            const fstr = componentes.map(c => parseFloat(c.percentual).toFixed(1) + '% ' + (c.material_nome || '?').toUpperCase()).join('  -  ');
            pdf.text(pdf.splitTextToSize(fstr, 170)[0] || fstr, 18, y + 11);
            y += 19;

            // ─── SEÇÃO 4: PARECERES TÉCNICOS E DECISÃO DE COMPRA ───────────────────
            checarNovaPagina(45);
            pdf.setFillColor(13, 36, 22);
            pdf.rect(15, y, 180, 7, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text('PARECERES TÉCNICO E DECISÃO DE COMPRA', 17, y + 5);
            y += 10;

            // Parecer técnico
            pdf.setFillColor(235, 248, 240);
            pdf.rect(15, y, 180, 18, 'F');
            pdf.setFillColor(42, 140, 80);
            pdf.rect(15, y, 4, 18, 'F');
            pdf.setDrawColor(42, 140, 80);
            pdf.setLineWidth(0.3);
            pdf.rect(15, y, 180, 18);
            pdf.setTextColor(10, 70, 30);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.text('PARECER TÉCNICO (LABORATÓRIO):', 22, y + 5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(50, 50, 50);
            const pt = amostra.parecer_tecnico || '(sem observações informadas)';
            pdf.text(pdf.splitTextToSize(pt, 168).slice(0, 2), 22, y + 11);
            y += 22;

            // Decisão diretoria
            const decAprovada = amostra.decisao_diretoria === 'Aprovado';
            const isReprov = amostra.decisao_diretoria === 'Reprovado';
            const bgDec = decAprovada ? [235, 252, 240] : isReprov ? [252, 235, 235] : [248, 248, 235];
            const barDec = decAprovada ? [42, 168, 80] : isReprov ? [180, 40, 40] : [150, 140, 40];
            const txtDec = decAprovada ? [10, 70, 30] : isReprov ? [130, 20, 20] : [80, 70, 10];

            pdf.setFillColor(...bgDec);
            pdf.rect(15, y, 180, 24, 'F');
            pdf.setFillColor(...barDec);
            pdf.rect(15, y, 4, 24, 'F');
            pdf.setDrawColor(...barDec);
            pdf.setLineWidth(0.3);
            pdf.rect(15, y, 180, 24);
            pdf.setTextColor(...txtDec);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text('DECISÃO DA DIRETORIA: ' + (amostra.decisao_diretoria || 'AGUARDANDO').toUpperCase(), 22, y + 6);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(50, 50, 50);
            pdf.setFontSize(8);
            let dy = y + 12;
            if (amostra.obs_diretoria) {
                pdf.text(pdf.splitTextToSize('Obs: ' + amostra.obs_diretoria, 168).slice(0,1), 22, dy);
                dy += 5;
            }
            if (amostra.motivo_reprovacao) {
                pdf.setTextColor(160, 30, 30);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Motivo da Reprovação: ' + amostra.motivo_reprovacao, 22, dy);
                dy += 5;
            }
            if (decAprovada && amostra.preco_compra_entregar) {
                pdf.setTextColor(10, 100, 40);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Preço Autorizado - Entregar: R$ ' + fmtBRL(amostra.preco_compra_entregar) + '/kg  |  Coletar: R$ ' + fmtBRL(amostra.preco_compra_coletar || 0) + '/kg', 22, dy);
                dy += 5;
            }
            y += 28;

            // ─── SEÇÃO 5: ASSINATURAS E RASTREABILIDADE DIGITAL / ELETRÔNICA ────────
            checarNovaPagina(40);
            pdf.setFillColor(13, 36, 22);
            pdf.rect(15, y, 180, 7, 'F');
            pdf.setTextColor(42, 208, 122);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text('ASSINATURAS E RASTREABILIDADE DIGITAL / ELETRÔNICA', 17, y + 5);
            y += 12;

            const sigBoxWidth = 85;
            const sigY = y;

            // Assinatura Técnico Executor
            pdf.setDrawColor(42, 140, 80);
            pdf.setLineWidth(0.4);
            pdf.line(17, sigY + 12, 17 + sigBoxWidth, sigY + 12);
            pdf.setTextColor(30, 30, 30);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.text((amostra.tecnico_analise || amostra.responsavel || 'Analista de Laboratório').toUpperCase(), 17, sigY + 16);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(7);
            pdf.text('Perfil: Técnico Responsável / Laboratório', 17, sigY + 20);
            pdf.text('Status Execução: Desmonte e Triagem OK', 17, sigY + 24);

            // Assinatura Diretoria / Aprovador
            const dirX = 110;
            pdf.setDrawColor(42, 140, 80);
            pdf.setLineWidth(0.4);
            pdf.line(dirX, sigY + 12, dirX + sigBoxWidth, sigY + 12);
            pdf.setTextColor(30, 30, 30);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.text((amostra.autorizado_por || 'Diretoria ApexTech').toUpperCase(), dirX, sigY + 16);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(7);
            pdf.text('Perfil: Diretoria / Autorização Estratégica', dirX, sigY + 20);
            pdf.text('Decisão: ' + (amostra.decisao_diretoria || 'Aguardando'), dirX, sigY + 24);

            y += 30;

            // Rodapé final com total de páginas
            drawFooter(currentPageNum);

            pdf.save('LAUDO_APEXTECH_' + (amostra.numero_amostra || 'PDF') + '.pdf');

        } catch (err) {
            console.error('Erro ao gerar laudo PDF:', err);
            _apexNotify('Atenção', 'Erro ao gerar o laudo. Tente novamente.', 'error');
        }
    };

    // --- 6.5. CENTRAL BI (ANALYTICS) ---
    let biChartEvolucaoObj = null;
    let biChartComposicaoObj = null;
    let biChartFornecedoresObj = null;
    let biChartMargensObj = null;

    window.initApexBI = function() {
        carregarDadosBI();
    };

    async function carregarDadosBI() {
        try {
            const resAmo = await fetch('/api/amostras');
            const amostrasRaw = await resAmo.json();
            const amostras = Array.isArray(amostrasRaw) ? amostrasRaw : [];
            
            const resPlan = await fetch('/api/planejamento-compras');
            const planRaw = await resPlan.json();
            const planejamento = Array.isArray(planRaw) ? planRaw : [];

            const resEst = await fetch('/api/estoque');
            const { estoque } = await resEst.json();

            // ─── KPIs ───
            let pesoTotal = 0;
            let totalCompra = 0;
            let faturamento = 0;
            let lucroConsolidado = 0;

            const _planArray = Array.isArray(planejamento) ? planejamento : [];
            _planArray.forEach(p => {
                pesoTotal += parseFloat(p.peso_comprado) || 0;
                const totalC = (parseFloat(p.peso_comprado) || 0) * (parseFloat(p.preco_compra) || 0);
                const pesoMat = (parseFloat(p.peso_comprado) || 0) * ((parseFloat(p.percentual_rendimento) || 0) / 100);
                const totalV = pesoMat * (parseFloat(p.preco_venda_material) || 0);
                totalCompra += totalC;
                faturamento += totalV;
            });
            lucroConsolidado = faturamento - totalCompra;
            const margemConsolidada = faturamento > 0 ? (lucroConsolidado / faturamento) * 100 : 0;

            let totalPesoOriginalAmostras = 0;
            let totalPesoPerdaAmostras = 0;
            
            amostras.forEach(a => {
                if (a.status === 'Processado' || a.status === 'Liberado para Produção') {
                    const weight = parseFloat(a.peso_inicial) || 0;
                    totalPesoOriginalAmostras += weight;
                    
                    const lotes = planejamento.filter(l => l.amostra_id === a.id);
                    if (lotes.length > 0) {
                        const avgRend = lotes.reduce((acc, curr) => acc + parseFloat(curr.percentual_rendimento), 0) / lotes.length;
                        totalPesoPerdaAmostras += weight * (1 - (avgRend / 100));
                    } else {
                        totalPesoPerdaAmostras += weight * 0.05;
                    }
                }
            });
            const taxaPerdaIndustrial = totalPesoOriginalAmostras > 0 ? (totalPesoPerdaAmostras / totalPesoOriginalAmostras) * 100 : 2.5;

            document.getElementById('bi-kpi-peso-total').textContent = pesoTotal.toLocaleString('pt-BR') + ' kg';
            document.getElementById('bi-kpi-faturamento').textContent = 'R$ ' + faturamento.toLocaleString('pt-BR', {minimumFractionDigits:2});
            document.getElementById('bi-kpi-lucro').textContent = 'R$ ' + lucroConsolidado.toLocaleString('pt-BR', {minimumFractionDigits:2});
            document.getElementById('bi-kpi-margem').textContent = fmtBRL(margemConsolidada) + ' %';
            document.getElementById('bi-kpi-perda').textContent = fmtBRL(taxaPerdaIndustrial) + ' %';

            // ── Gráfico 1: Evolução Mensal ──
            const mesesMap = {};
            planejamento.forEach(p => {
                const m = p.mes || '2026-07';
                if (!mesesMap[m]) mesesMap[m] = { compra: 0, venda: 0, lucro: 0 };
                const totalC = (parseFloat(p.peso_comprado) || 0) * (parseFloat(p.preco_compra) || 0);
                const pesoMat = (parseFloat(p.peso_comprado) || 0) * ((parseFloat(p.percentual_rendimento) || 0) / 100);
                const totalV = pesoMat * (parseFloat(p.preco_venda_material) || 0);
                mesesMap[m].compra += totalC;
                mesesMap[m].venda += totalV;
                mesesMap[m].lucro += (totalV - totalC);
            });
            const mesesLabels = Object.keys(mesesMap).sort();
            const dataCompra = mesesLabels.map(m => mesesMap[m].compra);
            const dataVenda = mesesLabels.map(m => mesesMap[m].venda);
            const dataLucro = mesesLabels.map(m => mesesMap[m].lucro);

            if (biChartEvolucaoObj) biChartEvolucaoObj.destroy();
            const ctxEvol = document.getElementById('biChartEvolucao').getContext('2d');
            biChartEvolucaoObj = new Chart(ctxEvol, {
                type: 'bar',
                data: {
                    labels: mesesLabels,
                    datasets: [
                        { label: 'Custo Compra', data: dataCompra, backgroundColor: '#1e4e8c' },
                        { label: 'Faturamento Venda', data: dataVenda, backgroundColor: '#3e7cb1' },
                        { label: 'Lucro Bruto', data: dataLucro, backgroundColor: '#2AD07A' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { grid: { color: '#222' } } }
                }
            });

            // ── Gráfico 2: Composição das Amostras ──
            const compMap = {};
            estoque.forEach(e => {
                compMap[e.material_nome] = parseFloat(e.saldo) || 0;
            });
            const compLabels = Object.keys(compMap);
            const compData = Object.values(compMap);

            if (biChartComposicaoObj) biChartComposicaoObj.destroy();
            const ctxComp = document.getElementById('biChartComposicao').getContext('2d');
            biChartComposicaoObj = new Chart(ctxComp, {
                type: 'doughnut',
                data: {
                    labels: compLabels,
                    datasets: [{
                        data: compData,
                        backgroundColor: ['#e07b39', '#7eb3d5', '#a8c5a0', '#b0a0c0', '#d4b896', '#2AD07A', '#3e7cb1', '#cccccc']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            });

            // ── Gráfico 3: Ranking de Fornecedores ──
            const fornMap = {};
            planejamento.forEach(p => {
                const f = p.fornecedor_nome || 'Desconhecido';
                if (!fornMap[f]) fornMap[f] = { volume: 0, lucro: 0 };
                const totalC = (parseFloat(p.peso_comprado) || 0) * (parseFloat(p.preco_compra) || 0);
                const pesoMat = (parseFloat(p.peso_comprado) || 0) * ((parseFloat(p.percentual_rendimento) || 0) / 100);
                const totalV = pesoMat * (parseFloat(p.preco_venda_material) || 0);
                fornMap[f].volume += parseFloat(p.peso_comprado) || 0;
                fornMap[f].lucro += (totalV - totalC);
            });
            const fornLabels = Object.keys(fornMap);
            const fornVolumeData = fornLabels.map(f => fornMap[f].volume);
            const fornLucroData = fornLabels.map(f => fornMap[f].lucro);

            if (biChartFornecedoresObj) biChartFornecedoresObj.destroy();
            const ctxForn = document.getElementById('biChartFornecedores').getContext('2d');
            biChartFornecedoresObj = new Chart(ctxForn, {
                type: 'bar',
                data: {
                    labels: fornLabels,
                    datasets: [
                        { label: 'Lucro Projetado (R$)', data: fornLucroData, backgroundColor: '#2AD07A', yAxisID: 'y' },
                        { label: 'Volume (kg)', data: fornVolumeData, type: 'line', borderColor: '#3e7cb1', backgroundColor: 'transparent', yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { type: 'linear', display: true, position: 'left', grid: { color: '#222' } },
                        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
                    }
                }
            });

            // ── Gráfico 4: Margem de Compra Coleta vs Entrega ──
            const catMargem = {};
            localPrecos.forEach(p => {
                const cat = p.material_categoria;
                if (!catMargem[cat]) catMargem[cat] = { entrega: 0, coleta: 0, count: 0 };
                const lucroEnt = p.venda_ref - p.preco_entregar;
                const margemEnt = p.venda_ref > 0 ? (lucroEnt / p.venda_ref) * 100 : 0;
                const lucroCol = p.venda_ref - p.preco_coletar;
                const margemCol = p.venda_ref > 0 ? (lucroCol / p.venda_ref) * 100 : 0;
                catMargem[cat].entrega += margemEnt;
                catMargem[cat].coleta += margemCol;
                catMargem[cat].count++;
            });
            const catLabels = Object.keys(catMargem);
            const catEntrega = catLabels.map(c => catMargem[c].entrega / catMargem[c].count);
            const catColeta = catLabels.map(c => catMargem[c].coleta / catMargem[c].count);

            if (biChartMargensObj) biChartMargensObj.destroy();
            const ctxMarg = document.getElementById('biChartMargens').getContext('2d');
            biChartMargensObj = new Chart(ctxMarg, {
                type: 'bar',
                data: {
                    labels: catLabels,
                    datasets: [
                        { label: 'Margem Entrega (%)', data: catEntrega, backgroundColor: '#3e7cb1' },
                        { label: 'Margem Coleta (%)', data: catColeta, backgroundColor: '#e07b39' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { grid: { color: '#222' } } }
                }
            });

            // ── TOP 10 Melhores Produtos (Margem Líquida) ──
            const topBody = document.getElementById('bi-top10-table-body');
            if (topBody && localPrecos && localPrecos.length > 0) {
                const listComMargem = localPrecos.map(p => {
                    const com = parseFloat(p.comissao || 0);
                    const pis = parseFloat(p.pis_cofins || 0);
                    const fdc = parseFloat(p.fidc || 0);
                    const icm = parseFloat(p.icms || 0);
                    const frete = parseFloat(p.frete_coleta || 0);

                    const totalDedPct = com + pis + fdc + icm;
                    const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                    const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;

                    const lucroLiqEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                    const margemLiqEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroLiqEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;

                    const lucroLiqCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - frete;
                    const margemLiqCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroLiqCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;

                    return {
                        ...p,
                        vendaLiquida,
                        lucroLiqEnt,
                        margemLiqEnt,
                        lucroLiqCol,
                        margemLiqCol
                    };
                });

                listComMargem.sort((a, b) => b.margemLiqEnt - a.margemLiqEnt);
                const top10 = listComMargem.slice(0, 10);

                topBody.innerHTML = '';
                top10.forEach((item, idx) => {
                    const pos = idx + 1;
                    let posBadge = `<span class="bi-pos-badge" style="background:#223547; color:#fff; padding:3px 8px; border-radius:10px; font-weight:bold; font-size:0.8rem; display:inline-block; min-width:32px; text-align:center;">#${pos}</span>`;
                    if (pos === 1) posBadge = `<span class="bi-pos-badge" style="background:#ffb703; color:#000; padding:3px 8px; border-radius:10px; font-weight:bold; font-size:0.8rem; display:inline-block; min-width:32px; text-align:center;"><i class="fa-solid fa-crown"></i> #1</span>`;
                    else if (pos === 2) posBadge = `<span class="bi-pos-badge" style="background:#c0c0c0; color:#000; padding:3px 8px; border-radius:10px; font-weight:bold; font-size:0.8rem; display:inline-block; min-width:32px; text-align:center;">#2</span>`;
                    else if (pos === 3) posBadge = `<span class="bi-pos-badge" style="background:#cd7f32; color:#fff; padding:3px 8px; border-radius:10px; font-weight:bold; font-size:0.8rem; display:inline-block; min-width:32px; text-align:center;">#3</span>`;

                    let statusBadge = '<span class="bi-status-badge" style="background:#0d3020; color:#2AD07A; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Excelente</span>';
                    if (item.margemLiqEnt < 5) {
                        statusBadge = '<span class="bi-status-badge" style="background:#3a1515; color:#ff6b6b; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Atenção/Baixa</span>';
                    } else if (item.margemLiqEnt < 15) {
                        statusBadge = '<span class="bi-status-badge" style="background:#3a2e00; color:#f0b800; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Boa</span>';
                    }

                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #1a2a3a';
                    tr.innerHTML = `
                        <td style="padding:8px 10px; text-align:center;">${posBadge}</td>
                        <td style="padding:8px 10px;"><strong class="bi-mat-nome" style="color:#fff;">${item.material_nome || '-'}</strong></td>
                        <td style="padding:8px 10px; color:#aaa;" class="bi-mat-cat">${item.material_categoria || '-'}</td>
                        <td style="padding:8px 10px; text-align:right; color:#d97706; font-weight:bold;" class="bi-venda-ref">R$ ${fmtBRL(item.venda_ref)}</td>
                        <td style="padding:8px 10px; text-align:right;">R$ ${fmtBRL(item.preco_entregar)}</td>
                        <td style="padding:8px 10px; text-align:right;">R$ ${fmtBRL(item.preco_coletar)}</td>
                        <td style="padding:8px 10px; text-align:right; color:#2AD07A; font-weight:bold; font-size:0.88rem;">${fmtBRL(item.margemLiqEnt)}%</td>
                        <td style="padding:8px 10px; text-align:right; color:#4fc3f7; font-weight:bold; font-size:0.88rem;">${fmtBRL(item.margemLiqCol)}%</td>
                        <td style="padding:8px 10px; text-align:center;">${statusBadge}</td>
                    `;
                    topBody.appendChild(tr);
                });
            }

        } catch (err) {
            console.error(err);
        }
    }

    function popularSeletoresAmostras() {
        const plA = document.getElementById('pl-amostra');
        if (plA) {
            plA.innerHTML = '<option value="">-- Lote Avulso (Sem amostra) --</option>';
            localAmostras.forEach(a => {
                plA.innerHTML += `<option value="${a.id}">${a.numero_amostra} - ${a.fornecedor_nome} (${parseFloat(a.peso_inicial).toFixed(0)}kg)</option>`;
            });
        }
    }

    
// MODULE_EXTRACTED: // ─── 5. PLANEJAMENTO MENSAL DE FORNECEDORES & MOTOR PREDITIVO DE CENÁRIOS ───

// MODULE_EXTRACTED: // ─── MÓDULO DE PLANEJAMENTO ESTRATÉGICO V3 (TESTE META FATURAMENTO -> INSUMO) ─────────

    function gerarHtmlTabelaResiduosParaPdf(precos, dataUltimaAtualizacao, settings, logoBase64, modo = 'fornecedor') {
        const isCompleta = modo === 'completa';
        const activeSettings = settings || settingsPrecosResiduos || {};
        const tituloPdf = isCompleta ? 'Tabela Geral de Resíduos — Visão Completa' : 'Tabela de Preços — Resíduos';

        const categorias = [];
        precos.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) categorias.push(p.material_categoria);
        });

        function gerarGridLogo(src) {
            if (!src) return '';
            const cols = isCompleta ? 6 : 4;
            const rows = 16;
            let grid = '<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;">';
            for (let r = 0; r < rows; r++) {
                grid += '<div style="display:flex;justify-content:space-around;align-items:center;padding:18px 0;">';
                for (let c = 0; c < cols; c++) {
                    grid += `<img src="${src}" alt="" style="width:140px;opacity:0.07;transform:rotate(-20deg);display:block;flex-shrink:0;" />`;
                }
                grid += '</div>';
            }
            grid += '</div>';
            return grid;
        }

        let html = `
            <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:25px;color:#333;background:#ffffff;width:100%;margin:0 auto;box-sizing:border-box;position:relative;">
                ${gerarGridLogo(logoBase64)}
                <div style="position:relative;z-index:1;">
                    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1a5c38;padding-bottom:20px;margin-bottom:25px;">
                        <div><img src="assets/img/apexlogo.png" alt="ApexTech Metais" style="height:60px;"></div>
                        <div style="text-align:right;">
                            <h1 style="margin:0;color:#1a5c38;font-size:${isCompleta ? '1.6rem' : '1.8rem'};font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${tituloPdf}</h1>
                            <p style="margin:6px 0 0 0;font-size:0.95rem;color:#666;font-weight:500;">Última Atualização: <span style="color:#1a5c38;font-weight:bold;">${dataUltimaAtualizacao}</span></p>
                        </div>
                    </div>
                    <div style="background:#f4faf7;border-left:5px solid #2AD07A;border-radius:4px;padding:15px;margin-bottom:30px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <h4 style="margin:0 0 10px 0;color:#1a5c38;font-size:1rem;">⚠️ Diretrizes Gerais de Compra — Resíduos</h4>
                        <ul style="margin:0;padding-left:20px;font-size:0.85rem;color:#444;line-height:1.5;">
                            <li>Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg.</li>
                            <li>OBS: Variação de preço conforme atualização de mercado.</li>
                            <li style="font-weight:bold;color:#c0392b;">DEMAIS RESÍDUOS PREÇO SOBRE ANÁLISE (FOTO)</li>
                        </ul>
                    </div>`;

        categorias.forEach(cat => {
            const precosCat = precos.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = (activeSettings && activeSettings[`cor_categoria_residuo_${cat}`]) || '#2AD07A';

            html += `
                <div style="margin-bottom:30px;page-break-inside:avoid;border:1px solid ${corCategoria};border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="background:${corCategoria};color:#fff;padding:10px 15px;font-weight:bold;display:flex;justify-content:space-between;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.5px;">
                        <span>${cat}</span>
                        <span style="font-size:0.85rem;font-weight:normal;opacity:0.9;">VIGÊNCIA ATÉ: ${validadeStr}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:${isCompleta ? '0.75rem' : '0.8rem'};text-align:left;">
                        <thead>
                            <tr style="background:#f8f9fa;border-bottom:2px solid #ddd;">
                                <th style="padding:8px;border:1px solid #eee;font-weight:600;color:#555;">Descrição</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Preço Entregar (R$/kg)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Preço Coletar (R$/kg)</th>
                                ${isCompleta ? `
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#d97706;">Venda Ref (R$/kg)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Comissão (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">PIS/COFINS (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">FIDC (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">ICMS (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Frete Coleta</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#0284c7;">Venda Líq.</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#16a34a;">Lucro Líq. Ent.</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#16a34a;">Margem Ent (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#2563eb;">Lucro Líq. Col.</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#2563eb;">Margem Col (%)</th>
                                ` : ''}
                                <th style="padding:8px;border:1px solid #eee;font-weight:600;color:#555;">NCM</th>
                            </tr>
                        </thead>
                        <tbody>`;

            precosCat.forEach((p, idx) => {
                const comissao = parseFloat(p.comissao || 0);
                const pisCofins = parseFloat(p.pis_cofins || 0);
                const fidc = parseFloat(p.fidc || 0);
                const icms = parseFloat(p.icms || 0);
                const freteColeta = parseFloat(p.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                const bgRow = idx % 2 === 0 ? '#ffffff' : '#e8f5ee';
                html += `
                    <tr style="border-bottom:1px solid #c8d3e0;background-color:${bgRow};page-break-inside:avoid;">
                        <td style="padding:8px;border:1px solid #c8d3e0;color:#111;"><strong>${p.material_nome}</strong></td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#111;">R$ ${fmtBRL(p.preco_entregar)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#111;">R$ ${fmtBRL(p.preco_coletar)}</td>
                        ${isCompleta ? `
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#d97706;">R$ ${fmtBRL(p.venda_ref)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(comissao)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(pisCofins)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(fidc)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(icms)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">R$ ${fmtBRL(freteColeta)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#0284c7;">R$ ${fmtBRL(vendaLiquida)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#16a34a;">R$ ${fmtBRL(lucroEnt)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#16a34a;">${fmtBRL(margemEnt)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#2563eb;">R$ ${fmtBRL(lucroCol)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#2563eb;">${fmtBRL(margemCol)}%</td>
                        ` : ''}
                        <td style="padding:8px;border:1px solid #c8d3e0;color:#111;font-weight:bold;">${p.material_ncm || '-'}</td>
                    </tr>`;
            });

            html += `
                            <tr style="background:#fafafa;">
                                <td colspan="${isCompleta ? 15 : 4}" style="padding:10px;text-align:right;font-style:italic;color:#777;border:1px solid #eee;">DEMAIS RESÍDUOS PREÇO SOBRE ANÁLISE (FOTO)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>`;
        });

        html += `
                    <div style="margin-top:40px;border-top:2px solid #ddd;padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:#555;">
                        <div style="font-weight:bold;color:#1a5c38;font-size:0.95rem;">✅ Aprovado pelo CEO Jose Tiago</div>
                        <div style="text-align:right;color:#888;">Documento oficial ApexTech Metais • Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
                    </div>
                </div>
            </div>`;
        return html;
    }

    window.gerarPdfTabelaResiduosBase64 = async function(modo) {
        const modoPDF = modo || 'fornecedor';
        const isCompleta = modoPDF === 'completa';
        let precos = localPrecosResiduos;
        if (!precos || precos.length === 0) {
            const res = await fetch('/api/tabela-precos-residuos');
            precos = await res.json();
        }
        let settings = {};
        try { const r = await fetch('/api/settings'); settings = await r.json(); } catch(e) {}
        const hoje = new Date().toLocaleDateString('pt-BR');

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
        } catch(e) { console.warn('Logo watermark não carregou:', e); }

        const htmlContent = gerarHtmlTabelaResiduosParaPdf(precos, hoje, settings, logoWatermarkBase64, modoPDF);
        return await renderHtmlToPdfBase64(htmlContent, isCompleta);
    };

    window.exportarTabelaResiduosPdf = async function(modo) {
        const modoPDF = modo || 'fornecedor';
        const isCompleta = modoPDF === 'completa';
        const btnId = isCompleta ? 'btn-pdf-residuos-completa' : 'btn-pdf-residuos-fornecedor';
        const btn = document.getElementById(btnId);
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...'; }
        try {
            const base64 = await window.gerarPdfTabelaResiduosBase64(modoPDF);
            if (!base64) { _apexNotify('Atenção', 'Erro ao gerar o PDF de Resíduos.', 'error'); return; }
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${base64}`;
            link.download = isCompleta ? 'Tabela_Residuos_Completa.pdf' : 'Tabela_Residuos_Fornecedor.pdf';
            link.click();
        } catch(err) { console.error(err); _apexNotify('Atenção', 'Erro ao exportar PDF Resíduos: ' + err.message, 'error'); }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = isCompleta
                    ? '<i class="fa-solid fa-file-pdf" style="color:#ff4d4d;"></i> PDF Geral'
                    : '<i class="fa-solid fa-file-pdf" style="color:#2AD07A;"></i> PDF Fornecedor';
            }
        }
    };

    // ─── PDF LIGAS ────────────────────────────────────────────────────────────────

    function gerarHtmlTabelaLigasParaPdf(precos, dataUltimaAtualizacao, settings, logoBase64, modo = 'fornecedor') {
        const isCompleta = modo === 'completa';
        const activeSettings = settings || settingsPrecosLigas || {};
        const tituloPdf = isCompleta ? 'Tabela Geral de Ligas Metálicas — Visão Completa' : 'Tabela de Preços — Ligas Metálicas';

        const categorias = [];
        precos.forEach(p => {
            if (p.material_categoria && !categorias.includes(p.material_categoria)) categorias.push(p.material_categoria);
        });

        function gerarGridLogo(src) {
            if (!src) return '';
            const cols = isCompleta ? 6 : 4;
            const rows = 16;
            let grid = '<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;">';
            for (let r = 0; r < rows; r++) {
                grid += '<div style="display:flex;justify-content:space-around;align-items:center;padding:18px 0;">';
                for (let c = 0; c < cols; c++) {
                    grid += `<img src="${src}" alt="" style="width:140px;opacity:0.07;transform:rotate(-20deg);display:block;flex-shrink:0;" />`;
                }
                grid += '</div>';
            }
            grid += '</div>';
            return grid;
        }

        let html = `
            <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:25px;color:#333;background:#ffffff;width:100%;margin:0 auto;box-sizing:border-box;position:relative;">
                ${gerarGridLogo(logoBase64)}
                <div style="position:relative;z-index:1;">
                    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1565c0;padding-bottom:20px;margin-bottom:25px;">
                        <div><img src="assets/img/apexlogo.png" alt="ApexTech Metais" style="height:60px;"></div>
                        <div style="text-align:right;">
                            <h1 style="margin:0;color:#1565c0;font-size:${isCompleta ? '1.6rem' : '1.8rem'};font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${tituloPdf}</h1>
                            <p style="margin:6px 0 0 0;font-size:0.95rem;color:#666;font-weight:500;">Última Atualização: <span style="color:#1565c0;font-weight:bold;">${dataUltimaAtualizacao}</span></p>
                        </div>
                    </div>
                    <div style="background:#f0f6ff;border-left:5px solid #4fc3f7;border-radius:4px;padding:15px;margin-bottom:30px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <h4 style="margin:0 0 10px 0;color:#1565c0;font-size:1rem;">⚠️ Diretrizes Gerais de Compra — Ligas</h4>
                        <ul style="margin:0;padding-left:20px;font-size:0.85rem;color:#444;line-height:1.5;">
                            <li>Atenção: Quantidade mínima para entrega 100kg por produto. Caso não atinja a quantidade será descontado R$ 1,00/kg.</li>
                            <li>OBS: Variação de preço conforme atualização de mercado.</li>
                            <li style="font-weight:bold;color:#c0392b;">DEMAIS LIGAS PREÇO SOBRE ANÁLISE (FOTO)</li>
                        </ul>
                    </div>`;

        categorias.forEach(cat => {
            const precosCat = precos.filter(p => p.material_categoria === cat);
            if (precosCat.length === 0) return;
            const validadeStr = precosCat[0] ? formatarDataSemFuso(precosCat[0].validade) : '-';
            const corCategoria = (activeSettings && activeSettings[`cor_categoria_liga_${cat}`]) || '#4fc3f7';

            html += `
                <div style="margin-bottom:30px;page-break-inside:avoid;border:1px solid ${corCategoria};border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="background:${corCategoria};color:#fff;padding:10px 15px;font-weight:bold;display:flex;justify-content:space-between;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.5px;">
                        <span>${cat}</span>
                        <span style="font-size:0.85rem;font-weight:normal;opacity:0.9;">VIGÊNCIA ATÉ: ${validadeStr}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:${isCompleta ? '0.75rem' : '0.8rem'};text-align:left;">
                        <thead>
                            <tr style="background:#f8f9fa;border-bottom:2px solid #ddd;">
                                <th style="padding:8px;border:1px solid #eee;font-weight:600;color:#555;">Descrição</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Preço Entregar (R$/kg)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Preço Coletar (R$/kg)</th>
                                ${isCompleta ? `
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#d97706;">Venda Ref (R$/kg)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Comissão (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">PIS/COFINS (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">FIDC (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">ICMS (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#555;">Frete Coleta</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#0284c7;">Venda Líq.</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#16a34a;">Lucro Líq. Ent.</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#16a34a;">Margem Ent (%)</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#2563eb;">Lucro Líq. Col.</th>
                                <th style="padding:8px;text-align:right;border:1px solid #eee;font-weight:600;color:#2563eb;">Margem Col (%)</th>
                                ` : ''}
                                <th style="padding:8px;border:1px solid #eee;font-weight:600;color:#555;">NCM</th>
                            </tr>
                        </thead>
                        <tbody>`;

            precosCat.forEach((p, idx) => {
                const comissao = parseFloat(p.comissao || 0);
                const pisCofins = parseFloat(p.pis_cofins || 0);
                const fidc = parseFloat(p.fidc || 0);
                const icms = parseFloat(p.icms || 0);
                const freteColeta = parseFloat(p.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoes = (parseFloat(p.venda_ref) || 0) * (totalDedPct / 100);
                const vendaLiquida = (parseFloat(p.venda_ref) || 0) - valDeducoes;
                const lucroEnt = vendaLiquida - (parseFloat(p.preco_entregar) || 0);
                const margemEnt = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroEnt / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                const lucroCol = vendaLiquida - (parseFloat(p.preco_coletar) || 0) - freteColeta;
                const margemCol = (parseFloat(p.venda_ref) || 0) > 0 ? (lucroCol / (parseFloat(p.venda_ref) || 0)) * 100 : 0;
                const bgRow = idx % 2 === 0 ? '#ffffff' : '#e8f2ff';
                html += `
                    <tr style="border-bottom:1px solid #c8d3e0;background-color:${bgRow};page-break-inside:avoid;">
                        <td style="padding:8px;border:1px solid #c8d3e0;color:#111;"><strong>${p.material_nome}</strong></td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#111;">R$ ${fmtBRL(p.preco_entregar)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#111;">R$ ${fmtBRL(p.preco_coletar)}</td>
                        ${isCompleta ? `
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#d97706;">R$ ${fmtBRL(p.venda_ref)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(comissao)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(pisCofins)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(fidc)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">${fmtBRL(icms)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#444;">R$ ${fmtBRL(freteColeta)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#0284c7;">R$ ${fmtBRL(vendaLiquida)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#16a34a;">R$ ${fmtBRL(lucroEnt)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#16a34a;">${fmtBRL(margemEnt)}%</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;color:#2563eb;">R$ ${fmtBRL(lucroCol)}</td>
                        <td style="padding:8px;text-align:right;border:1px solid #c8d3e0;font-weight:bold;color:#2563eb;">${fmtBRL(margemCol)}%</td>
                        ` : ''}
                        <td style="padding:8px;border:1px solid #c8d3e0;color:#111;font-weight:bold;">${p.material_ncm || '-'}</td>
                    </tr>`;
            });

            html += `
                            <tr style="background:#fafafa;">
                                <td colspan="${isCompleta ? 15 : 4}" style="padding:10px;text-align:right;font-style:italic;color:#777;border:1px solid #eee;">DEMAIS LIGAS PREÇO SOBRE ANÁLISE (FOTO)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>`;
        });

        html += `
                    <div style="margin-top:40px;border-top:2px solid #ddd;padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:#555;">
                        <div style="font-weight:bold;color:#1565c0;font-size:0.95rem;">✅ Aprovado pelo CEO Jose Tiago</div>
                        <div style="text-align:right;color:#888;">Documento oficial ApexTech Metais • Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
                    </div>
                </div>
            </div>`;
        return html;
    }

    window.gerarPdfTabelaLigasBase64 = async function(modo) {
        const modoPDF = modo || 'fornecedor';
        const isCompleta = modoPDF === 'completa';
        let precos = localPrecosLigas;
        if (!precos || precos.length === 0) {
            const res = await fetch('/api/tabela-precos-ligas');
            precos = await res.json();
        }
        let settings = {};
        try { const r = await fetch('/api/settings'); settings = await r.json(); } catch(e) {}
        const hoje = new Date().toLocaleDateString('pt-BR');

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
        } catch(e) { console.warn('Logo watermark não carregou:', e); }

        const htmlContent = gerarHtmlTabelaLigasParaPdf(precos, hoje, settings, logoWatermarkBase64, modoPDF);
        return await renderHtmlToPdfBase64(htmlContent, isCompleta);
    };

    window.exportarTabelaLigasPdf = async function(modo) {
        const modoPDF = modo || 'fornecedor';
        const isCompleta = modoPDF === 'completa';
        const btnId = isCompleta ? 'btn-pdf-ligas-completa' : 'btn-pdf-ligas-fornecedor';
        const btn = document.getElementById(btnId);
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...'; }
        try {
            const base64 = await window.gerarPdfTabelaLigasBase64(modoPDF);
            if (!base64) { _apexNotify('Atenção', 'Erro ao gerar o PDF de Ligas.', 'error'); return; }
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${base64}`;
            link.download = isCompleta ? 'Tabela_Ligas_Completa.pdf' : 'Tabela_Ligas_Fornecedor.pdf';
            link.click();
        } catch(err) { console.error(err); _apexNotify('Atenção', 'Erro ao exportar PDF Ligas: ' + err.message, 'error'); }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = isCompleta
                    ? '<i class="fa-solid fa-file-pdf" style="color:#ff4d4d;"></i> PDF Geral'
                    : '<i class="fa-solid fa-file-pdf" style="color:#4fc3f7;"></i> PDF Fornecedor';
            }
        }
    };
