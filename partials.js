/**
 * ApexTech Metais — Partials compartilhados (cabeçalho, título de página, rodapé e WhatsApp)
 * Inclua este script em cada página logo após o <body>.
 * Defina window.CURRENT_PAGE com o nome da página ativa para marcar o menu.
 */
(function () {
  const WHATSAPP = 'https://api.whatsapp.com/send?phone=5511940222249';
  const TELEFONE_HREF = 'tel:+551156105564';
  const TELEFONE = '11 5610-5564';
  const EMAIL = 'contato@apextechmetais.com.br';

  /* ─── Navegação ─── */
  const navItems = [
    { label: 'Sobre',          href: '/sobre.html',        key: 'sobre' },
    { label: 'Soluções',       href: '/servicos.html',     key: 'servicos' },
    { label: 'Catálogo',       href: '/produtos.html',     key: 'produtos' },
    { label: 'Compra e venda', href: '/onde-comprar.html', key: 'onde-comprar' },
    { label: 'Cotações LME',   href: '/cotacoes.html',     key: 'cotacoes' },
    { label: 'Notícias',       href: '/noticias.html',     key: 'noticias' },
  ];
  const currentPage = window.CURRENT_PAGE || '';

  const linkAtual = (item) => (item.key === currentPage ? ' aria-current="page"' : '');
  const navDesktop = navItems.map(i => `<li${i.key === currentPage ? ' class="current"' : ''}><a href="${i.href}"${linkAtual(i)}>${i.label}</a></li>`).join('');
  const navDrawer = [{ label: 'Início', href: '/index.html', key: 'home' }, ...navItems, { label: 'Contato', href: '/contato.html', key: 'contato' }]
    .map((i, n) => `<li style="--i:${n}"><a href="${i.href}"${linkAtual(i)} onclick="closeMenu()">${i.label}</a></li>`).join('');

  const iconeWhats = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.1A8.5 8.5 0 1 1 21 11.5Z"/></svg>';

  /* ─── Cabeçalho ─── */
  const headerHTML = `
<a class="ax-skip" href="#page-content">Pular para o conteúdo</a>
<header class="header-desktop ax-header">
    <div class="ax-header__bar">
        <a href="/index.html" class="ax-logo" aria-label="ApexTech Metais — página inicial">
            <img src="/assets/img/logo-apextech.svg" alt="ApexTech Metais" width="188" height="56">
        </a>
        <nav class="ax-nav" aria-label="Principal">
            <ul class="menu-desktop">${navDesktop}</ul>
        </nav>
        <div class="ax-header__acoes">
            <a href="${TELEFONE_HREF}" class="ax-fone">${TELEFONE}</a>
            <a href="/contato.html" class="ax-btn ax-btn--solido ax-btn--pequeno">Pedir avaliação</a>
            <button class="ax-menu-btn" id="btn-open-menu" aria-label="Abrir menu" aria-controls="mobile-drawer">
                <span></span><span></span>
            </button>
        </div>
    </div>
</header>
<div class="ax-drawer" id="mobile-drawer" aria-label="Menu">
    <div class="ax-drawer__topo">
        <img src="/assets/img/logo-apextech.svg" alt="ApexTech Metais" width="150" height="45">
        <button class="ax-drawer__fechar" id="btn-close-menu" aria-label="Fechar menu">Fechar</button>
    </div>
    <nav aria-label="Menu completo"><ul class="mobile-nav">${navDrawer}</ul></nav>
    <div class="ax-drawer__contato">
        <a href="${TELEFONE_HREF}">${TELEFONE}</a>
        <a href="mailto:${EMAIL}">${EMAIL}</a>
        <a href="${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
</div>
<div class="ax-drawer-fundo" id="drawer-overlay"></div>`;

  /* ─── Título das páginas internas ─── */
  const titulos = {
    'sobre':        { title: 'Quem somos', desc: 'Compramos, processamos e devolvemos metal à indústria desde a triagem até a matéria-prima.' },
    'servicos':     { title: 'Soluções', desc: 'Compra e gestão de resíduos metálicos para indústrias, obras e empresas.' },
    'produtos':     { title: 'Catálogo de materiais', desc: 'Os metais e ligas que compramos e fornecemos.' },
    'onde-comprar': { title: 'Compra e venda', desc: 'De onde vem a sucata que compramos e para quem vai o metal que processamos.' },
    'cotacoes':     { title: 'Cotações LME', desc: 'Fechamentos diários da Bolsa de Metais de Londres e do dólar comercial.' },
    'noticias':     { title: 'Notícias', desc: 'Mercado de metais, reciclagem e novidades da ApexTech.' },
    'contato':      { title: 'Fale com a gente', desc: 'Peça a avaliação da sua sucata ou tire dúvidas sobre coleta e pagamento.' },
  };

  /* ─── Rodapé ─── */
  const footerHTML = `
<footer class="ax-footer" id="rodape">
    <div class="ax-wrap ax-footer__grade">
        <div class="ax-footer__marca">
            <img src="/assets/img/logo-apextech.svg" alt="ApexTech Metais" width="200" height="60">
            <p>Compra, processamento e valorização de sucatas metálicas em São Paulo e região.</p>
        </div>
        <nav class="footer-col-links" aria-label="Institucional">
            <h2>Empresa</h2>
            <ul>
                <li><a href="/sobre.html">Quem somos</a></li>
                <li><a href="/servicos.html">Soluções</a></li>
                <li><a href="/onde-comprar.html">Compra e venda</a></li>
                <li><a href="/noticias.html">Notícias</a></li>
            </ul>
        </nav>
        <nav class="footer-col-solucoes" aria-label="Materiais">
            <h2>Materiais</h2>
            <ul>
                <li><a href="/produtos.html">Catálogo de materiais</a></li>
                <li><a href="/cotacoes.html">Cotações LME</a></li>
                <li><a href="/sobre.html#galeria">Fotos da operação</a></li>
            </ul>
        </nav>
        <div class="ax-footer__contato">
            <h2>Atendimento</h2>
            <a class="ax-footer__fone" href="${TELEFONE_HREF}">${TELEFONE}</a>
            <a href="mailto:${EMAIL}">${EMAIL}</a>
            <ul class="ax-footer__redes">
                <li><a href="${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a></li>
                <li><a href="https://www.instagram.com/apextechmetais/" target="_blank" rel="noopener">Instagram</a></li>
                <li><a href="https://www.facebook.com/apextechmetais" target="_blank" rel="noopener">Facebook</a></li>
            </ul>
        </div>
    </div>
    <div class="ax-wrap ax-footer__base">
        <p>© ${new Date().getFullYear()} Apextech Indústria e Comércio de Resíduos Ltda.</p>
        <a href="/admin.html" class="admin-access-btn">Área restrita</a>
    </div>
</footer>`;

  const widgetsHTML = `
<a href="${WHATSAPP}" target="_blank" rel="noopener" class="ax-whats" aria-label="Conversar no WhatsApp">
    ${iconeWhats}<span>WhatsApp</span>
</a>`;

  /* ─── Injeção no DOM ─── */
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.add('ax');
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      pageContent.insertAdjacentHTML('beforebegin', headerHTML);
    } else {
      document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    const t = titulos[currentPage];
    if (t && pageContent) {
      pageContent.insertAdjacentHTML('afterbegin', `
<section class="ax-pagehead">
    <div class="ax-wrap">
        <h1>${t.title}</h1>
        <p>${t.desc}</p>
    </div>
</section>`);
    }

    document.body.insertAdjacentHTML('beforeend', footerHTML);
    document.body.insertAdjacentHTML('beforeend', widgetsHTML);

    // Fecha o menu com Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.closeMenu) window.closeMenu();
    });
  });
})();
