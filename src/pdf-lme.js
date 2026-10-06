const axios = require('axios');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;

/**
 * Converte cor hex (#RRGGBB) para array [r, g, b]
 */
const h = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
];

const fmtUSD = (v) => v !== null && v !== undefined
    ? '$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : '—';

const fmtBRL3 = (v) => v !== null && v !== undefined
    ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : '—';

const fmtBRL4 = (v) => v !== null && v !== undefined
    ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : '—';

// IMPORTANTE: as fontes padrão do jsPDF (Helvetica/WinAnsi) NÃO possuem os glifos ▲ ▼ →.
// Usá-los gera texto corrompido no PDF (ex.: "%² 3.584%"). Por isso usamos marcadores
// internos ([UP]/[DN]) que são removidos no didParseCell e desenhados como triângulos vetoriais.
const ARROW_UP = '[UP]';
const ARROW_DN = '[DN]';

const fmtPct = (v) => v !== null && v !== undefined
    ? (v >= 0 ? ARROW_UP : ARROW_DN) + (Math.abs(v) * 100).toFixed(3).replace('.', ',') + '%'
    : '—';

const fmtOscRS = (v) => v !== null && v !== undefined
    ? (v >= 0 ? ARROW_UP : ARROW_DN) + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : '—';

/** Remove os marcadores de seta da célula e guarda a direção para desenhar depois */
function parseArrowCell(data) {
    const raw = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
    let dir = null;
    if (raw.startsWith(ARROW_UP)) dir = 'up';
    else if (raw.startsWith(ARROW_DN)) dir = 'down';
    if (!dir) return;
    data.cell.text = [raw.slice(ARROW_UP.length)];
    data.cell.apexArrow = dir;
    data.cell.styles.cellPadding = { top: 2, bottom: 2, right: 2, left: 6 };
}

/** Desenha um triângulo verde (alta) ou vermelho (queda) à esquerda do texto */
function drawArrowCell(doc, data) {
    const dir = data.cell.apexArrow;
    if (!dir) return;
    const textW = doc.getTextWidth(data.cell.text.join(' '));
    const cx = data.cell.x + data.cell.width / 2 - textW / 2 - 2.2;
    const cy = data.cell.y + data.cell.height / 2;
    const s = 1.3;
    if (dir === 'up') {
        doc.setFillColor(0, 176, 80);
        doc.triangle(cx - s, cy + s * 0.8, cx + s, cy + s * 0.8, cx, cy - s * 0.9, 'F');
    } else {
        doc.setFillColor(220, 0, 0);
        doc.triangle(cx - s, cy - s * 0.8, cx + s, cy - s * 0.8, cx, cy + s * 0.9, 'F');
    }
}

// Paleta de cores oficiais do sistema Apextech
const HDR = {
    data:     { bg: h('#000000'), fg: [255, 255, 255] },
    cobre:    { bg: h('#db1f1f'), fg: [255, 255, 255] },
    zinco:    { bg: h('#E6B8B7'), fg: [255, 255, 255] },
    aluminio: { bg: h('#BFBFBF'), fg: [255, 255, 255] },
    chumbo:   { bg: h('#C9A8E8'), fg: [255, 255, 255] },
    estanho:  { bg: h('#B5B059'), fg: [255, 255, 255] },
    niquel:   { bg: [255, 255, 255], fg: [0, 0, 0] },
    dolar:    { bg: h('#70AD47'), fg: [255, 255, 255] },
};

const CELL_BG = {
    cobre:    h('#FF8B9B'),
    zinco:    h('#E6B8B7'),
    aluminio: h('#BFBFBF'),
    chumbo:   h('#C9A8E8'),
    estanho:  h('#B5B059'),
    niquel:   [255, 255, 255],
    dolar:    h('#70AD47'),
};

const CELL_FG = {
    cobre:    [0, 0, 0],
    zinco:    [61, 26, 26],
    aluminio: [17, 17, 17],
    chumbo:   [45, 0, 96],
    estanho:  [58, 48, 0],
    niquel:   [34, 34, 34],
    dolar:    [26, 64, 0],
};

