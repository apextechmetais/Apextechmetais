// ─── COTAÇÕES AO VIVO DÓLAR & LME (USD / BRL) ─────────────────────────────
    window.carregarCotacoesDolarLME = async function() {
        try {
            const res = await fetch('/api/cotacoes/dolar-lme');
            const data = await res.json();
            if (data && data.dolar) {
                window.currentDolarRate = data.dolar;
                console.log(`💵 Cotação Dólar Comercial: R$ ${data.dolar.toFixed(2)} | LME Cobre: R$ ${data.lme_brl_kg?.cobre}/kg`);

                const alertaEl = document.getElementById('alerta-cotacao-mercado');
                const alertaTexto = document.getElementById('alerta-cotacao-texto');
                if (alertaEl && data.variacao_alta) {
                    alertaEl.style.display = 'flex';
                    if (alertaTexto) {
                        const pctStr = (data.dolar_pct_change >= 0 ? '+' : '') + (data.dolar_pct_change || 0).toFixed(2) + '%';
                        alertaTexto.textContent = `Alta volatilidade detectada no Dólar (${pctStr} hoje). Avalie revisar a Tabela de Preços.`;
                    }
                } else if (alertaEl) {
                    alertaEl.style.display = 'none';
                }
            }
        } catch(e) {
            console.warn('Erro ao buscar cotação ao vivo:', e);
        }
    };

    async function carregarAmostras() {
        try {
            const res = await fetch('/api/amostras');
            const data = await res.json();
            localAmostras = Array.isArray(data) ? data : [];
            renderAmostras();
            popularSeletoresAmostras();
            atualizarNotificacoesAprovacao();
        } catch (err) {
            console.error('Erro ao carregar amostras:', err);
            localAmostras = [];
        }
    }

    