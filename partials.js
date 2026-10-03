/**
 * ApexTech Metais — Partials compartilhados (header + footer)
 * Inclua este script em cada página logo após o <body>.
 * Defina window.CURRENT_PAGE com o nome da página ativa para marcar o menu.
 */
(function () {
  /* ─── Mapa de itens de navegação ─── */
  const navItems = [
    { label: 'Home',                  href: '/index.html',        key: 'home' },
    { label: 'Sobre',                 href: '/sobre.html',        key: 'sobre' },
    { label: 'Soluções',              href: '/servicos.html',     key: 'servicos' },
    { label: 'Catálogo',              href: '/produtos.html',     key: 'produtos' },
    { label: 'Onde Encontramos',      href: '/onde-comprar.html', key: 'onde-comprar' },
    { label: 'Cotações LME',          href: '/cotacoes.html',     key: 'cotacoes' },
    { label: 'Galeria',               href: '/sobre.html#galeria',key: 'galeria' },
    { label: 'Notícias',              href: '/noticias.html',     key: 'noticias' },
    { label: 'Atendimento',           href: '/contato.html',      key: 'contato' },
  ];

  const currentPage = window.CURRENT_PAGE || '';

  /* ─── Gera itens do menu ─── */
  function buildNavItems(mobile) {
    return navItems.map(item => {
      const isActive = item.key === currentPage;
      if (mobile) {
        return `<li><a href="${item.href}" onclick="closeMenu()">${item.label}</a></li>`;
      }
      return `<li${isActive ? ' class="current"' : ''}><a href="${item.href}">${item.label}</a></li>`;
    }).join('\n');
  }

  /* ─── HTML do Header ─── */
  const headerHTML = `
<header class="header-desktop">
    <div class="fundo-header">
        <div class="container-fluid">
            <div class="header-row">

                <!-- Logo -->
                <div class="logo-wrap">
                    <a href="/index.html" class="link_logo">
                        <img src="https://apextechmetais.com.br/wp-content/uploads/2024/07/logo-apextech.svg"
                             alt="ApexTech Metais" title="ApexTech Metais" class="img-logo-desktop">
                    </a>
                </div>

                <!-- Nav desktop — itens principais apenas -->
                <nav class="menu_desktop" id="menu-desktop">
                    <ul class="menu-desktop">
                        <li${currentPage==='home'?' class="current"':''}>    <a href="/index.html">Home</a></li>
                        <li${currentPage==='sobre'?' class="current"':''}>   <a href="/sobre.html">Sobre</a></li>
                        <li${currentPage==='servicos'?' class="current"':''}>   <a href="/servicos.html">Soluções</a></li>
                        <li${currentPage==='produtos'?' class="current"':''}>  <a href="/produtos.html">Catálogo</a></li>
                        <li${currentPage==='cotacoes'?' class="current"':''}>  <a href="/cotacoes.html">Cotações LME</a></li>
                        <li${currentPage==='contato'?' class="current"':''}>   <a href="/contato.html">Contato</a></li>
                    </ul>
                </nav>

                <!-- Ações da direita -->
                <div class="header-actions">
                    <!-- Telefone compacto -->
                    <a href="tel:+551156105564" class="header-phone-link" title="Ligar agora">
                        <i class="fa-solid fa-phone"></i>
                        <span>11 5610-5564</span>
                    </a>
                    <!-- Redes sociais compactas -->
                    <ul class="redes-sociais header-social-compact">
                        <li><a href="https://www.facebook.com/apextechmetais" target="_blank" class="rede-social-facebook" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a></li>
                        <li><a href="https://www.instagram.com/apextechmetais/" target="_blank" class="rede-social-instagram" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a></li>
                        <li><a href="https://api.whatsapp.com/send?phone=5511940222249" target="_blank" class="rede-social-whatsapp" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a></li>
                    </ul>
                    <!-- Botão hambúrguer — abre o drawer com TODOS os itens -->
                    <button class="btn-open-menu-desktop" id="btn-open-menu" aria-label="Menu completo">
                        <i class="fa-solid fa-bars"></i>
                    </button>
                </div>

            </div>
        </div>
    </div>

    <!-- Mobile / Full Menu Drawer -->
    <div class="mobile-drawer" id="mobile-drawer">
        <div class="mobile-drawer-header">
            <img src="https://apextechmetais.com.br/wp-content/uploads/2024/07/logo-apextech.svg" alt="ApexTech Metais" class="mobile-logo">
            <button class="btn-close-menu" id="btn-close-menu" aria-label="Fechar menu">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <nav>
            <ul class="mobile-nav">
                ${buildNavItems(true)}
            </ul>
        </nav>
        <div class="mobile-contact">
            <a href="tel:+551156105564" class="mobile-contact-item"><i class="fa-solid fa-phone"></i> 11 5610-5564</a>
            <a href="mailto:contato@apextechmetais.com.br" class="mobile-contact-item"><i class="fa-solid fa-envelope"></i> contato@apextechmetais.com.br</a>
        </div>
        <ul class="redes-sociais mobile-social">
            <li><a href="https://www.facebook.com/apextechmetais" target="_blank" class="rede-social-facebook" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a></li>
            <li><a href="https://www.instagram.com/apextechmetais/" target="_blank" class="rede-social-instagram" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a></li>
            <li><a href="https://api.whatsapp.com/send?phone=5511940222249" target="_blank" class="rede-social-whatsapp" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a></li>
        </ul>
    </div>
    <div class="drawer-overlay" id="drawer-overlay"></div>
</header>`;


  /* ─── HTML do Footer ─── */
  const footerHTML = `
<footer class="footer-desktop" id="contato">
    <div class="container">
        <div class="footer-content-row">
            <!-- Logo + Social -->
            <div class="footer-col footer-col-logo">
                <div class="footer_column footer_column_1">
                    <img src="https://apextechmetais.com.br/wp-content/uploads/2024/07/logo-apextech.svg"
                         alt="ApexTech Metais" class="footer-logo">
                    <ul class="redes-sociais footer-social">
                        <li class="rede-social-facebook-item">
                            <a href="https://www.facebook.com/apextechmetais" target="_blank" class="rede-social-facebook" aria-label="Facebook">
                                <i class="fa-brands fa-facebook"></i>
                            </a>
                        </li>
                        <li class="rede-social-instagram-item">
                            <a href="https://www.instagram.com/apextechmetais/" target="_blank" class="rede-social-instagram" aria-label="Instagram">
                                <i class="fa-brands fa-instagram"></i>
                            </a>
                        </li>
                        <li class="rede-social-whatsapp-item">
                            <a href="https://api.whatsapp.com/send?phone=5511940222249" target="_blank" class="rede-social-whatsapp" aria-label="WhatsApp">
                                <i class="fa-brands fa-whatsapp"></i>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Institucional -->
            <div class="footer-col footer-col-links">
                <div class="footer_column footer_column_2">
                    <h2 class="widgettitle">Institucional</h2>
                    <ul class="footer-menu">
                        <li><a href="/index.html">Home</a></li>
                        <li><a href="/sobre.html">Sobre</a></li>
                        <li><a href="/onde-comprar.html">Compra e Venda</a></li>
                    </ul>
                </div>
            </div>

            <!-- Soluções -->
            <div class="footer-col footer-col-links footer-col-solucoes">
                <div class="footer_column footer_column_3">
                    <h2 class="widgettitle">Soluções</h2>
                    <ul class="footer-menu">
                        <li><a href="https://apextechmetais.com.br/solucao/sucatas-de-industrias/" target="_blank">Sucatas de Indústrias</a></li>
                        <li><a href="https://apextechmetais.com.br/solucao/sucatas-de-fios-e-cabos/" target="_blank">Sucatas de Fios e Cabos</a></li>
                        <li><a href="https://apextechmetais.com.br/solucao/residuos-e-sucatas-de-obras/" target="_blank">Resíduos e Sucatas de Obras</a></li>
                        <li><a href="https://apextechmetais.com.br/solucao/residuos-de-conectores/" target="_blank">Resíduos de Conectores</a></li>
                    </ul>
                </div>
            </div>

            <!-- Atendimento -->
            <div class="footer-col footer-col-contact">
                <div class="footer_column footer_column_4">
                    <h2 class="widgettitle">Atendimento</h2>
                    <div class="dados_de_atendimento">
                        <a href="tel:+551156105564" target="_blank" class="dados_item">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clipPhone2)"><path d="M4.56614 1.65964C4.49234 1.56471 4.3992 1.48658 4.29289 1.43042C4.18658 1.37426 4.06953 1.34136 3.94953 1.33391C3.82953 1.32647 3.70932 1.34464 3.59688 1.38722C3.48444 1.4298 3.38235 1.49582 3.29739 1.58089L2.00489 2.87464C1.40114 3.47964 1.17864 4.33589 1.44239 5.08714C2.5383 8.19602 4.31883 11.0189 6.65239 13.3471C8.98063 15.6807 11.8035 17.4612 14.9124 18.5571C15.6636 18.8209 16.5199 18.5984 17.1249 17.9946L18.4174 16.7021C18.5025 16.6172 18.5685 16.5151 18.6111 16.4026C18.6536 16.2902 18.6718 16.17 18.6644 16.05C18.6569 15.93 18.624 15.8129 18.5679 15.7066C18.5117 15.6003 18.4336 15.5072 18.3386 15.4334L15.4549 13.1909C15.3534 13.1124 15.2354 13.0579 15.1099 13.0315C14.9843 13.0051 14.8544 13.0074 14.7299 13.0384L11.9924 13.7221C11.627 13.8128 11.2443 13.8077 10.8814 13.7072C10.5186 13.6067 10.1878 13.4142 9.92114 13.1484L6.85114 10.0771C6.58511 9.81059 6.39241 9.47987 6.29167 9.11701C6.19094 8.75415 6.18559 8.37142 6.27614 8.00589L6.96114 5.26839C6.99208 5.14387 6.99444 5.01396 6.96803 4.8884C6.94162 4.76284 6.88713 4.64489 6.80864 4.54339L4.56614 1.65964ZM2.35364 0.638386C2.57238 0.419573 2.83517 0.249799 3.12456 0.140338C3.41395 0.0308764 3.72331 -0.0157677 4.03211 0.00350262C4.34091 0.022773 4.64208 0.107517 4.91561 0.252107C5.18915 0.396698 5.42879 0.597826 5.61864 0.842136L7.86114 3.72464C8.27239 4.25339 8.41739 4.94214 8.25489 5.59214L7.57114 8.32964C7.53603 8.47144 7.53806 8.61989 7.57704 8.76068C7.61601 8.90146 7.69061 9.02983 7.79364 9.13339L10.8649 12.2046C10.9686 12.3079 11.0971 12.3826 11.2382 12.4216C11.3792 12.4606 11.5279 12.4625 11.6699 12.4271L14.4061 11.7434C14.7269 11.6636 15.0616 11.6577 15.3851 11.7259C15.7085 11.7941 16.0123 11.9347 16.2736 12.1371L19.1561 14.3796C20.1924 15.1859 20.2874 16.7171 19.3599 17.6434L18.0674 18.9359C17.1424 19.8609 15.7599 20.2671 14.4711 19.8134C11.172 18.6541 8.17681 16.7656 5.70864 14.2884C3.2316 11.8206 1.34308 8.82585 0.183636 5.52714C-0.268864 4.23964 0.137386 2.85589 1.06239 1.93089L2.35364 0.638386Z" fill="currentColor"/></g><defs><clipPath id="clipPhone2"><rect width="20" height="20" fill="currentColor"/></clipPath></defs></svg>
                            <span>11 5610-5564</span>
                        </a>
                        <a href="mailto:contato@apextechmetais.com.br" target="_blank" class="dados_item">
                            <svg width="21" height="17" viewBox="0 0 21 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0 3.25C0 2.55381 0.276562 1.88613 0.768845 1.39384C1.26113 0.901562 1.92881 0.625 2.625 0.625H18.375C19.0712 0.625 19.7389 0.901562 20.2312 1.39384C20.7234 1.88613 21 2.55381 21 3.25V13.75C21 14.4462 20.7234 15.1139 20.2312 15.6062C19.7389 16.0984 19.0712 16.375 18.375 16.375H2.625C1.92881 16.375 1.26113 16.0984 0.768845 15.6062C0.276562 15.1139 0 14.4462 0 13.75V3.25ZM2.625 1.9375C2.2769 1.9375 1.94306 2.07578 1.69692 2.32192C1.45078 2.56806 1.3125 2.9019 1.3125 3.25V3.53481L10.5 9.04731L19.6875 3.53481V3.25C19.6875 2.9019 19.5492 2.56806 19.3031 2.32192C19.0569 2.07578 18.7231 1.9375 18.375 1.9375H2.625ZM19.6875 5.06519L13.5082 8.773L19.6875 12.5753V5.06519ZM19.6429 14.0899L12.2404 9.53425L10.5 10.5777L8.75962 9.53425L1.35713 14.0886C1.43171 14.3679 1.59642 14.6148 1.82567 14.7909C2.05493 14.967 2.33592 15.0625 2.625 15.0625H18.375C18.6639 15.0625 18.9448 14.9672 19.174 14.7914C19.4032 14.6156 19.568 14.369 19.6429 14.0899ZM1.3125 12.5753L7.49175 8.773L1.3125 5.06519V12.5753Z" fill="currentColor"/></svg>
                            <span>contato@apextechmetais.com.br</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Copyright -->
    <div class="copyright">
        <div class="container">
            <div class="copyright-row">
                <div class="copyright-text">
                    <p>Copyright 2026 - APEXTECH - INDUSTRIA DE <br>COMÉRCIO DE RESÍDUOS LTDA</p>
                </div>
                <div class="copyright-logo" style="text-align: right;">
                    <a href="/admin.html" class="admin-access-btn" title="Acesso Restrito Admin">
                        <i class="fa-solid fa-gear" style="font-size: 1.8rem; color: rgba(255,255,255,0.4); transition: color 0.3s ease;"></i>
                    </a>
                </div>
            </div>
        </div>
    </div>
</footer>
`;

  /* ─── HTML do Chatbot e Widgets Flutuantes ─── */
  const widgetsHTML = `
<!-- Chatbot Container -->
<div class="chatbot-container" id="chatbot-container">
    <div class="chatbot-header">
        <div class="chatbot-avatar">
            <img src="assets/img/avatar.png" alt="IA">
        </div>
        <div class="chatbot-title">
            <h4>Assistente Virtual</h4>
            <p>ApexTech Metais</p>
        </div>
        <button id="chatbot-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="chatbot-messages" id="chatbot-messages">
        <div class="message ai-message">
            Olá! Como posso ajudar você hoje com a reciclagem de metais?
        </div>
    </div>
    <div class="chatbot-input">
        <input type="text" id="chatbot-input-field" placeholder="Digite sua mensagem...">
        <button id="chatbot-send"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
</div>

<button class="chatbot-toggle" id="chatbot-toggle">
    <img src="assets/img/avatar.png" alt="IA" class="toggle-avatar">
</button>

<!-- WhatsApp Floating Button -->
<a href="https://api.whatsapp.com/send?phone=5511940222249" target="_blank" class="btn-flutuante-whatsapp" aria-label="WhatsApp">
    <i class="fa-brands fa-whatsapp"></i>
</a>
`;

  /* ─── Injeção no DOM ─── */
  document.addEventListener('DOMContentLoaded', function () {
    // Injetar header
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      pageContent.insertAdjacentHTML('beforebegin', headerHTML);
    } else {
      document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    // Injetar Page Top Banner (se não for Home nem Admin)
    if (currentPage && currentPage !== 'home' && currentPage !== 'admin') {
      const bannerData = {
        'sobre': { 
            title: 'Sobre Nós', 
            desc: 'ApexTech Metais - Tradição e Inovação na Gestão de Resíduos',
            img: 'https://images.unsplash.com/photo-1518557984649-7b161c230cfa?auto=format&fit=crop&w=1920&q=80'
        },
        'servicos': { 
            title: 'Soluções e Serviços', 
            desc: 'Gestão inteligente e sustentável de resíduos metálicos',
            img: 'https://images.unsplash.com/photo-1530982011887-3cc11cc85693?auto=format&fit=crop&w=1920&q=80'
        },
        'produtos': { 
            title: 'Catálogo de Produtos', 
            desc: 'Conheça os materiais e ligas que processamos',
            img: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?auto=format&fit=crop&w=1920&q=80'
        },
        'onde-comprar': { 
            title: 'Compra e Venda', 
            desc: 'Coletamos sucatas e resíduos de diversos segmentos',
            img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80'
        },
        'cotacoes': { 
            title: 'Cotações LME', 
            desc: 'Acompanhe o mercado global de metais em tempo real',
            img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1920&q=80'
        },
        'noticias': { 
            title: 'Notícias', 
            desc: 'Novidades, sustentabilidade e mercado de metais',
            img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80'
        },
        'contato': { 
            title: 'Fale Conosco', 
            desc: 'Entre em contato para cotações, parcerias e dúvidas',
            img: 'https://images.unsplash.com/photo-1516328314061-1c15c90ce915?auto=format&fit=crop&w=1920&q=80'
        }
      };

      if (bannerData[currentPage]) {
        const bd = bannerData[currentPage];
        const bannerHTML = `
        <section class="page-top-banner" style="background-image: url('${bd.img}');">
            <div class="page-top-banner-overlay"></div>
            <div class="container">
                <h1>${bd.title}</h1>
                <p>${bd.desc}</p>
            </div>
        </section>
        `;
        if (pageContent) {
           pageContent.insertAdjacentHTML('afterbegin', bannerHTML);
        }
      }
    }

    // Injetar footer
    document.body.insertAdjacentHTML('beforeend', footerHTML);

    // Injetar widgets (Chatbot e WhatsApp)
    document.body.insertAdjacentHTML('beforeend', widgetsHTML);
  });
})();
