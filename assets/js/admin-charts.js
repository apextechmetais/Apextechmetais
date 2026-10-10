/**
 * ApexTech — padrão visual dos gráficos do painel (Chart.js).
 * Carregado logo depois do Chart.js. Define os padrões globais e um plugin que aplica o mesmo
 * acabamento a todos os gráficos, inclusive os que definem cores de eixo e grade por conta própria.
 * Não altera as cores das séries: elas carregam significado (metais, alta/baixa, comprar/vender).
 */
(function () {
    if (!window.Chart) return;
    const Chart = window.Chart;
    const FONTE = "'Archivo', 'Segoe UI', system-ui, sans-serif";
    const TEXTO = 'rgba(245, 246, 243, 0.72)';
    const TEXTO_FORTE = '#F5F6F3';
    const GRADE = 'rgba(245, 246, 243, 0.07)';
    const FUNDO_PAINEL = '#0C2A1D';

    const semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Telas que o cliente aprovou como estão (Relatório Diário LME e Tabelas) ficam com os gráficos originais.
    // Por isso nada é alterado em Chart.defaults: o acabamento é aplicado gráfico a gráfico, pelo plugin abaixo.
    const protegido = (chart) => !!(chart.canvas && chart.canvas.closest && chart.canvas.closest('.ap-original'));

    const ehRadial = (tipo) => ['pie', 'doughnut', 'polarArea', 'radar'].includes(tipo);

    Chart.register({
        id: 'apexAcabamento',
        beforeUpdate(chart) {
            if (protegido(chart)) return;
            try {
                const tipoBase = chart.config.type;
                const opts = chart.options;

                // Texto, grade e animação
                opts.font = Object.assign({}, opts.font, { family: FONTE, size: 12 });
                opts.color = TEXTO;
                opts.borderColor = GRADE;
                if (semMovimento) opts.animation = false;
                else if (opts.animation && typeof opts.animation === 'object') { opts.animation.duration = 650; opts.animation.easing = 'easeOutQuart'; }
                if (opts.elements) {
                    if (opts.elements.point) opts.elements.point.hitRadius = 14;
                    if (opts.elements.arc) { opts.elements.arc.borderColor = FUNDO_PAINEL; opts.elements.arc.borderWidth = 2; }
                }

                // Legenda: marcadores redondos e discretos
                const legenda = opts.plugins && opts.plugins.legend;
                if (legenda && legenda.labels) {
                    legenda.labels.usePointStyle = true;
                    legenda.labels.pointStyle = 'circle';
                    legenda.labels.boxWidth = 8;
                    legenda.labels.boxHeight = 8;
                    legenda.labels.padding = 16;
                    legenda.labels.color = TEXTO;
                    legenda.labels.font = Object.assign({}, legenda.labels.font, { family: FONTE, size: 12, weight: '500' });
                }

                // Dica ao passar o mouse: mesma caixa em todos os gráficos
                const dica = opts.plugins && opts.plugins.tooltip;
                if (dica) {
                    dica.backgroundColor = 'rgba(5, 19, 12, 0.96)';
                    dica.borderColor = 'rgba(37, 208, 127, 0.4)';
                    dica.borderWidth = 1;
                    dica.padding = 12;
                    dica.cornerRadius = 8;
                    dica.titleColor = TEXTO_FORTE;
                    dica.bodyColor = TEXTO;
                    dica.titleFont = { family: FONTE, size: 12, weight: '650' };
                    dica.bodyFont = { family: FONTE, size: 12, weight: '500' };
                    dica.boxPadding = 6;
                    dica.usePointStyle = true;
                }

                // Eixos: grade suave, sem borda dura, números legíveis
                if (!ehRadial(tipoBase) && opts.scales) {
                    Object.keys(opts.scales).forEach(id => {
                        const eixo = opts.scales[id];
                        if (!eixo) return;
                        if (eixo.grid) {
                            const horizontal = eixo.axis === 'y' || id.charAt(0) === 'y';
                            eixo.grid.color = GRADE;
                            eixo.grid.drawTicks = false;
                            if (!horizontal && opts.indexAxis !== 'y') eixo.grid.display = false;
                        }
                        if (eixo.border) { eixo.border.display = false; eixo.border.dash = [3, 4]; }
                        if (eixo.ticks) {
                            eixo.ticks.color = TEXTO;
                            eixo.ticks.padding = 8;
                            eixo.ticks.font = Object.assign({}, eixo.ticks.font, { family: FONTE, size: 11 });
                        }
                        if (eixo.title && eixo.title.display) {
                            eixo.title.color = TEXTO;
                            eixo.title.font = Object.assign({}, eixo.title.font, { family: FONTE, size: 11, weight: '500' });
                        }
                    });
                }
                if (ehRadial(tipoBase) && opts.scales && opts.scales.r) {
                    const r = opts.scales.r;
                    if (r.grid) r.grid.color = GRADE;
                    if (r.angleLines) r.angleLines.color = GRADE;
                    if (r.pointLabels) { r.pointLabels.color = TEXTO; r.pointLabels.font = { family: FONTE, size: 11 }; }
                    if (r.ticks) { r.ticks.color = TEXTO; r.ticks.backdropColor = 'transparent'; }
                }

                // Séries: cantos arredondados nas barras, linhas suaves, rosca mais fina
                (chart.data.datasets || []).forEach(ds => {
                    const tipo = ds.type || tipoBase;
                    if (tipo === 'bar') {
                        if (ds.borderRadius === undefined) ds.borderRadius = 6;
                        if (ds.maxBarThickness === undefined) ds.maxBarThickness = 64;
                        if (ds.borderSkipped === undefined) ds.borderSkipped = false;
                    } else if (tipo === 'line') {
                        if (ds.tension === undefined || ds.tension === 0) ds.tension = ds.stepped ? 0 : 0.35;
                        if (ds.borderWidth === undefined || ds.borderWidth < 2) ds.borderWidth = 2.5;
                        if (ds.pointRadius === undefined) ds.pointRadius = (ds.data || []).length <= 12 ? 3 : 0;
                        if (ds.pointHoverRadius === undefined) ds.pointHoverRadius = 5;
                        if (ds.pointBackgroundColor === undefined) ds.pointBackgroundColor = ds.borderColor;
                        if (ds.pointBorderColor === undefined) ds.pointBorderColor = FUNDO_PAINEL;
                        if (ds.pointBorderWidth === undefined) ds.pointBorderWidth = 2;
                    } else if (tipo === 'doughnut' || tipo === 'pie') {
                        ds.borderColor = FUNDO_PAINEL;
                        ds.borderWidth = 2;
                        if (ds.hoverOffset === undefined) ds.hoverOffset = 6;
                    }
                });
                if (tipoBase === 'doughnut' && opts.cutout === undefined) opts.cutout = '66%';
            } catch (e) {
                // o acabamento nunca pode impedir um gráfico de aparecer
            }
        },
        // Gráfico sem nenhum valor: avisa, em vez de mostrar só a grade vazia
        afterDraw(chart) {
            if (protegido(chart)) return;
            try {
                const temDado = (chart.data.datasets || []).some(ds => (ds.data || []).some(v => {
                    const n = (v && typeof v === 'object') ? (v.y !== undefined ? v.y : v.v) : v;
                    return n !== null && n !== undefined && !Number.isNaN(Number(n));
                }));
                if (temDado) return;
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = TEXTO;
                ctx.font = "500 13px " + FONTE;
                ctx.fillText('Ainda não há dados para este gráfico', (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
                ctx.restore();
            } catch (e) {}
        }
    });
})();