const ROW_BG = {
    0: { bg: h('#A6A6A6'), fg: [51, 51, 51] },   // MÉDIA SEMANAL
    1: { bg: h('#FFFF00'), fg: [51, 51, 51] },   // 100% LME
    2: { bg: h('#1a1a1a'), fg: [255, 255, 255] }, // SEMANA ANTERIOR (fundo preto oficial)
    3: { bg: h('#E2EFDA'), fg: [0, 0, 0] },       // FECHAMENTO %
    4: { bg: h('#00B0F0'), fg: [255, 255, 255] }, // OSCILAÇÃO %
    5: { bg: h('#F2F2F2'), fg: [0, 0, 0] },       // OSCILAÇÃO R$
    6: { bg: h('#A6A6A6'), fg: [51, 51, 51] },   // MÉDIA MENSAL
};

const METAL_KEYS = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];

/**
 * Renderiza gráfico de barras (Semana Anterior vs LME Atual)
 * Tenta ChartJSNodeCanvas localmente e, caso falhe, usa QuickChart.io como fallback
 */
async function buildChartBuffer(labels, dataAnt, dataLme, chartW = 1200, chartH = 350) {
    const bgColors = labels.map((_, i) => {
        const valAtu = dataLme[i] || 0;
        const valAnt = dataAnt[i] || 0;
        return valAtu >= valAnt
            ? { lme: 'rgba(39,174,96,0.85)', ant: 'rgba(231,76,60,0.85)' }
            : { lme: 'rgba(231,76,60,0.85)', ant: 'rgba(39,174,96,0.85)' };
    });

    const chartConfig = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Semana Anterior',
                    data: dataAnt,
                    backgroundColor: bgColors.map(c => c.ant),
                    borderWidth: 1
                },
                {
                    label: 'LME Atual (100%)',
                    data: dataLme,
                    backgroundColor: bgColors.map(c => c.lme),
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 13, weight: 'bold' } } }
            },
            scales: {
                y: { ticks: { font: { size: 11 } } },
                x: { ticks: { font: { size: 13, weight: 'bold' } } }
            }
        }
    };

    // 1. Tentar ChartJSNodeCanvas local
    try {
        const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
        const cvs = new ChartJSNodeCanvas({ width: chartW, height: chartH, backgroundColour: 'white' });
        return await cvs.renderToBuffer(chartConfig);
    } catch (canvasErr) {
        console.warn('⚠️ ChartJSNodeCanvas não disponível, gerando via QuickChart.io:', canvasErr.message);
    }

    // 2. Fallback infalível via QuickChart
    try {
        const qcRes = await axios.get('https://quickchart.io/chart', {
            params: {
                w: chartW,
                h: chartH,
                bkg: 'white',
                c: JSON.stringify(chartConfig)
            },
            responseType: 'arraybuffer',
            timeout: 10000
        });
        return Buffer.from(qcRes.data);
    } catch (qcErr) {
        console.error('❌ Falha ao obter gráfico do QuickChart:', qcErr.message);
        return null;
    }
}

