/* ApexTech Metais — interações da página inicial */
(function () {
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─── Comprovante com as cotações reais da LME ─── */
    const METAIS = [
        ['cobre', 'Cobre'], ['aluminio', 'Alumínio'], ['zinco', 'Zinco'],
        ['chumbo', 'Chumbo'], ['estanho', 'Estanho'], ['niquel', 'Níquel']
    ];
    const numeroUS = (txt) => parseFloat(String(txt || '').replace(/,/g, ''));      // "14,689.00"
    const numeroBR = (txt) => parseFloat(String(txt || '').replace(/\./g, '').replace(',', '.')); // "5,0119"
    const fmt = (n, casas) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    const chaveMes = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    async function diariasDoMes(data) {
        const r = await fetch(`/api/lme/tabela/${chaveMes(data)}`);
        if (!r.ok) throw new Error('LME indisponível');
        const corpo = await r.json();
        return (corpo.cotacoes || []).filter(c => c.tipo === 'diaria' && !isNaN(numeroUS(c.cobre)));
    }

    function contar(el, destino, casas) {
        if (semMovimento) { el.textContent = fmt(destino, casas); return; }
        const inicio = performance.now(), duracao = 900, de = destino * 0.985;
        (function passo(agora) {
            const t = Math.min(1, (agora - inicio) / duracao);
            const suave = 1 - Math.pow(1 - t, 3);
            el.textContent = fmt(de + (destino - de) * suave, casas);
            if (t < 1) requestAnimationFrame(passo);
        })(inicio);
    }

    async function carregarComprovante() {
        const corpo = document.getElementById('ax-ticket-linhas');
        const rotulo = document.getElementById('ax-ticket-data');
        if (!corpo || !rotulo) return;
        try {
            const hoje = new Date();
            let dias = await diariasDoMes(hoje);
            if (dias.length < 2) {
                const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                dias = (await diariasDoMes(anterior)).concat(dias);
            }
            if (dias.length === 0) throw new Error('sem cotações');
            const ultimo = dias[dias.length - 1];
            const previo = dias.length > 1 ? dias[dias.length - 2] : null;

            rotulo.textContent = `Fechamento de ${ultimo.dia.replace('/', ' de ').toLowerCase()}`;
            corpo.innerHTML = '';
            METAIS.forEach(([chave, nome]) => {
                const valor = numeroUS(ultimo[chave]);
                const antes = previo ? numeroUS(previo[chave]) : NaN;
                const variacao = antes > 0 ? ((valor - antes) / antes) * 100 : null;
                const tr = document.createElement('tr');
                const classe = variacao === null || variacao === 0 ? '' : (variacao > 0 ? 'is-alta' : 'is-baixa');
                const seta = variacao === null || variacao === 0 ? '' : (variacao > 0 ? '▲ ' : '▼ ');
                tr.innerHTML = `<th scope="row">${nome}</th><td data-valor></td><td class="${classe}">${variacao === null ? '—' : seta + fmt(Math.abs(variacao), 2) + '%'}</td>`;
                corpo.appendChild(tr);
                contar(tr.querySelector('[data-valor]'), valor, 2);
            });
            const dolar = numeroBR(ultimo.dolar);
            const elDolar = document.getElementById('ax-ticket-dolar');
            if (elDolar && !isNaN(dolar)) elDolar.textContent = 'R$ ' + fmt(dolar, 4);
        } catch (e) {
            rotulo.textContent = 'Cotações indisponíveis no momento';
        }
    }

    /* ─── Lista "O que compramos": abre um item por vez ─── */
    function iniciarLista() {
        document.querySelectorAll('[data-ax-lista]').forEach(lista => {
            const itens = Array.from(lista.querySelectorAll('.ax-item'));
            itens.forEach(item => {
                const botao = item.querySelector('button');
                botao.addEventListener('click', () => {
                    const abrir = !item.classList.contains('is-aberto');
                    itens.forEach(outro => {
                        outro.classList.remove('is-aberto');
                        outro.querySelector('button').setAttribute('aria-expanded', 'false');
                    });
                    if (abrir) {
                        item.classList.add('is-aberto');
                        botao.setAttribute('aria-expanded', 'true');
                    }
                });
            });
        });
    }

    /* ─── Passo a passo: a linha avança conforme a rolagem ─── */
    function iniciarPassos() {
        const lista = document.querySelector('[data-ax-passos]');
        if (!lista) return;
        const passos = Array.from(lista.children);
        if (semMovimento) {
            lista.style.setProperty('--progresso', 1);
            passos.forEach(p => p.classList.add('is-ativo'));
            return;
        }
        let agendado = false;
        function atualizar() {
            agendado = false;
            const caixa = lista.getBoundingClientRect();
            const altura = window.innerHeight;
            // 0 quando o topo da lista entra a 85% da tela; 1 quando chega a 35%
            const progresso = Math.max(0, Math.min(1, (altura * 0.85 - caixa.top) / (altura * 0.5)));
            lista.style.setProperty('--progresso', progresso.toFixed(3));
            passos.forEach((p, i) => p.classList.toggle('is-ativo', progresso >= (i + 0.35) / passos.length));
        }
        window.addEventListener('scroll', () => { if (!agendado) { agendado = true; requestAnimationFrame(atualizar); } }, { passive: true });
        window.addEventListener('resize', atualizar);
        atualizar();
    }

    document.addEventListener('DOMContentLoaded', () => {
        carregarComprovante();
        iniciarLista();
        iniciarPassos();
    });
})();
