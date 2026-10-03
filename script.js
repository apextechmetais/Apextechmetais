// ============================================================
// APEXTECH METAIS - JavaScript
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // --------------------------------------------------------
    // MOBILE DRAWER
    // --------------------------------------------------------
    const btnOpen = document.getElementById('btn-open-menu');
    const btnClose = document.getElementById('btn-close-menu');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('drawer-overlay');

    function openMenu() {
        drawer.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        drawer.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (btnOpen) btnOpen.addEventListener('click', openMenu);
    if (btnClose) btnClose.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    // Expose closeMenu globally (used in onclick attributes)
    window.closeMenu = closeMenu;

    // --------------------------------------------------------
    // HEADER SCROLL EFFECT
    // --------------------------------------------------------
    const header = document.querySelector('.header-desktop');

    function handleScroll() {
        if (window.scrollY > 60) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    // --------------------------------------------------------
    // ACTIVE NAV LINK ON SCROLL
    // --------------------------------------------------------
    const sections = document.querySelectorAll('section[id], main[id]');
    const navLinks = document.querySelectorAll('.menu-desktop li a, .mobile-nav li a');

    const observerOptions = {
        rootMargin: '-30% 0px -60% 0px',
        threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    const parentLi = link.parentElement;
                    if (href === '#' + id || (id === 'home' && href === '/')) {
                        parentLi.classList.add('current');
                    } else {
                        parentLi.classList.remove('current');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => sectionObserver.observe(section));

    // --------------------------------------------------------
    // SCROLL FADE-IN ANIMATIONS
    // --------------------------------------------------------
    const fadeElements = document.querySelectorAll(
        '.solucao_item, .area-card, .transformando-img, .transformando-text, ' +
        '.catalogo-card, .catalogo-cta, .lme-card, .footer-col'
    );

    fadeElements.forEach(el => el.classList.add('fade-up'));

    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 80);
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    fadeElements.forEach(el => fadeObserver.observe(el));

    // --------------------------------------------------------
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // --------------------------------------------------------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const headerHeight = header ? header.offsetHeight : 0;
                const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;

                window.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // --------------------------------------------------------
    // PARALLAX LIGHT EFFECT ON HERO
    // --------------------------------------------------------
    const hero = document.querySelector('.hero-banner');
    if (hero) {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            if (scrolled < window.innerHeight) {
                hero.style.backgroundPositionY = `calc(50% + ${scrolled * 0.3}px)`;
            }
        }, { passive: true });
    }

    // --------------------------------------------------------
    // SOLUCOES CARD HOVER TILT EFFECT
    // --------------------------------------------------------
    const cards = document.querySelectorAll('.solucao_item');
    cards.forEach(card => {
        card.addEventListener('mousemove', function (e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -3;
            const rotateY = ((x - centerX) / centerX) * 3;

            this.style.transform = `translateY(-6px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', function () {
            this.style.transform = '';
        });
    });

    // --------------------------------------------------------
    // FOOTER COLUMN LINKS SHOW ON MOBILE
    // --------------------------------------------------------
    if (window.innerWidth <= 768) {
        const hiddenCols = document.querySelectorAll('.footer-col-links, .footer-col-solucoes');
        hiddenCols.forEach(col => col.style.display = 'block');
    }

    // --------------------------------------------------------
    // ONDE ENCONTRAMOS - TAB SWITCHING
    // --------------------------------------------------------
    const ondeTabs = document.querySelectorAll('.onde-tab');
    const ondePanels = document.querySelectorAll('.onde-panel');

    ondeTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetId = 'panel-' + this.dataset.tab;

            // Update tabs
            ondeTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');

            // Update panels
            ondePanels.forEach(panel => {
                panel.classList.remove('active');
            });
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });

    // Add onde-cards to fade observer
    const ondeCards = document.querySelectorAll('.onde-card, .onde-cta, .onde-tab');
    ondeCards.forEach(el => el.classList.add('fade-up'));
    ondeCards.forEach(el => fadeObserver.observe(el));

    // --------------------------------------------------------
    // ONDE ENCONTRAMOS - DYNAMIC TABS FROM ADMIN localStorage
    // --------------------------------------------------------
    function renderDynamicTabs() {
        let mats = [];
        try {
            const matsStr = localStorage.getItem('apex_materiais');
            if (matsStr) mats = JSON.parse(matsStr);
        } catch(e) {}

        if (!mats || mats.length === 0) return;

        const tabsContainer = document.querySelector('.onde-tabs');
        const panelsContainer = document.querySelector('.onde-section') || document.getElementById('onde-encontramos');

        if (!tabsContainer) return;

        const iconsList = ['fa-cogs', 'fa-bolt', 'fa-microchip', 'fa-recycle', 'fa-wrench', 'fa-industry', 'fa-tools', 'fa-box'];
        const locationIconsList = ['fa-industry', 'fa-home', 'fa-warehouse', 'fa-building', 'fa-store', 'fa-truck', 'fa-recycle', 'fa-briefcase'];

        mats.forEach((mat, idx) => {
            const tabId = `dinamico-${mat.id}`;

            // Create Tab Button
            const tabBtn = document.createElement('button');
            tabBtn.className = 'onde-tab';
            tabBtn.dataset.tab = tabId;
            tabBtn.setAttribute('aria-selected', 'false');
            const icon = iconsList[idx % iconsList.length];
            tabBtn.innerHTML = `<i class="fa-solid ${icon}"></i><span>${mat.nome}</span>`;
            tabsContainer.appendChild(tabBtn);

            // Create Panel
            const panel = document.createElement('div');
            panel.className = 'onde-panel';
            panel.id = `panel-${tabId}`;

            // Build product image HTML (if admin provided one)
            let imgHtml = '';
            if (mat.imagem) {
                imgHtml = `
                    <div class="dynamic-product-img-wrap fade-up" data-modal-img="${mat.imagem}" data-modal-title="${mat.nome}" data-modal-desc="${mat.desc}">
                        <img src="${mat.imagem}" alt="${mat.nome}" loading="lazy">
                        <div class="img-expand-hint"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
                    </div>`;
            }

            // Build location cards HTML
            let cardsHtml = '';
            if (mat.locais && mat.locais.length > 0) {
                mat.locais.forEach((loc, locIdx) => {
                    const locIcon = locationIconsList[locIdx % locationIconsList.length];
                    cardsHtml += `
                        <div class="onde-card fade-up">
                            <div class="onde-card-icon"><i class="fa-solid ${locIcon}"></i></div>
                            <h4>${loc.titulo}</h4>
                            <p>${loc.desc}</p>
                        </div>`;
                });
            } else {
                cardsHtml = `<div class="onde-card fade-up"><div class="onde-card-icon"><i class="fa-solid fa-recycle"></i></div><h4>${mat.nome}</h4><p>${mat.desc}</p></div>`;
            }

            panel.innerHTML = `
                ${imgHtml}
                <div class="onde-panel-header">
                    <p>${mat.desc}</p>
                </div>
                <div class="onde-cards-grid">
                    ${cardsHtml}
                </div>`;

            // Insert panel before .onde-cta or at the end of the section
            const ctaEl = document.querySelector('#onde-encontramos .onde-cta') || document.querySelector('#onde-encontramos .onde-sustentabilidade');
            const parentEl = ctaEl ? ctaEl.parentElement : panelsContainer;
            if (ctaEl) {
                parentEl.insertBefore(panel, ctaEl);
            } else if (panelsContainer) {
                panelsContainer.appendChild(panel);
            }

            // Add event listener to this tab
            tabBtn.addEventListener('click', function () {
                const allTabs = document.querySelectorAll('.onde-tab');
                const allPanels = document.querySelectorAll('.onde-panel');
                const targetId = 'panel-' + this.dataset.tab;

                allTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                allPanels.forEach(p => p.classList.remove('active'));

                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            });

            // Observe new cards for fade animation
            panel.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));

            // Click on image → open lightbox
            const imgWrap = panel.querySelector('.dynamic-product-img-wrap');
            if (imgWrap) {
                imgWrap.addEventListener('click', () => {
                    openCatalogModal(mat.imagem, mat.nome, mat.desc);
                });
            }
        });
    }

    renderDynamicTabs();

    // --------------------------------------------------------
    // CATALOG LIGHTBOX MODAL
    // --------------------------------------------------------
    const catalogModal   = document.getElementById('catalog-modal');
    const catalogModalImg   = document.getElementById('catalog-modal-img');
    const catalogModalTitle = document.getElementById('catalog-modal-title');
    const catalogModalDesc  = document.getElementById('catalog-modal-desc');
    const catalogModalClose = catalogModal ? catalogModal.querySelector('.catalog-modal-close') : null;
    const catalogModalOverlay = catalogModal ? catalogModal.querySelector('.catalog-modal-overlay') : null;

    // Default product images for the 6 static catalog cards
    const staticCatalogData = [
        {
            nome: 'Fios e Cabos',
            desc: 'Sucatas de fios elétricos, cabos de cobre, alumínio e outros metais não-ferrosos.',
            img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
        },
        {
            nome: 'Conectores e Disjuntores',
            desc: 'Resíduos de conectores elétricos e disjuntores industriais de diversas marcas e modelos.',
            img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80'
        },
        {
            nome: 'Sucatas Industriais',
            desc: 'Resíduos metálicos gerados por processos industriais, incluindo alumínio, cobre e ferro.',
            img: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80'
        },
        {
            nome: 'Sucatas Eletrônicas',
            desc: 'Placas, componentes eletrônicos, equipamentos obsoletos e seus subprodutos recicláveis.',
            img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'
        },
        {
            nome: 'Resíduos de Obras',
            desc: 'Materiais metálicos provenientes de demolições e construções civis, reformas e instalações.',
            img: 'https://images.unsplash.com/photo-1581579188537-8b78e4f04daa?auto=format&fit=crop&w=800&q=80'
        },
        {
            nome: 'Materiais Elétricos',
            desc: 'Transformadores, motores elétricos, bobinas e demais equipamentos elétricos fora de uso.',
            img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80'
        }
    ];

    function openCatalogModal(imgSrc, title, desc) {
        if (!catalogModal) return;
        catalogModalImg.src = imgSrc;
        catalogModalImg.alt = title;
        catalogModalTitle.textContent = title;
        catalogModalDesc.textContent = desc;
        catalogModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCatalogModal() {
        if (!catalogModal) return;
        catalogModal.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (catalogModalClose) catalogModalClose.addEventListener('click', closeCatalogModal);
    if (catalogModalOverlay) catalogModalOverlay.addEventListener('click', closeCatalogModal);

    // Close on Esc key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCatalogModal();
    });

    // Add click-hint + lightbox to the 6 static catalog cards
    const staticCards = document.querySelectorAll('.catalogo-card');
    staticCards.forEach((card, idx) => {
        const data = staticCatalogData[idx];
        if (!data) return;

        // Inject click hint element
        const hint = document.createElement('div');
        hint.className = 'catalogo-card-click-hint';
        hint.innerHTML = '<i class="fa-solid fa-camera" style="margin-right:5px;"></i>Ver foto do produto';
        card.appendChild(hint);

        card.addEventListener('click', () => {
            openCatalogModal(data.img, data.nome, data.desc);
        });
    });

    // --------------------------------------------------------
    // SOLUTIONS LIGHTBOX MODAL (API)
    // --------------------------------------------------------
    const solModal        = document.getElementById('solution-modal');
    const solModalImg     = document.getElementById('solution-modal-img');
    const solModalTitle   = document.getElementById('solution-modal-title');
    const solModalDesc    = document.getElementById('solution-modal-desc');
    const solModalClose   = solModal ? solModal.querySelector('#solution-modal-close') : null;
    const solModalOverlay = solModal ? solModal.querySelector('#solution-modal-overlay') : null;

    function openSolucaoModal(data) {
        if (!solModal || !data) return;
        solModalImg.src = data.img;
        solModalImg.alt = data.nome;
        solModalTitle.textContent = data.nome;
        // A API retorna o campo como "descricao"
        solModalDesc.textContent = data.descricao || data.desc || '';
        solModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeSolucaoModal() {
        if (!solModal) return;
        solModal.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (solModalClose)   solModalClose.addEventListener('click', closeSolucaoModal);
    if (solModalOverlay) solModalOverlay.addEventListener('click', closeSolucaoModal);

    // Busca soluções da API e renderiza os cards
    const solucoesContainer = document.getElementById('solucoes-container');
    if (solucoesContainer) {
        fetch('/api/solucoes')
            .then(res => res.json())
            .then(items => {
                solucoesContainer.innerHTML = '';
                items.forEach(data => {
                    const div = document.createElement('div');
                    div.className = 'solucao_item';
                    div.setAttribute('role', 'button');
                    div.setAttribute('tabindex', '0');
                    div.style.cursor = 'pointer';

                    const texto = data.descricao || '';
                    const resumo = texto.length > 160 ? texto.substring(0, 160) + '...' : texto;

                    div.innerHTML = `
                        <article>
                            <div class="solucoes_header">
                                <img src="${data.img}" alt="${data.nome}" class="img-fluid solucao-icon">
                                <h2>${data.nome}</h2>
                            </div>
                            <div class="solucoes_conteudo">
                                <p>${resumo}</p>
                            </div>
                        </article>
                    `;

                    div.addEventListener('click', (e) => {
                        e.preventDefault();
                        openSolucaoModal(data);
                    });

                    solucoesContainer.appendChild(div);
                });
            })
            .catch(err => {
                console.error('Erro ao carregar soluções:', err);
            });
    }



    // --------------------------------------------------------
    // CHATBOT INTEGRATION (GROQ API)
    // --------------------------------------------------------
    const chatToggle = document.getElementById('chatbot-toggle');
    const chatContainer = document.getElementById('chatbot-container');
    const chatClose = document.getElementById('chatbot-close');
    const chatMessages = document.getElementById('chatbot-messages');
    const chatInput = document.getElementById('chatbot-input-field');
    const chatSend = document.getElementById('chatbot-send');

    if (chatToggle && chatContainer) {
        chatToggle.addEventListener('click', () => {
            chatContainer.classList.add('open');
            chatToggle.style.display = 'none';
        });

        chatClose.addEventListener('click', () => {
            chatContainer.classList.remove('open');
            chatToggle.style.display = 'flex';
        });
    }

    async function sendToGroq(userText) {
        // Read materials from localStorage to inform the AI
        let mats = [];
        try {
            const matsStr = localStorage.getItem('apex_materiais');
            if (matsStr) mats = JSON.parse(matsStr);
        } catch(e) {}

        let extraMatsInfo = mats.map(m => {
            let locaisInfo = '';
            if (m.locais && m.locais.length > 0) {
                locaisInfo = ' Onde encontramos: ' + m.locais.map(l => `${l.titulo} (${l.desc})`).join(', ') + '.';
            }
            return `- ${m.nome}: ${m.desc}.${locaisInfo}`;
        }).join('\n');
        
        const systemPrompt = `Você é o assistente virtual da ApexTech Metais, uma empresa especializada em compra e reciclagem de resíduos metálicos.
Seu papel é responder dúvidas de clientes sobre os materiais que a empresa compra, onde eles são encontrados, e como funciona o processo de venda.
A empresa compra normalmente: Sucatas de Indústrias, Resíduos de Conectores, Sucatas de Fios e Cabos, Resíduos de Obras, Disjuntores, Motores Elétricos (Alumínio) e Coolers de Computadores.
Além disso, a empresa também compra os seguintes materiais cadastrados:
${extraMatsInfo}

Responda de forma curta, amigável e profissional. Use o português do Brasil. Não invente informações. Se não souber algo, sugira que o cliente entre em contato pelo WhatsApp.`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: userText,
                    systemPrompt: systemPrompt
                })
            });

            if (!response.ok) {
                console.error('Groq Proxy API Error', await response.text());
                return "Desculpe, estou com problemas técnicos no momento. Tente entrar em contato pelo WhatsApp!";
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error(error);
            return "Desculpe, ocorreu um erro na comunicação. Tente novamente.";
        }
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function handleChat() {
        const text = chatInput.value.trim();
        if (!text) return;

        // User message
        addMessage(text, 'user');
        chatInput.value = '';

        // Typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing';
        typingDiv.textContent = 'Digitando...';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Fetch from Groq
        const reply = await sendToGroq(text);

        // Remove typing and add reply
        typingDiv.remove();
        addMessage(reply, 'ai');
    }

    if (chatSend) {
        chatSend.addEventListener('click', handleChat);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChat();
        });
    }

    // --------------------------------------------------------
    // RENDERIZAR NOTÍCIAS DO MERCADO (API)
    // --------------------------------------------------------
    async function renderNoticias() {
        const grid    = document.getElementById('noticias-grid');
        const emptyEl = document.getElementById('noticias-empty');
        if (!grid) return;

        try {
            const res      = await fetch('/api/noticias');
            const noticias = res.ok ? await res.json() : [];

            if (!noticias.length) {
                if (emptyEl) emptyEl.style.display = 'flex';
                return;
            }

            if (emptyEl) emptyEl.style.display = 'none';
            grid.innerHTML = '';

            // Ordenar do mais recente para o mais antigo
            const sorted = [...noticias].sort((a, b) =>
                new Date(b.data_pub || b.data || 0) - new Date(a.data_pub || a.data || 0)
            );

            sorted.forEach(n => {
                const card = document.createElement('div');
                card.className = 'noticia-card';

                const rawDate = n.data_pub || n.data || '';
                const dataFormatada = rawDate
                    ? new Date(rawDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '';

                card.innerHTML = `
                    <div class="noticia-meta">
                        ${n.categoria ? `<span class="noticia-categoria">${n.categoria}</span>` : ''}
                        ${dataFormatada ? `<span class="noticia-data"><i class="fa-regular fa-calendar"></i> ${dataFormatada}</span>` : ''}
                    </div>
                    <h3 class="noticia-titulo">${n.titulo}</h3>
                    ${n.resumo ? `<p class="noticia-resumo">${n.resumo}</p>` : ''}
                    ${n.url ? `<a href="${n.url}" target="_blank" rel="noopener noreferrer" class="noticia-link">
                        Leia a matéria completa <i class="fa-solid fa-arrow-right"></i>
                    </a>` : ''}
                `;
                grid.appendChild(card);
            });
        } catch (err) {
            console.error('Erro ao carregar notícias:', err);
            if (emptyEl) emptyEl.style.display = 'flex';
        }
    }

    renderNoticias();

    // --------------------------------------------------------
    // COTAÇÕES LME DINÂMICAS
    // --------------------------------------------------------
    let lmeIndice = 'cobre';
    let lmeMesAtual = '';
    const lmeCharts = {};

    function initLMEDashboard() {
        const indicesButtons = document.querySelectorAll('#indices .lme-metal-btn');
        const selectMonth = document.getElementById('meslme');
        const printBtn = document.getElementById('imprimirlme');

        if (!selectMonth) return; // Se a seção LME não estiver nesta página

        // 1. Carga Inicial: busca o mês padrão
        fetchLMETabela('atual'); // Busca o mês mais recente/atual da LME
        
        // 2. Mudança de Mês no Dropdown
        selectMonth.addEventListener('change', function(e) {
            e.preventDefault();
            lmeMesAtual = this.value;
            fetchLMETabela(lmeMesAtual);
        });

        // 3. Clique nas abas de metais
        indicesButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                lmeIndice = this.dataset.indice;
                
                // Tonalidade das abas
                indicesButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Atualizar os gráficos e cards de variação
                atualizaGraficosLME();
            });
        });

        // 4. Botão de Impressão da Tabela
        if (printBtn) {
            printBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Imprimir tabela em tela cheia usando print nativo com regras de css @media print
                window.print();
            });
        }
    }

    async function fetchLMETabela(mes) {
        const tableBox = document.getElementById('boxtabela');
        const selectMonth = document.getElementById('meslme');
        const tableTitle = document.getElementById('table-title');

        if (!tableBox) return;

        // Mostrar indicador de carregamento
        tableBox.innerHTML = `
            <div class="lme-table-loading">
                <i class="fa-solid fa-circle-notch fa-spin"></i> Carregando dados da tabela...
            </div>
        `;

        try {
            const response = await fetch(`/api/lme/tabela/${mes}`);
            if (!response.ok) throw new Error('Falha na requisição dos dados da LME.');
            const data = await response.json();

            // Preencher o dropdown de meses na primeira execução
            if (selectMonth && selectMonth.children.length === 0) {
                data.mesesDisponiveis.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.valor;
                    opt.textContent = item.texto;
                    if (item.valor === mes) {
                        opt.selected = true;
                    }
                    selectMonth.appendChild(opt);
                });
                lmeMesAtual = selectMonth.value;
            }

            // Atualizar o título
            const selectText = selectMonth.options[selectMonth.selectedIndex]?.text || '';
            if (tableTitle) {
                tableTitle.textContent = `Tabela de informações diárias de ${selectText.toLowerCase()}`;
            }

            // Renderizar a tabela HTML
            renderLMETable(data.cotacoes);

            // Atualizar os gráficos e variações
            atualizaGraficosLME();

        } catch (err) {
            console.error('Erro ao carregar tabela LME:', err);
            tableBox.innerHTML = `
                <div class="lme-table-loading" style="color: #ff4d4d;">
                    <i class="fa-solid fa-circle-xmark"></i> Não foi possível carregar os dados das cotações.
                </div>
            `;
        }
    }

    function renderLMETable(cotacoes) {
        const tableBox = document.getElementById('boxtabela');
        if (!tableBox || !cotacoes || cotacoes.length === 0) return;

        // Formata os metais adicionando o prefixo "$" aos valores numéricos
        function formatMetalValue(val) {
            if (!val) return '';
            let clean = val.replace(/(US\$|R\$|\$)\s*/gi, '').trim();
            if (/\d/.test(clean)) {
                return `$ ${clean}`;
            }
            return val;
        }

        // Formata o dólar adicionando o prefixo "R$" aos valores numéricos
        function formatDolarValue(val) {
            if (!val) return '';
            let clean = val.replace(/(US\$|R\$|\$)\s*/gi, '').trim();
            if (/\d/.test(clean)) {
                return `R$ ${clean}`;
            }
            return val;
        }

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Dia</th>
                        <th>Cobre <small>U$/t</small></th>
                        <th>Zinco <small>U$/t</small></th>
                        <th>Alumínio <small>U$/t</small></th>
                        <th>Chumbo <small>U$/t</small></th>
                        <th>Estanho <small>U$/t</small></th>
                        <th>Níquel <small>U$/t</small></th>
                        <th>Dólar <small>US$</small></th>
                    </tr>
                </thead>
                <tbody>
        `;

        cotacoes.forEach(row => {
            let rowClass = '';
            if (row.tipo === 'semanal') rowClass = 'row-semanal';
            if (row.tipo === 'mensal') rowClass = 'row-mensal';

            let cellClass = row.tipo === 'mensal' ? 'lmemensal' : (row.tipo === 'semanal' ? 'lmemedia' : 'lmenormal');

            const isDolarFeriado = row.dolar.toLowerCase().includes('feriado');
            const dolarCellClass = isDolarFeriado ? 'lmeferiado' : '';

            tableHtml += `
                <tr class="${rowClass}">
                    <td class="${cellClass}">${row.dia}</td>
                    <td class="${cellClass}">${formatMetalValue(row.cobre)}</td>
                    <td class="${cellClass}">${formatMetalValue(row.zinco)}</td>
                    <td class="${cellClass}">${formatMetalValue(row.aluminio)}</td>
                    <td class="${cellClass}">${formatMetalValue(row.chumbo)}</td>
                    <td class="${cellClass}">${formatMetalValue(row.estanho)}</td>
                    <td class="${cellClass}">${formatMetalValue(row.niquel)}</td>
                    <td class="${dolarCellClass}">${formatDolarValue(row.dolar)}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        tableBox.innerHTML = tableHtml;
    }


    function atualizaGraficosLME() {
        if (!lmeMesAtual) return;
        renderLMEGrafico('diario');
        renderLMEGrafico('semanal');
        renderLMEGrafico('mensal');
        fetchLMEVariacao();
    }

    async function renderLMEGrafico(tipoGraf) {
        const canvasId = `chart-${tipoGraf}`;
        const titleId = `titchart-${tipoGraf}`;
        const canvas = document.getElementById(canvasId);
        const titleEl = document.getElementById(titleId);

        if (!canvas) return;

        try {
            const response = await fetch('/api/lme/graflme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tipograf: tipoGraf,
                    meslme: lmeMesAtual,
                    indice: lmeIndice
                })
            });

            if (!response.ok) throw new Error('Falha ao obter dados do gráfico.');
            const data = await response.json();

            // Destruir instância anterior do gráfico se existir
            if (lmeCharts[tipoGraf]) {
                lmeCharts[tipoGraf].destroy();
            }

            // Aplicar identidade visual da ApexTech Metais (verde brilhante em vez de vermelho do original)
            if (data.datasets && data.datasets[0]) {
                data.datasets[0].borderColor = '#2AD07A';
                data.datasets[0].backgroundColor = 'rgba(42, 208, 122, 0.04)';
                data.datasets[0].pointBackgroundColor = '#2AD07A';
                data.datasets[0].pointBorderColor = '#0E291B';
                data.datasets[0].pointHoverBackgroundColor = '#FFFFFF';
                data.datasets[0].pointHoverBorderColor = '#2AD07A';
                data.datasets[0].borderWidth = 3;
                data.datasets[0].pointRadius = 4;
            }

            // Customizar o título
            if (titleEl) {
                titleEl.textContent = `Evolução ${data.datasets[0].label}`;
            }

            // Instanciar Chart.js v2
            lmeCharts[tipoGraf] = new Chart(canvas, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        display: false
                    },
                    tooltips: {
                        backgroundColor: '#0E291B',
                        titleFontFamily: 'Raleway',
                        bodyFontFamily: 'Lato',
                        titleFontColor: '#2AD07A',
                        bodyFontColor: '#FFFFFF',
                        borderColor: 'rgba(42, 208, 122, 0.25)',
                        borderWidth: 1,
                        displayColors: false
                    },
                    scales: {
                        yAxes: [{
                            gridLines: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                zeroLineColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                fontColor: 'rgba(255, 255, 255, 0.6)',
                                fontSize: 11
                            }
                        }],
                        xAxes: [{
                            gridLines: {
                                display: false
                            },
                            ticks: {
                                fontColor: 'rgba(255, 255, 255, 0.6)',
                                fontSize: 10
                            }
                        }]
                    }
                }
            });

        } catch (err) {
            console.error(`Erro ao carregar gráfico ${tipoGraf}:`, err);
        }
    }

    async function fetchLMEVariacao() {
        const container = document.getElementById('variacao');
        if (!container) return;

        try {
            const response = await fetch('/api/lme/varialme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    meslme: lmeMesAtual,
                    indice: lmeIndice
                })
            });

            if (!response.ok) throw new Error('Falha ao carregar variações.');
            const data = await response.json();

            // Renderizar cards de variação usando JSON limpo
            renderLMEVariacoes(data.parsed);

        } catch (err) {
            console.error('Erro ao buscar variações:', err);
            container.innerHTML = `
                <div class="lme-variation-loading" style="color: #ff4d4d;">
                    <i class="fa-solid fa-circle-xmark"></i> Erro ao carregar variações.
                </div>
            `;
        }
    }

    function renderLMEVariacoes(variaveis) {
        const container = document.getElementById('variacao');
        if (!container) return;

        if (!variaveis || variaveis.length === 0) {
            container.innerHTML = `
                <div class="lme-variation-loading">
                    Sem dados de variação disponíveis para o período.
                </div>
            `;
            return;
        }

        let html = '';
        variaveis.forEach(item => {
            const valClass = item.isPositive ? 'text-success' : 'text-danger';
            const icon = item.isPositive ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down';
            
            html += `
                <div class="lme-variation-card">
                    <div class="lme-var-header">
                        <h4>${item.titulo}</h4>
                        <i class="fa-solid fa-chart-line"></i>
                    </div>
                    
                    <div class="lme-var-body">
                        <div class="lme-var-col current">
                            <small>${item.dataAtual}</small>
                            <b>${item.valAtual}</b>
                        </div>
                        <div class="lme-var-col previous">
                            <small>${item.dataAnt}</small>
                            <b>${item.valAnt}</b>
                        </div>
                    </div>
                    
                    <div class="lme-var-footer">
                        <span>Variação</span>
                        <h3 class="${valClass}">
                            <i class="${icon}"></i>
                            ${item.footerText}
                        </h3>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // --------------------------------------------------------
    // APLICAR CONFIGURAÇÕES DA HOME (MOSTRAR/OCULTAR SEÇÕES)
    // --------------------------------------------------------
    async function applyHomepageSettings() {
        try {
            const response = await fetch('/api/settings');
            if (!response.ok) throw new Error('Falha ao obter configurações da home.');
            const settings = await response.json();

            // Mapeamento: chave da config -> ID da seção no HTML
            const sectionMap = {
                'show_sobre': ['sobre'],
                'show_solucoes': ['solucoes', 'areas-de-atuacoes'],
                'show_catalogo': ['catalogo'],
                'show_onde_encontramos': ['onde-encontramos'],
                'show_cotacoes': ['cotacoes'],
                'show_noticias': ['noticias'],
                'show_galeria': ['galeria']
            };

            // Ligar/Desligar visibilidade de cada seção e seu item de menu correspondente
            for (const [key, sectionIds] of Object.entries(sectionMap)) {
                const show = settings[key] !== 'false';

                // Seções
                sectionIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.display = show ? '' : 'none';
                    }
                });

                // Links de menu (desktop e mobile)
                sectionIds.forEach(id => {
                    const links = document.querySelectorAll(`a[href="#${id}"]`);
                    links.forEach(link => {
                        const li = link.closest('li');
                        if (li) {
                            li.style.display = show ? '' : 'none';
                        }
                    });
                });
            }

            // Carregar a galeria se estiver ativa
            if (settings['show_galeria'] !== 'false') {
                renderHomepageGallery();
            }

        } catch (err) {
            console.error('Erro ao aplicar configurações da home:', err);
            renderHomepageGallery();
        }
    }

    // --------------------------------------------------------
    // RENDERIZAR GALERIA DE FOTOS DINÂMICA
    // --------------------------------------------------------
    async function renderHomepageGallery() {
        const grid = document.getElementById('galeria-grid');
        if (!grid) return;

        try {
            const response = await fetch('/api/galeria');
            if (!response.ok) throw new Error('Falha ao obter imagens da galeria.');
            const items = await response.json();

            grid.innerHTML = '';

            if (items.length === 0) {
                grid.innerHTML = `
                    <div class="galeria-loading text-center" style="color: #888;">
                        <i class="fa-solid fa-images"></i> Nenhuma foto na galeria no momento.
                    </div>
                `;
                return;
            }

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'galeria-item fade-up';
                div.innerHTML = `
                    <img src="${item.url}" alt="${item.titulo}" loading="lazy">
                    <div class="galeria-overlay">
                        <h4 class="galeria-title">${item.titulo}</h4>
                        <div class="galeria-expand-icon"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
                    </div>
                `;

                div.addEventListener('click', () => {
                    if (typeof openCatalogModal === 'function') {
                        openCatalogModal(item.url, item.titulo, 'ApexTech Metais - Galeria de Fotos');
                    }
                });

                grid.appendChild(div);
            });

            // Disparar animações para os novos elementos
            const newFadeElements = grid.querySelectorAll('.fade-up');
            if (typeof fadeObserver !== 'undefined') {
                newFadeElements.forEach(el => fadeObserver.observe(el));
            } else {
                newFadeElements.forEach(el => el.classList.add('visible'));
            }

        } catch (err) {
            console.error('Erro ao carregar galeria:', err);
            grid.innerHTML = `
                <div class="galeria-loading text-center" style="color: #ff4d4d;">
                    <i class="fa-solid fa-circle-xmark"></i> Erro ao carregar as fotos da galeria.
                </div>
            `;
        }
    }

    // Inicializar o dashboard cotações LME
    initLMEDashboard();

    // Aplicar configurações da home e carregar galeria
    applyHomepageSettings();

    console.log('🌿 ApexTech Metais - Carregado com sucesso!');
});
