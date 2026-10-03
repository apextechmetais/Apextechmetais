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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcularPesosPorPercentual,
        calcularValorBrutoItem,
        calcularViabilidadeCompleta
    };
} else {
    window.ApexEngine = {
        calcularPesosPorPercentual,
        calcularValorBrutoItem,
        calcularViabilidadeCompleta
    };
}
