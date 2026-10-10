/**
 * Trilha de auditoria: transforma cada requisição que altera dados em um registro legível.
 * O registro é feito quando a resposta termina, para guardar também o resultado (sucesso, negado, erro).
 */

// Campos cujo valor nunca vai para o registro
const CAMPO_SENSIVEL = /pass|senha|secret|token|api[_-]?key|chave|data_b64|base64|foto|imagem|arquivo|qr/i;
// Chamadas automáticas da tela, que só fariam ruído na trilha
const IGNORAR = [/^\/whatsapp\/resincronizar$/, /^\/chat$/];

const CATEGORIAS = [
    [/^\/login$/, 'LOGIN'],
    [/^\/usuarios/, 'USUÁRIOS'],
    [/^\/settings/, 'CONFIGURAÇÕES'],
    [/^\/permissoes|^\/me\//, 'PERMISSÕES'],
    [/^\/amostras/, 'AMOSTRAS'],
    [/^\/tabela-precos/, 'PREÇOS'],
    [/^\/pedidos-venda/, 'PEDIDOS DE VENDA'],
    [/^\/pedidos-compra/, 'PEDIDOS DE COMPRA'],
    [/^\/fornecedores/, 'FORNECEDORES'],
    [/^\/clientes/, 'CLIENTES'],
    [/^\/(materiais|residuos-catalogo|ligas-catalogo)/, 'CATÁLOGO'],
    [/^\/estoque/, 'ESTOQUE'],
    [/^\/pcp/, 'PCP'],
    [/^\/(planejamento|estrategiav3)/, 'PLANEJAMENTO'],
    [/^\/whatsapp/, 'WHATSAPP'],
    [/^\/lme/, 'LME'],
    [/^\/(galeria|noticias|solucoes|site-imagens)/, 'SITE'],
    [/^\/admin/, 'ADMINISTRAÇÃO']
];
const VERBO = { POST: 'Incluiu', PUT: 'Alterou', PATCH: 'Alterou', DELETE: 'Excluiu' };

function categoria(caminho) {
    const achada = CATEGORIAS.find(([padrao]) => padrao.test(caminho));
    return achada ? achada[1] : 'SISTEMA';
}

/** Cópia do corpo sem segredos e sem textos longos (fotos em base64, por exemplo). */
function corpoSeguro(corpo, nivel = 0) {
    if (!corpo || typeof corpo !== 'object') return corpo;
    if (Array.isArray(corpo)) return nivel > 1 ? `[${corpo.length} itens]` : corpo.slice(0, 5).map(v => corpoSeguro(v, nivel + 1));
    const saida = {};
    Object.keys(corpo).slice(0, 30).forEach(chave => {
        const valor = corpo[chave];
        if (CAMPO_SENSIVEL.test(chave)) saida[chave] = '***';
        else if (valor && typeof valor === 'object') saida[chave] = nivel > 1 ? '{…}' : corpoSeguro(valor, nivel + 1);
        else if (typeof valor === 'string' && valor.length > 80) saida[chave] = valor.slice(0, 80) + '…';
        else saida[chave] = valor;
    });
    return saida;
}

function resultado(status) {
    if (status < 400) return 'sucesso';
    if (status === 401) return 'não autenticado';
    if (status === 403) return 'acesso negado';
    if (status === 404) return 'não encontrado';
    if (status === 409 || status === 400) return 'recusado';
    return 'erro';
}

/**
 * Monta o registro de uma requisição. Devolve null quando ela não deve ser auditada.
 * `caminho` é o caminho sem o prefixo /api.
 */
function resumirRequisicao({ metodo, caminho, corpo, usuario, status }) {
    if (!VERBO[metodo]) return null;
    if (IGNORAR.some(padrao => padrao.test(caminho))) return null;

    const acao = categoria(caminho);
    const res = resultado(status);
    const idAmostra = (caminho.match(/^\/amostras\/(\d+)/) || [])[1];

    if (acao === 'LOGIN') {
        const quem = String((corpo && corpo.user) || '').slice(0, 60) || 'sem usuário';
        return { usuario: quem, acao, detalhe: status < 400 ? 'Entrou no sistema' : `Tentativa de login recusada (${status})`, amostraId: null };
    }

    let dados = '';
    try {
        const seguro = corpoSeguro(corpo);
        const texto = seguro && typeof seguro === 'object' && Object.keys(seguro).length ? JSON.stringify(seguro) : '';
        dados = texto ? ' | Dados: ' + (texto.length > 320 ? texto.slice(0, 320) + '…' : texto) : '';
    } catch (e) { dados = ''; }

    return {
        usuario: usuario || 'Anônimo',
        acao,
        detalhe: `${VERBO[metodo]} em ${caminho} — ${res}${status >= 400 ? ` (${status})` : ''}${dados}`,
        amostraId: idAmostra ? parseInt(idAmostra, 10) : null
    };
}

/** Middleware do Express. `registrar(usuario, acao, detalhe, amostraId, req)` grava o registro. */
function criarMiddlewareAuditoria(registrar) {
    return (req, res, next) => {
        if (!VERBO[req.method]) return next();
        const caminho = req.path;
        res.on('finish', () => {
            try {
                const registro = resumirRequisicao({
                    metodo: req.method, caminho, corpo: req.body,
                    usuario: req.user ? (req.user.user || req.user.nome) : null,
                    status: res.statusCode
                });
                if (registro) Promise.resolve(registrar(registro.usuario, registro.acao, registro.detalhe, registro.amostraId, req)).catch(() => {});
            } catch (e) { /* a auditoria nunca pode derrubar uma requisição */ }
        });
        next();
    };
}

/** IP de quem fez a requisição (o primeiro da cadeia quando há proxy, como no Railway). */
function ipDaRequisicao(req) {
    if (!req) return '127.0.0.1';
    const encaminhado = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
    return encaminhado || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

module.exports = { resumirRequisicao, criarMiddlewareAuditoria, corpoSeguro, categoria, ipDaRequisicao };
