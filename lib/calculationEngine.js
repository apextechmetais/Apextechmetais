/**
 * ApexEngine - Motor Central Reutilizável de Cálculos Industriais ERP
 * 
 * Regra Única Central de Cálculo para:
 * - Viabilidade Técnica (Percentual * Peso Bruto)
 * - Valor Bruto da Compra (Peso * Preço Atual do Material)
 * - Margem e Preço Sugerido (Valor Bruto + Margem %)
 * - Consistência em Compras, Vendas, PDFs, BI e Relatórios
 */

function calcularPesosPorPercentual(pesoBruto, composicaoPercentual) {
    const bruto = parseFloat(pesoBruto) || 0;
    if (bruto <= 0 || !Array.isArray(composicaoPercentual)) {
        return [];
    }

    return composicaoPercentual.map(item => {
        const pct = parseFloat(item.percentual) || 0;
        const pesoCalculado = (bruto * pct) / 100;
        return {
            ...item,
            peso: parseFloat(pesoCalculado.toFixed(3)),
            percentual: pct
        };
    });
}

function calcularValorBrutoItem(peso, precoKg) {
    const p = parseFloat(peso) || 0;
    const pr = parseFloat(precoKg) || 0;
    return parseFloat((p * pr).toFixed(2));
}

function calcularViabilidadeCompleta({ pesoBruto, componentes, tabelaPrecos = [], margemPct = 100, dificuldadeBonusPct = 0 }) {
    const bruto = parseFloat(pesoBruto) || 0;
    let totalPesoRecuperado = 0;
    let valorBrutoTotalCompra = 0;
    let possuiMaterialSemPreco = false;

    const componentesProcessados = (componentes || []).map(c => {
        const pct = bruto > 0 ? (parseFloat(c.peso) / bruto) * 100 : parseFloat(c.percentual) || 0;
        const pesoCalc = parseFloat(parseFloat(c.peso || 0).toFixed(3));
        totalPesoRecuperado += pesoCalc;

        // Buscar preço na tabela
        const itemPreco = tabelaPrecos.find(p => p.material_id === c.material_id);
        const precoKg = itemPreco ? (parseFloat(itemPreco.preco_entregar) || 0) : null;

        let valorItem = 0;
        if (precoKg !== null) {
            valorItem = calcularValorBrutoItem(pesoCalc, precoKg);
            valorBrutoTotalCompra += valorItem;
        } else {
            possuiMaterialSemPreco = true;
        }

        return {
            ...c,
            peso: pesoCalc,
            percentual: parseFloat(pct.toFixed(2)),
            preco_entregar_kg: precoKg,
            valor_total_item: valorItem
        };
    });

    const perdaFisicaKg = Math.max(0, bruto - totalPesoRecuperado);
    const percentualPerda = bruto > 0 ? (perdaFisicaKg / bruto) * 100 : 0;

    const margemTotal = (parseFloat(margemPct) || 0) + (parseFloat(dificuldadeBonusPct) || 0);
    const precoSugeridoEntregar = valorBrutoTotalCompra / (1 + (margemTotal / 100));
    const precoSugeridoColetar = precoSugeridoEntregar * 0.96; // 4% de desconto para coleta

    return {
        pesoBruto: bruto,
        totalPesoRecuperado: parseFloat(totalPesoRecuperado.toFixed(3)),
        perdaFisicaKg: parseFloat(perdaFisicaKg.toFixed(3)),
        percentualPerda: parseFloat(percentualPerda.toFixed(2)),
        valorBrutoTotalCompra: parseFloat(valorBrutoTotalCompra.toFixed(2)),
        margemAplicadaPct: margemTotal,
        precoSugeridoEntregar: parseFloat(precoSugeridoEntregar.toFixed(2)),
        precoSugeridoColetar: parseFloat(precoSugeridoColetar.toFixed(2)),
        possuiMaterialSemPreco,
        componentes: componentesProcessados
    };
}

// ─── Módulo Estratégico: margem e mix ────────────────────────────────────────
// Regra única de margem usada pelo ranking, simulador de mix, forecast, alavancagem e payback.

function _num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

/** Normaliza os nomes de campo das tabelas de preço (venda_ref/preco_venda, preco_entregar/preco_compra...). */
function normalizarPrecosMaterial(tp) {
    const t = tp || {};
    return {
        venda: _num(t.preco_venda || t.venda_ref),
        entregar: _num(t.preco_entregar || t.preco_compra_entregar || t.preco_compra),
        coletar: _num(t.preco_coletar || t.preco_compra_coletar || t.preco_compra),
        deducoesPct: _num(t.comissao) + _num(t.pis_cofins) + _num(t.fidc) + _num(t.icms),
        freteColeta: _num(t.frete_coleta)
    };
}

function _rendimentoFracao(rendimentoPct) {
    const r = _num(rendimentoPct);
    if (r <= 0) return 1;
    return Math.min(r, 100) / 100;
}

/**
 * Margem líquida por kg vendido de um material.
 * - Deduções (comissão, PIS/COFINS, FIDC, ICMS) incidem sobre o preço de venda.
 * - Frete de coleta só entra quando a compra é por coleta.
 * - Rendimento < 100% aumenta o custo: para vender 1 kg é preciso comprar 1/rendimento kg.
 */