/**
 * Gera o PDF oficial da LME em formato Paisagem (Landscape)
 * Layout 100% idêntico à impressão do sistema com tabelas, cores por metal, gráficos e matriz 90-110%
 * @param {Object} semana Dados da semana agrupada com days e computed
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function gerarPdfRelatorioLME(semana) {
    if (!semana) {
        throw new Error('Objeto semana é obrigatório para gerar o PDF da LME.');
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // ─── PÁGINA 1: CABEÇALHO DARK GREEN APEXTECH ──────────────────────
    doc.setFillColor(13, 40, 26); // #0d281a
    doc.rect(0, 0, 297, 24, 'F');
    
    // Borda verde de sotaque
    doc.setFillColor(42, 208, 122); // #2AD07A
    doc.rect(0, 23, 297, 1.2, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('ApexTech Metais', 14, 10);

    doc.setFontSize(10);
    doc.setTextColor(42, 208, 122);
    doc.text('Relatório Oficial de Cotações LME', 14, 16);

    const firstDay = (semana.days && semana.days.filter(d => d.data && d.data !== '—')[0]?.data) || '—';
    const lastDay  = (semana.days && semana.days.filter(d => d.data && d.data !== '—').pop()?.data)  || '—';
    
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text(`Cotação Válida: ${firstDay} a ${lastDay}`, 283, 11, { align: 'right' });

    const nowSp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const nowSpStr = nowSp.toLocaleDateString('pt-BR') + ' às ' + nowSp.toLocaleTimeString('pt-BR');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 225, 200);
    doc.setFont(undefined, 'normal');
    doc.text(`Emissão: ${nowSpStr}`, 283, 17, { align: 'right' });

    // ─── TABELA PRINCIPAL ─────────────────────────────────────────────
    const HEAD_ROW = ['DATA', 'Cobre US$/t', 'Zinco US$/t', 'Alumínio US$/t', 'Chumbo US$/t', 'Estanho US$/t', 'Níquel US$/t', 'Dólar US$'];
    const colKeys  = ['data', 'cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel', 'dolar'];

    const tableBody = [];
    for (let i = 0; i < 5; i++) {
        const d = (semana.days && semana.days[i]) || {};
        tableBody.push([
            d.data || '—',
            fmtUSD(d.cobre),
            fmtUSD(d.zinco),
            fmtUSD(d.aluminio),
            fmtUSD(d.chumbo),
            fmtUSD(d.estanho),
            fmtUSD(d.niquel),
            fmtBRL4(d.dolar)
        ]);
    }
    // Linha vazia separadora
    tableBody.push(Array(8).fill(''));

    // Linhas computadas
    const comp = semana.computed || {};
    tableBody.push([
        'MÉDIA SEMANAL',
        fmtUSD(comp['MEDIA SEMANAL']?.cobre),
        fmtUSD(comp['MEDIA SEMANAL']?.zinco),
        fmtUSD(comp['MEDIA SEMANAL']?.aluminio),
        fmtUSD(comp['MEDIA SEMANAL']?.chumbo),
        fmtUSD(comp['MEDIA SEMANAL']?.estanho),
        fmtUSD(comp['MEDIA SEMANAL']?.niquel),
        fmtBRL4(comp['MEDIA SEMANAL']?.dolar)
    ]);
    tableBody.push([
        '100% LME (R$)',
        fmtBRL3(comp['100% LME']?.cobre),
        fmtBRL3(comp['100% LME']?.zinco),
        fmtBRL3(comp['100% LME']?.aluminio),
        fmtBRL3(comp['100% LME']?.chumbo),
        fmtBRL3(comp['100% LME']?.estanho),
        fmtBRL3(comp['100% LME']?.niquel),
        fmtBRL4(comp['100% LME']?.dolar)
    ]);
    tableBody.push([
        'SEMANA ANTERIOR',
        fmtBRL3(comp['SEMANA ANTERIOR']?.cobre),
        fmtBRL3(comp['SEMANA ANTERIOR']?.zinco),
        fmtBRL3(comp['SEMANA ANTERIOR']?.aluminio),
        fmtBRL3(comp['SEMANA ANTERIOR']?.chumbo),
        fmtBRL3(comp['SEMANA ANTERIOR']?.estanho),
        fmtBRL3(comp['SEMANA ANTERIOR']?.niquel),
        fmtBRL4(comp['SEMANA ANTERIOR']?.dolar)
    ]);
    tableBody.push([
        'FECHAMENTO % (SEMANA ANTERIOR)',
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.cobre),
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.zinco),
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.aluminio),
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.chumbo),
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.estanho),
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.niquel),
        fmtPct(comp['FECHAMENTO % ( SEMANA ANTERIOR )']?.dolar)
    ]);
    tableBody.push([
        'OSCILAÇÃO %',
        fmtPct(comp['OSCILAÇÃO %']?.cobre),
        fmtPct(comp['OSCILAÇÃO %']?.zinco),
        fmtPct(comp['OSCILAÇÃO %']?.aluminio),
        fmtPct(comp['OSCILAÇÃO %']?.chumbo),
        fmtPct(comp['OSCILAÇÃO %']?.estanho),
        fmtPct(comp['OSCILAÇÃO %']?.niquel),
        fmtPct(comp['OSCILAÇÃO %']?.dolar)
    ]);
    tableBody.push([
        'OSCILAÇÃO R$',
        fmtOscRS(comp['OSCILAÇÃO R$']?.cobre),
        fmtOscRS(comp['OSCILAÇÃO R$']?.zinco),
        fmtOscRS(comp['OSCILAÇÃO R$']?.aluminio),
        fmtOscRS(comp['OSCILAÇÃO R$']?.chumbo),
        fmtOscRS(comp['OSCILAÇÃO R$']?.estanho),
        fmtOscRS(comp['OSCILAÇÃO R$']?.niquel),
        fmtOscRS(comp['OSCILAÇÃO R$']?.dolar)
    ]);
    tableBody.push([
        'MÉDIA MENSAL',
        fmtBRL3(comp['MEDIA MENSAL']?.cobre),
        fmtBRL3(comp['MEDIA MENSAL']?.zinco),
        fmtBRL3(comp['MEDIA MENSAL']?.aluminio),
        fmtBRL3(comp['MEDIA MENSAL']?.chumbo),
        fmtBRL3(comp['MEDIA MENSAL']?.estanho),
        fmtBRL3(comp['MEDIA MENSAL']?.niquel),
        fmtBRL4(comp['MEDIA MENSAL']?.dolar)
    ]);

    autoTable(doc, {
        startY: 27,
        head: [HEAD_ROW],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'center', fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', cellWidth: 35 } },
        margin: { left: 10, right: 10 },
        didParseCell: function(data) {
            const ci = data.column.index;
            const ri = data.row.index;
            const metalKey = colKeys[ci];

            if (data.section === 'head') {
                data.cell.styles.fillColor = HDR[metalKey]?.bg || [50, 50, 50];
                data.cell.styles.textColor = HDR[metalKey]?.fg || [255, 255, 255];
                return;
            }

            // Linhas dos dias (0 a 4)
            if (ri < 5) {
                if (ci === 0) {
                    data.cell.styles.fillColor = [240, 240, 240];
                    data.cell.styles.textColor = [0, 0, 0];
                } else if (CELL_BG[metalKey]) {
                    data.cell.styles.fillColor = CELL_BG[metalKey];
                    data.cell.styles.textColor = CELL_FG[metalKey];
                }
                return;
            }

            // Linha separadora vazia
            if (ri === 5) {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [255, 255, 255];
                return;
            }

            // Linhas computadas
            const compIdx = ri - 6;
            if (ROW_BG[compIdx]) {
                data.cell.styles.fillColor = ROW_BG[compIdx].bg;
                data.cell.styles.textColor = ROW_BG[compIdx].fg;
            }
            if (ci === 0) data.cell.styles.halign = 'left';
            parseArrowCell(data);
        },
        didDrawCell: function(data) {
            if (data.section === 'body') drawArrowCell(doc, data);
        }
    });

    // ─── MINI-TABELA RESUMO (Semana Ant × LME Atual × Oscilação) ─────
    const afterMain = doc.lastAutoTable.finalY + 4;
    const ant   = comp['SEMANA ANTERIOR'] || {};
    const lme   = comp['100% LME']        || {};
    const oscRs = comp['OSCILAÇÃO R$']     || {};

    const SUMMARY_HEAD = [['TIPO', 'Cobre R$/kg', 'Zinco R$/kg', 'Alumínio R$/kg', 'Chumbo R$/kg', 'Estanho R$/kg', 'Níquel R$/kg', 'Dólar R$']];
    const SUMMARY_BODY = [
        ['SEMANA ANTERIOR (R$/kg)', fmtBRL3(ant.cobre), fmtBRL3(ant.zinco), fmtBRL3(ant.aluminio), fmtBRL3(ant.chumbo), fmtBRL3(ant.estanho), fmtBRL3(ant.niquel), fmtBRL4(ant.dolar)],
        ['LME ATUAL (R$/kg)',       fmtBRL3(lme.cobre), fmtBRL3(lme.zinco), fmtBRL3(lme.aluminio), fmtBRL3(lme.chumbo), fmtBRL3(lme.estanho), fmtBRL3(lme.niquel), fmtBRL4(lme.dolar)],
        ['Oscilação R$/kg',         fmtOscRS(oscRs.cobre), fmtOscRS(oscRs.zinco), fmtOscRS(oscRs.aluminio), fmtOscRS(oscRs.chumbo), fmtOscRS(oscRs.estanho), fmtOscRS(oscRs.niquel), fmtOscRS(oscRs.dolar)],
    ];

    autoTable(doc, {
        startY: afterMain,
        head: SUMMARY_HEAD,
        body: SUMMARY_BODY,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'center', fontStyle: 'bold' },
        headStyles: { fillColor: [10, 74, 47], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', cellWidth: 45 } },
        margin: { left: 10, right: 10 },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index > 0) {
                const metalKey = colKeys[data.column.index];
                if (CELL_BG[metalKey]) {
                    data.cell.styles.fillColor = CELL_BG[metalKey];
                    data.cell.styles.textColor = CELL_FG[metalKey];
                }
                parseArrowCell(data);
            }
        },
        didDrawCell: function(data) {
            if (data.section === 'body') drawArrowCell(doc, data);
        }
    });

    // ─── PÁGINA 2: GRÁFICOS DE BARRAS E TABELA 90-110% ─────────────
    doc.addPage();
    let curY = 15;

    let chartFull = null;
    try {
        chartFull = await buildChartBuffer(
            ['COBRE', 'ZINCO', 'ALUMÍNIO', 'CHUMBO', 'ESTANHO', 'NÍQUEL'],
            ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'].map(k => ant[k] || 0),
            ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'].map(k => lme[k] || 0),
            1200,
            350
        );
    } catch (chartErr) {
        console.warn('⚠️ Aviso ao renderizar gráficos no PDF:', chartErr.message);
    }

    doc.setFontSize(12);
    doc.setTextColor(10, 74, 47);
    doc.setFont(undefined, 'bold');
    doc.text('Desempenho — Semana Anterior vs LME Atual', 10, curY);
    doc.setFont(undefined, 'normal');
    curY += 6;

    if (chartFull) {
        // Margem de 10mm de cada lado -> 297 - 20 = 277mm de largura
        doc.addImage('data:image/png;base64,' + chartFull.toString('base64'), 'PNG', 10, curY, 277, 80);
        curY += 85;
    } else {
        curY += 10;
    }

    // ─── TABELA VALORES BASE 90% a 110% ──────────────────────────────
    doc.setFontSize(12);
    doc.setTextColor(10, 74, 47);
    doc.setFont(undefined, 'bold');
    doc.text('VALORES BASE DE 90% A 110% × LME DA SEMANA × DÓLAR', 10, curY + 4);
    doc.setFont(undefined, 'normal');
    curY += 8;

    const baseHead = [['%', 'COBRE', 'ZINCO', 'ALUMÍNIO', 'CHUMBO', 'ESTANHO', 'NÍQUEL']];
    const baseBody = [];
    for (let p = 90; p <= 110; p++) {
        const row = [p === 100 ? '100%' : `${p}%`];
        METAL_KEYS.forEach(m => {
            const lmeVal = comp['SEMANA ANTERIOR']?.[m] ?? null;
            row.push(lmeVal !== null ? 'R$ ' + (lmeVal * p / 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—');
        });
        baseBody.push(row);
    }

    autoTable(doc, {
        startY: curY,
        head: baseHead,
        body: baseBody,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'right', fontStyle: 'bold' },
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { halign: 'center', cellWidth: 15 } },
        didParseCell: function(data) {
            if (data.section === 'head' && data.column.index > 0) {
                const hColors = [HDR.cobre.bg, HDR.zinco.bg, HDR.aluminio.bg, HDR.chumbo.bg, HDR.estanho.bg, HDR.niquel.bg];
                data.cell.styles.fillColor = hColors[data.column.index - 1] || [50, 50, 50];
                data.cell.styles.textColor = (data.column.index === 6) ? [0, 0, 0] : [255, 255, 255];
            }
            if (data.section === 'body') {
                if (data.row.index === 10) {
                    data.cell.styles.fillColor = [0, 0, 0];
                    data.cell.styles.textColor = [255, 255, 255];
                } else if (data.row.index < 10) {
                    const s = 255 - (10 - data.row.index) * 6;
                    data.cell.styles.fillColor = [255, s, s];
                } else {
                    const s = 255 - (data.row.index - 10) * 6;
                    data.cell.styles.fillColor = [s, 255, s];
                }
            }
        }
    });

    // Rodapé
    const lastY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text('Apextech Metais — Indústria e Comércio de Resíduos Ltda  |  apextechmetais.com.br', 148.5, lastY, { align: 'center' });

    return Buffer.from(doc.output('arraybuffer'));
}

module.exports = {
    gerarPdfRelatorioLME
};