function calcularMargemMaterial(tp, { operacao = 'entrega', rendimentoPct = 100, choqueVendaPct = 0, choqueCompraPct = 0 } = {}) {
    const p = normalizarPrecosMaterial(tp);
    const coleta = operacao === 'coleta' || operacao === 'retirada';
    const rend = _rendimentoFracao(rendimentoPct);

    const precoVenda = p.venda * (1 + _num(choqueVendaPct) / 100);
    const precoCompra = (coleta ? p.coletar : p.entregar) * (1 + _num(choqueCompraPct) / 100);
    const frete = coleta ? p.freteColeta : 0;

    const vendaLiquida = precoVenda * (1 - p.deducoesPct / 100);
    const custoKgVendido = (precoCompra + frete) / rend;
    const lucroBrutoKg = precoVenda - precoCompra / rend;
    const lucroLiquidoKg = vendaLiquida - custoKgVendido;

    return {
        precoVenda,
        precoCompra,
        freteKg: frete,
        deducoesPct: p.deducoesPct,
        vendaLiquida,
        custoKgVendido,
        lucroBrutoKg,
        lucroLiquidoKg,
        margemBrutaPct: precoVenda > 0 ? (lucroBrutoKg / precoVenda) * 100 : 0,
        margemLiquidaPct: precoVenda > 0 ? (lucroLiquidoKg / precoVenda) * 100 : 0
    };
}

/**
 * Explosão do mix de um plano estratégico.
 * frente 'venda': a meta é faturamento; referência = preço de venda, compra = preço "entregar".
 * frente 'compra': a meta é orçamento; referência = preço "entregar", compra = preço "coletar" (com frete).
 * Os choques de preço não mudam os volumes planejados: mostram o que acontece com o plano se o mercado se mover.
 */
function calcularMixEstrategico({ metaFaturamento, frente = 'venda', itens = [], tabelaPrecos = [], choqueVendaPct = 0, choqueCompraPct = 0 } = {}) {
    const meta = _num(metaFaturamento);
    const fVenda = 1 + _num(choqueVendaPct) / 100;
    const fCompra = 1 + _num(choqueCompraPct) / 100;
    const coleta = frente !== 'venda';

    let totalPct = 0, totalKg = 0, totalKgCompra = 0, totalInvestimento = 0;
    let receita = 0, receitaLiquida = 0, custoCompra = 0, custoFrete = 0;

    const linhas = (itens || []).map(item => {
        const tp = (tabelaPrecos || []).find(x => x.material_id == item.material_id) || {};
        const p = normalizarPrecosMaterial(tp);
        const fracaoPct = _num(item.fracaoPct != null ? item.fracaoPct : item.fracao_pct);
        const rendimentoPct = _rendimentoFracao(item.rendimentoPct != null ? item.rendimentoPct : item.rendimento_pct) * 100;
        const rend = rendimentoPct / 100;

        const precoRef = coleta ? p.entregar : p.venda;
        const precoCompra = coleta ? p.coletar : p.entregar;
        const frete = coleta ? p.freteColeta : 0;

        const faturamentoAlvo = meta * (fracaoPct / 100);
        const volumeKg = precoRef > 0 ? faturamentoAlvo / precoRef : 0;
        const volumeCompraKg = volumeKg / rend;
        const investimento = volumeCompraKg * precoCompra;

        totalPct += fracaoPct;
        totalKg += volumeKg;
        totalKgCompra += volumeCompraKg;
        totalInvestimento += investimento;

        const receitaItem = volumeKg * precoRef * fVenda;
        receita += receitaItem;
        receitaLiquida += receitaItem * (1 - p.deducoesPct / 100);
        custoCompra += investimento * fCompra;
        custoFrete += volumeCompraKg * frete;

        return {
            material_id: item.material_id,
            material_nome: tp.material_nome || tp.nome || null,
            fracaoPct, rendimentoPct, precoRef, precoCompra,
            faturamentoAlvo, volumeKg, volumeCompraKg, investimento
        };
    });

    const custoTotal = custoCompra + custoFrete;
    const lucroBruto = receita - custoCompra;
    const lucroLiquido = receitaLiquida - custoTotal;
    const taxaVendaLiquida = receita > 0 ? receitaLiquida / receita : 1;
    const precoVendaMedio = totalKg > 0 ? receita / totalKg : 0;
    const pontoEquilibrioFat = taxaVendaLiquida > 0 ? custoTotal / taxaVendaLiquida : custoTotal;

    return {
        linhas,
        totalPct, totalKg, totalKgCompra, totalInvestimento,
        receita, receitaLiquida, custoCompra, custoFrete, custoTotal,
        lucroBruto,
        margemBrutaPct: receita > 0 ? (lucroBruto / receita) * 100 : 0,
        lucroLiquido,
        margemLiquidaPct: receita > 0 ? (lucroLiquido / receita) * 100 : 0,
        precoVendaMedio,
        precoCompraMedio: totalKgCompra > 0 ? custoCompra / totalKgCompra : 0,
        pontoEquilibrioFat,
        pontoEquilibrioKg: precoVendaMedio > 0 ? pontoEquilibrioFat / precoVendaMedio : 0
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcularPesosPorPercentual,
        calcularValorBrutoItem,
        calcularViabilidadeCompleta,
        normalizarPrecosMaterial,
        calcularMargemMaterial,
        calcularMixEstrategico
    };
} else {
    window.ApexEngine = {
        calcularPesosPorPercentual,
        calcularValorBrutoItem,
        calcularViabilidadeCompleta,
        normalizarPrecosMaterial,
        calcularMargemMaterial,
        calcularMixEstrategico
    };
}
