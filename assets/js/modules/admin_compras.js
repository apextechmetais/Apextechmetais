
let itensPedidoCompra = [];
// PEDIDOS DE COMPRA
// =============================================================================
(function() {
    let localPedidos = [];
    let itensPedidoCompra  = [];

    const fmtR = (v) => 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    const fmtD = (d) => { if (!d) return '-'; try { return new Date(d).toLocaleDateString('pt-BR', {timeZone:'UTC'}); } catch(e){ return d; } };
    const statusColor = {
        'Rascunho': '#7fa8c8',
        'Aguardando Aprovação': '#ffeb3b',
        'Aprovado': '#2AD07A',
        'Confirmado': '#2AD07A',
        'Em Separação': '#4fc3f7',
        'Faturado': '#2AD07A',
        'Entregue': '#2AD07A',
        'Cancelado': '#ff6b6b'
    };

    window.initApexPedidosCompra = function() {
        carregarPedidosCompra();
    };

    async function carregarPedidosCompra() {
        if (localPedidos && localPedidos.length > 0) renderPedidosCompra(localPedidos);
        try {
            const res  = await fetch('/api/pedidos-compra');
            if (res.ok) {
                const data = await res.json();
                localPedidos = Array.isArray(data) ? data : [];
            } else {
                localPedidos = [];
            }
        } catch(e) {
            console.error('Erro ao carregar pedidos:', e);
            localPedidos = [];
        }
        renderPedidosCompra(localPedidos);
    }

    function renderPedidosCompra(lista) {
        const tbody = document.getElementById('pedidos-compra-tbody');
        if (!tbody) return;
        if (!lista || lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#5a738e;"><i class="fa-solid fa-file-invoice-dollar" style="font-size:2rem; margin-bottom:10px; display:block; color:#2AD07A;"></i>Nenhum pedido de compra cadastrado ainda.<br><small>Clique em <strong>+ Novo Pedido</strong> para emitir um novo pedido de compra.</small></td></tr>';
            return;
        }
        tbody.innerHTML = lista.map(p => {
            const stColor = statusColor[p.status] || '#7fa8c8';
            const cliCadastrado = p.fornecedor_id ? true : false;
            const badgeCliente = cliCadastrado
                ? `<span style="background:#1b382b; color:#2AD07A; border:1px solid #2AD07A; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:6px;"><i class="fa-solid fa-user-check"></i> CADASTRADO</span>`
                : `<span style="background:#38321b; color:#ffeb3b; border:1px solid #ffeb3b; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:6px;"><i class="fa-solid fa-user-clock"></i> NOVO / PENDENTE</span>`;

            return `
            <tr style="border-bottom:1px solid #1a2a3a; transition:background 0.15s;" onmouseover="this.style.background='#0f2030'" onmouseout="this.style.background=''">
                <td style="padding:12px 10px; font-weight:bold; color:#2AD07A;">
                    ${p.numero || '-'}<br>
                    <small style="color:#5a738e; font-weight:normal;">Emissão: ${fmtD(p.data_emissao)}</small>
                </td>
                <td style="padding:12px 10px; color:#fff;">
                    <div style="font-weight:bold; font-size:0.92rem;">${p.fornecedor_nome || p.fornecedor_nome_avulso || 'Cliente Avulso'} ${badgeCliente}</div>
                    <div style="color:#7fa8c8; font-size:0.8rem; margin-top:2px;">
                        ${p.fornecedor_cnpj ? 'CNPJ: ' + p.fornecedor_cnpj : 'Sem CNPJ'} ${p.fornecedor_cidade ? ' | ' + p.fornecedor_cidade + '-' + (p.fornecedor_uf||'') : ''}
                    </div>
                </td>
                <td style="padding:12px 10px; color:#ccc;">
                    <div style="font-weight:600; color:#fff;">${p.criado_por || 'Admin'}</div>
                    <small style="color:#7fa8c8;">${p.criado_por_perfil || 'Administrador'}</small>
                </td>
                <td style="padding:12px 10px; color:#aaa;">
                    <div><i class="fa-solid fa-calendar-day" style="color:#2AD07A;"></i> Delivery: <strong>${fmtD(p.data_entrega)}</strong></div>
                    <small style="color:#7fa8c8;">${p.tipo_frete || 'CIF - Entrega APEXTECH'}</small>
                    ${p.responsavel_recebimento ? `<br><small style="color:#e07b39;">Rec: ${p.responsavel_recebimento}</small>` : ''}
                </td>
                <td style="padding:12px 10px;">
                    <span style="background:${stColor}22; color:${stColor}; border:1px solid ${stColor}66; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:700; display:inline-block;">
                        ${p.status || 'Rascunho'}
                    </span>
                </td>
                <td style="padding:12px 10px; text-align:right; color:#2AD07A; font-weight:bold; font-size:0.98rem;">${fmtR(p.total_geral)}</td>
                <td style="padding:12px 10px; text-align:center;">
                    <button onclick="exportarPedidoPdfCompraPorId(${p.id})" style="background:none; border:none; color:#2AD07A; cursor:pointer; margin-right:6px; font-size:1.05rem;" title="Baixar PDF do Pedido"><i class="fa-solid fa-file-pdf"></i></button>
                    <button onclick="editarPedidoCompra(${p.id})" style="background:none; border:none; color:#3e7cb1; cursor:pointer; margin-right:6px; font-size:1.05rem;" title="Editar Pedido"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirPedidoCompra(${p.id}, '${p.numero}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1.05rem;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
        }).join('');
    }

    window.filtrarPedidos = function() {
        const txt    = (document.getElementById('pedidos-search')?.value || '').toLowerCase();
        const status = document.getElementById('pedidos-status-filter')?.value || '';
        const filtrado = localPedidos.filter(p => {
            const matchTxt = !txt || (p.numero||'').toLowerCase().includes(txt) || (p.fornecedor_nome||'').toLowerCase().includes(txt) || (p.criado_por||'').toLowerCase().includes(txt);
            const matchSt  = !status || p.status === status;
            return matchTxt && matchSt;
        });
        renderPedidosCompra(filtrado);
    };

    window.abrirNovoPedidoCompra = async function() { window._aprovar_pedido_compra_flag = false;
        itensPedidoCompra = [];

        // 1. Abrir o modal IMEDIATAMENTE ao clicar no botão
        const modal = document.getElementById('modal-pedido-compra');
        if (modal) modal.style.display = 'flex';

        try { document.getElementById('form-pedido-compra')?.reset(); } catch(e){}
        if (document.getElementById('pedidoc-condicao-custom')) {
            document.getElementById('pedidoc-condicao-custom').style.display = 'none';
            document.getElementById('pedidoc-condicao-custom').value = '';
        }
        document.getElementById('pedidoc-id').value = '';
        document.getElementById('modal-pedido-titulo-compra').textContent = 'Novo Pedido de Compra';
        document.getElementById('pedidoc-data-emissao').value = new Date().toISOString().split('T')[0];
        
        // Auto-preencher usuário logado e perfil
        const loggedUser = sessionStorage.getItem('apex_logged_user_name') || 'Administrador Apex';
        const loggedRole = sessionStorage.getItem('apex_logged_user_role') || 'Administrador';
        if (document.getElementById('pedidoc-vendedor')) document.getElementById('pedidoc-vendedor').value = loggedUser;
        if (document.getElementById('pedidoc-perfil')) document.getElementById('pedidoc-perfil').value = loggedRole;

        limparFornecedorPedido();
        renderItensPedidoCompra();
        recalcularPedidoCompra();

        // Número provisório imediato
        document.getElementById('pedidoc-numero').value = 'PC-' + String(Math.floor(Date.now()/1000)%10000).padStart(4,'0');
        if(document.getElementById('pedidoc-rastreamento-box')) document.getElementById('pedidoc-rastreamento-box').style.display = 'none';
        if(document.getElementById('btnc-aprovar-pedido')) document.getElementById('btnc-aprovar-pedido').style.display = 'none';
        if(document.getElementById('pedidoc-status-header')) document.getElementById('pedidoc-status-header').value = 'Rascunho';
        if(document.getElementById('pedidoc-data-entrega')) document.getElementById('pedidoc-data-entrega').value = '';

        // 2. Buscar dados em segundo plano com validação de status HTTP
        try {
            const res = await fetch('/api/fornecedores');
            if (res.ok) window.localFornecedores = await res.json();
        } catch(e){}

        try {
            const r = await fetch('/api/pedidos-compra/proximo-numero');
            if (r.ok) {
                const d = await r.json();
                if (d && d.numero) document.getElementById('pedidoc-numero').value = d.numero;
            }
        } catch(e){}
    };

    window.fecharModalPedidoCompra = function() {
        document.getElementById('modal-pedido-compra').style.display = 'none';
    };

    const normalizeTxt = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    window.buscarFornecedorPedido = async function(val) {
        const drop = document.getElementById('pedidoc-fornecedor-dropdown');
        if (!drop) return;

        if (!window.localFornecedores || window.localFornecedores.length === 0) {
            try {
                const res = await fetch('/api/fornecedores');
                window.localFornecedores = await res.json();
            } catch(e){}
        }

        const rawVal = (val || '').trim();
        const q = normalizeTxt(rawVal);
        const searchTerms = q.split(/\s+/).filter(Boolean);

        let resultados = [];
        if (searchTerms.length === 0) {
            resultados = (window.localFornecedores || []).slice(0, 15);
        } else {
            resultados = (window.localFornecedores || []).filter(c => {
                const targetText = normalizeTxt(`${c.nome||''} ${c.fantasia||''} ${c.razao_social||''} ${c.cnpj||''} ${c.cpf||''} ${c.email||''}`);
                const cleanCnpj = (c.cnpj||'').replace(/\D/g,'');
                const cleanCpf = (c.cpf||'').replace(/\D/g,'');
                const cleanQ = q.replace(/\D/g,'');

                const matchesCNPJ = cleanQ.length >= 3 && (cleanCnpj.includes(cleanQ) || cleanCpf.includes(cleanQ));
                const matchesWords = searchTerms.every(term => targetText.includes(term));

                return matchesCNPJ || matchesWords;
            });
        }

        let html = '';

        if (rawVal.length > 0) {
            html += `
                <div onclick="abrirCadastroFornecedorExpress('${rawVal.replace(/'/g,"\\'")}')" style="padding:10px 14px; background:#1b382b; color:#2AD07A; cursor:pointer; font-weight:bold; border-bottom:1px solid #1e4e8c; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#224535'" onmouseout="this.style.background='#1b382b'">
                    <i class="fa-solid fa-user-plus"></i> + Cadastrar Novo Cliente "${rawVal}"
                </div>
            `;
        } else {
            html += `
                <div onclick="abrirCadastroFornecedorExpress('')" style="padding:10px 14px; background:#162738; color:#7fa8c8; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #1e4e8c; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='#1e354d'" onmouseout="this.style.background='#162738'">
                    <i class="fa-solid fa-plus-circle"></i> + Cadastrar Novo Cliente do Zero
                </div>
            `;
        }

        if (resultados.length > 0) {
            html += resultados.map(c => `
                <div onclick="selecionarFornecedorPedido(${c.id})" style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #1a2a3a; transition:background 0.15s;" onmouseover="this.style.background='#1a2a3a'" onmouseout="this.style.background=''">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#fff;">${c.nome||c.fantasia||''}</strong>
                        <span style="background:#1b382b; color:#2AD07A; font-size:0.7rem; padding:1px 6px; border-radius:3px; font-weight:bold;">CADASTRADO</span>
                    </div>
                    <div style="color:#7fa8c8; font-size:0.8rem; margin-top:2px;">${c.cnpj||c.cpf||'Sem CNPJ'} | ${c.cidade||''}${c.uf?'/'+c.uf:''} | ${c.telefone1||''}</div>
                </div>
            `).join('');
        } else if (rawVal.length > 0) {
            html += `
                <div style="padding:14px; text-align:center; color:#aaa; font-size:0.88rem;">
                    Nenhum cliente encontrado com "<strong>${rawVal}</strong>".
                    <div style="margin-top:8px;">
                        <button type="button" onclick="abrirCadastroFornecedorExpress('${rawVal.replace(/'/g,"\\'")}')" class="btn-primary" style="font-size:0.82rem; background:#2AD07A; color:#000; border:none; padding:6px 14px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-user-plus"></i> Cadastrar "${rawVal}" Agora
                        </button>
                    </div>
                </div>
            `;
        }

        drop.innerHTML = html;
        drop.style.display = 'block';
    };

    window.redirecionarParaCadastroFornecedor = function(nomePrefill) {
        const drop = document.getElementById('pedidoc-fornecedor-dropdown');
        if (drop) drop.style.display = 'none';

        fecharModalPedidoCompra();

        const navClientes = document.getElementById('nav-clientes') || document.querySelector('.nav-item[data-target="clientes-view"]');
        if (navClientes) {
            navClientes.click();
        } else {
            document.querySelectorAll('.view-section').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            const cliSec = document.getElementById('clientes-view');
            if (cliSec) { cliSec.classList.add('active'); cliSec.style.display = 'block'; }
        }

        if (window.initApexClientes) window.initApexClientes();

        setTimeout(() => {
            if (window.abrirModalCliente) window.abrirModalCliente();
            if (nomePrefill) {
                const elNome = document.getElementById('cli-nome');
                const elFant = document.getElementById('cli-fantasia');
                if (elNome) elNome.value = nomePrefill;
                if (elFant) elFant.value = nomePrefill;
            }
        }, 150);
    };

    window.abrirCadastroFornecedorExpress = function(nomePrefill) {
        redirecionarParaCadastroFornecedor(nomePrefill);
    };

    window.selecionarFornecedorPedido = function(id) {
        if (!window.localFornecedores || window.localFornecedores.length === 0) {
            fetch('/api/fornecedores').then(r=>r.json()).then(clis=>{
                window.localFornecedores = clis;
                window.selecionarFornecedorPedido(id);
            });
            return;
        }
        const c = (window.localFornecedores||[]).find(x => x.id == id);
        if (!c) return;
        document.getElementById('pedidoc-fornecedor-id').value = c.id;
        document.getElementById('pedidoc-fornecedor-busca').value = c.nome || c.fantasia || '';
        document.getElementById('pedidoc-fornecedor-dropdown').style.display = 'none';
        document.getElementById('fc-nome').textContent     = c.nome || c.fantasia || '';
        document.getElementById('fc-cnpj').textContent     = c.cnpj || c.cpf || 'CNPJ Não informado';
        document.getElementById('fc-cidade').textContent   = c.cidade || '';
        document.getElementById('fc-uf').textContent       = c.uf || '';
        document.getElementById('fc-tel').textContent      = c.telefone1 || c.telefone2 || '-';
        document.getElementById('fc-email').textContent    = c.email || '-';
        if (document.getElementById('fc-endereco')) document.getElementById('fc-endereco').textContent = c.endereco || 'Endereço principal de cadastro';
        
        const badge = document.getElementById('fc-status-badge');
        if (badge) {
            badge.style.background = '#1b382b';
            badge.style.color = '#2AD07A';
            badge.style.borderColor = '#2AD07A';
            badge.innerHTML = '<i class="fa-solid fa-user-check"></i> CLIENTE CADASTRADO NO SISTEMA';
        }

        // Se o endereço de entrega estiver vazio, preenche com o endereço do cliente
        const elEndEntrega = document.getElementById('pedidoc-endereco-entrega');
        if (elEndEntrega && !elEndEntrega.value) {
            elEndEntrega.value = (c.endereco || '') + (c.cidade ? ' - ' + c.cidade + '/' + (c.uf||'') : '');
        }

        document.getElementById('pedidoc-fornecedor-card').style.display = 'block';
        if (c.condicao_pagamento) {
            definirCondicaoPagamento(c.condicao_pagamento);
        }
    };

    window.verificarCondicaoPersonalizada = function(val) {
        const inputCustom = document.getElementById('pedidoc-condicao-custom');
        if (!inputCustom) return;
        if (val === 'CUSTOM') {
            inputCustom.style.display = 'block';
            inputCustom.focus();
        } else {
            inputCustom.style.display = 'none';
        }
    };

    function obterCondicaoPagamento() {
        const sel = document.getElementById('pedidoc-condicao');
        if (!sel) return '';
        if (sel.value === 'CUSTOM') {
            const customVal = (document.getElementById('pedidoc-condicao-custom')?.value || '').trim();
            if (!customVal) return 'A Combinar';
            return customVal.toLowerCase().includes('dia') ? customVal : customVal + ' dias';
        }
        return sel.value;
    }

    function definirCondicaoPagamento(val) {
        const sel = document.getElementById('pedidoc-condicao');
        const inputCustom = document.getElementById('pedidoc-condicao-custom');
        if (!sel) return;
        if (!val) {
            sel.selectedIndex = 0;
            if (inputCustom) inputCustom.style.display = 'none';
            return;
        }
        let achou = false;
        for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === val) {
                sel.selectedIndex = i;
                achou = true;
                break;
            }
        }
        if (!achou) {
            sel.value = 'CUSTOM';
            if (inputCustom) {
                inputCustom.style.display = 'block';
                inputCustom.value = val;
            }
        } else {
            if (inputCustom) inputCustom.style.display = 'none';
        }
    }

    window.limparFornecedorPedido = function() {
        document.getElementById('pedidoc-fornecedor-id').value = '';
        document.getElementById('pedidoc-fornecedor-busca').value = '';
        document.getElementById('pedidoc-fornecedor-dropdown').style.display = 'none';
        document.getElementById('pedidoc-fornecedor-card').style.display = 'none';
    };

    window.adicionarItemPedidoCompra = function() {
        itensPedidoCompra.push({ descricao:'', unidade:'kg', quantidade:0, preco_unitario:0, desconto_item:0, total_item:0 });
        renderItensPedidoCompra();
    };

    window.removerItemPedidoCompra = function(idx) {
        itensPedidoCompra.splice(idx,1);
        renderItensPedidoCompra();
        recalcularPedidoCompra();
    };

    window.atualizarItemPedidoCompra = function(idx, campo, val) {
        itensPedidoCompra[idx][campo] = campo==='descricao'||campo==='unidade' ? val : parseFloat(val)||0;
        const it = itensPedidoCompra[idx];
        it.total_item = it.quantidade * it.preco_unitario * (1 - (it.desconto_item||0)/100);
        renderItensPedidoCompra();
        recalcularPedidoCompra();
    };

    function renderItensPedidoCompra() {
        const tbody = document.getElementById('itens-pedidoc-tbody');
        const meud = document.getElementById('itens-pedidoc-thead');
        const vazio  = document.getElementById('itens-pedidoc-vazio');
        if (meud) meud.style.display = 'table-header-group';
        if (!tbody) return;
        if (itensPedidoCompra.length === 0) {
            tbody.innerHTML = '';
            if (vazio) vazio.style.display = 'block';
            return;
        }
        if (vazio) vazio.style.display = 'none';
        tbody.innerHTML = itensPedidoCompra.map((it,i) => `
            <tr style="border-bottom:1px solid #1a2a3a;">
                <td style="padding:6px 4px;">
                    <input value="${it.descricao||''}" onchange="atualizarItemPedidoCompra(${i},'descricao',this.value)" class="noble-input" style="width:100%; padding:5px 8px; font-size:0.82rem;" placeholder="Ex: Sucata de Cobre / Alumínio" />
                </td>
                <td style="padding:6px 4px; text-align:center;">
                    <select onchange="atualizarItemPedidoCompra(${i},'unidade',this.value)" class="noble-input" style="padding:5px 4px; font-size:0.82rem; width:65px;">
                        ${['kg','t','un','m','m²','L'].map(u=>`<option value="${u}" ${it.unidade===u?'selected':''}>${u}</option>`).join('')}
                    </select>
                </td>
                <td style="padding:6px 4px;">
                    <input type="number" min="0" step="0.001" value="${it.quantidade||''}" placeholder="Ex: 50.5" onchange="atualizarItemPedidoCompra(${i},'quantidade',this.value)" class="noble-input" style="width:100px; text-align:right; padding:5px 8px; font-size:0.82rem; font-weight:600; border-color:#1e4e8c;" />
                </td>
                <td style="padding:6px 4px;">
                    <input type="number" min="0" step="0.0001" value="${it.preco_unitario||''}" placeholder="R$ 0,00" onchange="atualizarItemPedidoCompra(${i},'preco_unitario',this.value)" class="noble-input" style="width:110px; text-align:right; padding:5px 8px; font-size:0.82rem;" />
                </td>
                <td style="padding:6px 4px;">
                    <input type="number" min="0" max="100" step="0.01" value="${it.desconto_item||0}" onchange="atualizarItemPedidoCompra(${i},'desconto_item',this.value)" class="noble-input" style="width:75px; text-align:right; padding:5px 8px; font-size:0.82rem;" />
                </td>
                <td style="padding:6px 4px; text-align:right; color:#2AD07A; font-weight:600;">${fmtR(it.total_item)}</td>
                <td style="padding:6px 4px; text-align:center;">
                    <button type="button" onclick="removerItemPedidoCompra(${i})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1rem;" title="Remover Item"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    window.recalcularPedidoCompra = function() {
        const subtotal  = itensPedidoCompra.reduce((s,it) => s+(it.total_item||0), 0);
        const desc      = parseFloat(document.getElementById('pedidoc-desconto')?.value)||0;
        const frete     = parseFloat(document.getElementById('pedidoc-frete')?.value)||0;
        const total     = subtotal*(1-desc/100)+frete;
        if (document.getElementById('pedidoc-total-itens'))  document.getElementById('pedidoc-total-itens').textContent  = fmtR(subtotal);
        if (document.getElementById('pedidoc-total-geral'))  document.getElementById('pedidoc-total-geral').textContent  = fmtR(total);
    };

    window.salvarPedidoCompra = async function(e) {
        e.preventDefault();
        const clienteId = document.getElementById('pedidoc-fornecedor-id').value;
        const clienteBusca = document.getElementById('pedidoc-fornecedor-busca').value;
        
        if (!clienteId && !clienteBusca) {
            _apexNotify('Sistema', 'Selecione ou informe um fornecedor para o pedido.', 'info');
            return;
        }
        if (itensPedidoCompra.length === 0) {
            _apexNotify('Sistema', 'Adicione ao menos um item ao pedido.', 'info');
            return;
        }

        const numField = document.getElementById('pedidoc-numero');
        if (!numField.value || numField.value.trim() === '') {
            numField.value = 'PC-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
        }

        const payload = {
            numero:                  numField.value.trim(),
            fornecedor_id:              clienteId ? parseInt(clienteId) : null,
            fornecedor_nome:            clienteBusca,
            data_emissao:            document.getElementById('pedidoc-data-emissao').value,
            data_entrega:            document.getElementById('pedidoc-data-entrega').value || null,
            status:                  document.getElementById('pedidoc-status').value,
            condicao_pagamento:      obterCondicaoPagamento(),
            observacoes:             document.getElementById('pedidoc-obs').value,
            desconto_pct:            parseFloat(document.getElementById('pedidoc-desconto').value)||0,
            frete:                   parseFloat(document.getElementById('pedidoc-frete').value)||0,
            criado_por:              document.getElementById('pedidoc-vendedor')?.value || sessionStorage.getItem('apex_logged_user_name') || 'Admin',
            criado_por_perfil:       document.getElementById('pedidoc-perfil')?.value || sessionStorage.getItem('apex_logged_user_role') || 'Administrador',
            endereco_entrega:        document.getElementById('pedidoc-endereco-entrega')?.value || '',
            responsavel_recebimento: document.getElementById('pedidoc-responsavel-recebimento')?.value || '',
            tipo_frete:              document.getElementById('pedidoc-tipo-frete')?.value || 'CIF - Entrega APEXTECH',
            itens:                   itensPedidoCompra
        };

        if (window._aprovar_pedido_compra_flag) {
            payload.status = 'Aprovado';
            payload.aprovado_por = sessionStorage.getItem('apex_logged_user_name') || 'Admin';
        }

        const id  = document.getElementById('pedidoc-id').value;
        const url = id ? `/api/pedidos-compra/${id}` : '/api/pedidos-compra';
        const method = id ? 'PUT' : 'POST';

        const btn = document.getElementById('btn-salvar-pedido-compra') || document.querySelector('#form-pedido-compra button[type="submit"]') || document.getElementById('btnc-salvar-pedido');
        const originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...'; }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Erro ao salvar pedido de compra');
            }
            _apexNotify('Sucesso', 'Pedido de Compra salvo com sucesso!', 'success');
            fecharModalPedidoCompra();
            carregarPedidosCompra();
        } catch(err) {
            clearTimeout(timeoutId);
            const msg = err.name === 'AbortError'
                ? 'Tempo limite esgotado. Verifique sua conexao e tente novamente.'
                : err.message;
            _apexNotify('Atenção', 'Não foi possível salvar o pedido de compra: ' + msg, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = originalBtnHtml || '<i class="fa-solid fa-save"></i> Salvar Pedido'; }
        }
    };

    window.editarPedidoCompra = async function(id) { window._aprovar_pedido_compra_flag = false;
        try {
            const res  = await fetch(`/api/pedidos-compra/${id}`);
            const data = await res.json();
            document.getElementById('pedidoc-id').value             = data.id;
            document.getElementById('modal-pedido-titulo-compra').textContent = `Editar Pedido ${data.numero}`;
            document.getElementById('pedidoc-numero').value          = data.numero;
            document.getElementById('pedidoc-data-emissao').value    = (data.data_emissao||'').slice(0,10);
            document.getElementById('pedidoc-data-entrega').value    = (data.data_entrega||'').slice(0,10);
            if(document.getElementById('pedidoc-status-header')) document.getElementById('pedidoc-status-header').value = data.status || 'Rascunho';
            
            if(document.getElementById('pedidoc-rastreamento-box')) {
                document.getElementById('pedidoc-rastreamento-box').style.display = 'flex';
                document.getElementById('pedidoc-criado-em').textContent = data.criado_em ? new Date(data.criado_em).toLocaleString('pt-BR') : '-';
                document.getElementById('pedidoc-atualizado-em').textContent = data.atualizado_em ? new Date(data.atualizado_em).toLocaleString('pt-BR') : '-';
                document.getElementById('pedidoc-aprovado-por').textContent = data.aprovado_por || 'Pendente';
                document.getElementById('pedidoc-data-aprovacao').textContent = data.data_aprovacao ? '(' + new Date(data.data_aprovacao).toLocaleString('pt-BR') + ')' : '';
            }
            if(document.getElementById('btnc-aprovar-pedido')) {
                const isDiretoria = globalRolePermissions && globalRolePermissions['Pedidos de Compra'] === 'Escrita';
                if (data.status !== 'Aprovado' && isDiretoria) {
                    document.getElementById('btnc-aprovar-pedido').style.display = 'inline-block';
                } else {
                    document.getElementById('btnc-aprovar-pedido').style.display = 'none';
                }
            }
            document.getElementById('pedidoc-desconto').value        = data.desconto_pct||0;
            document.getElementById('pedidoc-frete').value           = data.frete||0;
            document.getElementById('pedidoc-obs').value             = data.observacoes||'';

            if (document.getElementById('pedidoc-vendedor')) document.getElementById('pedidoc-vendedor').value = data.criado_por || 'Admin';
            if (document.getElementById('pedidoc-perfil')) document.getElementById('pedidoc-perfil').value = data.criado_por_perfil || 'Administrador';
            if (document.getElementById('pedidoc-endereco-entrega')) document.getElementById('pedidoc-endereco-entrega').value = data.endereco_entrega || '';
            if (document.getElementById('pedidoc-responsavel-recebimento')) document.getElementById('pedidoc-responsavel-recebimento').value = data.responsavel_recebimento || '';
            
            if (document.getElementById('pedidoc-tipo-frete')) {
                const selF = document.getElementById('pedidoc-tipo-frete');
                for(let i=0;i<selF.options.length;i++) if(selF.options[i].value===data.tipo_frete){selF.selectedIndex=i;break;}
            }

            const selSt = document.getElementById('pedidoc-status');
            for(let i=0;i<selSt.options.length;i++) if(selSt.options[i].value===data.status){selSt.selectedIndex=i;break;}
            const selCond = document.getElementById('pedidoc-condicao');
            for(let i=0;i<selCond.options.length;i++) if(selCond.options[i].value===data.condicao_pagamento){selCond.selectedIndex=i;break;}
            
            if (data.fornecedor_id) {
                window.selecionarFornecedorPedido(data.fornecedor_id);
            } else if (data.fornecedor_nome) {
                document.getElementById('pedidoc-fornecedor-busca').value = data.fornecedor_nome;
            }

            itensPedidoCompra = (data.itens||[]).map(it => ({...it}));
            renderItensPedidoCompra();
            recalcularPedidoCompra();
            document.getElementById('modal-pedido-venda').style.display = 'flex';
        } catch(err) {
            _apexNotify('Atenção', 'Erro ao carregar pedido: '+err.message, 'error');
        }
    };

    window.excluirPedidoCompra = async function(id, numero) {
        if (!confirm(`Excluir o pedido ${numero}? Esta ação não pode ser desfeita.`)) return;
        try {
            await fetch(`/api/pedidos-compra/${id}`, {method:'DELETE'});
            await carregarPedidosCompra();
        } catch(err) {
            _apexNotify('Atenção', 'Erro ao excluir: '+err.message, 'error');
        }
    };

    window.imprimirPedidoCompra = function() {
        exportarPedidoPdfDoFormCompra();
    };

    window.exportarPedidoPdfCompraPorId = async function(id) {
        let p = null;
        try {
            const r = await fetch(`/api/pedidos-compra/${id}`);
            p = await r.json();
        } catch(e) {
            console.error('Erro ao buscar itens do pedido:', e);
        }
        if (!p || p.error) { _apexNotify('Sistema', 'Pedido não encontrado.', 'info'); return; }
        await gerarPdfPedidoCompra(p);
    };

    window.exportarPedidoPdfDoFormCompra = async function() {
        const num    = document.getElementById('pedidoc-numero').value || 'PC-0000';
        const cliId  = document.getElementById('pedidoc-fornecedor-id').value;
        const c      = (window.localFornecedores||[]).find(x => x.id == cliId) || {};
        const p = {
            numero: num,
            fornecedor_id: cliId ? parseInt(cliId) : null,
            fornecedor_nome: document.getElementById('fc-nome').textContent || document.getElementById('pedidoc-fornecedor-busca').value || '-',
            fornecedor_cnpj: document.getElementById('fc-cnpj').textContent || c.cnpj || c.cpf || '-',
            fornecedor_cidade: document.getElementById('fc-cidade').textContent || c.cidade || '-',
            fornecedor_uf: document.getElementById('fc-uf').textContent || c.uf || '-',
            fornecedor_telefone: document.getElementById('fc-tel').textContent || c.telefone1 || '-',
            fornecedor_email: document.getElementById('fc-email').textContent || c.email || '-',
            fornecedor_endereco: c.endereco || '-',
            data_emissao: document.getElementById('pedidoc-data-emissao').value,
            data_entrega: document.getElementById('pedidoc-data-entrega').value,
            condicao_pagamento: document.getElementById('pedidoc-condicao').value,
            status: document.getElementById('pedidoc-status').value,
            observacoes: document.getElementById('pedidoc-obs').value,
            desconto_pct: parseFloat(document.getElementById('pedidoc-desconto').value)||0,
            frete: parseFloat(document.getElementById('pedidoc-frete').value)||0,
            criado_por: document.getElementById('pedidoc-vendedor')?.value || sessionStorage.getItem('apex_logged_user_name') || 'Admin',
            criado_por_perfil: document.getElementById('pedidoc-perfil')?.value || sessionStorage.getItem('apex_logged_user_role') || 'Administrador',
            endereco_entrega: document.getElementById('pedidoc-endereco-entrega')?.value || '',
            responsavel_recebimento: document.getElementById('pedidoc-responsavel-recebimento')?.value || '',
            tipo_frete: document.getElementById('pedidoc-tipo-frete')?.value || 'CIF - Entrega APEXTECH',
            itens: itensPedidoCompra
        };
        await gerarPdfPedidoCompra(p);
    };

    async function gerarPdfPedidoCompra(p) {
        if (!window.jspdf) { _apexNotify('Sistema', 'Biblioteca jsPDF não carregada.', 'info'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Marca d'água do logo em toda a folha
        if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
            await window.aplicarMarcaDaguaLogoJsPDF(doc);
        } else if (typeof aplicarMarcaDaguaLogoJsPDF === 'function') {
            await aplicarMarcaDaguaLogoJsPDF(doc);
        }

        if (doc.GState && doc.setGState) {
            try { doc.setGState(new doc.GState({ opacity: 1.0 })); } catch(e){}
        }

        // Cabeçalho da Empresa
        doc.setFillColor(13, 26, 38);
        doc.rect(0, 0, 210, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('APEXTECH METAIS', 14, 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('PEDIDO DE COMPRA / ORDEM DE COMPRA', 14, 21);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(p.numero || 'PC-0000', 196, 14, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Emissão: ${fmtD(p.data_emissao)}`, 196, 21, { align: 'right' });

        // Box 1: Dados do Cliente & Cadastro
        doc.setFillColor(240, 244, 248);
        doc.setDrawColor(200, 212, 224);
        doc.roundedRect(14, 33, 182, 38, 2, 2, 'FD');

        const cliStatusText = p.fornecedor_id ? 'FORNECEDOR CADASTRADO NO SISTEMA' : 'NOVO FORNECEDOR / PENDENTE';
        doc.setTextColor(13, 36, 22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('DADOS DO FORNECEDOR (ORIGEM)', 18, 40);
        
        doc.setFontSize(8);
        doc.setTextColor(p.fornecedor_id ? 42 : 180, p.fornecedor_id ? 150 : 120, p.fornecedor_id ? 80 : 20);
        // Removed status text

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Razão Social / Nome: ', 18, 46);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.fornecedor_nome || p.fornecedor_nome_avulso || p.fornecedor_id || 'Não informado'), 55, 46);

        doc.setFont('helvetica', 'bold');
        doc.text('CNPJ/CPF: ', 18, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.fornecedor_cnpj || '-'), 38, 52);

        doc.setFont('helvetica', 'bold');
        doc.text('Telefone: ', 115, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.fornecedor_telefone || '-'), 132, 52);

        doc.setFont('helvetica', 'bold');
        doc.text('Endereço Fiscal: ', 18, 58);
        doc.setFont('helvetica', 'normal');
        const endStr = `${p.fornecedor_endereco || ''} ${p.fornecedor_cidade ? '- ' + p.fornecedor_cidade : ''}${p.fornecedor_uf ? '/' + p.fornecedor_uf : ''}`;
        doc.text(endStr.trim() ? endStr : '-', 45, 58);

        doc.setFont('helvetica', 'bold');
        doc.text('E-mail: ', 18, 64);
        doc.setFont('helvetica', 'normal');
        doc.text(String(p.fornecedor_email || '-'), 33, 64);

        // Box 2: Emissor, Logística e Aprovação
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(14, 74, 182, 24, 2, 2, 'FD');

        doc.setTextColor(13, 36, 22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        
        doc.text('Emitido por: ', 18, 80);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(`${p.criado_por || 'Admin'} (${p.criado_por_perfil || 'Administrador'})`, 38, 80);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Status / Aprovação: ', 115, 80);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(p.status === 'Aprovado' || p.status === 'Faturado' || p.status === 'Entregue' ? 42 : 200, p.status === 'Aprovado' ? 150 : 100, 40);
        doc.text(String(p.status || 'Rascunho'), 147, 80);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Endereço de Entrega: ', 18, 86);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        const _addrFull = String(p.endereco_entrega || endStr || 'Mesmo do cadastro');
        const _addrLine = doc.splitTextToSize(_addrFull, 58);
        doc.text(_addrLine[0] + (_addrLine.length > 1 ? '...' : ''), 52, 86);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Data de Entrega: ', 115, 86);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(p.data_entrega ? fmtD(p.data_entrega) : 'Não informada', 143, 86);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Recebedor Destino: ', 18, 92);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(String(p.responsavel_recebimento || 'Almoxarifado Cliente'), 48, 92);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 36, 22);
        doc.text('Frete / Logística: ', 115, 92);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(String(p.tipo_frete || 'CIF - Entrega APEXTECH').replace(/Apex ?Tech/ig, 'APEXTECH'), 142, 92);

        // Tabela de Itens
        const tableItens = (p.itens || []).map((it, idx) => [
            String(idx + 1),
            it.descricao || '-',
            it.unidade || 'kg',
            (parseFloat(it.quantidade) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
            fmtR(it.preco_unitario),
            (parseFloat(it.desconto_item) || 0) + '%',
            fmtR(it.total_item)
        ]);

        doc.autoTable({
            startY: 102,
            head: [['Item', 'Descrição do Produto/Material', 'Und', 'Qtd', 'Preço Unit.', 'Desc%', 'Total (R$)']],
            body: tableItens.length > 0 ? tableItens : [['1', 'Nenhum item adicionado', '-', '0', 'R$ 0,00', '0%', 'R$ 0,00']],
            theme: 'grid',
            headStyles: { fillColor: [13, 36, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
            bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
            alternateRowStyles: { fillColor: [240, 245, 250] },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 22, halign: 'right' },
                4: { cellWidth: 28, halign: 'right' },
                5: { cellWidth: 18, halign: 'right' },
                6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: 14, right: 14 }
        });

        let finalY = doc.lastAutoTable.finalY + 8;

        // Resumo de Totais
        const subtot = (p.itens || []).reduce((s, it) => s + (parseFloat(it.total_item) || 0), 0);
        const descPct = parseFloat(p.desconto_pct) || 0;
        const descVal = subtot * (descPct / 100);
        const freteVal = parseFloat(p.frete) || 0;
        const totalGeral = subtot - descVal + freteVal;

        doc.setFillColor(240, 244, 248);
        doc.setDrawColor(200, 212, 224);
        doc.roundedRect(120, finalY, 76, 32, 2, 2, 'FD');

        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        doc.text('Subtotal Itens:', 124, finalY + 7);
        doc.text(fmtR(subtot), 192, finalY + 7, { align: 'right' });

        doc.text(`Desconto Geral (${descPct}%):`, 124, finalY + 13);
        doc.text(`- ${fmtR(descVal)}`, 192, finalY + 13, { align: 'right' });

        doc.text('Frete:', 124, finalY + 19);
        doc.text(fmtR(freteVal), 192, finalY + 19, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(13, 36, 22);
        doc.text('TOTAL DO PEDIDO:', 124, finalY + 27);
        doc.text(fmtR(p.total_geral || totalGeral), 192, finalY + 27, { align: 'right' });

        // Observações
        if (p.observacoes) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(13, 36, 22);
            doc.text('OBSERVAÇÕES / INSTRUÇÕES DE ENTREGA:', 14, finalY + 7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(50, 50, 50);
            const splitObs = doc.splitTextToSize(p.observacoes, 95);
            doc.text(splitObs, 14, finalY + 13);
        }

        // Assinaturas
        const sigY = Math.min(Math.max(finalY + 45, 245), 265);
        doc.setDrawColor(180, 180, 180);
        doc.line(20, sigY, 90, sigY);
        doc.line(120, sigY, 190, sigY);

        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.text(`ApexTech Metais — Emissor: ${p.criado_por || 'Admin'}`, 55, sigY + 5, { align: 'center' });
        doc.text('Fornecedor / Aceite e Confirmação', 155, sigY + 5, { align: 'center' });

        // Aplicar Marca d'água oficial em todas as páginas
        if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
            await window.aplicarMarcaDaguaLogoJsPDF(doc);
        } else if (typeof aplicarMarcaDaguaLogoJsPDF === 'function') {
            await aplicarMarcaDaguaLogoJsPDF(doc);
        }

        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7.5);
            doc.setTextColor(130, 130, 130);
            doc.text(`ApexTech Metais — Documento de Pedido de Compra ${p.numero || ''} | Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`Pedido_Compra_${p.numero || 'PC'}.pdf`);
    }

    // =========================================================================
    // EXPORTAR CENTRAL DE INTELIGÊNCIA APEXTECH (BI) EM PDF
    // =========================================================================
    window.exportarBIPDF = async function() {
        const biView = document.getElementById('bi-view');
        if (!biView) {
            _apexNotify('Atenção', 'Painel BI não encontrado.', 'error');
            return;
        }

        _apexNotify('Gerando PDF', 'Formatando relatório BI com fundo claro institucional... Aguarde!', 'info');

        const btnPdf = biView.querySelector('button[onclick="exportarBIPDF()"]');
        if (btnPdf) btnPdf.style.visibility = 'hidden';

        // Salvar estilo original para restaurar depois
        const originalStyle = biView.getAttribute('style') || '';
        
        // Guardar estilos originais para restauração pós-impressão
        const allDynamicEls = biView.querySelectorAll('*');
        const originalInlineStyles = new Map();
        allDynamicEls.forEach(el => {
            originalInlineStyles.set(el, el.getAttribute('style'));
        });
        const originalBiViewStyle = biView.getAttribute('style');

        try {
            // 1. Aplicar Tema de Impressão de Altíssima Nitidez (Fundo 100% Branco Puro e sem Backgrounds em Cards)
            biView.style.background = '#ffffff';
            biView.style.color = '#000000';
            biView.style.padding = '15px';
            biView.style.borderRadius = '0px';

            // Remover backgrounds de TODOS os cards, tabelas e contêineres internos
            const elementsToClearBg = biView.querySelectorAll('.estoque-card, .kpi-card, .dashboard-card, table, thead, tr, th, td, div, section, header, .chart-container');
            elementsToClearBg.forEach(el => {
                el.style.backgroundColor = 'transparent';
                el.style.background = 'none';
            });

            // Dar bordas limpas e elegantes aos cards KPI e de gráficos para estruturação sem poluição visual
            const cardsBorder = biView.querySelectorAll('.estoque-card, .kpi-card');
            cardsBorder.forEach(el => {
                el.style.border = '1px solid #cbd5e1';
                el.style.borderRadius = '6px';
                el.style.boxShadow = 'none';
            });

            // Ajustar o cabeçalho da tabela TOP 10 Produtos (removendo fundo escuro e aplicando fundo cinza institucional bem suave)
            const tableHeaders = biView.querySelectorAll('thead tr, th');
            tableHeaders.forEach(el => {
                el.style.backgroundColor = '#f1f5f9';
                el.style.color = '#0f172a';
                el.style.fontWeight = '700';
                el.style.borderBottom = '2px solid #94a3b8';
            });

            const tableRows = biView.querySelectorAll('tbody tr, td');
            tableRows.forEach(el => {
                el.style.borderBottom = '1px solid #e2e8f0';
            });

            // Ajustar especificamente as badges de Posição (#4 em diante) e Status no PDF
            const posBadges = biView.querySelectorAll('.bi-pos-badge');
            posBadges.forEach(el => {
                const txt = el.textContent || '';
                // Manter cores especiais só do pódio (#1 ouro, #2 prata, #3 bronze)
                if (!txt.includes('#1') && !txt.includes('#2') && !txt.includes('#3')) {
                    el.style.backgroundColor = 'transparent';
                    el.style.background = 'none';
                    el.style.color = '#0f172a';
                    el.style.border = '1px solid #cbd5e1';
                }
            });

            const statusBadges = biView.querySelectorAll('.bi-status-badge');
            statusBadges.forEach(el => {
                el.style.backgroundColor = 'transparent';
                el.style.background = 'none';
                el.style.border = '1px solid #cbd5e1';
                if (el.textContent.includes('Excelente')) el.style.color = '#15803d';
                else if (el.textContent.includes('Boa')) el.style.color = '#b45309';
                else el.style.color = '#b91c1c';
            });

            // Ajustar cores de textos para ficarem 100% nítidos e legíveis
            const allTextNodes = biView.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, strong, label, th, td');
            allTextNodes.forEach(el => {
                const comp = window.getComputedStyle(el).color;
                // Se o texto for amarelo (Venda Ref), converter para Marrom/Âmbar escuro vibrante nítido (#b45309)
                if (el.classList.contains('bi-venda-ref') || comp.includes('255, 235, 59') || comp.includes('240, 184, 0') || comp.includes('217, 119, 6')) {
                    el.style.color = '#b45309';
                    el.style.fontWeight = 'bold';
                }
                // Se o texto for branco, cinza claro ou amarelado fraco, transformar em tom escuro de alta legibilidade (respeitando se for badge)
                else if (!el.classList.contains('bi-pos-badge') && (comp.includes('255, 255, 255') || comp.includes('170, 170, 170') || comp.includes('127, 168, 200') || comp.includes('204, 204, 204'))) {
                    el.style.color = '#0f172a';
                }
                // Títulos e subtítulos principais em tom azul marinho escuro nítido
                if (['H1','H2','H3','H4','STRONG'].includes(el.tagName)) {
                    if (comp.includes('255, 255, 255') || comp.includes('15, 23, 42') || comp.includes('17, 24, 39')) {
                        el.style.color = '#0f172a';
                    }
                }
            });

            // Capturar com html2canvas em altíssima definição (scale: 2)
            const canvas = await html2canvas(biView, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // 2. Restaurar estilos visuais da tela escura imediatamente
            if (btnPdf) btnPdf.style.visibility = 'visible';
            if (originalBiViewStyle !== null) biView.setAttribute('style', originalBiViewStyle);
            else biView.removeAttribute('style');

            allDynamicEls.forEach(el => {
                const orig = originalInlineStyles.get(el);
                if (orig !== null && orig !== undefined) el.setAttribute('style', orig);
                else el.removeAttribute('style');
            });

            // 3. Montar PDF Multi-páginas com jsPDF em A4 com encaixe perfeito sem fatiar linhas ao meio
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                _apexNotify('Atenção', 'Biblioteca jsPDF não carregada.', 'error');
                return;
            }

            const today = new Date();
            const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            const formattedDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Configurar Margens Institucionais e Área Útil de Impressão
            const marginTop = 18;
            const marginBottom = 12;
            const marginLeft = 8;
            const contentWidth = pdfWidth - (marginLeft * 2); // 194mm útil
            const maxPageHeight = pdfHeight - marginTop - marginBottom; // 267mm área útil por folha

            // Calcular proporções
            const pxToMm = contentWidth / canvas.width;
            const totalContentHeightMm = canvas.height * pxToMm;

            let remainingHeightMm = totalContentHeightMm;
            let currentSrcYPx = 0;
            let pageNum = 1;

            while (remainingHeightMm > 0) {
                if (pageNum > 1) pdf.addPage();

                // Cabeçalho Institucional de topo em cada página
                pdf.setFillColor(30, 78, 140);
                pdf.rect(0, 0, pdfWidth, 13, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.text('APEXTECH METAIS — RELATÓRIO BI & DESEMPENHO OPERACIONAL', 8, 8.5);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Emissão: ${dateStr}`, pdfWidth - 8, 8.5, { align: 'right' });

                // Quantos mm e px cabem nesta folha
                const sliceHeightMm = Math.min(maxPageHeight, remainingHeightMm);
                const sliceHeightPx = sliceHeightMm / pxToMm;

                // Recorte exato no Canvas
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeightPx;
                const ctx = pageCanvas.getContext('2d');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                ctx.drawImage(
                    canvas,
                    0, currentSrcYPx, canvas.width, sliceHeightPx,
                    0, 0, canvas.width, sliceHeightPx
                );

                const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
                pdf.addImage(pageImgData, 'JPEG', marginLeft, marginTop, contentWidth, sliceHeightMm);

                // Rodapé com numeração de página institucional
                pdf.setFontSize(8);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`Página ${pageNum} | Central de Inteligência ApexTech`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });

                currentSrcYPx += sliceHeightPx;
                remainingHeightMm -= sliceHeightMm;
                pageNum++;
            }

            // Aplicar marca d'água oficial com logo em todas as páginas do PDF
            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(pdf);
            }

            pdf.save(`Relatorio_BI_ApexTech_${formattedDate}.pdf`);

            _apexNotify('Sucesso', '✅ Relatório BI exportado em PDF nítido e limpo!', 'info');

        } catch (err) {
            console.error('Erro ao exportar PDF do BI:', err);
            if (btnPdf) btnPdf.style.visibility = 'visible';
            if (originalBiViewStyle !== null) biView.setAttribute('style', originalBiViewStyle);
            else biView.removeAttribute('style');

            allDynamicEls.forEach(el => {
                const orig = originalInlineStyles.get(el);
                if (orig !== null && orig !== undefined) el.setAttribute('style', orig);
                else el.removeAttribute('style');
            });
            _apexNotify('Atenção', 'Erro ao exportar PDF: ' + err.message, 'error');
        }
    };

    // ── GERAÇÃO DE PDFS DE PLANEJAMENTO, MRP, INDUSTRIAL E ORDENS DE PRODUÇÃO (PCP) ──

    function getJsPDFClass() {
        if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
        if (window.jsPDF) return window.jsPDF;
        return null;
    }

    window.imprimirOPPdf = async function(opId) {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível no navegador.', 'error');
                return;
            }
            const list = (localOPs && localOPs.length > 0) ? localOPs : (window.localOPs || []);
            const op = list.find(x => x.id == opId);
            if (!op) {
                _apexNotify('Atenção', 'Ordem de Produção não encontrada.', 'error');
                return;
            }

            const doc = new JSClass('portrait', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 210, 32, 'F');

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 183, 77);
            doc.text('APEXTECH METAIS ERP', 15, 15);

            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`ORDEM DE PRODUÇÃO & ROTEIRO PCP — ${op.numero_op || 'OP'}`, 15, 24);

            doc.setFontSize(8);
            doc.setTextColor(180, 200, 220);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 145, 15);
            doc.text(`Emissor: ${sessionStorage.getItem('apex_logged_user_name') || 'Administrador'}`, 145, 22);

            doc.autoTable({
                startY: 38,
                head: [['Campo / Parâmetro', 'Especificação Industrial']],
                body: [
                    ['Número da OP', op.numero_op || 'OP-2026'],
                    ['Material de Entrada', op.material_entrada || '-'],
                    ['Peso de Entrada (kg)', parseFloat(op.peso_entrada_kg || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Material Resultante Esperado', op.material_saida_nome || '-'],
                    ['Peso de Saída Estimado (kg)', parseFloat(op.peso_saida_estimado_kg || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Cronograma Previsto', `${fmtD(op.data_inicio_prevista)} até ${fmtD(op.data_fim_prevista)}`],
                    ['Responsável PCP', op.responsavel_pcp || 'Eng. Roberto'],
                    ['Status da Ordem de Produção', op.status || 'Planejada'],
                    ['Observações / Instruções', op.observacoes || 'Sem observações']
                ],
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 }
            });

            const etapas = op.etapas || [];
            let totalEst = 0;
            let totalReal = 0;

            const etapasBody = etapas.map(et => {
                const estH = parseFloat(et.tempo_estimado_horas || 0);
                const realH = parseFloat(et.tempo_real_horas || 0);
                totalEst += estH;
                totalReal += realH;
                return [
                    et.ordem || '-',
                    et.nome_etapa || '-',
                    et.equipamento_nome || 'Nenhum / Manual',
                    estH.toFixed(1) + ' h',
                    realH.toFixed(1) + ' h',
                    et.status_etapa || 'Pendente',
                    et.operador_responsavel || 'Operador'
                ];
            });

            etapasBody.push([
                '', 'TOTAL ACUMULADO DA OP', '', totalEst.toFixed(1) + ' h', totalReal.toFixed(1) + ' h', '', ''
            ]);

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['#', 'Etapa Operacional', 'Equipamento', 'Tempo Est.', 'Tempo Real', 'Status Etapa', 'Operador']],
                body: etapasBody,
                theme: 'grid',
                headStyles: { fillColor: [255, 183, 77], textColor: [10, 20, 30], fontStyle: 'bold' },
                styles: { fontSize: 8.5, cellPadding: 3 },
                didParseCell: function(data) {
                    if (data.row.index === etapasBody.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                        data.cell.styles.textColor = [0, 0, 0];
                    }
                }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Ordem_Producao_${op.numero_op}_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', `PDF da Ordem de Produção ${op.numero_op} baixado com marca d'água!`, 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF da OP:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF da OP: ' + err.message, 'error');
        }
    };

    window.imprimirRelatorioOPsPdf = async function() {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localOPs && localOPs.length > 0) ? localOPs : (window.localOPs || []);
            if (list.length === 0) {
                _apexNotify('Atenção', 'Nenhuma Ordem de Produção (OP) cadastrada para imprimir.', 'info');
                return;
            }

            const doc = new JSClass('landscape', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 297, 28, 'F');

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 183, 77);
            doc.text('APEXTECH METAIS ERP — RELATÓRIO GERAL DE ORDENS DE PRODUÇÃO & PCP', 15, 18);

            const body = list.map(op => {
                const etapas = op.etapas || [];
                const totalEst = etapas.reduce((s, e) => s + parseFloat(e.tempo_estimado_horas || 0), 0);
                const totalReal = etapas.reduce((s, e) => s + parseFloat(e.tempo_real_horas || 0), 0);
                return [
                    op.numero_op || '-',
                    op.material_entrada || '-',
                    parseFloat(op.peso_entrada_kg || 0).toLocaleString('pt-BR') + ' kg',
                    op.material_saida_nome || '-',
                    parseFloat(op.peso_saida_estimado_kg || 0).toLocaleString('pt-BR') + ' kg',
                    `${fmtD(op.data_inicio_prevista)} a ${fmtD(op.data_fim_prevista)}`,
                    totalEst.toFixed(1) + ' h',
                    totalReal.toFixed(1) + ' h',
                    op.status || 'Planejada',
                    op.responsavel_pcp || '-'
                ];
            });

            doc.autoTable({
                startY: 34,
                head: [['Nº OP', 'Mat. Entrada', 'Peso Entrada', 'Mat. Saída Esperado', 'Peso Saída Est.', 'Cronograma', 'Tempo Est.', 'Tempo Real', 'Status OP', 'Responsável']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [30, 78, 140], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Relatorio_Ordens_Producao_PCP_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Relatório Geral de Ordens de Produção baixado com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar relatório geral de OPs:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.imprimirMrpPdf = async function(id) {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localMRP && localMRP.length > 0) ? localMRP : (window.localMRP || []);
            const item = list.find(x => x.id == id);
            if (!item) {
                _apexNotify('Atenção', 'Demanda de compra MRP não encontrada.', 'error');
                return;
            }

            const doc = new JSClass('portrait', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 210, 32, 'F');

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(42, 208, 122);
            doc.text('APEXTECH METAIS ERP', 15, 15);

            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`DEMANDA DE COMPRA (MRP) — MATÉRIA-PRIMA`, 15, 24);

            doc.autoTable({
                startY: 38,
                head: [['Item de Demanda', 'Especificação MRP']],
                body: [
                    ['Material Requerido', item.material_nome || 'Material'],
                    ['Fornecedor Homologado', item.fornecedor_nome || 'Fornecedor'],
                    ['Quantidade Necessária (kg)', parseFloat(item.quantidade_necessaria || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Ponto de Pedido / Est. Mínimo (kg)', parseFloat(item.ponto_pedido_kg || 0).toLocaleString('pt-BR') + ' kg'],
                    ['Lead Time de Entrega (Dias)', (item.lead_time_dias || 7) + ' dias'],
                    ['Preço Estimado (R$/kg)', 'R$ ' + parseFloat(item.preco_estimado || 0).toFixed(2)],
                    ['Custo Total Previsto (R$)', 'R$ ' + parseFloat(item.custo_total_estimado || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})],
                    ['Mês Referência', item.mes_referencia || '-'],
                    ['Status da Demanda', item.status || 'Sugerido'],
                    ['Observações', item.observacoes || '-']
                ],
                theme: 'grid',
                headStyles: { fillColor: [42, 208, 122], textColor: [0, 0, 0], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Demanda_Compra_MRP_${item.id}_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Demanda de compra MRP baixada em PDF com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF MRP:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF MRP: ' + err.message, 'error');
        }
    };

    window.imprimirRelatorioMrpPdf = async function() {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localMRP && localMRP.length > 0) ? localMRP : (window.localMRP || []);
            if (list.length === 0) {
                _apexNotify('Atenção', 'Nenhuma demanda de compra (MRP) cadastrada para imprimir.', 'info');
                return;
            }

            const doc = new JSClass('landscape', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 297, 28, 'F');

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(42, 208, 122);
            doc.text('APEXTECH METAIS ERP — PLANEJAMENTO DE NECESSIDADES DE COMPRA (MRP)', 15, 18);

            const body = list.map(m => [
                m.material_nome || '-',
                m.fornecedor_nome || '-',
                parseFloat(m.quantidade_necessaria || 0).toLocaleString('pt-BR') + ' kg',
                parseFloat(m.ponto_pedido_kg || 0).toLocaleString('pt-BR') + ' kg',
                (m.lead_time_dias || 7) + ' dias',
                'R$ ' + parseFloat(m.preco_estimado || 0).toFixed(2),
                'R$ ' + parseFloat(m.custo_total_estimado || 0).toLocaleString('pt-BR', {minimumFractionDigits:2}),
                m.mes_referencia || '-',
                m.status || 'Sugerido'
            ]);

            doc.autoTable({
                startY: 34,
                head: [['Material', 'Fornecedor', 'Qtd Necessária', 'Est. Mínimo', 'Lead Time', 'Preço Est.', 'Custo Total', 'Mês Ref.', 'Status']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [42, 208, 122], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Relatorio_Planejamento_MRP_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Relatório Geral MRP baixado em PDF com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar relatório MRP:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.imprimirEquipamentoPdf = async function(id) {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localEquipamentos && localEquipamentos.length > 0) ? localEquipamentos : (window.localEquipamentos || []);
            const eq = list.find(x => x.id == id);
            if (!eq) {
                _apexNotify('Atenção', 'Equipamento não encontrado.', 'error');
                return;
            }

            const doc = new JSClass('portrait', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 210, 32, 'F');

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(62, 124, 177);
            doc.text('APEXTECH METAIS ERP', 15, 15);

            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`FICHA DE CAPACIDADE INDUSTRIAL — TAG: ${eq.codigo_tag || 'EQ'}`, 15, 24);

            doc.autoTable({
                startY: 38,
                head: [['Parâmetro Operacional', 'Especificação da Máquina']],
                body: [
                    ['Código / TAG', eq.codigo_tag || '-'],
                    ['Nome do Equipamento', eq.nome_equipamento || '-'],
                    ['Setor Operacional', eq.setor || 'Processamento'],
                    ['Capacidade Nominal (kg/h)', parseFloat(eq.capacidade_nominal_kgh || 0).toLocaleString('pt-BR') + ' kg/h'],
                    ['Disponibilidade (h/dia)', (eq.disponibilidade_horas_dia || 16) + ' horas/dia'],
                    ['Tempo de Setup (Horas)', (eq.tempo_setup_horas || 1.0) + ' horas'],
                    ['Eficiência OEE (%)', (eq.eficiencia_oee_pct || 85) + ' %'],
                    ['Status Operacional', eq.status || 'Operacional'],
                    ['Observações Técnicas', eq.observacoes || '-']
                ],
                theme: 'grid',
                headStyles: { fillColor: [62, 124, 177], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Ficha_Equipamento_${eq.codigo_tag || eq.id}_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', `Ficha do equipamento ${eq.codigo_tag || eq.nome_equipamento} baixada em PDF!`, 'success');
        } catch (err) {
            console.error('Erro ao gerar ficha do equipamento:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };

    window.imprimirRelatorioIndustrialPdf = async function() {
        try {
            const JSClass = getJsPDFClass();
            if (!JSClass) {
                _apexNotify('Sistema', 'A biblioteca jsPDF não está disponível.', 'error');
                return;
            }
            const list = (localEquipamentos && localEquipamentos.length > 0) ? localEquipamentos : (window.localEquipamentos || []);
            if (list.length === 0) {
                _apexNotify('Atenção', 'Nenhum equipamento industrial cadastrado para imprimir.', 'info');
                return;
            }

            const doc = new JSClass('landscape', 'mm', 'a4');

            doc.setFillColor(16, 26, 36);
            doc.rect(0, 0, 297, 28, 'F');

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(62, 124, 177);
            doc.text('APEXTECH METAIS ERP — MAPEAMENTO DE CAPACIDADE & LINHAS INDUSTRIAIS', 15, 18);

            const body = list.map(e => [
                e.codigo_tag || '-',
                e.nome_equipamento || '-',
                e.setor || '-',
                parseFloat(e.capacidade_nominal_kgh || 0).toLocaleString('pt-BR') + ' kg/h',
                (e.disponibilidade_horas_dia || 16) + ' h/dia',
                (e.tempo_setup_horas || 1.0) + ' h',
                (e.eficiencia_oee_pct || 85) + ' %',
                e.status || 'Operacional'
            ]);

            doc.autoTable({
                startY: 34,
                head: [['TAG', 'Equipamento', 'Setor', 'Capacidade Nominal', 'Disponibilidade', 'Setup', 'OEE %', 'Status']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [62, 124, 177], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5 }
            });

            if (typeof window.aplicarMarcaDaguaLogoJsPDF === 'function') {
                await window.aplicarMarcaDaguaLogoJsPDF(doc);
            }

            doc.save(`Relatorio_Capacidade_Industrial_${new Date().toISOString().split('T')[0]}.pdf`);
            _apexNotify('Sucesso', 'Relatório Geral de Capacidade Industrial baixado em PDF com marca d\'água!', 'success');
        } catch (err) {
            console.error('Erro ao gerar relatório industrial:', err);
            _apexNotify('Atenção', 'Erro ao gerar PDF: ' + err.message, 'error');
        }
    };


    var _listMetasEstrategicas = [];
    var _listTabelaPrecosEstrategica = [];
    let _chartEstrategicoCenarios = null;
    let _mesEstrategicoAtivo = null; // null significa visualizando tela de 12 meses

    window.carregarPlanejamentoEstrategico = async function() {
        try {
            // Buscar tabela de preços completa e metas estratégicas cadastradas
            const [resPrecos, resMetas] = await Promise.all([
                fetch('/api/tabela-precos'),
                fetch('/api/planejamento-estrategico')
            ]);
            
            _listTabelaPrecosEstrategica = await resPrecos.json();
            const rawMetas = await resMetas.json();
            _listMetasEstrategicas = Array.isArray(rawMetas) ? rawMetas : [];

            // Popular comboboxes de seleção de produto
            popularSelectsProdutoEstrategico();

            if (_mesEstrategicoAtivo) {
                // Se um mês está ativo, renderiza os detalhes daquele mês
                renderDashboardEstrategico();
            } else {
                // Caso contrário, mostra a visão geral dos 12 meses
                renderVisualizacao12Meses();
            }
        } catch(e) {
            console.error('Erro ao carregar planejamento estratégico:', e);
            _apexNotify('Erro', 'Não foi possível carregar os dados estratégicos.', 'error');
        }
    };

    function popularSelectsProdutoEstrategico() {
        const selectProd = document.getElementById('plest-select-produto');
        const selectModal = document.getElementById('metaest-material-id');
        if (!selectProd || !selectModal) return;

        const currentValProd = selectProd.value;
        const currentValModal = selectModal.value;

        // Limpar e preencher
        selectProd.innerHTML = '<option value="">-- Selecione um Produto --</option>';
        selectModal.innerHTML = '<option value="">-- Selecione o Insumo/Produto --</option>';

        // Tabela de preços possui material_id e material_nome
        _listTabelaPrecosEstrategica.forEach(tp => {
            const opt1 = document.createElement('option');
            opt1.value = tp.material_id;
            opt1.textContent = tp.material_nome + ' (' + tp.material_categoria + ')';
            selectProd.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = tp.material_id;
            opt2.textContent = tp.material_nome + ' (' + tp.material_categoria + ')';
            selectModal.appendChild(opt2);
        });

        if (currentValProd) selectProd.value = currentValProd;
        if (currentValModal) selectModal.value = currentValModal;
    }

    window.voltarPara12MesesEstrategico = function() {
        _mesEstrategicoAtivo = null;
        document.getElementById('plest-view-12meses').style.display = 'block';
        document.getElementById('plest-view-detalhes-mes').style.display = 'none';
        renderVisualizacao12Meses();
    };

    window.detalharMesEstrategico = function(mes) {
        _mesEstrategicoAtivo = mes;
        document.getElementById('plest-view-12meses').style.display = 'none';
        document.getElementById('plest-view-detalhes-mes').style.display = 'block';
        document.getElementById('plest-txt-mes-ativo').innerHTML = `<i class="fa-solid fa-calendar-days" style="color:#00e5ff;"></i> Planejamento Estratégico — ${formatarMesAnoLabel(mes)}`;
        
        // Selecionar o primeiro produto por padrão se não houver um selecionado
        const selectProd = document.getElementById('plest-select-produto');
        if (selectProd && !selectProd.value && _listTabelaPrecosEstrategica.length > 0) {
            selectProd.value = _listTabelaPrecosEstrategica[0].material_id;
        }

        renderDashboardEstrategico();
    };

    function formatarMesAnoLabel(mesStr) {
        if (!mesStr) return '';
        const [year, month] = mesStr.split('-');
        const mesesNomes = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${mesesNomes[parseInt(month) - 1]} de ${year}`;
    }

    function renderVisualizacao12Meses() {
        const tbody = document.getElementById('plest-12meses-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Obter os 12 meses a partir de Agosto/2026
        const listMeses = [];
        let startYear = 2026;
        let startMonth = 8; // Agosto

        // Obter data atual do sistema para comparar status do mês
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-indexed

        for (let i = 0; i < 12; i++) {
            const m = String(startMonth).padStart(2, '0');
            const mesKey = `${startYear}-${m}`;
            listMeses.push(mesKey);

            startMonth++;
            if (startMonth > 12) {
                startMonth = 1;
                startYear++;
            }
        }

        listMeses.forEach(mesKey => {
            // Filtrar metas cadastradas neste mês
            const metasMes = _listMetasEstrategicas.filter(m => m.mes === mesKey);

            let totalMetaCompra = 0;
            let totalMetaVenda = 0;
            let totalFaturamentoProjetado = 0;
            let totalRealizado = 0;
            let totalConservador = 0;
            let totalAgressivo = 0;

            metasMes.forEach(meta => {
                const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === meta.material_id);
                const pVenda = tp ? parseFloat(tp.venda_ref || 0) : 0;

                const qCons = parseFloat(meta.qtd_conservador || 0);
                const qMod = parseFloat(meta.qtd_moderado || 0);
                const qAgr = parseFloat(meta.qtd_agressivo || 0);
                const qReal = parseFloat(meta.qtd_realizado || 0);

                totalMetaCompra += qMod;
                totalMetaVenda += qMod;
                totalFaturamentoProjetado += (qMod * pVenda);
                totalRealizado += qReal;
                totalConservador += qCons;
                totalAgressivo += qAgr;
            });

            const atingimentoPct = totalMetaCompra > 0 ? (totalRealizado / totalMetaCompra) * 100 : 0;

            // Determinar Status
            let statusStr = '';
            let statusCor = '';
            const [y, m] = mesKey.split('-').map(Number);
            const isFuturo = (y > currentYear) || (y === currentYear && m > currentMonth);
            const isAtual = (y === currentYear && m === currentMonth);

            if (totalRealizado === 0 && isFuturo) {
                statusStr = 'NÃO INICIADO';
                statusCor = '#aaa';
            } else if (isAtual) {
                statusStr = 'EM ANDAMENTO';
                statusCor = '#00e5ff';
            } else if (atingimentoPct >= 100) {
                statusStr = atingimentoPct > 100 ? 'META SUPERADA' : 'META ATINGIDA';
                statusCor = '#2AD07A';
            } else {
                statusStr = 'ABAIXO DA META';
                statusCor = '#ff4d4d';
            }

            // Posição entre os cenários
            let cenarioAlcancado = '—';
            if (totalRealizado > 0) {
                if (totalRealizado >= totalAgressivo && totalAgressivo > 0) {
                    cenarioAlcancado = '<span style="color:#ff4d4d; font-weight:bold;">Agressivo</span>';
                } else if (totalRealizado >= totalMetaCompra && totalMetaCompra > 0) {
                    cenarioAlcancado = '<span style="color:#00e5ff; font-weight:bold;">Moderado</span>';
                } else if (totalRealizado >= totalConservador && totalConservador > 0) {
                    cenarioAlcancado = '<span style="color:#ffeb3b; font-weight:bold;">Conservador</span>';
                } else {
                    cenarioAlcancado = '<span style="color:#ff4d4d;">Abaixo do Conservador</span>';
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px 8px;"><strong>${formatarMesAnoLabel(mesKey)}</strong></td>
                <td style="padding:10px 8px; text-align:right;">${totalMetaCompra.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right;">${totalMetaVenda.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${totalFaturamentoProjetado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td style="padding:10px 8px; text-align:right; color:#fff;">${totalRealizado.toLocaleString('pt-BR')} kg</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${atingimentoPct >= 100 ? '#2AD07A' : '#ffb74d'};">${atingimentoPct.toFixed(1)}%</td>
                <td style="padding:10px 8px; text-align:center;">${cenarioAlcancado}</td>
                <td style="padding:10px 8px; text-align:center; font-weight:bold; color:${statusCor};">${statusStr}</td>
                <td style="padding:10px 8px; text-align:center;">
                    <button onclick="detalharMesEstrategico('${mesKey}')" class="btn-primary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#2AD07A; color:#0d1826; font-weight:bold;">
                        <i class="fa-solid fa-magnifying-glass"></i> Detalhar Mês
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.onSelectProdutoEstrategico = function() {
        if (_mesEstrategicoAtivo) {
            renderDashboardEstrategico();
        }
    };

    window.onSelectModalMaterial = function() {
        const matId = parseInt(document.getElementById('metaest-material-id').value);
        const lblCompra = document.getElementById('metaest-lbl-compra');
        const lblVenda = document.getElementById('metaest-lbl-venda');
        const lblMargem = document.getElementById('metaest-lbl-margem');

        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (tp) {
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVenda = parseFloat(tp.venda_ref || 0);
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const frete = parseFloat(tp.frete_coleta || 0);

            const impostoUnit = pVenda * ((pisCofins + icms) / 100);
            const custoTotal = pCompra + frete + impostoUnit + (pVenda * (comissao / 100)) + (pVenda * (fidc / 100));
            const lucro = pVenda - custoTotal;
            const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;

            lblCompra.textContent = 'R$ ' + pCompra.toFixed(2);
            lblVenda.textContent = 'R$ ' + pVenda.toFixed(2);
            lblMargem.textContent = margem.toFixed(1) + '%';
        } else {
            lblCompra.textContent = '—';
            lblVenda.textContent = '—';
            lblMargem.textContent = '—';
        }
    };

    function renderDashboardEstrategico() {
        if (!_mesEstrategicoAtivo) return;
        const filterMes = _mesEstrategicoAtivo;
        const targetMatId = parseInt(document.getElementById('plest-select-produto').value) || null;

        // Filtrar metas cadastradas para o mês selecionado
        const metasMes = _listMetasEstrategicas.filter(m => m.mes === filterMes);

        // Agregadores gerais do mês para o dashboard KPI (Moderado)
        let totalFaturamentoProjetado = 0;
        let totalCustoCompraProjetado = 0;
        let totalLucroProjetado = 0;
        let totalFidcProjetado = 0;
        let countMateriais = 0;
        let somaMargem = 0;
        let somaMarkup = 0;

        const tableBody = document.getElementById('plest-geral-table-body');
        if (tableBody) tableBody.innerHTML = '';

        // Tabela de preços é a base de tudo
        _listTabelaPrecosEstrategica.forEach(tp => {
            // Achar se existe meta cadastrada para este produto no mês
            const meta = metasMes.find(m => m.material_id === tp.material_id);
            
            // Metas de volume para os cenários (padrão 0 se não cadastrado)
            const qCons = meta ? parseFloat(meta.qtd_conservador || 0) : 0;
            const qMod = meta ? parseFloat(meta.qtd_moderado || 0) : 0;
            const qAgr = meta ? parseFloat(meta.qtd_agressivo || 0) : 0;
            const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;

            // Margem customizada definida pelo usuário
            const margemCustom = (meta && meta.margem_alvo !== null) ? parseFloat(meta.margem_alvo) : null;

            // Valores comerciais oficiais da tabela
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVendaBase = parseFloat(tp.venda_ref || 0);
            const comissaoPct = parseFloat(tp.comissao || 0);
            const pisCofinsPct = parseFloat(tp.pis_cofins || 0);
            const fidcPct = parseFloat(tp.fidc || 0);
            const icmsPct = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);

            // Custos unitários baseados nos percentuais
            const custoImpostos = pVendaBase * ((pisCofinsPct + icmsPct) / 100);
            const custoComissao = pVendaBase * (comissaoPct / 100);
            const custoFidc = pVendaBase * (fidcPct / 100);
            const custoTotalUnit = pCompra + freteColeta + custoImpostos + custoComissao + custoFidc;

            // Calcular preço de venda planejado se houver margem customizada
            let pVendaProjetado = pVendaBase;
            if (margemCustom !== null && margemCustom < 100) {
                pVendaProjetado = custoTotalUnit / (1 - margemCustom / 100);
            }

            const lucroUnit = pVendaProjetado - custoTotalUnit;
            const margemUnitPct = pVendaProjetado > 0 ? (lucroUnit / pVendaProjetado) * 100 : 0;
            const markupUnit = pCompra > 0 ? (pVendaProjetado / pCompra) : 0;

            // Faturamento e custos totais projetados no cenário moderado (alvo)
            const fatMod = qMod * pVendaProjetado;
            const custoMod = qMod * custoTotalUnit;
            const lucroMod = fatMod - custoMod;
            const fidcTotalMod = qMod * custoFidc;

            totalFaturamentoProjetado += fatMod;
            totalCustoCompraProjetado += custoMod;
            totalLucroProjetado += lucroMod;
            totalFidcProjetado += fidcTotalMod;

            if (qMod > 0) {
                somaMargem += margemUnitPct;
                somaMarkup += markupUnit;
                countMateriais++;
            }

            // Atingimento e desvios
            const atingimentoPct = qMod > 0 ? (qReal / qMod) * 100 : 0;
            const saldo = qMod - qReal;

            // Comparação de qual cenário de volume o realizado alcançou
            let cenarioAlcancado = 'Abaixo';
            let cenarioCor = '#ff4d4d';
            if (qReal > 0) {
                if (qReal >= qAgr && qAgr > 0) {
                    cenarioAlcancado = 'Agressivo';
                    cenarioCor = '#ff4d4d';
                } else if (qReal >= qMod && qMod > 0) {
                    cenarioAlcancado = 'Moderado';
                    cenarioCor = '#00e5ff';
                } else if (qReal >= qCons && qCons > 0) {
                    cenarioAlcancado = 'Conservador';
                    cenarioCor = '#ffeb3b';
                } else {
                    cenarioAlcancado = 'Abaixo';
                    cenarioCor = '#aaa';
                }
            }

            // Detectar prejuízo unitário
            const isPrejuizo = lucroUnit < 0;

            // Inserir na planilha geral se houver meta
            if (tableBody && (meta || qMod > 0)) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding:8px;">
                        <strong>${tp.material_nome}</strong>
                        ${isPrejuizo ? '<span style="background:#ff4d4d; color:#fff; font-size:0.65rem; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">PREJUÍZO</span>' : ''}
                    </td>
                    <td style="padding:8px; text-align:right;">${qCons.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#00e5ff;">${qMod.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right;">${qAgr.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${pCompra.toFixed(2)}</td>
                    <td style="padding:8px; text-align:right; color:#2AD07A;">R$ ${pVendaProjetado.toFixed(2)}</td>
                    <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${fatMod.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; color:${lucroMod >= 0 ? '#2AD07A' : '#ff4d4d'}; font-weight:bold;">R$ ${lucroMod.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:${margemUnitPct >= 10 ? '#2AD07A' : '#ff4d4d'};">${margemUnitPct.toFixed(1)}%</td>
                    <td style="padding:8px; text-align:right; color:#fff;">
                        ${qReal.toLocaleString('pt-BR')} kg
                        <div style="font-size:0.7rem; color:${cenarioCor}; margin-top:2px;">Cenário: ${cenarioAlcancado}</div>
                    </td>
                    <td style="padding:8px; text-align:center; font-weight:bold;">
                        <span style="color:${atingimentoPct >= 100 ? '#2AD07A' : (atingimentoPct >= 75 ? '#ffb74d' : '#ff4d4d')};">${atingimentoPct.toFixed(1)}%</span>
                        <div style="font-size:0.7rem; color:#aaa; margin-top:2px;">Saldo: ${saldo.toLocaleString('pt-BR')} kg</div>
                    </td>
                    <td style="padding:8px; text-align:center;">
                        <button onclick="editarMetaEstrategicaRapido(${tp.material_id}, '${filterMes}', ${qCons}, ${qMod}, ${qAgr}, ${qReal}, ${margemCustom || '""'}, ${meta ? meta.valor_compra_realizado : 0}, ${meta ? meta.valor_venda_realizado : 0})" class="btn-primary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#00e5ff; color:#0d1826;" title="Editar"><i class="fa-solid fa-edit"></i></button>
                        ${meta ? `<button onclick="deletarMetaEstrategica(${meta.id})" style="background:none; border:none; color:#ff6b6b; margin-left:8px; cursor:pointer;" title="Remover Meta"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                `;
                tableBody.appendChild(tr);
            }
        });

        if (tableBody && tableBody.children.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; color:#aaa;">Nenhuma meta cadastrada para este mês. Clique em "Alterar Metas do Mês" no topo para planejar.</td></tr>`;
        }

        // Renderizar KPIs no topo
        document.getElementById('est-kpi-fat-previsto').textContent = 'R$ ' + totalFaturamentoProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('est-kpi-custo-previsto').textContent = 'R$ ' + totalCustoCompraProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('est-kpi-lucro-previsto').textContent = 'R$ ' + totalLucroProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('est-kpi-margem-media').textContent = (countMateriais > 0 ? (somaMargem / countMateriais) : 0).toFixed(1) + '%';
        document.getElementById('est-kpi-markup-medio').textContent = (countMateriais > 0 ? (somaMarkup / countMateriais) : 0).toFixed(2) + 'x';
        document.getElementById('est-kpi-fidc-total').textContent = 'R$ ' + totalFidcProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});

        // 3. Renderizar produto detalhado ativo e cenários individuais
        renderDetalhesProdutoSelecionado(targetMatId, filterMes);

        // 4. Renderizar rankings executivos
        renderRankingEstrategico();

        // 5. Atualizar insights automáticos de IA
        gerarInsightsIAEstrategicos(metasMes);
    }

    function renderDetalhesProdutoSelecionado(matId, mes) {
        const container = document.getElementById('plest-produto-detalhes-container');
        const cenBody = document.getElementById('plest-cenarios-table-body');
        const prBody = document.getElementById('plest-planejado-realizado-tbody');
        if (!container || !cenBody || !prBody) return;

        const preco = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        const meta = _listMetasEstrategicas.find(m => m.material_id === matId && m.mes === mes);

        if (!preco) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:15px; color:#aaa; font-size:0.85rem;">
                    Selecione um produto no combobox acima para avaliar custos, spreads e margens integradas.
                </div>
            `;
            cenBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto para visualizar cenários.</td></tr>`;
            prBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto.</td></tr>`;
            if (_chartEstrategicoCenarios) { _chartEstrategicoCenarios.destroy(); _chartEstrategicoCenarios = null; }
            return;
        }

        const pCompra = parseFloat(preco.preco_entregar || 0);
        const pVendaBase = parseFloat(preco.venda_ref || 0);
        const comissao = parseFloat(preco.comissao || 0);
        const pisCofins = parseFloat(preco.pis_cofins || 0);
        const fidc = parseFloat(preco.fidc || 0);
        const icms = parseFloat(preco.icms || 0);
        const frete = parseFloat(preco.frete_coleta || 0);

        const impostoUnit = pVendaBase * ((pisCofins + icms) / 100);
        const comissaoUnit = pVendaBase * (comissao / 100);
        const fidcUnit = pVendaBase * (fidc / 100);
        const custoTotal = pCompra + frete + impostoUnit + comissaoUnit + fidcUnit;

        // Custom Target Margin
        const margemCustom = (meta && meta.margem_alvo !== null) ? parseFloat(meta.margem_alvo) : null;
        let pVendaProjetado = pVendaBase;
        if (margemCustom !== null && margemCustom < 100) {
            pVendaProjetado = custoTotal / (1 - margemCustom / 100);
        }

        const lucroUnit = pVendaProjetado - custoTotal;
        const margem = pVendaProjetado > 0 ? (lucroUnit / pVendaProjetado) * 100 : 0;
        const markup = pCompra > 0 ? (pVendaProjetado / pCompra) : 0;

        container.innerHTML = `
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Compra (Tabela)</small>
                <div style="font-weight:bold; color:#ffb74d; margin-top:2px;">R$ ${pCompra.toFixed(2)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Venda Projetada</small>
                <div style="font-weight:bold; color:#2AD07A; margin-top:2px;">R$ ${pVendaProjetado.toFixed(2)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Markup Projetado</small>
                <div style="font-weight:bold; color:#9b59b6; margin-top:2px;">${markup.toFixed(2)}x</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Lucro Unitário</small>
                <div style="font-weight:bold; color:${lucroUnit >= 0 ? '#00e5ff' : '#ff4d4d'}; margin-top:2px;">R$ ${lucroUnit.toFixed(2)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Margem Líquida</small>
                <div style="font-weight:bold; color:${margem >= 10 ? '#3e7cb1' : '#ff4d4d'}; margin-top:2px;">${margem.toFixed(1)}%</div>
            </div>
        `;

        // Cenários individuais
        const qCons = meta ? parseFloat(meta.qtd_conservador || 0) : 0;
        const qMod = meta ? parseFloat(meta.qtd_moderado || 0) : 0;
        const qAgr = meta ? parseFloat(meta.qtd_agressivo || 0) : 0;
        const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;

        const fillCenario = (nome, qtd, cor) => {
            const fat = qtd * pVendaProjetado;
            const custo = qtd * custoTotal;
            const lucro = fat - custo;
            return `
                <tr>
                    <td style="padding:8px; font-weight:bold; color:${cor};">${nome}</td>
                    <td style="padding:8px; text-align:right; color:#fff;">${qtd.toLocaleString('pt-BR')} kg</td>
                    <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${fat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${custo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; color:${lucro >= 0 ? '#2AD07A' : '#ff4d4d'}; font-weight:bold;">R$ ${lucro.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:#2AD07A;">${margem.toFixed(1)}%</td>
                    <td style="padding:8px; text-align:center; color:#9b59b6;">${markup.toFixed(2)}x</td>
                </tr>
            `;
        };

        cenBody.innerHTML = `
            ${fillCenario('Conservador', qCons, '#ffeb3b')}
            ${fillCenario('Moderado (Meta)', qMod, '#00e5ff')}
            ${fillCenario('Agressivo', qAgr, '#ff4d4d')}
        `;

        // Realizados financeiros consolidados
        const valCompraReal = meta ? parseFloat(meta.valor_compra_realizado || 0) : 0;
        const valVendaReal = meta ? parseFloat(meta.valor_venda_realizado || 0) : 0;

        // Planejado vs Realizado (Mês Consolidado)
        const fatPlan = qMod * pVendaProjetado;
        const fatReal = valVendaReal > 0 ? valVendaReal : (qReal * pVendaProjetado);
        const investPlan = qMod * custoTotal;
        const investReal = valCompraReal > 0 ? valCompraReal : (qReal * custoTotal);
        const lucroPlan = fatPlan - investPlan;
        const lucroReal = fatReal - investReal;

        const precoMedioVendaReal = qReal > 0 ? (fatReal / qReal) : pVendaProjetado;
        const precoMedioCompraReal = qReal > 0 ? (investReal / qReal) : pCompra;
        const margemReal = precoMedioVendaReal > 0 ? ((precoMedioVendaReal - precoMedioCompraReal) / precoMedioVendaReal) * 100 : 0;

        const compRow = (nome, planVal, realVal, unit, isMoney, isPercent = false) => {
            const diff = planVal - realVal;
            const pct = planVal > 0 ? (realVal / planVal) * 100 : 0;
            const fmt = (v) => {
                if (isPercent) return v.toFixed(1) + '%';
                return isMoney ? 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2}) : v.toLocaleString('pt-BR') + ' ' + unit;
            };
            return `
                <tr>
                    <td style="padding:8px; font-weight:600; color:#fff;">${nome}</td>
                    <td style="padding:8px; text-align:right; color:#aaa;">${fmt(planVal)}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#fff;">${fmt(realVal)}</td>
                    <td style="padding:8px; text-align:right; color:${diff <= 0 ? '#2AD07A' : '#ff4d4d'};">${diff <= 0 ? 'Meta Atingida' : fmt(diff) + ' restante'}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:${pct >= 100 ? '#2AD07A' : (pct >= 80 ? '#ffb74d' : '#ff4d4d')};">${pct.toFixed(1)}%</td>
                </tr>
            `;
        };

        prBody.innerHTML = `
            ${compRow('Meta de Compra (Volume)', qMod, qReal, 'kg', false)}
            ${compRow('Meta de Venda (Volume)', qMod, qReal, 'kg', false)}
            ${compRow('Faturamento', fatPlan, fatReal, '', true)}
            ${compRow('Investimento (Reserva)', investPlan, investReal, '', true)}
            ${compRow('Lucro Projetado', lucroPlan, lucroReal, '', true)}
            ${compRow('Margem Líquida', margem, margemReal, '', false, true)}
        `;

        // Renderizar gráfico de cenários com Chart.js
        renderGraficoCenariosEstrategicos(qCons, qMod, qAgr, qReal, preco.material_nome);
    }

    function renderGraficoCenariosEstrategicos(cons, mod, agr, real, produtoNome) {
        const ctx = document.getElementById('plest-chart-cenarios');
        if (!ctx) return;

        if (_chartEstrategicoCenarios) {
            _chartEstrategicoCenarios.destroy();
        }

        _chartEstrategicoCenarios = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Conservador', 'Moderado', 'Agressivo', 'Realizado'],
                datasets: [{
                    label: 'Volume (kg) - ' + produtoNome,
                    data: [cons, mod, agr, real],
                    backgroundColor: ['rgba(255, 235, 59, 0.4)', 'rgba(0, 229, 255, 0.4)', 'rgba(255, 77, 77, 0.4)', 'rgba(42, 208, 122, 0.5)'],
                    borderColor: ['#ffeb3b', '#00e5ff', '#ff4d4d', '#2AD07A'],
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8eaabf', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8eaabf', font: { size: 9 } } }
                }
            }
        });
    }

    window.renderRankingEstrategico = function() {
        const select = document.getElementById('plest-select-ranking-tipo');
        const tbody = document.getElementById('plest-rankings-tbody');
        if (!select || !tbody) return;

        const tipo = select.value;
        tbody.innerHTML = '';

        // Mapear produtos com cálculos
        const dadosRanked = _listTabelaPrecosEstrategica.map(tp => {
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVenda = parseFloat(tp.venda_ref || 0);
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const frete = parseFloat(tp.frete_coleta || 0);

            const impostoUnit = pVenda * ((pisCofins + icms) / 100);
            const custoTotal = pCompra + frete + impostoUnit + (pVenda * (comissao / 100)) + (pVenda * (fidc / 100));

            const lucro = pVenda - custoTotal;
            const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;
            const markup = pCompra > 0 ? (pVenda / pCompra) : 0;
            const spread = pVenda - pCompra;

            return {
                material_nome: tp.material_nome,
                material_categoria: tp.material_categoria,
                preco_compra: pCompra,
                preco_venda: pVenda,
                lucro,
                margem,
                markup,
                spread
            };
        });

        // Ordenação com base no tipo selecionado
        if (tipo === 'lucro') {
            dadosRanked.sort((a,b) => b.lucro - a.lucro);
        } else if (tipo === 'margem') {
            dadosRanked.sort((a,b) => b.margem - a.margem);
        } else if (tipo === 'markup') {
            dadosRanked.sort((a,b) => b.markup - a.markup);
        } else if (tipo === 'oportunidade' || tipo === 'faturamento') {
            dadosRanked.sort((a,b) => b.spread - a.spread);
        } else if (tipo === 'abaixo') {
            dadosRanked.sort((a,b) => a.margem - b.margem);
        }

        // Exibir Top 10
        const top10 = dadosRanked.slice(0, 10);
        top10.forEach((item, idx) => {
            let keyMetricStr = '';
            if (tipo === 'lucro') keyMetricStr = 'R$ ' + item.lucro.toFixed(2);
            else if (tipo === 'margem' || tipo === 'abaixo') keyMetricStr = item.margem.toFixed(1) + '%';
            else if (tipo === 'markup') keyMetricStr = item.markup.toFixed(2) + 'x';
            else if (tipo === 'oportunidade' || tipo === 'faturamento') keyMetricStr = 'Spread: R$ ' + item.spread.toFixed(2);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; text-align:center; font-weight:bold; color:#00e5ff;">#${idx+1}</td>
                <td style="padding:8px;"><strong>${item.material_nome}</strong></td>
                <td style="padding:8px;"><span style="background:#122a3f; color:#3e7cb1; padding:2px 8px; border-radius:12px; font-size:0.7rem;">${item.material_categoria}</span></td>
                <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${item.preco_compra.toFixed(2)}</td>
                <td style="padding:8px; text-align:right; color:#2AD07A;">R$ ${item.preco_venda.toFixed(2)}</td>
                <td style="padding:8px; text-align:right; color:${item.lucro >= 0 ? '#00e5ff' : '#ff4d4d'}; font-weight:bold;">R$ ${item.lucro.toFixed(2)} /kg</td>
                <td style="padding:8px; text-align:center; font-weight:bold; color:#2AD07A;">${keyMetricStr}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function gerarInsightsIAEstrategicos(metasMes) {
        const insightsContainer = document.getElementById('plest-ia-insights');
        if (!insightsContainer) return;

        if (_listTabelaPrecosEstrategica.length === 0) {
            insightsContainer.textContent = 'Sem dados de cotações para formular insights estratégicos.';
            return;
        }

        // Mapear margens
        const listCalculada = _listTabelaPrecosEstrategica.map(tp => {
            const pCompra = parseFloat(tp.preco_entregar || 0);
            const pVenda = parseFloat(tp.venda_ref || 0);
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const frete = parseFloat(tp.frete_coleta || 0);

            const impostoUnit = pVenda * ((pisCofins + icms) / 100);
            const custoTotal = pCompra + frete + impostoUnit + (pVenda * (comissao / 100)) + (pVenda * (fidc / 100));
            const lucro = pVenda - custoTotal;
            const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;
            return { nome: tp.material_nome, margem, lucro, pCompra, pVenda };
        });

        // Achar campeão de margem
        const melhorMargem = [...listCalculada].sort((a,b) => b.margem - a.margem)[0];
        // Achar risco de margem (margem negativa ou menor que 5%)
        const riscoMargem = listCalculada.filter(x => x.margem < 5);

        let html = `<ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:6px;">`;
        if (melhorMargem) {
            html += `<li>🚀 <strong>Destaque Comercial</strong>: O produto <strong>${melhorMargem.nome}</strong> possui a melhor margem líquida da tabela com <strong>${melhorMargem.margem.toFixed(1)}%</strong>. Focar volume nele aumenta exponencialmente o lucro.</li>`;
        }

        if (riscoMargem.length > 0) {
            html += `<li>⚠️ ï¸ <strong>Alerta de Risco</strong>: Encontramos ${riscoMargem.length} produtos com margem crítica ou negativa (ex: <strong>${riscoMargem[0].nome}</strong> com ${riscoMargem[0].margem.toFixed(1)}%). Recomenda-se renegociar compra ou reajustar tabela de venda.</li>`;
        } else {
            html += `<li>✅ <strong>Saúde da Carteira</strong>: Todos os produtos da Tabela de Preços apresentam margens unitárias saudáveis e seguras contra flutuações.</li>`;
        }

        // Acompanhar realizado
        if (metasMes.length > 0) {
            const atingimentoMedio = metasMes.reduce((acc, curr) => {
                const mod = parseFloat(curr.qtd_moderado || 0);
                const real = parseFloat(curr.qtd_realizado || 0);
                return acc + (mod > 0 ? (real / mod) * 100 : 0);
            }, 0) / metasMes.length;

            html += `<li>📊 <strong>Atingimento</strong>: O atingimento médio das metas estratégicas do mês atual está em <strong>${atingimentoMedio.toFixed(1)}%</strong>.</li>`;
        }

        // Análises de progresso por produto
        metasMes.forEach(m => {
            const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === m.material_id);
            if (tp) {
                const mod = parseFloat(m.qtd_moderado || 0);
                const real = parseFloat(m.qtd_realizado || 0);
                const cons = parseFloat(m.qtd_conservador || 0);

                if (real >= mod && mod > 0) {
                    html += `<li>🏆 <strong>Meta Atingida</strong>: O produto <strong>${tp.material_nome}</strong> superou a meta moderada com <strong>${real.toLocaleString('pt-BR')} kg</strong> realizados.</li>`;
                } else if (real >= cons && cons > 0) {
                    html += `<li>📈 <strong>Cenário Conservador</strong>: O produto <strong>${tp.material_nome}</strong> superou o cenário conservador e está buscando a meta moderada.</li>`;
                } else if (mod > 0) {
                    const restante = mod - real;
                    html += `<li>🕒 <strong>Restante</strong>: Faltam <strong>${restante.toLocaleString('pt-BR')} kg</strong> de <strong>${tp.material_nome}</strong> para atingir a meta moderada do mês.</li>`;
                }
            }
        });

        html += `</ul>`;
        insightsContainer.innerHTML = html;
    }

    // Modal meta estratégica handlers
    window.abrirModalMetaEstrategica = function() {
        const modal = document.getElementById('modal-meta-estrategica');
        if (modal) {
            // Preencher mês atual ou ativo no input
            const mesInput = document.getElementById('metaest-mes');
            if (mesInput) {
                if (_mesEstrategicoAtivo) {
                    mesInput.value = _mesEstrategicoAtivo;
                } else {
                    const today = new Date();
                    mesInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
                }
            }

            document.body.appendChild(modal);
            modal.style.display = 'flex';
        }
    };

    window.fecharModalMetaEstrategica = function() {
        const modal = document.getElementById('modal-meta-estrategica');
        if (modal) modal.style.display = 'none';
        document.getElementById('form-meta-estrategica').reset();
    };

    window.editarMetaEstrategicaRapido = function(materialId, mes, cons, mod, agr, real) {
        document.getElementById('metaest-material-id').value = materialId;
        document.getElementById('metaest-mes').value = mes;
        document.getElementById('metaest-qtd-conservador').value = cons;
        document.getElementById('metaest-qtd-moderado').value = mod;
        document.getElementById('metaest-qtd-agressivo').value = agr;
        document.getElementById('metaest-qtd-realizado').value = real;

        onSelectModalMaterial();
        abrirModalMetaEstrategica();
    };

    window.salvarMetaEstrategicaForm = async function(event) {
        event.preventDefault();
        const material_id = document.getElementById('metaest-material-id').value;
        const mes = document.getElementById('metaest-mes').value;
        const qtd_conservador = document.getElementById('metaest-qtd-conservador').value;
        const qtd_moderado = document.getElementById('metaest-qtd-moderado').value;
        const qtd_agressivo = document.getElementById('metaest-qtd-agressivo').value;
        const qtd_realizado = document.getElementById('metaest-qtd-realizado').value;

        try {
            const res = await fetch('/api/planejamento-estrategico', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_id, mes, qtd_conservador, qtd_moderado, qtd_agressivo, qtd_realizado
                })
            });

            if (res.ok) {
                _apexNotify('Sucesso', 'Meta de planejamento estratégico salva com sucesso!', 'success');
                fecharModalMetaEstrategica();
                await carregarPlanejamentoEstrategico();
            } else {
                throw new Error('Falha ao salvar meta');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível salvar a meta estratégica.', 'error');
        }
    };

    window.deletarMetaEstrategica = async function(id) {
        if (!confirm('Deseja realmente remover esta meta de planejamento estratégico?')) return;
        try {
            const res = await fetch(`/api/planejamento-estrategico/${id}`, { method: 'DELETE' });
            if (res.ok) {
                _apexNotify('Sucesso', 'Meta estratégica excluída.', 'success');
                await carregarPlanejamentoEstrategico();
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível excluir a meta.', 'error');
        }
    };


    // ─── MÓDULO DE PLANEJAMENTO ESTRATÉGICO V3 (TESTE META FATURAMENTO -> INSUMO) ─────────
    let _listMetasV3 = [];
    let _chartEstrategicoV3 = null;
    let _mesV3Ativo = null; // null = visão de 12 meses
    let _mixSimulacaoV3 = []; // Mix de produtos para simulação: [{ material_id, fracaoPct }]

    window.carregarPlanejamentoEstrategicov3 = async function() {
        try {
            const resPrecos = await fetch('/api/tabela-precos');
            _listTabelaPrecosEstrategica = await resPrecos.json();
            
            // Renderiza o Dashboard de Margens
            window.renderDashboardVisuaisEstrategicoV3();
        } catch (e) {
            console.error('Erro ao carregar planejamento V3:', e);
            _apexNotify('Erro', 'Não foi possível carregar os dados estratégicos V3.', 'error');
        }
    };

    window.renderDashboardVisuaisEstrategicoV3 = function() {
        if (!_listTabelaPrecosEstrategica || _listTabelaPrecosEstrategica.length === 0) return;

        let totalMargem = 0;
        let produtosValidos = 0;
        
        const dadosGrafico = _listTabelaPrecosEstrategica.map(tp => {
            const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const pCompra = parseFloat(tp.preco_entregar || tp.preco_compra || tp.preco_compra_coletar || 0);
            let margem = 0;
            if (pVenda > 0) {
                margem = ((pVenda - pCompra) / pVenda) * 100;
                totalMargem += margem;
                produtosValidos++;
            }
            return {
                nome: tp.material_nome || 'Produto ' + tp.material_id,
                margem: margem,
                pVenda: pVenda,
                pCompra: pCompra
            };
        }).filter(p => p.pVenda > 0);

        dadosGrafico.sort((a, b) => b.margem - a.margem);

        const margemMedia = produtosValidos > 0 ? (totalMargem / produtosValidos) : 0;
        document.getElementById('dash-margem-media').textContent = margemMedia.toFixed(1) + '%';
        document.getElementById('dash-margem-total-produtos').textContent = dadosGrafico.length;

        if (dadosGrafico.length > 0) {
            const melhor = dadosGrafico[0];
            document.getElementById('dash-margem-maior-val').textContent = melhor.margem.toFixed(1) + '%';
            document.getElementById('dash-margem-maior-nome').textContent = melhor.nome;
            
            const pior = dadosGrafico[dadosGrafico.length - 1];
            document.getElementById('dash-margem-menor-val').textContent = pior.margem.toFixed(1) + '%';
            document.getElementById('dash-margem-menor-nome').textContent = pior.nome;
        }

        const top10 = dadosGrafico.slice(0, 10);
        const worst10 = [...dadosGrafico].reverse().slice(0, 10);

        renderChartMargem('chart-margin-top10', top10, '#2AD07A', 'Maiores Margens Brutas (%)');
        renderChartMargem('chart-margin-worst10', worst10, '#ff4d4d', 'Menores Margens Brutas (%)');
    };

    let chartMarginTop10Instance = null;
    let chartMarginWorst10Instance = null;

    function renderChartMargem(canvasId, dados, cor, labelStr) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const labels = dados.map(d => d.nome);
        const values = dados.map(d => parseFloat(d.margem.toFixed(1)));

        if (canvasId === 'chart-margin-top10' && chartMarginTop10Instance) chartMarginTop10Instance.destroy();
        if (canvasId === 'chart-margin-worst10' && chartMarginWorst10Instance) chartMarginWorst10Instance.destroy();

        const chartConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: labelStr,
                    data: values,
                    backgroundColor: cor,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#1a2e3f' },
                        ticks: { color: '#8eaabf', callback: function(value) { return value + '%' } } 
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#8eaabf', maxRotation: 45, minRotation: 45 } 
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) { return ctx.raw + '%'; }
                        }
                    }
                }
            }
        };

        if (canvasId === 'chart-margin-top10') chartMarginTop10Instance = new Chart(ctx, chartConfig);
        if (canvasId === 'chart-margin-worst10') chartMarginWorst10Instance = new Chart(ctx, chartConfig);
    }

    function popularSelectsProdutoEstrategicov3() {
        const selectProd = document.getElementById('plestv3-select-produto');
        const selectConsulta = document.getElementById('plestv3-consulta-material');
        const selectModal = document.getElementById('metaestv3-material-id');

        const currentValProd = selectProd ? selectProd.value : '';
        const currentValConsulta = selectConsulta ? selectConsulta.value : '';
        const currentValModal = selectModal ? selectModal.value : '';

        if (selectProd) selectProd.innerHTML = '<option value="">-- Selecione um Produto --</option>';
        if (selectConsulta) selectConsulta.innerHTML = '<option value="">-- Selecione um Material --</option>';
        if (selectModal) selectModal.innerHTML = '<option value="">-- Selecione um Produto --</option>';

        _listTabelaPrecosEstrategica.forEach(tp => {
            const label = tp.material_nome + ' (' + tp.material_categoria + ')';
            if (selectProd) {
                const opt = document.createElement('option');
                opt.value = tp.material_id;
                opt.textContent = label;
                selectProd.appendChild(opt);
            }
            if (selectConsulta) {
                const opt = document.createElement('option');
                opt.value = tp.material_id;
                opt.textContent = label;
                selectConsulta.appendChild(opt);
            }
            if (selectModal) {
                const opt = document.createElement('option');
                opt.value = tp.material_id;
                opt.textContent = label;
                selectModal.appendChild(opt);
            }
        });

        if (selectProd && currentValProd) selectProd.value = currentValProd;
        if (selectConsulta && currentValConsulta) selectConsulta.value = currentValConsulta;
        if (selectModal && currentValModal) selectModal.value = currentValModal;
    }

    window.onChangeConsultaMaterialV3 = function() {
        const selectConsulta = document.getElementById('plestv3-consulta-material');
        const tbody = document.getElementById('plestv3-consulta-tbody');
        if (!selectConsulta || !tbody) return;

        const matId = parseInt(selectConsulta.value);
        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);

        if (!tp) {
            tbody.innerHTML = `
                <tr id="plestv3-consulta-row" style="background:#101a24; color:#fff;">
                    <td colspan="14" style="text-align:center; padding:12px; color:#aaa;">Selecione um material no seletor acima para ver as taxas e margens.</td>
                </tr>
            `;
            return;
        }

        const comissao = parseFloat(tp.comissao || 0);
        const pisCofins = parseFloat(tp.pis_cofins || 0);
        const fidc = parseFloat(tp.fidc || 0);
        const icms = parseFloat(tp.icms || 0);
        const freteColeta = parseFloat(tp.frete_coleta || 0);

        const totalDedPct = comissao + pisCofins + fidc + icms;
        const valDeducoes = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) * (totalDedPct / 100);
        const vendaLiquida = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) - valDeducoes;

        const lucroEnt = vendaLiquida - (parseFloat(tp.preco_entregar || tp.preco_compra || 0));
        const margemEnt = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroEnt / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

        const lucroCol = vendaLiquida - (parseFloat(tp.preco_coletar || tp.preco_compra || 0)) - freteColeta;
        const margemCol = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroCol / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

        tbody.innerHTML = `
            <tr style="background:#101a24; color:#fff;">
                <td style="padding:10px; font-weight:bold; color:#00e5ff;">R$ ${window.fmtBRL(tp.preco_entregar)}</td>
                <td style="padding:10px; font-weight:bold; color:#ffb74d;">R$ ${window.fmtBRL(tp.preco_coletar)}</td>
                <td style="padding:10px; font-weight:bold; color:#ffeb3b;">R$ ${window.fmtBRL(tp.preco_venda || tp.venda_ref)}</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(comissao)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(pisCofins)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(fidc)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">${window.fmtBRL(icms)}%</td>
                <td style="padding:10px; text-align:right; color:#ccc;">R$ ${window.fmtBRL(freteColeta)}</td>
                <td style="padding:10px; font-weight:bold; color:#4fc3f7;">R$ ${window.fmtBRL(vendaLiquida)}</td>
                <td style="padding:10px; color:${lucroEnt >= 0 ? '#2AD07A' : '#ff4d4d'};">R$ ${window.fmtBRL(lucroEnt)}</td>
                <td style="padding:10px; font-weight:bold; color:${margemEnt >= 0 ? '#2AD07A' : '#ff4d4d'};">${(margemEnt).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                <td style="padding:10px; color:${lucroCol >= 0 ? '#3e7cb1' : '#ff4d4d'};">R$ ${window.fmtBRL(lucroCol)}</td>
                <td style="padding:10px; font-weight:bold; color:${margemCol >= 0 ? '#3e7cb1' : '#ff4d4d'};">${(margemCol).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                <td style="padding:10px; font-weight:bold;">${tp.material_ncm || '-'}</td>
            </tr>
        `;
    };

    window.adicionarMaterialSimulacaoV3 = function() {
        const selectConsulta = document.getElementById('plestv3-consulta-material');
        if (!selectConsulta) return;
        const matId = parseInt(selectConsulta.value);
        if (!matId) {
            _apexNotify('Aviso', 'Selecione um material primeiro no seletor de consulta.', 'warning');
            return;
        }

        let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (!tp) {
            const materialNome = document.querySelector(`#plestv3-consulta-material option[value="${matId}"]`)?.textContent || 'Produto sem preço';
            tp = { material_id: matId, material_nome: materialNome, preco_venda: 0, preco_compra: 0 };
        }

        if (_mixSimulacaoV3.some(x => x.material_id === matId)) {
            _apexNotify('Aviso', 'Este produto já está incluído no mix de simulação.', 'warning');
            return;
        }

        // Adiciona com fração padrão dividindo igualmente
        const count = _mixSimulacaoV3.length + 1;
        const defaultFracao = parseFloat((100 / count).toFixed(1));
        _mixSimulacaoV3.push({ material_id: matId, fracaoPct: defaultFracao });

        // Redistribui se for o caso
        let sum = _mixSimulacaoV3.reduce((acc, x) => acc + x.fracaoPct, 0);
        if (Math.abs(sum - 100) > 2) {
            _mixSimulacaoV3.forEach(x => { x.fracaoPct = parseFloat((100 / count).toFixed(1)); });
        }

        window.recalcularSimulacaoV3();
    };

    window.removerMaterialSimulacaoV3 = function(matId) {
        _mixSimulacaoV3 = _mixSimulacaoV3.filter(x => x.material_id !== matId);
        window.recalcularSimulacaoV3();
    };

    window.onChangeFracaoSimulacaoV3 = function(matId, val) {
        const parsed = parseFloat(val) || 0;
        const item = _mixSimulacaoV3.find(x => x.material_id === matId);
        if (item) {
            item.fracaoPct = parsed;
        }

        // Recalcular totais sem travar para dar flexibilidade ao usuário
        let sum = _mixSimulacaoV3.reduce((acc, x) => acc + x.fracaoPct, 0);
        const lblPct = document.getElementById('plestv3-mix-total-pct');
        if (lblPct) {
            lblPct.textContent = `${sum.toFixed(1)}%`;
            lblPct.style.color = Math.abs(sum - 100) < 0.1 ? '#2AD07A' : '#ff4d4d';
        }

        // Recalcula volumes e totais
        window.recalcularSimulacaoV3(false);
    };

    window.recalcularSimulacaoV3 = function(redesenharTabela = true) {
        const inputFat = document.getElementById('plestv3-sim-meta-faturamento');
        const selectFrente = document.getElementById('plestv3-sim-frente');
        const mixTbody = document.getElementById('plestv3-mix-tbody');
        const rankingTbody = document.getElementById('plestv3-ranking-tbody');

        if (!inputFat || !selectFrente || !mixTbody || !rankingTbody) return;

        let valLimpo = inputFat.value.replace(/\./g, '').replace(',', '.');
        const fatTotalAlvo = parseFloat(valLimpo) || 0;
        const frente = selectFrente.value; // 'venda' ou 'compra'

        // 1. Renderizar o ranking de melhores margens
        const listPrecosSorted = [..._listTabelaPrecosEstrategica].map(tp => {
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);
            const totalDedPct = comissao + pisCofins + fidc + icms;
            const valDeducoes = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) * (totalDedPct / 100);
            const vendaLiquida = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) - valDeducoes;

            const lucroEnt = vendaLiquida - (parseFloat(tp.preco_entregar || tp.preco_compra || 0));
            const margemEnt = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroEnt / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

            const lucroCol = vendaLiquida - (parseFloat(tp.preco_coletar || tp.preco_compra || 0)) - freteColeta;
            const margemCol = (parseFloat(tp.preco_venda || tp.venda_ref || 0)) > 0 ? (lucroCol / (parseFloat(tp.preco_venda || tp.venda_ref || 0))) * 100 : 0;

            return {
                nome: tp.material_nome,
                margemEnt,
                margemCol
            };
        }).sort((a, b) => Math.max(b.margemEnt, b.margemCol) - Math.max(a.margemEnt, a.margemCol));

        rankingTbody.innerHTML = listPrecosSorted.slice(0, 10).map((x, idx) => `
            <tr style="border-bottom:1px solid #1a2e3f;">
                <td style="padding:6px 4px; color:#fff;"><strong>#${idx+1}</strong> ${x.nome}</td>
                <td style="padding:6px 4px; text-align:right; color:#2AD07A; font-weight:bold;">${x.margemEnt.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                <td style="padding:6px 4px; text-align:right; color:#3e7cb1; font-weight:bold;">${x.margemCol.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
            </tr>
        `).join('');

        // 2. Renderizar e Calcular Mix de Simulação
        if (redesenharTabela) {
            mixTbody.innerHTML = '';
        }

        let totalKgCalculado = 0;
        let totalPctAlocado = 0;
        let totalInvestimentoNecessario = 0;

        _mixSimulacaoV3.forEach((mixItem) => {
            let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === mixItem.material_id);
            if (!tp) {
                const materialNome = document.querySelector(`#plestv3-consulta-material option[value="${mixItem.material_id}"]`)?.textContent || 'Produto Indefinido';
                tp = { material_id: mixItem.material_id, material_nome: materialNome, preco_venda: 0, preco_compra: 0 };
            }

            const faturamentoAlvoProduto = fatTotalAlvo * (mixItem.fracaoPct / 100);

            // Preço de venda (referência para calcular volume)
            const pRef = frente === 'venda'
                ? parseFloat(tp.preco_venda || tp.venda_ref || 0)
                : parseFloat(tp.preco_entregar || tp.preco_compra || 0);

            // Preço de compra (quanto investe para adquirir o material)
            const pCompra = frente === 'venda'
                ? parseFloat(tp.preco_entregar || tp.preco_compra || 0)
                : parseFloat(tp.preco_coletar || tp.preco_compra || 0);

            // Volume necessário em kg (baseado no preço de venda)
            const volumeKg = pRef > 0 ? (faturamentoAlvoProduto / pRef) : 0;

            // Investimento necessário para comprar essa quantidade
            const investimentoProduto = volumeKg * pCompra;

            totalKgCalculado += volumeKg;
            totalPctAlocado += mixItem.fracaoPct;
            totalInvestimentoNecessario += investimentoProduto;

            if (redesenharTabela) {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #223547';
                tr.innerHTML = `
                    <td style="padding:6px 4px; color:#fff;"><strong>${tp.material_nome}</strong></td>
                    <td style="padding:6px 4px; text-align:center;">
                        <input type="number" class="noble-input" value="${mixItem.fracaoPct}" style="width:70px; text-align:center; padding:3px; font-size:0.75rem; margin:0;" oninput="window.onChangeFracaoSimulacaoV3(${mixItem.material_id}, this.value)">
                    </td>
                    <td style="padding:6px 4px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${faturamentoAlvoProduto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding:6px 4px; text-align:right; color:#ccc;">R$ ${window.fmtBRL(pRef)}</td>
                    <td style="padding:6px 4px; text-align:right; font-weight:bold; color:#2AD07A;" id="plestv3-mix-kg-${mixItem.material_id}">
                        ${volumeKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})} kg
                    </td>
                    <td style="padding:6px 4px; text-align:right; color:#ffb74d;" id="plestv3-mix-pcompra-${mixItem.material_id}">R$ ${window.fmtBRL(pCompra)}</td>
                    <td style="padding:6px 4px; text-align:right; font-weight:bold; color:#ff9800;" id="plestv3-mix-invest-${mixItem.material_id}">
                        R$ ${investimentoProduto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td style="padding:6px 4px; text-align:center;">
                        <button onclick="window.removerMaterialSimulacaoV3(${mixItem.material_id})" style="background:none; border:none; color:#ff6b6b; cursor:pointer;" title="Remover"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                mixTbody.appendChild(tr);
            } else {
                // Atualização dinâmica sem redesenhar toda a tabela
                const lblKg = document.getElementById(`plestv3-mix-kg-${mixItem.material_id}`);
                if (lblKg) lblKg.textContent = `${volumeKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})} kg`;
                const lblInvest = document.getElementById(`plestv3-mix-invest-${mixItem.material_id}`);
                if (lblInvest) lblInvest.textContent = `R$ ${investimentoProduto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            }
        });

        if (_mixSimulacaoV3.length === 0) {
            mixTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:15px; color:#aaa;">Nenhum produto adicionado ao mix. Selecione acima e clique em "Adicionar ao Mix".</td></tr>`;
        }

        // 3. Atualizar rodapés (tfoot com Totais e Médias), totais e indicadores estratégicos
        const lblPct    = document.getElementById('plestv3-mix-total-pct');
        const lblKg     = document.getElementById('plestv3-mix-total-kg');
        const lblInvest = document.getElementById('plestv3-mix-total-investimento');
        const lblFeed   = document.getElementById('plestv3-mix-feedback');

        const countItems = _mixSimulacaoV3.length || 1;
        let totalVendaLiquidaCalculada = 0;

        _mixSimulacaoV3.forEach((mixItem) => {
            let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === mixItem.material_id);
            if (!tp) tp = { preco_venda: 0, preco_compra: 0 };
            const faturamentoAlvoProduto = fatTotalAlvo * (mixItem.fracaoPct / 100);
            const pRef = frente === 'venda'
                ? parseFloat(tp.preco_venda || tp.venda_ref || 0)
                : parseFloat(tp.preco_entregar || tp.preco_compra || 0);
            const volumeKg = pRef > 0 ? (faturamentoAlvoProduto / pRef) : 0;
            
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);
            const totalDedPct = comissao + pisCofins + fidc + icms;
            const valDeducoesUnit = pRef * (totalDedPct / 100);
            const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);
            
            totalVendaLiquidaCalculada += (volumeKg * vendaLiquidaUnit);
        });

        const pVendaMedioPonderado = totalKgCalculado > 0 ? (fatTotalAlvo / totalKgCalculado) : 0;
        const pCompraMedioPonderado = totalKgCalculado > 0 ? (totalInvestimentoNecessario / totalKgCalculado) : 0;

        const medFracaoPct = totalPctAlocado / countItems;
        const medFatAlvo = fatTotalAlvo / countItems;
        const medVolKg = totalKgCalculado / countItems;
        const medInvestimento = totalInvestimentoNecessario / countItems;

        const lucroBruto = fatTotalAlvo - totalInvestimentoNecessario;
        const margemBrutaPct = fatTotalAlvo > 0 ? (lucroBruto / fatTotalAlvo) * 100 : 0;

        const lucroLiquido = totalVendaLiquidaCalculada - totalInvestimentoNecessario;
        const margemLiquidaPct = fatTotalAlvo > 0 ? (lucroLiquido / fatTotalAlvo) * 100 : 0;

        const taxaVendaLiquida = fatTotalAlvo > 0 ? (totalVendaLiquidaCalculada / fatTotalAlvo) : 1;
        const pontoEquilibrioFat = taxaVendaLiquida > 0 ? (totalInvestimentoNecessario / taxaVendaLiquida) : totalInvestimentoNecessario;
        const pontoEquilibrioKg = pVendaMedioPonderado > 0 ? (pontoEquilibrioFat / pVendaMedioPonderado) : 0;

        if (lblPct) {
            lblPct.textContent = `${totalPctAlocado.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;
            lblPct.style.color = Math.abs(totalPctAlocado - 100) < 0.1 ? '#2AD07A' : '#ff4d4d';
        }
        if (lblKg) {
            lblKg.textContent = `${totalKgCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})} kg`;
        }
        if (lblInvest) {
            lblInvest.textContent = `R$ ${totalInvestimentoNecessario.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        // Atualizar TFOOT - Linha de TOTAIS
        const ftTotPct = document.getElementById('plestv3-tfoot-tot-pct');
        const ftTotFat = document.getElementById('plestv3-tfoot-tot-fat');
        const ftTotPVenda = document.getElementById('plestv3-tfoot-tot-pvenda');
        const ftTotVol = document.getElementById('plestv3-tfoot-tot-vol');
        const ftTotPCompra = document.getElementById('plestv3-tfoot-tot-pcompra');
        const ftTotInvest = document.getElementById('plestv3-tfoot-tot-invest');

        if (ftTotPct) ftTotPct.textContent = `${totalPctAlocado.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
        if (ftTotFat) ftTotFat.textContent = `R$ ${fatTotalAlvo.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        if (ftTotPVenda) ftTotPVenda.textContent = '—';
        if (ftTotVol) ftTotVol.textContent = `${totalKgCalculado.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})} kg`;
        if (ftTotPCompra) ftTotPCompra.textContent = '—';
        if (ftTotInvest) ftTotInvest.textContent = `R$ ${totalInvestimentoNecessario.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // Atualizar TFOOT - Linha de MÉDIAS
        const ftMedPct = document.getElementById('plestv3-tfoot-med-pct');
        const ftMedFat = document.getElementById('plestv3-tfoot-med-fat');
        const ftMedPVenda = document.getElementById('plestv3-tfoot-med-pvenda');
        const ftMedVol = document.getElementById('plestv3-tfoot-med-vol');
        const ftMedPCompra = document.getElementById('plestv3-tfoot-med-pcompra');
        const ftMedInvest = document.getElementById('plestv3-tfoot-med-invest');

        if (ftMedPct) ftMedPct.textContent = `${medFracaoPct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
        if (ftMedFat) ftMedFat.textContent = `R$ ${medFatAlvo.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        if (ftMedPVenda) ftMedPVenda.textContent = `R$ ${window.fmtBRL(pVendaMedioPonderado)}`;
        if (ftMedVol) ftMedVol.textContent = `${medVolKg.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})} kg`;
        if (ftMedPCompra) ftMedPCompra.textContent = `R$ ${window.fmtBRL(pCompraMedioPonderado)}`;
        if (ftMedInvest) ftMedInvest.textContent = `R$ ${medInvestimento.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // Atualizar Card de Indicadores (Margem Bruta, Margem Líquida, Ponto de Equilíbrio)
        const indBruta = document.getElementById('plestv3-ind-margem-bruta');
        const indLiquida = document.getElementById('plestv3-ind-margem-liquida');
        const indEquilibrio = document.getElementById('plestv3-ind-ponto-equilibrio');

        if (indBruta) indBruta.textContent = `R$ ${lucroBruto.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} (${margemBrutaPct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%)`;
        if (indLiquida) indLiquida.textContent = `R$ ${lucroLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} (${margemLiquidaPct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%)`;
        if (indEquilibrio) indEquilibrio.textContent = `R$ ${pontoEquilibrioFat.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} (${pontoEquilibrioKg.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})} kg)`;

        // Feedback visual de alocação
        if (lblFeed && _mixSimulacaoV3.length > 0) {
            lblFeed.style.display = 'block';
            const diff = totalPctAlocado - 100;
            if (Math.abs(diff) < 0.1) {
                lblFeed.style.background = 'rgba(42, 208, 122, 0.12)';
                lblFeed.style.border = '1px solid rgba(42, 208, 122, 0.4)';
                lblFeed.style.color = '#2AD07A';
                lblFeed.innerHTML = `✅ Mix 100% alocado! Para atingir sua meta de <strong>R$ ${fatTotalAlvo.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>, você precisa investir <strong>R$ ${totalInvestimentoNecessario.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong> em compras e adquirir <strong>${totalKgCalculado.toLocaleString('pt-BR', {minimumFractionDigits:1})} kg</strong> de material.`;
            } else if (diff < 0) {
                lblFeed.style.background = 'rgba(255, 184, 0, 0.1)';
                lblFeed.style.border = '1px solid rgba(255, 184, 0, 0.4)';
                lblFeed.style.color = '#ffb74d';
                const faltando = fatTotalAlvo * (Math.abs(diff) / 100);
                lblFeed.innerHTML = `⚠️ ï¸ Ainda faltam <strong>${Math.abs(diff).toLocaleString('pt-BR', {minimumFractionDigits:1})}%</strong> para atingir 100% do mix — equivale a <strong>R$ ${faltando.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong> de faturamento não coberto. Adicione mais produtos.`;
            } else {
                lblFeed.style.background = 'rgba(255, 77, 77, 0.1)';
                lblFeed.style.border = '1px solid rgba(255, 77, 77, 0.4)';
                lblFeed.style.color = '#ff4d4d';
                lblFeed.innerHTML = `❌ Mix ultrapassou 100% em <strong>${diff.toLocaleString('pt-BR', {minimumFractionDigits:1})}%</strong>. Reduza as frações para não exceder a meta.`;
            }
        } else if (lblFeed) {
            lblFeed.style.display = 'none';
        }
    };

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  CICLOS DE SIMULAÇÃO V3 — Salvar / Lançar Resultado Real
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // Storage key específico para ciclos desta empresa/usuário
    const _CICLOS_KEY = 'apextech_ciclos_simulacao_v3';

    function _getCiclos() {
        try { return JSON.parse(localStorage.getItem(_CICLOS_KEY) || '[]'); } catch { return []; }
    }
    function _saveCiclos(arr) {
        localStorage.setItem(_CICLOS_KEY, JSON.stringify(arr));
    }

    // Sincroniza o campo "Investimento Simulado" com o valor calculado no mix
    function _syncInvestimentoSimuladoCiclo() {
        const el = document.getElementById('plestv3-ciclo-investimento-sim');
        const lblInvest = document.getElementById('plestv3-mix-total-investimento');
        if (el && lblInvest) {
            // Pega o valor numérico do span de total investimento
            const raw = lblInvest.textContent.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
            const val = parseFloat(raw) || 0;
            el.value = val > 0 ? val : '';
        }
    }

    window.salvarCicloSimulacaoV3 = function() {
        const dataInicio = document.getElementById('plestv3-ciclo-data-inicio')?.value;
        const dataFim    = document.getElementById('plestv3-ciclo-data-fim')?.value;
        const metaFatEl  = document.getElementById('plestv3-ciclo-meta-fat');
        let   metaFat    = parseFloat(metaFatEl?.value) || 0;

        // Se não informou meta manual, usa o faturamento alvo configurado na simulação
        if (!metaFat) {
            const elFat = document.getElementById('plestv3-fat-alvo');
            metaFat = parseFloat(elFat?.value) || 0;
        }

        if (!dataInicio || !dataFim) {
            (window._apexNotify ? window._apexNotify('Notificação', 'Informe a Data de Início e a Data de Fim do ciclo.', 'info') : alert('Informe a Data de Início e a Data de Fim do ciclo.'));
            return;
        }
        if (new Date(dataFim) < new Date(dataInicio)) {
            (window._apexNotify ? window._apexNotify('Notificação', 'A Data de Fim deve ser posterior à Data de Início.', 'info') : alert('A Data de Fim deve ser posterior à Data de Início.'));
            return;
        }
        if (!metaFat || metaFat <= 0) {
            (window._apexNotify ? window._apexNotify('Notificação', 'Informe a Meta de Faturamento do ciclo.', 'info') : alert('Informe a Meta de Faturamento do ciclo.'));
            return;
        }

        _syncInvestimentoSimuladoCiclo();
        const investSimulado = parseFloat(document.getElementById('plestv3-ciclo-investimento-sim')?.value) || 0;

        // Capturar snapshot do mix atual
        const mixSnapshot = _mixSimulacaoV3.map(item => {
            const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === item.material_id);
            return { material_id: item.material_id, nome: tp?.material_nome || `ID ${item.material_id}`, fracaoPct: item.fracaoPct };
        });

        const ciclo = {
            id: Date.now(),
            dataInicio,
            dataFim,
            metaFaturamento: metaFat,
            investimentoSimulado: investSimulado,
            mixSnapshot,
            frente: document.getElementById('plestv3-frente')?.value || 'venda',
            // Resultado real (preenchido posteriormente)
            fatReal: null,
            investReal: null,
            volumeReal: null,
            obs: '',
            status: 'simulado' // 'simulado' | 'realizado'
        };

        const ciclos = _getCiclos();
        ciclos.unshift(ciclo); // mais recente primeiro
        _saveCiclos(ciclos);

        // Feedback visual
        const nota = document.getElementById('plestv3-ciclo-nota-salvo');
        if (nota) nota.style.display = 'block';

        _renderizarCiclosV3();
        const msg = `✅ Ciclo salvo! Período: ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}\nMeta: R$ ${metaFat.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        window._apexNotify ? window._apexNotify('Notificação', msg, 'info') : alert(msg);
    };

    window.abrirModalResultadoRealV3 = function(cicloId) {
        const modal = document.getElementById('modal-resultado-real-v3');
        if (!modal) return;

        // Se veio com ID específico, usa ele; senão pega o primeiro ciclo simulado
        let id = cicloId;
        if (!id) {
            const ciclos = _getCiclos();
            const pendente = ciclos.find(c => c.status === 'simulado');
            if (!pendente) { (window._apexNotify ? window._apexNotify('Notificação', 'Nenhum ciclo simulado pendente. Salve primeiro uma simulação.', 'info') : alert('Nenhum ciclo simulado pendente. Salve primeiro uma simulação.')); return; }
            id = pendente.id;
        }

        document.getElementById('modal-rr-ciclo-id').value = id;
        document.getElementById('modal-rr-fat-real').value = '';
        document.getElementById('modal-rr-invest-real').value = '';
        document.getElementById('modal-rr-volume-real').value = '';
        document.getElementById('modal-rr-obs').value = '';
        modal.style.display = 'flex';
    };

    window.fecharModalResultadoRealV3 = function() {
        const modal = document.getElementById('modal-resultado-real-v3');
        if (modal) modal.style.display = 'none';
    };

    window.confirmarResultadoRealV3 = function() {
        const cicloId  = parseInt(document.getElementById('modal-rr-ciclo-id')?.value);
        const fatReal  = parseFloat(document.getElementById('modal-rr-fat-real')?.value);
        const invReal  = parseFloat(document.getElementById('modal-rr-invest-real')?.value);
        const volReal  = parseFloat(document.getElementById('modal-rr-volume-real')?.value) || null;
        const obs      = document.getElementById('modal-rr-obs')?.value?.trim() || '';

        if (!fatReal || fatReal <= 0) { (window._apexNotify ? window._apexNotify('Notificação', 'Informe o Faturamento Real alcançado.', 'info') : alert('Informe o Faturamento Real alcançado.')); return; }
        if (!invReal || invReal <= 0) { (window._apexNotify ? window._apexNotify('Notificação', 'Informe o Investimento Real realizado em compras.', 'info') : alert('Informe o Investimento Real realizado em compras.')); return; }

        const ciclos = _getCiclos();
        const idx = ciclos.findIndex(c => c.id === cicloId);
        if (idx < 0) { (window._apexNotify ? window._apexNotify('Notificação', 'Ciclo não encontrado.', 'info') : alert('Ciclo não encontrado.')); return; }

        ciclos[idx].fatReal      = fatReal;
        ciclos[idx].investReal   = invReal;
        ciclos[idx].volumeReal   = volReal;
        ciclos[idx].obs          = obs;
        ciclos[idx].status       = 'realizado';
        _saveCiclos(ciclos);

        window.fecharModalResultadoRealV3();
        _renderizarCiclosV3();
    };

    window.excluirCicloV3 = function(cicloId) {
        if (!confirm('Excluir este ciclo? Esta ação não pode ser desfeita.')) return;
        const ciclos = _getCiclos().filter(c => c.id !== cicloId);
        _saveCiclos(ciclos);
        _renderizarCiclosV3();
    };

    function _renderizarCiclosV3() {
        const tbody = document.getElementById('plestv3-ciclos-tbody');
        if (!tbody) return;

        const ciclos = _getCiclos();
        if (ciclos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:18px; color:#aaa;">Nenhum ciclo salvo ainda. Configure o período e salve sua simulação.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        ciclos.forEach(c => {
            const fmtData = d => {
                try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; }
            };
            const periodo = `${fmtData(c.dataInicio)} → ${fmtData(c.dataFim)}`;
            const mixNomes = (c.mixSnapshot || []).map(m => `${m.nome} (${m.fracaoPct.toLocaleString('pt-BR', {maximumFractionDigits:1})}%)`).join(', ') || '—';

            let atingimentoHTML = '—';
            let statusHTML = `<span style="color:#ffb74d; font-weight:bold;"><i class="fa-solid fa-clock"></i> Pendente</span>`;

            if (c.status === 'realizado' && c.fatReal != null) {
                const pct = c.metaFaturamento > 0 ? (c.fatReal / c.metaFaturamento) * 100 : 0;
                const cor = pct >= 100 ? '#2AD07A' : pct >= 80 ? '#ffb74d' : '#ff4d4d';
                const icone = pct >= 100 ? '✅' : pct >= 80 ? '⚠️ ï¸' : '❌';
                atingimentoHTML = `<span style="color:${cor}; font-weight:bold;">${icone} ${pct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%</span>`;
                statusHTML = `<span style="color:${cor}; font-weight:bold;"><i class="fa-solid fa-flag-checkered"></i> Realizado</span>`;
            }

            const fatRealStr  = c.fatReal   != null ? `R$ ${c.fatReal.toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '—';
            const invRealStr  = c.investReal != null ? `R$ ${c.investReal.toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '—';

            const acaoReal = c.status === 'simulado'
                ? `<button onclick="window.abrirModalResultadoRealV3(${c.id})" title="Lançar Resultado Real" style="background:rgba(42,208,122,0.12); border:1px solid #2AD07A; color:#2AD07A; border-radius:4px; padding:3px 8px; cursor:pointer; font-size:0.78rem; margin-right:4px;"><i class="fa-solid fa-flag-checkered"></i> Real</button>`
                : '';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #223547';
            tr.innerHTML = `
                <td style="padding:7px 10px; color:#ccc; white-space:nowrap; font-size:0.8rem;">${periodo}</td>
                <td style="padding:7px 10px; color:#aaa; font-size:0.76rem; max-width:180px; overflow:hidden; text-overflow:ellipsis;" title="${mixNomes}">${mixNomes}</td>
                <td style="padding:7px 10px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${(c.metaFaturamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:7px 10px; text-align:right; color:#ff9800;">R$ ${(c.investimentoSimulado||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:7px 10px; text-align:right; color:#2AD07A;">${fatRealStr}</td>
                <td style="padding:7px 10px; text-align:right; color:#aaa;">${invRealStr}</td>
                <td style="padding:7px 10px; text-align:center;">${atingimentoHTML}</td>
                <td style="padding:7px 10px; text-align:center;">${statusHTML}</td>
                <td style="padding:7px 10px; text-align:center; white-space:nowrap;">
                    ${acaoReal}
                    <button onclick="window.excluirCicloV3(${c.id})" title="Excluir" style="background:none; border:none; color:#ff6b6b; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Inicializar ciclos ao carregar a seção
    function _initCiclosV3() {
        _syncInvestimentoSimuladoCiclo();
        _renderizarCiclosV3();
        // Pré-preenche datas com mês corrente
        const hoje = new Date();
        const dInicio = document.getElementById('plestv3-ciclo-data-inicio');
        const dFim    = document.getElementById('plestv3-ciclo-data-fim');
        if (dInicio && !dInicio.value) {
            dInicio.value = hoje.toISOString().slice(0, 7) + '-01';
        }
        if (dFim && !dFim.value) {
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            dFim.value = ultimoDia.toISOString().slice(0, 10);
        }
    }

    window.detalharMesEstrategicov3 = function(mes) {
        _mesV3Ativo = mes;
        const divDet = document.getElementById('plestv3-view-detalhes-mes');
        if (divDet) divDet.style.display = 'block';
        
        const textAtivo = document.getElementById('plestv3-txt-mes-ativo');
        if (textAtivo) {
            textAtivo.innerHTML = `<i class="fa-solid fa-calendar-days" style="color:#00e5ff;"></i> Planejamento Estratégico V3 — ${formatarMesAnoLabel(mes)}`;
        }
        
        const selectProd = document.getElementById('plestv3-select-produto');
        if (selectProd && !selectProd.value && _listTabelaPrecosEstrategica.length > 0) {
            selectProd.value = _listTabelaPrecosEstrategica[0].material_id;
        }

        renderDashboardEstrategov3();
    };

    window.onSelectProdutoEstrategicov3 = function() {
        if (_mesV3Ativo) renderDashboardEstrategov3();
    };

    function renderDashboardEstrategov3() {
        if (!_mesV3Ativo) return;
        const mes = _mesV3Ativo;
        const targetMatId = parseInt(document.getElementById('plestv3-select-produto').value) || null;

        const metasMes = _listMetasV3.filter(m => m.mes === mes);

        // Agregadores para o Dashboard
        let totalFaturamentoProjetado = 0;
        let totalFaturamentoReal = 0;
        let totalReservaCompra = 0;
        let totalMetaCompra = 0;
        let totalRealizado = 0;
        let totalCustoReal = 0;
        let count = 0;
        let somaMargemProj = 0;

        const tableBody = document.getElementById('plestv3-geral-table-body');
        if (tableBody) tableBody.innerHTML = '';

        _listTabelaPrecosEstrategica.forEach(tp => {
            const meta = metasMes.find(m => m.material_id === tp.material_id);
            if (meta || tp.material_id === targetMatId) {
                const mFat = meta ? parseFloat(meta.meta_faturamento || 0) : 0;
                const mMargem = meta ? parseFloat(meta.margem_desejada || 0) : 0;
                const op = meta ? meta.operacao : 'entrega';
                const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;
                const valVendaReal = meta ? parseFloat(meta.valor_venda_realizado || 0) : 0;

                const pInsumo = op === 'retirada' 
                    ? parseFloat(tp.preco_coletar || tp.preco_compra || 0)
                    : parseFloat(tp.preco_entregar || tp.preco_coletar || 0);
                const pVenda = parseFloat(tp.preco_venda || tp.venda_ref || 0);

                const tetoCusto = mFat * (1 - mMargem/100);
                const qPlan = pInsumo > 0 ? (tetoCusto / pInsumo) : 0;

                const fatProj = mFat;
                const fatReal = valVendaReal > 0 ? valVendaReal : (qReal * pVenda);
                const custoReal = qReal * pInsumo;

                totalFaturamentoProjetado += fatProj;
                totalFaturamentoReal += fatReal;
                totalReservaCompra += tetoCusto;
                totalMetaCompra += qPlan;
                totalRealizado += qReal;
                totalCustoReal += custoReal;

                if (mFat > 0) {
                    somaMargemProj += mMargem;
                    count++;
                }

                const atingimentoPct = qPlan > 0 ? (qReal / qPlan) * 100 : 0;
                const saldo = qPlan - qReal;

                // Detectar prejuízo (se o preço de venda da tabela for menor que o de insumo)
                const isPrejuizo = (pVenda - pInsumo) < 0;

                if (tableBody && meta) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding:8px;">
                            <strong>${tp.material_nome}</strong>
                            ${isPrejuizo ? '<span style="background:#ff4d4d; color:#fff; font-size:0.65rem; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">PREJUÍZO</span>' : ''}
                        </td>
                        <td style="padding:8px; text-align:center; text-transform:capitalize; color:#aaa;">${op}</td>
                        <td style="padding:8px; text-align:right; color:#00e5ff; font-weight:bold;">R$ ${mFat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px; text-align:center; font-weight:bold; color:#3e7cb1;">${mMargem.toLocaleString('pt-BR',{minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                        <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${tetoCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                        <td style="padding:8px; text-align:right; color:#aaa;">R$ ${window.fmtBRL(pInsumo)}</td>
                        <td style="padding:8px; text-align:right; font-weight:bold;">${qPlan.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</td>
                        <td style="padding:8px; text-align:right; color:#fff;">${qReal.toLocaleString('pt-BR',{minimumFractionDigits:1})} kg</td>
                        <td style="padding:8px; text-align:center; font-weight:bold; color:${atingimentoPct >= 100 ? '#2AD07A' : '#ffb74d'};">${atingimentoPct.toLocaleString('pt-BR',{minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                        <td style="padding:8px; text-align:center; font-weight:bold; color:${atingimentoPct >= 100 ? '#2AD07A' : '#ffb74d'};">${atingimentoPct >= 100 ? 'CONCLUÍDO' : 'PENDENTE'}</td>
                        <td style="padding:8px; text-align:center;">
                            <button onclick="editarMetaEstrategicav3Rapido(${tp.material_id}, '${mes}', ${mFat}, ${mMargem}, '${op}', ${qReal}, ${valVendaReal})" class="btn-primary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#00e5ff; color:#0d1826;" title="Editar"><i class="fa-solid fa-edit"></i></button>
                            <button onclick="deletarMetaEstrategicav3(${meta.id})" style="background:none; border:none; color:#ff6b6b; margin-left:8px; cursor:pointer;" title="Remover Meta"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                }
            }
        });

        if (tableBody && tableBody.children.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:20px; color:#aaa;">Nenhuma meta cadastrada para este mês. Clique em "Configurar Meta do Mês" no topo para planejar.</td></tr>`;
        }

        // Renderizar Cards de KPIs do topo V3
        const margemBrutaPonderada = totalFaturamentoReal > 0 
            ? ((totalFaturamentoReal - totalCustoReal) / totalFaturamentoReal) * 100
            : (count > 0 ? (somaMargemProj / count) : 0);

        const eficienciaVendas = totalFaturamentoProjetado > 0 ? (totalFaturamentoReal / totalFaturamentoProjetado) * 100 : 0;

        document.getElementById('estv3-kpi-fat-projetado').textContent = 'R$ ' + totalFaturamentoProjetado.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('estv3-kpi-fat-real').textContent = 'R$ ' + totalFaturamentoReal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('estv3-kpi-reserva').textContent = 'R$ ' + totalReservaCompra.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('estv3-kpi-margem-bruta').textContent = margemBrutaPonderada.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';
        document.getElementById('estv3-kpi-meta-compra').textContent = totalMetaCompra.toLocaleString('pt-BR', {minimumFractionDigits:1}) + ' kg';
        document.getElementById('estv3-kpi-eficiencia').textContent = eficienciaVendas.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';

        // Detalhes do produto reativo ativo
        renderDetalhesProdutoSelecionadov3(targetMatId, mes);

        // Atualizar insights textuais
        gerarInsightsIAEstrategicosv3(metasMes);
    }

    function renderDetalhesProdutoSelecionadov3(matId, mes) {
        const container = document.getElementById('plestv3-produto-detalhes-container');
        const cenBody = document.getElementById('plestv3-cenarios-tbody');
        const prBody = document.getElementById('plestv3-planejado-realizado-tbody');
        if (!container || !cenBody || !prBody) return;

        const preco = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        const meta = _listMetasV3.find(m => m.material_id === matId && m.mes === mes);

        if (!preco) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:15px; color:#aaa; font-size:0.85rem;">Selecione um produto acima para calcular faturamento, custos e volumes consolidados.</div>`;
            cenBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto.</td></tr>`;
            prBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Selecione um produto.</td></tr>`;
            if (_chartEstrategicoV3) { _chartEstrategicoV3.destroy(); _chartEstrategicoV3 = null; }
            return;
        }

        const op = meta ? meta.operacao : 'entrega';
        const pInsumo = op === 'retirada' 
            ? parseFloat(preco.preco_coletar || preco.preco_compra || 0)
            : parseFloat(preco.preco_entregar || preco.preco_coletar || 0);
        const pVenda = parseFloat(preco.preco_venda || preco.venda_ref || 0);

        const metaFatVal = meta ? parseFloat(meta.meta_faturamento || 0) : 100000; // default para simular se vazio
        const margemDesejadaVal = meta ? parseFloat(meta.margem_desejada || 0) : 40;
        const qReal = meta ? parseFloat(meta.qtd_realizado || 0) : 0;
        const valVendaReal = meta ? parseFloat(meta.valor_venda_realizado || 0) : 0;

        const tetoCusto = metaFatVal * (1 - margemDesejadaVal/100);
        const qPlan = pInsumo > 0 ? (tetoCusto / pInsumo) : 0;

        container.innerHTML = `
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Operação ativa</small>
                <div style="font-weight:bold; color:#00e5ff; margin-top:2px; text-transform:capitalize;">${op}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Preço Insumo</small>
                <div style="font-weight:bold; color:#ffb74d; margin-top:2px;">R$ ${window.fmtBRL(pInsumo)}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Faturamento Alvo</small>
                <div style="font-weight:bold; color:#2AD07A; margin-top:2px;">R$ ${metaFatVal.toLocaleString('pt-BR')}</div>
            </div>
            <div style="text-align:center; padding:8px; background:#101a24; border-radius:8px; border:1px solid #1e4e8c;">
                <small style="color:#aaa; font-size:0.75rem;">Qtd Planejada</small>
                <div style="font-weight:bold; color:#fff; margin-top:2px;">${qPlan.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg</div>
            </div>
        `;

        // Cenários de Projeção (Conservador 80% / Moderado 100% / Agressivo 120%)
        const fillCenarioRow = (nome, pct, cor) => {
            const fat = metaFatVal * (pct / 100);
            const custo = fat * (1 - margemDesejadaVal/100);
            const volume = pInsumo > 0 ? (custo / pInsumo) : 0;
            return `
                <tr>
                    <td style="padding:8px; font-weight:bold; color:${cor};">${nome} (${pct}%)</td>
                    <td style="padding:8px; text-align:right; color:#fff;">R$ ${fat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:center; color:#3e7cb1;">${margemDesejadaVal.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                    <td style="padding:8px; text-align:right; color:#ffb74d;">R$ ${custo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#fff;">${volume.toLocaleString('pt-BR',{maximumFractionDigits:1})} kg</td>
                </tr>
            `;
        };

        cenBody.innerHTML = `
            ${fillCenarioRow('Conservador', 80, '#ffeb3b')}
            ${fillCenarioRow('Moderado (Alvo)', 100, '#00e5ff')}
            ${fillCenarioRow('Agressivo', 120, '#ff4d4d')}
        `;

        // Comparativo Planejado vs Realizado
        const fatReal = valVendaReal > 0 ? valVendaReal : (qReal * pVenda);
        const custoPlan = tetoCusto;
        const custoReal = qReal * pInsumo;
        const lucroPlan = metaFatVal - custoPlan;
        const lucroReal = fatReal - custoReal;

        const compRowV3 = (nome, planVal, realVal, unit, isMoney) => {
            const diff = planVal - realVal;
            const pct = planVal > 0 ? (realVal / planVal) * 100 : 0;
            const fmt = (v) => isMoney ? 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2}) : v.toLocaleString('pt-BR') + ' ' + unit;
            return `
                <tr>
                    <td style="padding:8px; font-weight:600; color:#fff;">${nome}</td>
                    <td style="padding:8px; text-align:right; color:#aaa;">${fmt(planVal)}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#fff;">${fmt(realVal)}</td>
                    <td style="padding:8px; text-align:right; color:${diff <= 0 ? '#2AD07A' : '#ff4d4d'};">${diff <= 0 ? 'Meta Atingida' : fmt(diff) + ' restante'}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:${pct >= 100 ? '#2AD07A' : (pct >= 80 ? '#ffb74d' : '#ff4d4d')};">${pct.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                </tr>
            `;
        };

        prBody.innerHTML = `
            ${compRowV3('Meta de Faturamento (Venda)', metaFatVal, fatReal, '', true)}
            ${compRowV3('Reserva de Compra (Investimento)', custoPlan, custoReal, '', true)}
            ${compRowV3('Volume Necessário (Compra)', qPlan, qReal, 'kg', false)}
            ${compRowV3('Lucro Projetado', lucroPlan, lucroReal, '', true)}
        `;

        // Renderizar gráfico reativo do atingimento V3
        const consVol = pInsumo > 0 ? ((metaFatVal * 0.8 * (1 - margemDesejadaVal/100)) / pInsumo) : 0;
        const agrVol = pInsumo > 0 ? ((metaFatVal * 1.2 * (1 - margemDesejadaVal/100)) / pInsumo) : 0;

        renderGraficoCenariosEstrategicosv3(consVol, qPlan, agrVol, qReal, preco.material_nome);
    }

    function renderGraficoCenariosEstrategicosv3(cons, mod, agr, real, produtoNome) {
        const ctx = document.getElementById('plestv3-chart-cenarios');
        if (!ctx) return;

        if (_chartEstrategicoV3) {
            _chartEstrategicoV3.destroy();
        }

        _chartEstrategicoV3 = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Conservador', 'Moderado', 'Agressivo', 'Realizado'],
                datasets: [{
                    label: 'Volume Insumo (kg) - ' + produtoNome,
                    data: [cons, mod, agr, real],
                    backgroundColor: ['rgba(255, 235, 59, 0.4)', 'rgba(0, 229, 255, 0.4)', 'rgba(255, 77, 77, 0.4)', 'rgba(42, 208, 122, 0.5)'],
                    borderColor: ['#ffeb3b', '#00e5ff', '#ff4d4d', '#2AD07A'],
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8eaabf', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8eaabf', font: { size: 9 } } }
                }
            }
        });
    }

    function gerarInsightsIAEstrategicosv3(metasMes) {
        const insightsContainer = document.getElementById('plestv3-ia-insights');
        if (!insightsContainer) return;

        let html = `<ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:6px;">`;

        if (metasMes.length === 0) {
            html += `<li>Defina uma meta de faturamento e margem no botão acima para simular e avaliar os insumos necessários.</li>`;
        } else {
            metasMes.forEach(m => {
                const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === m.material_id);
                if (tp) {
                    const pInsumo = m.operacao === 'retirada' 
                        ? parseFloat(tp.preco_compra_coletar || tp.preco_compra || 0)
                        : parseFloat(tp.preco_compra_entregar || tp.preco_compra_coletar || 0);

                    const metaFat = parseFloat(m.meta_faturamento || 0);
                    const margem = parseFloat(m.margem_desejada || 0);
                    const teto = metaFat * (1 - margem/100);
                    const qPlan = pInsumo > 0 ? (teto / pInsumo) : 0;
                    const real = parseFloat(m.qtd_realizado || 0);

                    if (real >= qPlan && qPlan > 0) {
                        html += `<li>🏆 <strong>Meta Superada</strong>: O insumo <strong>${tp.material_nome}</strong> atingiu 100% da meta de compra com <strong>${real.toLocaleString('pt-BR')} kg</strong> realizados.</li>`;
                    } else if (qPlan > 0) {
                        const falta = qPlan - real;
                        html += `<li>🕒 <strong>Acompanhamento</strong>: Faltam comprar <strong>${falta.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg</strong> de <strong>${tp.material_nome}</strong> para cobrir a meta comercial.</li>`;
                    }
                }
            });
        }

        html += `</ul>`;
        insightsContainer.innerHTML = html;
    }

    window.abrirModalPlanejamentosSalvosV3 = async function() {
        // Remove any existing modal to ensure clean state
        let existing = document.getElementById('modal-estrategiav3-planos');
        if (existing) {
            existing.remove();
        }
        
        let modal = document.createElement('div');
        modal.id = 'modal-estrategiav3-planos';
        // Completely inline CSS to avoid any stylesheet interference
        modal.style.cssText = 'display:flex; align-items:center; justify-content:center; z-index:9999999; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); font-family:sans-serif; backdrop-filter:blur(5px);';
        modal.innerHTML = `
            <div style="width:90%; max-width:900px; max-height:90vh; overflow-y:auto; position:relative; background:#0d1826; border:1px solid #2AD07A; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,1); padding:20px;">
                <button onclick="document.getElementById('modal-estrategiav3-planos').remove()" style="position:absolute; top:15px; right:15px; background:transparent; border:none; color:#ff4d4d; font-size:1.5rem; cursor:pointer; font-weight:bold;">X</button>
                <h2 style="margin:0 0 20px 0; color:#fff; border-bottom:1px solid #1a2e3f; padding-bottom:10px;">Planejamentos Salvos</h2>
                <div id="lista-estrategiav3-planos">
                    <div style="color:#00e5ff; text-align:center; padding:30px; font-size:1.2rem; font-weight:bold;">Sincronizando com o banco de dados...</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const lista = document.getElementById('lista-estrategiav3-planos');

        try {
            const res = await fetch('/api/estrategiav3_planos');
            if (!res.ok) throw new Error('Erro do servidor: ' + res.status);
            const planos = await res.json();
            
            if (!Array.isArray(planos)) throw new Error('A resposta da API não é um array válido.');

            if (planos.length === 0) {
                lista.innerHTML = '<div style="color:#aaa; text-align:center; padding:30px; font-size:1.2rem;">Nenhum planejamento salvo ainda. Você precisa salvar um planejamento primeiro!</div>';
                return;
            }

            lista.innerHTML = planos.map(p => {
                const itensArray = Array.isArray(p.itens) ? p.itens : [];
                return `
                    <div style="background:#162433; border:1px solid #1c2e3d; border-radius:8px; padding:15px; margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                            <div>
                                <h3 style="margin:0; color:#2AD07A; font-size:1.1rem;">${p.titulo || 'Sem Título'}</h3>
                                <small style="color:#aaa;">Período: ${window.fmtD(p.data_inicial)} até ${window.fmtD(p.data_final)}</small>
                            </div>
                            <button onclick="window.gerarPdfEstrategiaV3(${p.id})" style="background:#2AD07A; color:#0d1826; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">GERAR PDF</button>
                        </div>
                        <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:10px;">
                            <div style="background:#0d1826; padding:10px; border-radius:6px; flex:1; min-width:180px;">
                                <span style="display:block; color:#aaa; font-size:0.8rem; margin-bottom:4px;">Estratégia Principal</span>
                                <span style="display:block; color:#fff; font-weight:bold;">${p.frente === 'venda' ? 'Foco em Venda' : 'Foco em Compra'}</span>
                            </div>
                            <div style="background:#0d1826; padding:10px; border-radius:6px; flex:1; min-width:180px;">
                                <span style="display:block; color:#aaa; font-size:0.8rem; margin-bottom:4px;">Objetivo (R$)</span>
                                <span style="display:block; color:#00e5ff; font-weight:bold; font-size:1.1rem;">Meta Total: R$ ${window.fmtBRL(p.meta_faturamento)}</span>
                            </div>
                        </div>
                        <h4 style="margin:0 0 10px 0; color:#fff; font-size:0.9rem; border-bottom:1px solid #1c2e3d; padding-bottom:5px;">Composição do Mix</h4>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:0.8rem; min-width:500px;">
                                <thead>
                                    <tr style="background:#0d1826; color:#aaa; text-align:left;">
                                        <th style="padding:6px;">Produto</th>
                                        <th style="padding:6px; text-align:right;">Fração</th>
                                        <th style="padding:6px; text-align:right;">Meta (R$)</th>
                                        <th style="padding:6px; text-align:right;">Realizado (R$)</th>
                                        <th style="padding:6px; text-align:center;">Progresso</th>
                                        <th style="padding:6px; text-align:center;">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                ${itensArray.map(it => {
                                    const tp = window._listTabelaPrecosEstrategica && window._listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
                                    const mNome = tp ? tp.material_nome : 'Material ' + it.material_id;
                                    const atingidoPct = it.faturamento_alvo > 0 ? ((it.faturamento_realizado / it.faturamento_alvo) * 100) : 0;
                                    return `
                                        <tr style="border-bottom:1px solid #1c2e3d;">
                                            <td style="padding:6px; color:#fff;">${mNome}</td>
                                            <td style="padding:6px; color:#fff; text-align:right;">${it.fracao_pct}%</td>
                                            <td style="padding:6px; color:#2AD07A; text-align:right;">R$ ${window.fmtBRL(it.faturamento_alvo)}</td>
                                            <td style="padding:6px; color:#00e5ff; text-align:right;">
                                                <input type="text" id="plestv3-realizado-${it.id}" value="${window.fmtBRL(it.faturamento_realizado)}" style="width:90px; text-align:right; padding:4px; margin:0; background:#0d1826; color:#fff; border:1px solid #1c2e3d; border-radius:4px;" oninput="window.maskCurrencyV3(this)">
                                            </td>
                                            <td style="padding:6px; text-align:center;">
                                                <div style="background:#162433; border-radius:10px; width:100%; height:8px; position:relative; overflow:hidden;">
                                                    <div style="position:absolute; top:0; left:0; height:100%; width:${Math.min(atingidoPct, 100)}%; background:${atingidoPct >= 100 ? '#2AD07A' : '#00e5ff'};"></div>
                                                </div>
                                                <small style="color:#aaa;">${atingidoPct.toFixed(1)}%</small>
                                            </td>
                                            <td style="padding:6px; text-align:center;">
                                                <button type="button" onclick="window.salvarRealizadoV3(${it.id})" style="background:#00e5ff; color:#0d1826; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.7rem;">Salvar Realizado</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('');
            
            window._planosV3Cache = planos;

        } catch(e) {
            console.error('ERRO ABRIR MODAL:', e);
            (window._apexNotify ? window._apexNotify('Notificação', 'Aviso: ' + e.message, 'info') : alert('Aviso: ' + e.message));
            if (lista) {
                lista.innerHTML = `<div style="color:#ff4d4d; text-align:center; padding: 20px;">
                    <b>Erro ao carregar dados do servidor.</b><br><br>
                    ${e.message}
                </div>`;
            }
        }
    };

    // Modal Handlers V3
    window.abrirModalMetaEstrategicav3 = function() {
        const modal = document.getElementById('modal-meta-estrategicav3');
        if (modal) {
            const mesInput = document.getElementById('metaestv3-mes');
            if (mesInput) {
                if (_mesV3Ativo) {
                    mesInput.value = _mesV3Ativo;
                } else {
                    const today = new Date();
                    mesInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
                }
            }
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        }
    };

    window.fecharModalMetaEstrategicav3 = function() {
        const modal = document.getElementById('modal-meta-estrategicav3');
        if (modal) modal.style.display = 'none';
        document.getElementById('form-meta-estrategicav3').reset();
    };

    window.onSelectModalMaterialv3 = function() {
        const matId = parseInt(document.getElementById('metaestv3-material-id').value);
        const op = document.getElementById('metaestv3-operacao').value;
        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (tp) {
            const comissao = parseFloat(tp.comissao || 0);
            const pisCofins = parseFloat(tp.pis_cofins || 0);
            const fidc = parseFloat(tp.fidc || 0);
            const icms = parseFloat(tp.icms || 0);
            const freteColeta = parseFloat(tp.frete_coleta || 0);

            const totalDedPct = comissao + pisCofins + fidc + icms;
            const vendaRef = parseFloat(tp.preco_venda || tp.venda_ref || 0);
            const valDeducoes = vendaRef * (totalDedPct / 100);
            const vendaLiquida = vendaRef - valDeducoes;

            let margem = 0;
            if (op === 'retirada') {
                const lucroCol = vendaLiquida - (parseFloat(tp.preco_coletar || tp.preco_compra || 0)) - freteColeta;
                margem = vendaRef > 0 ? (lucroCol / vendaRef) * 100 : 0;
            } else {
                const lucroEnt = vendaLiquida - (parseFloat(tp.preco_entregar || tp.preco_compra || 0));
                margem = vendaRef > 0 ? (lucroEnt / vendaRef) * 100 : 0;
            }
            document.getElementById('metaestv3-margem-desejada').value = margem.toFixed(2);
        }
        calcularInsumoModalv3();
    };

    window.calcularInsumoModalv3 = function() {
        const matId = parseInt(document.getElementById('metaestv3-material-id').value);
        const metaFat = parseFloat(document.getElementById('metaestv3-meta-faturamento').value || 0);
        const margem = parseFloat(document.getElementById('metaestv3-margem-desejada').value || 0);
        const op = document.getElementById('metaestv3-operacao').value;

        const lblPreco = document.getElementById('metaestv3-lbl-preco-insumo');
        const lblTeto = document.getElementById('metaestv3-lbl-teto-custo');
        const lblQtd = document.getElementById('metaestv3-lbl-qtd-calculada');

        const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === matId);
        if (tp) {
            const pInsumo = op === 'retirada'
                ? parseFloat(tp.preco_coletar || tp.preco_compra || 0)
                : parseFloat(tp.preco_entregar || tp.preco_coletar || 0);

            const tetoCusto = metaFat * (1 - margem/100);
            const qtdCalculada = pInsumo > 0 ? (tetoCusto / pInsumo) : 0;

            lblPreco.textContent = 'R$ ' + pInsumo.toFixed(2);
            lblTeto.textContent = 'R$ ' + tetoCusto.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            lblQtd.textContent = qtdCalculada.toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' kg';
        } else {
            lblPreco.textContent = 'R$ 0,00';
            lblTeto.textContent = 'R$ 0,00';
            lblQtd.textContent = '0 kg';
        }
    };

    window.editarMetaEstrategicav3Rapido = function(materialId, mes, mFat, mMargem, op, qReal, valVendaReal) {
        document.getElementById('metaestv3-material-id').value = materialId;
        document.getElementById('metaestv3-mes').value = mes;
        document.getElementById('metaestv3-meta-faturamento').value = mFat;
        document.getElementById('metaestv3-margem-desejada').value = mMargem;
        document.getElementById('metaestv3-operacao').value = op;
        document.getElementById('metaestv3-qtd-realizado').value = qReal;
        document.getElementById('metaestv3-valor-venda-realizado').value = valVendaReal || '';

        onSelectModalMaterialv3();
        abrirModalMetaEstrategicav3();
    };

    window.salvarMetaEstrategicav3Form = async function(event) {
        event.preventDefault();
        const material_id = document.getElementById('metaestv3-material-id').value;
        const mes = document.getElementById('metaestv3-mes').value; // YYYY-MM
        const meta_faturamento = document.getElementById('metaestv3-meta-faturamento').value;
        const margem_desejada = document.getElementById('metaestv3-margem-desejada').value;
        const operacao = document.getElementById('metaestv3-operacao').value;
        const qtd_realizado = document.getElementById('metaestv3-qtd-realizado').value;
        const valor_venda_realizado = document.getElementById('metaestv3-valor-venda-realizado').value;
        const criarAtivo = document.getElementById('metaestv3-criar-ativo') ? document.getElementById('metaestv3-criar-ativo').checked : false;

        try {
            // Salvar a meta base
            const res = await fetch('/api/planejamento-estrategicov3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_id, mes, meta_faturamento, margem_desejada, operacao, qtd_realizado, valor_venda_realizado
                })
            });

            if (res.ok) {
                let msgSucesso = 'Planejamento base salvo com sucesso!';
                
                // Se marcou para criar como ativo
                if (criarAtivo) {
                    const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id == material_id)?.material_nome || 'Produto';
                    const fatAlvo = parseFloat(meta_faturamento) || 0;
                    const mg = parseFloat(margem_desejada) || 0;
                    const teto = fatAlvo * (1 - (mg/100));
                    
                    const dataInicio = `${mes}-01`;
                    const [y, m] = mes.split('-');
                    const dataFim = new Date(y, m, 0).toISOString().split('T')[0];

                    const payloadPlano = {
                        nome: `Plano Personalizado - ${mNome}`,
                        data_inicio: dataInicio,
                        data_fim: dataFim,
                        itens: [{
                            material_id: parseInt(material_id),
                            fracao_pct: 100,
                            faturamento_alvo: fatAlvo,
                            faturamento_realizado: parseFloat(valor_venda_realizado) || 0
                        }],
                        cenarios: [{
                            nome: 'PERSONALIZADO (100%)',
                            valor_meta_faturamento: fatAlvo,
                            valor_teto_custo: teto
                        }]
                    };

                    const resAtivo = await fetch('/api/estrategiav3_planos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payloadPlano)
                    });

                    if (resAtivo.ok) {
                        msgSucesso = 'Plano Personalizado salvo e ativado com sucesso!';
                    }
                }

                _apexNotify('Sucesso', msgSucesso, 'success');
                fecharModalMetaEstrategicav3();
                
                // Recarregar conforme a aba visível
                const secAtivos = document.getElementById('subaba-estr-ativos');
                if (secAtivos && secAtivos.style.display === 'block' && window.renderPlanejamentosAtivosV3) {
                    await window.renderPlanejamentosAtivosV3();
                } else if (window.carregarPlanejamentoEstrategicov3) {
                    await window.carregarPlanejamentoEstrategicov3();
                }
            } else {
                throw new Error('Falha ao salvar meta');
            }
        } catch (e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível salvar.', 'error');
        }
    };

    window.deletarMetaEstrategicav3 = async function(id) {
        if (!confirm('Deseja realmente remover esta meta estratégica?')) return;
        try {
            const res = await fetch(`/api/planejamento-estrategicov3/${id}`, { method: 'DELETE' });
            if (res.ok) {
                _apexNotify('Sucesso', 'Meta estratégica V3 excluída.', 'success');
                await carregarPlanejamentoEstrategicov3();
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível excluir.', 'error');
        }
    };

    window.abrirModalPlanejamentosSalvosV3 = async function() {
        const navEstrategico = document.getElementById('nav-planejamento-estrategicov3');
        if (navEstrategico) navEstrategico.click();
        if (window.alternarSubAbaEstrategico) window.alternarSubAbaEstrategico('ativos');
    };

    function formatarMesAnoLabel(mesStr) {
        if (!mesStr) return '';
        const parts = mesStr.split('-');
        if (parts.length !== 2) return mesStr;
        const ano = parts[0];
        const mesIdx = parseInt(parts[1], 10);
        const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return (nomes[mesIdx] || '') + ' / ' + ano;
    }

    window.fmtD = function(d) {
        if (!d) return '-'; 
        try { 
            if (typeof d === 'string' && d.includes('T')) d = d.split('T')[0];
            const parts = d.split('-');
            if(parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return new Date(d).toLocaleDateString('pt-BR', {timeZone:'UTC'}); 
        } catch(e){ 
            return d; 
        }
    };

    window.maskCurrencyV3 = function(input) {
        let value = input.value;
        value = value.replace(/\D/g, ""); 
        if (!value) { input.value = ""; return; }
        value = (parseInt(value, 10) / 100).toFixed(2) + "";
        value = value.replace(".", ",");
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        input.value = value;
    };

    window.salvarPlanejamentoV3 = async function() {
        const titulo = document.getElementById('plestv3-sim-titulo')?.value || '';
        const data_inicial = document.getElementById('plestv3-sim-dt-ini')?.value || '';
        const data_final = document.getElementById('plestv3-sim-dt-fim')?.value || '';
        const frente = document.getElementById('plestv3-sim-frente')?.value || 'venda';
        const metaFat = document.getElementById('plestv3-sim-meta-faturamento')?.value || '0';
        
        const cenario_conservador_pct = parseFloat(document.getElementById('plestv3-sim-cenario-conservador')?.value) || 80;
        const cenario_moderado_pct = parseFloat(document.getElementById('plestv3-sim-cenario-moderado')?.value) || 100;
        const cenario_agressivo_pct = parseFloat(document.getElementById('plestv3-sim-cenario-agressivo')?.value) || 120;

        const fatTotalAlvo = parseFloat(metaFat.replace(/\./g, '').replace(',', '.')) || 0;

        if (!titulo || !data_inicial || !data_final || _mixSimulacaoV3.length === 0) {
            _apexNotify('Aviso', 'Preencha o Título, Datas e adicione pelo menos um item ao Mix.', 'warning');
            return;
        }

        const payload = {
            titulo, data_inicial, data_final, frente, meta_faturamento: fatTotalAlvo,
            cenario_conservador_pct, cenario_moderado_pct, cenario_agressivo_pct,
            mix: _mixSimulacaoV3.map(m => {
                const faturamentoAlvo = fatTotalAlvo * (m.fracaoPct / 100);
                let pRef = 0; let pCompra = 0;
                const tp = _listTabelaPrecosEstrategica.find(x => x.material_id === m.material_id);
                if (tp) {
                    pRef = frente === 'venda' ? parseFloat(tp.preco_venda || tp.venda_ref || 0) : parseFloat(tp.preco_entregar || tp.preco_compra || 0);
                    pCompra = frente === 'venda' ? parseFloat(tp.preco_entregar || tp.preco_compra || 0) : parseFloat(tp.preco_coletar || tp.preco_compra || 0);
                }
                const vol = pRef > 0 ? (faturamentoAlvo / pRef) : 0;
                const invest = vol * pCompra;
                return {
                    material_id: m.material_id,
                    fracao_pct: m.fracaoPct,
                    volume_necessario: vol,
                    faturamento_alvo: faturamentoAlvo,
                    investimento_necessario: invest
                };
            })
        };

        try {
            const res = await fetch('/api/estrategiav3_planos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                _apexNotify('Sucesso', 'Estratégia salva com sucesso!', 'success');
                const navEstrategico = document.getElementById('nav-planejamento-estrategicov3');
                if (navEstrategico) navEstrategico.click();
                if (window.alternarSubAbaEstrategico) window.alternarSubAbaEstrategico('ativos');
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não foi possível salvar a estratégia.', 'error');
        }
    };



    window.atualizarRealizadoV3 = async function(mixId) {
        const inp = document.getElementById(`plestv3-realizado-${mixId}`);
        if (!inp) return;
        const valLimpo = inp.value.replace(/\./g, '').replace(',', '.');
        const numVal = parseFloat(valLimpo) || 0;
        try {
            const res = await fetch(`/api/estrategiav3_mix/${mixId}/realizado`, {
                method: 'PUT', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ faturamento_realizado: numVal })
            });
            if (res.ok) {
                _apexNotify('Sucesso', 'Realizado salvo!', 'success');
                
                // --- SCENARIO VALIDATION LOGIC ---
                const fetchRes = await fetch('/api/estrategiav3_planos');
                if (fetchRes.ok) {
                    const data = await fetchRes.json();
                    if(data.success && data.planos) {
                        let currentPlan = null;
                        for(let p of data.planos) {
                            if(p.itens.find(i => i.id === mixId)) {
                                currentPlan = p;
                                break;
                            }
                        }
                        
                        if(currentPlan) {
                            let totalReal = 0;
                            currentPlan.itens.forEach(it => { totalReal += parseFloat(it.faturamento_realizado) || 0; });
                            
                            const metaAlvo = parseFloat(currentPlan.meta_faturamento) || 0;
                            const consPct = parseFloat(currentPlan.cenario_conservador_pct) || 80;
                            const modPct = parseFloat(currentPlan.cenario_moderado_pct) || 100;
                            const agrPct = parseFloat(currentPlan.cenario_agressivo_pct) || 120;
                            
                            const tCons = metaAlvo * (consPct / 100);
                            const tMod = metaAlvo * (modPct / 100);
                            const tAgr = metaAlvo * (agrPct / 100);

                            if (metaAlvo > 0) {
                                if (totalReal >= tAgr) {
                                    _apexNotify('Cenário Atingido!', `Parabéns! O Cenário AGRESSIVO (${agrPct}%) foi alcançado na estratégia: ${currentPlan.titulo}.`, 'error');
                                } else if (totalReal >= tMod) {
                                    _apexNotify('Cenário Atingido!', `Ótimo! O Cenário MODERADO (${modPct}%) foi alcançado na estratégia: ${currentPlan.titulo}.`, 'warning');
                                } else if (totalReal >= tCons) {
                                    _apexNotify('Cenário Atingido!', `Muito bem! O Cenário CONSERVADOR (${consPct}%) foi alcançado na estratégia: ${currentPlan.titulo}.`, 'info');
                                }
                            }
                        }
                    }
                }
                
                window.renderPlanejamentosAtivosV3();
            } else {
                throw new Error('Erro PUT');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Não salvou o realizado.', 'error');
        }
    };

    window.toggleSimuladorPlanejamento = function() {
        const wrap = document.getElementById('wrapper-simulador-planejamento');
        const icon = document.getElementById('icon-toggle-simulador');
        if (wrap.style.display === 'none' || wrap.style.display === '') {
            wrap.style.display = 'block';
            if (icon) icon.className = 'fa-solid fa-chevron-up';
        } else {
            wrap.style.display = 'none';
            if (icon) icon.className = 'fa-solid fa-chevron-down';
        }
    };

    window.preencherTituloEMesesV3 = function() {
        const selMes = document.getElementById('plestv3-quick-mes');
        const selAno = document.getElementById('plestv3-quick-ano');
        const inputTitulo = document.getElementById('plestv3-sim-titulo');
        const inputDtIni = document.getElementById('plestv3-sim-dt-ini');
        const inputDtFim = document.getElementById('plestv3-sim-dt-fim');

        if (!selMes || !selAno || !inputTitulo) return;
        const valMes = selMes.value;
        const ano = selAno.value || '2027';

        if (!valMes) return;
        const [numMes, nomeMes] = valMes.split('|');

        inputTitulo.value = `${nomeMes} ${ano}`;

        if (numMes && ano) {
            const firstDay = `${ano}-${numMes}-01`;
            const lastDayObj = new Date(parseInt(ano, 10), parseInt(numMes, 10), 0);
            const lastDayNum = String(lastDayObj.getDate()).padStart(2, '0');
            const lastDay = `${ano}-${numMes}-${lastDayNum}`;

            if (inputDtIni) inputDtIni.value = firstDay;
            if (inputDtFim) inputDtFim.value = lastDay;
        }
    };

    window.limparFiltrosPlanejamentosV3 = function() {
        const selMes = document.getElementById('plestv3-filtro-mes');
        const selAno = document.getElementById('plestv3-filtro-ano');
        const selStatus = document.getElementById('plestv3-filtro-status');
        const inputBusca = document.getElementById('plestv3-filtro-busca');

        if (selMes) selMes.value = '';
        if (selAno) selAno.value = '';
        if (selStatus) selStatus.value = '';
        if (inputBusca) inputBusca.value = '';

        window.filtrarPlanejamentosAtivosV3();
    };

    function renderCardsPlanosV3(planosArray, container) {
        if (!container) return;
        container.innerHTML = '';
        planosArray.forEach(p => {
            let htmlItens = '';
            let totalAlvo = 0;
            let totalReal = 0;
            let totalInvest = 0;
            let totalVol = 0;
            let totalFracaoPct = 0;
            let totalVendaLiquida = 0;

            p.itens.forEach(it => {
                const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || 'Material ' + it.material_id;
                const fAlvo = parseFloat(it.faturamento_alvo) || 0;
                const fReal = parseFloat(it.faturamento_realizado) || 0;
                const invest = parseFloat(it.investimento_necessario) || 0;
                const vol = parseFloat(it.volume_necessario) || 0;
                const fracao = parseFloat(it.fracao_pct) || 0;

                let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
                const pRef = p.frente === 'venda'
                    ? parseFloat(tp?.preco_venda || tp?.venda_ref || 0)
                    : parseFloat(tp?.preco_entregar || tp?.preco_compra || 0);

                const comissao = parseFloat(tp?.comissao || 0);
                const pisCofins = parseFloat(tp?.pis_cofins || 0);
                const fidc = parseFloat(tp?.fidc || 0);
                const icms = parseFloat(tp?.icms || 0);
                const freteColeta = parseFloat(tp?.frete_coleta || 0);
                const totalDedPct = comissao + pisCofins + fidc + icms;
                const valDeducoesUnit = pRef * (totalDedPct / 100);
                const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);

                totalAlvo += fAlvo;
                totalReal += fReal;
                totalInvest += invest;
                totalVol += vol;
                totalFracaoPct += fracao;
                totalVendaLiquida += (vol * vendaLiquidaUnit);

                const progPct = fAlvo > 0 ? ((fReal / fAlvo) * 100).toFixed(1) : 0;
                
                htmlItens += `
                    <tr style="border-bottom:1px solid #1a2e3f;">
                        <td style="padding:10px;">${mNome}</td>
                        <td style="padding:10px;">${it.fracao_pct}%</td>
                        <td style="padding:10px; color:#2AD07A;">R$ ${window.fmtBRL(fAlvo)}</td>
                        <td style="padding:10px;">
                            <input type="text" id="plestv3-realizado-${it.id}" class="noble-input" value="${window.fmtBRL(fReal)}" style="width:100px; padding:4px;" oninput="window.maskCurrencyV3(this)" ${p.status === 'FINALIZADO' ? 'disabled' : ''}>
                        </td>
                        <td style="padding:10px;">
                            <div style="width:100%; background:#0d1826; height:6px; border-radius:3px; margin-top:6px;">
                                <div style="width:${Math.min(progPct, 100)}%; background:${progPct >= 100 ? '#2AD07A' : '#00e5ff'}; height:100%; border-radius:3px;"></div>
                            </div>
                            <small style="color:#aaa; font-size:10px;">${progPct}%</small>
                        </td>
                        <td style="padding:10px;">
                            ${p.status !== 'FINALIZADO' ? `<button onclick="window.atualizarRealizadoV3(${it.id})" style="background:#00e5ff; color:#0d1826; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">Salvar Realizado</button>` : '<span style="color:#aaa; font-size:11px;">Finalizado</span>'}
                        </td>
                    </tr>
                `;
            });

            // Cálculos de Totais, Médias e Indicadores Estratégicos do Plano Ativo
            const countAtivos = p.itens.length || 1;
            const mediaFracaoAtivo = totalFracaoPct / countAtivos;
            const mediaAlvoAtivo = totalAlvo / countAtivos;
            const mediaRealAtivo = totalReal / countAtivos;

            const pVendaMedioAtivo = totalVol > 0 ? (totalAlvo / totalVol) : 0;
            const lucroBrutoAtivo = totalAlvo - totalInvest;
            const margemBrutaPctAtivo = totalAlvo > 0 ? (lucroBrutoAtivo / totalAlvo) * 100 : 0;

            const lucroLiquidoAtivo = totalVendaLiquida - totalInvest;
            const margemLiquidaPctAtivo = totalAlvo > 0 ? (lucroLiquidoAtivo / totalAlvo) * 100 : 0;

            const taxaVendaLiqAtivo = totalAlvo > 0 ? (totalVendaLiquida / totalAlvo) : 1;
            const pontoEquilibrioFatAtivo = taxaVendaLiqAtivo > 0 ? (totalInvest / taxaVendaLiqAtivo) : totalInvest;
            const pontoEquilibrioVolAtivo = pVendaMedioAtivo > 0 ? (pontoEquilibrioFatAtivo / pVendaMedioAtivo) : 0;

            // Scenario Math
            const metaAlvo = parseFloat(p.meta_faturamento) || totalAlvo;
            const consPct = parseFloat(p.cenario_conservador_pct) || 80;
            const modPct = parseFloat(p.cenario_moderado_pct) || 100;
            const agrPct = parseFloat(p.cenario_agressivo_pct) || 120;
            
            const tCons = metaAlvo * (consPct / 100);
            const tMod = metaAlvo * (modPct / 100);
            const tAgr = metaAlvo * (agrPct / 100);
            
            const progressToMod = metaAlvo > 0 ? ((totalReal / tMod) * 100).toFixed(1) : 0;

            const cardHTML = `
                <div style="background:#162433; border:1px solid #1c2e3d; border-radius:10px; padding:16px; position:relative; opacity: ${p.status === 'FINALIZADO' ? '0.7' : '1'}; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 5px 0; color:#2AD07A; display:flex; align-items:center; gap:8px;">
                                ${p.titulo} 
                                ${p.status === 'FINALIZADO' ? '<span style="background:#4a4a4a; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">FINALIZADO</span>' : ''}
                            </h3>
                            <small style="color:#aaa;">Período: ${window.fmtD(p.data_inicial)} até ${window.fmtD(p.data_final)}</small>
                        </div>
                        <div style="display:flex; gap:10px;">
                            ${p.status !== 'FINALIZADO' ? `<button onclick="window.finalizarPlanejamentoV3(${p.id})" style="background:#ffb74d; color:#0d1826; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-flag-checkered"></i> Finalizar</button>` : ''}
                            <button onclick="window.gerarPdfEstrategiaV3(${p.id})" style="background:#2AD07A; color:#0d1826; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <button onclick="window.excluirPlanejamentoV3(${p.id})" style="background:#ff4d4d; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>

                    <!-- Scenarios Row -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:16px;">
                        <div style="background:#0d1826; border:1px solid #00e5ff; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#00e5ff; font-size:12px;">CONSERVADOR (${consPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tCons)}</div>
                            ${totalReal >= tCons ? '<div style="margin-top:5px; background:#00e5ff; color:#0d1826; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                        <div style="background:#0d1826; border:1px solid #ffb74d; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#ffb74d; font-size:12px;">MODERADO (${modPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tMod)}</div>
                            ${totalReal >= tMod ? '<div style="margin-top:5px; background:#ffb74d; color:#0d1826; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                        <div style="background:#0d1826; border:1px solid #ff4d4d; padding:12px; border-radius:8px;">
                            <h4 style="margin:0 0 8px 0; color:#ff4d4d; font-size:12px;">AGRESSIVO (${agrPct}%)</h4>
                            <div style="color:#fff; font-weight:bold; font-size:14px;">R$ ${window.fmtBRL(tAgr)}</div>
                            ${totalReal >= tAgr ? '<div style="margin-top:5px; background:#ff4d4d; color:#fff; font-size:10px; font-weight:bold; text-align:center; padding:2px; border-radius:4px;">ATINGIDO</div>' : ''}
                        </div>
                    </div>

                    <!-- Card de Indicadores Estratégicos para o Plano Ativo -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:16px; padding:10px; background:#0d1826; border:1px solid #1a3a5c; border-radius:8px;">
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #2AD07A;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-chart-line" style="color:#2AD07A;"></i> Margem Bruta</span>
                            <span style="font-size:13px; color:#2AD07A; font-weight:bold;">R$ ${window.fmtBRL(lucroBrutoAtivo)} (${margemBrutaPctAtivo.toFixed(1)}%)</span>
                        </div>
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #00e5ff;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-scale-balanced" style="color:#00e5ff;"></i> Margem Líquida Est.</span>
                            <span style="font-size:13px; color:#00e5ff; font-weight:bold;">R$ ${window.fmtBRL(lucroLiquidoAtivo)} (${margemLiquidaPctAtivo.toFixed(1)}%)</span>
                        </div>
                        <div style="background:#162433; padding:8px 12px; border-radius:6px; border-left:3px solid #ffb74d;">
                            <span style="font-size:11px; color:#aaa; display:block; text-transform:uppercase; font-weight:bold;"><i class="fa-solid fa-bullseye" style="color:#ffb74d;"></i> Ponto de Equilíbrio</span>
                            <span style="font-size:13px; color:#ffb74d; font-weight:bold;">R$ ${window.fmtBRL(pontoEquilibrioFatAtivo)} (${pontoEquilibrioVolAtivo.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg)</span>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div style="background:#0d1826; border:1px solid #1a2e3f; padding:12px; border-radius:8px; margin-bottom:16px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="color:#aaa; font-size:12px;">Progresso Total (Base Moderado)</span>
                            <span style="color:#2AD07A; font-weight:bold; font-size:12px;">R$ ${window.fmtBRL(totalReal)} / R$ ${window.fmtBRL(tMod)} (${progressToMod}%)</span>
                        </div>
                        <div style="width:100%; background:#162433; height:10px; border-radius:5px; position:relative; overflow:hidden;">
                            <div style="width:${Math.min(progressToMod, 100)}%; background:linear-gradient(90deg, #00e5ff, #2AD07A); height:100%; border-radius:5px; transition:width 0.5s;"></div>
                        </div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px; color:#fff;">
                        <thead>
                            <tr style="background:#0d1826; border-bottom:1px solid #2a4158;">
                                <th style="padding:10px; color:#aaa;">Produto</th>
                                <th style="padding:10px; color:#aaa;">Fração</th>
                                <th style="padding:10px; color:#aaa;">Meta (R$)</th>
                                <th style="padding:10px; color:#aaa;">Realizado (R$)</th>
                                <th style="padding:10px; color:#aaa;">Progresso</th>
                                <th style="padding:10px; color:#aaa;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlItens}
                        </tbody>
                        <tfoot style="border-top:2px solid #00e5ff; font-weight:bold; background:#0d1826;">
                            <tr style="color:#00e5ff; border-bottom:1px solid #1a2e3f;">
                                <td style="padding:10px;">TOTAL</td>
                                <td style="padding:10px;">${totalFracaoPct.toFixed(1)}%</td>
                                <td style="padding:10px; color:#2AD07A;">R$ ${window.fmtBRL(totalAlvo)}</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(totalReal)}</td>
                                <td style="padding:10px; color:#2AD07A;">${totalAlvo > 0 ? ((totalReal/totalAlvo)*100).toFixed(1) : 0}%</td>
                                <td style="padding:10px;"></td>
                            </tr>
                            <tr style="color:#e0e0e0; background:rgba(0,229,255,0.06);">
                                <td style="padding:10px; color:#00e5ff;"><i class="fa-solid fa-calculator"></i> MÉDIAS</td>
                                <td style="padding:10px;">${mediaFracaoAtivo.toFixed(1)}%</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(mediaAlvoAtivo)}</td>
                                <td style="padding:10px; color:#00e5ff;">R$ ${window.fmtBRL(mediaRealAtivo)}</td>
                                <td style="padding:10px; color:#00e5ff;">${mediaAlvoAtivo > 0 ? ((mediaRealAtivo/mediaAlvoAtivo)*100).toFixed(1) : 0}%</td>
                                <td style="padding:10px;"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
            container.innerHTML += cardHTML;
        });
    }

    window.filtrarPlanejamentosAtivosV3 = function() {
        const container = document.getElementById('container-planejamentos-ativos');
        const lblContador = document.getElementById('plestv3-filtro-contador');
        if (!container) return;

        const allPlanos = window._allPlanosAtivosV3 || [];
        if (allPlanos.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center;">Nenhum planejamento ativo encontrado.</p>';
            if (lblContador) lblContador.textContent = '0 encontrados';
            return;
        }

        const mes = document.getElementById('plestv3-filtro-mes')?.value || '';
        const ano = document.getElementById('plestv3-filtro-ano')?.value || '';
        const status = document.getElementById('plestv3-filtro-status')?.value || '';
        const busca = (document.getElementById('plestv3-filtro-busca')?.value || '').toLowerCase().trim();

        const monthNamesMap = {
            '01': 'janeiro', '02': 'fevereiro', '03': 'março', '04': 'abril',
            '05': 'maio', '06': 'junho', '07': 'julho', '08': 'agosto',
            '09': 'setembro', '10': 'outubro', '11': 'novembro', '12': 'dezembro'
        };

        const planosFiltrados = allPlanos.filter(p => {
            const tituloLower = (p.titulo || '').toLowerCase();
            const dtIni = (p.data_inicial || '');
            const dtFim = (p.data_final || '');
            const targetMonthName = mes ? monthNamesMap[mes] : null;

            if (mes) {
                const matchDtIni = dtIni.includes(`-${mes}-`) || dtIni.startsWith(`${mes}/`) || dtIni.includes(`/${mes}/`);
                const matchDtFim = dtFim.includes(`-${mes}-`) || dtFim.startsWith(`${mes}/`) || dtFim.includes(`/${mes}/`);
                const matchTituloName = targetMonthName && tituloLower.includes(targetMonthName);
                const matchTituloNum = tituloLower.includes(`/${mes}`) || tituloLower.includes(`-${mes}`);
                if (!matchDtIni && !matchDtFim && !matchTituloName && !matchTituloNum) return false;
            }

            if (ano) {
                const matchDtIni = dtIni.includes(ano);
                const matchDtFim = dtFim.includes(ano);
                const matchTitulo = tituloLower.includes(ano);
                if (!matchDtIni && !matchDtFim && !matchTitulo) return false;
            }

            if (status) {
                if (p.status !== status) return false;
            }

            if (busca) {
                const matchTitulo = tituloLower.includes(busca);
                const matchItens = (p.itens || []).some(it => {
                    const mNome = (_listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || '').toLowerCase();
                    return mNome.includes(busca);
                });
                if (!matchTitulo && !matchItens) return false;
            }

            return true;
        });

        if (lblContador) {
            lblContador.textContent = `${planosFiltrados.length} de ${allPlanos.length} exibidos`;
        }

        if (planosFiltrados.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; background:#162433; border-radius:10px; border:1px dashed #2a4158; color:#aaa;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; color:#ffb74d; margin-bottom:10px; display:block;"></i>
                    Nenhum planejamento encontrado para os filtros selecionados.<br>
                    <small style="color:#666;">Tente alterar o Mês, Ano ou termo de busca.</small>
                </div>
            `;
            return;
        }

        renderCardsPlanosV3(planosFiltrados, container);
    };

    window.renderPlanejamentosAtivosV3 = async function() {
        const container = document.getElementById('container-planejamentos-ativos');
        if (!container) return;
        
        container.innerHTML = '<p style="color:#aaa;">Carregando planos ativos...</p>';

        try {
            if (!_listTabelaPrecosEstrategica || _listTabelaPrecosEstrategica.length === 0) {
                const resPrecos = await fetch('/api/tabela-precos');
                _listTabelaPrecosEstrategica = await resPrecos.json();
            }
            
            const resMetas = await fetch('/api/planejamento-estrategicov3');
            const rawMetas = await resMetas.json();
            _listMetasV3 = Array.isArray(rawMetas) ? rawMetas : [];

            popularSelectsProdutoEstrategicov3();
            window.onChangeConsultaMaterialV3();
            window.recalcularSimulacaoV3();
            
            if (!_mesV3Ativo) {
                const today = new Date();
                _mesV3Ativo = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
            }
            window.detalharMesEstrategicov3(_mesV3Ativo);

            const res = await fetch('/api/estrategiav3_planos');
            if(!res.ok) throw new Error('Falha ao buscar planos');
            const data = await res.json();
            if(!data.success) throw new Error(data.error);

            window._allPlanosAtivosV3 = data.planos || [];
            window._lastPlanosConsultados = data.planos || [];

            window.filtrarPlanejamentosAtivosV3();

        } catch(e) {
            console.error(e);
            container.innerHTML = '<p style="color:#ff4d4d;">Erro ao carregar planos.</p>';
        }
    };

    window.excluirPlanejamentoV3 = async function(id) {
        if(!confirm('Tem certeza que deseja excluir este planejamento definitivamente?')) return;
        try {
            const res = await fetch(`/api/estrategiav3_planos/${id}`, { method: 'DELETE' });
            if(res.ok) {
                _apexNotify('Sucesso', 'Planejamento excluído.', 'success');
                window.renderPlanejamentosAtivosV3();
            } else {
                _apexNotify('Erro', 'Não foi possível excluir.', 'error');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Falha na exclusão.', 'error');
        }
    };

    window.finalizarPlanejamentoV3 = async function(id) {
        if(!confirm('Deseja finalizar este planejamento? Você não poderá mais editar os valores realizados.')) return;
        try {
            const res = await fetch(`/api/estrategiav3_planos/${id}/status`, { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'FINALIZADO' })
            });
            if(res.ok) {
                _apexNotify('Sucesso', 'Planejamento finalizado.', 'success');
                window.renderPlanejamentosAtivosV3();
            } else {
                _apexNotify('Erro', 'Não foi possível finalizar.', 'error');
            }
        } catch(e) {
            console.error(e);
            _apexNotify('Erro', 'Falha na finalização.', 'error');
        }
    };

    window.alternarSubAbaEstrategico = function(aba) {
        const btnMargens = document.getElementById('tab-btn-estr-margens');
        const btnAtivos = document.getElementById('tab-btn-estr-ativos');
        const btnPlan = document.getElementById('tab-btn-estr-planejamento-mes');

        if (btnMargens) btnMargens.classList.remove('active');
        if (btnAtivos) btnAtivos.classList.remove('active');
        if (btnPlan) btnPlan.classList.remove('active');

        const secMargens = document.getElementById('subaba-estr-margens');
        const secAtivos = document.getElementById('subaba-estr-ativos');
        const secPlan = document.getElementById('subaba-estr-planejamento-mes');

        if (secMargens) secMargens.style.display = 'none';
        if (secAtivos) secAtivos.style.display = 'none';
        if (secPlan) secPlan.style.display = 'none';

        if (aba === 'margens') {
            if (btnMargens) btnMargens.classList.add('active');
            if (secMargens) secMargens.style.display = 'block';
        } else if (aba === 'ativos') {
            if (btnAtivos) btnAtivos.classList.add('active');
            if (secAtivos) secAtivos.style.display = 'block';
            if (window.carregarPlanejamentoDashboard) window.carregarPlanejamentoDashboard();
            window.renderPlanejamentosAtivosV3();
        } else if (aba === 'planejamento-mes') {
            if (btnPlan) btnPlan.classList.add('active');
            if (secPlan) secPlan.style.display = 'block';
            window.renderPlanejamentoMesEstrategico();
        }
    };

    let mesPlanejamentoEstrategicoSelecionado = 'todos';

    window.onChangeMesPlanejamentoEstrategico = function() {
        const select = document.getElementById('plest-subaba-mes');
        if (select) {
            mesPlanejamentoEstrategicoSelecionado = select.value;
            window.renderPlanejamentoMesEstrategico();
        }
    };

    window.renderPlanejamentoMesEstrategico = async function() {
        // Garantir que os lotes de compra estao carregados
        if (!localPlanejamento || localPlanejamento.length === 0) {
            try {
                const res = await fetch('/api/planejamento-compras');
                if (res.ok) {
                    localPlanejamento = await res.json();
                }
            } catch(e) {
                console.error("Erro ao buscar localPlanejamento:", e);
            }
        }

        const lotesMes = (localPlanejamento || []).filter(lc => {
            if (mesPlanejamentoEstrategicoSelecionado === 'todos') return true;
            if (!lc.mes) return true;
            return lc.mes === mesPlanejamentoEstrategicoSelecionado;
        });

        // Agrupar por produto
        const mapProdutos = new Map();
        let pesoTotalGeral = 0;
        let totalCompraGeral = 0;
        let pesoMaterialGeral = 0;
        let totalVendaGeral = 0;
        let lucroBrutoGeral = 0;

        lotesMes.forEach(lc => {
            const produtoNome = lc.produto || 'Indefinido';
            if (!mapProdutos.has(produtoNome)) {
                mapProdutos.set(produtoNome, { peso: 0, investimento: 0, vendaLiquidaAcumulada: 0, pesoMaterial: 0, faturamento: 0, lucro: 0 });
            }
            const data = mapProdutos.get(produtoNome);
            
            const totalC = parseFloat(lc.peso_comprado || 0) * parseFloat(lc.preco_compra || 0);
            const pesoMat = parseFloat(lc.peso_comprado || 0) * (parseFloat(lc.percentual_rendimento || 0) / 100);
            const totalV = pesoMat * parseFloat(lc.preco_venda_material || 0);
            const lucroB = totalV - totalC;

            data.peso += parseFloat(lc.peso_comprado || 0);
            data.investimento += totalC;
            data.pesoMaterial += pesoMat;
            data.faturamento += totalV;
            data.lucro += lucroB;
            // Para venda liquida media ponderada
            data.vendaLiquidaAcumulada += (parseFloat(lc.preco_venda_material || 0) * pesoMat);

            pesoTotalGeral += parseFloat(lc.peso_comprado || 0);
            totalCompraGeral += totalC;
            pesoMaterialGeral += pesoMat;
            totalVendaGeral += totalV;
            lucroBrutoGeral += lucroB;
        });

        // KPI
        document.getElementById('plest-kpi-inv').textContent = totalCompraGeral.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('plest-kpi-fat').textContent = totalVendaGeral.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('plest-kpi-lucro').textContent = lucroBrutoGeral.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        const pctGeral = totalVendaGeral > 0 ? (lucroBrutoGeral / totalVendaGeral) * 100 : 0;
        document.getElementById('plest-kpi-pct').textContent = fmtBRL(pctGeral) + '%';

        const tbody = document.getElementById('plest-mes-table-body');
        const tfoot = document.getElementById('plest-mes-table-footer');
        if (!tbody || !tfoot) return;

        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        if (mapProdutos.size === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#aaa;">Nenhum planejamento encontrado para este mês.</td></tr>`;
            return;
        }

        const linhas = Array.from(mapProdutos.entries()).map(([produto, data]) => {
            const fracao = pesoTotalGeral > 0 ? (data.peso / pesoTotalGeral) * 100 : 0;
            const precoMedioCompra = data.peso > 0 ? data.investimento / data.peso : 0;
            const vendaLiquidaMedia = data.pesoMaterial > 0 ? data.vendaLiquidaAcumulada / data.pesoMaterial : 0;
            const percBruto = data.faturamento > 0 ? (data.lucro / data.faturamento) * 100 : 0;

            return { produto, fracao, peso: data.peso, precoCompra: precoMedioCompra, investimento: data.investimento, vendaLiquida: vendaLiquidaMedia, faturamento: data.faturamento, lucro: data.lucro, percBruto };
        });

        // Sort descending by weight
        linhas.sort((a, b) => b.peso - a.peso);

        linhas.forEach(linha => {
            const tr = document.createElement('tr');
            tr.style.background = '#ffffff';
            tr.style.color = '#333';
            tr.innerHTML = `
                <td style="padding:8px; border:1px solid #ddd;">${linha.produto}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmtBRL(linha.fracao)}%</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">KGS ${linha.peso.toLocaleString('pt-BR')}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${fmtBRL(linha.precoCompra)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${linha.investimento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${fmtBRL(linha.vendaLiquida)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">KGS ${linha.faturamento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">R$ ${linha.lucro.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmtBRL(linha.percBruto)}%</td>
            `;
            tbody.appendChild(tr);
        });

        const precoCompraGeral = pesoTotalGeral > 0 ? totalCompraGeral / pesoTotalGeral : 0;
        const vendaLiquidaGeral = pesoMaterialGeral > 0 ? totalVendaGeral / pesoMaterialGeral : 0;

        tfoot.innerHTML = `
            <tr style="background:#ffeb3b; text-align:left; color:#333; font-weight:bold;">
                <td style="padding:10px; border:1px solid #fbc02d;">TOTAIS</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">100,00%</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">KGS ${pesoTotalGeral.toLocaleString('pt-BR')}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right; color:#2e7d32;">R$ ${fmtBRL(precoCompraGeral)}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">R$ ${totalCompraGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right; color:#2e7d32;">R$ ${fmtBRL(vendaLiquidaGeral)}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">KGS ${totalVendaGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">R$ ${lucroBrutoGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="padding:10px; border:1px solid #fbc02d; text-align:right;">${fmtBRL(pctGeral)}%</td>
            </tr>
        `;
    };

    window.exportarPlanejamentoMesEstrategicoPdf = async function() {
        const tblContainer = document.getElementById('subaba-estr-planejamento-mes').querySelector('table').parentNode;
        
        let logoWatermarkBase64 = null;
        try {
            const logoRes = await fetch('/assets/img/logo%20(2).png');
            if (logoRes.ok) {
                const blob = await logoRes.blob();
                logoWatermarkBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch(e) { console.warn('Logo watermark nao carregou:', e); }

        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1200px;box-sizing:border-box;background:#ffffff;padding:25px;font-family:sans-serif;color:#333;';
        
        let grid = '';
        if (logoWatermarkBase64) {
            grid += '<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;">';
            for (let r = 0; r < 10; r++) {
                grid += '<div style="display:flex;justify-content:space-around;align-items:center;padding:20px 0;">';
                for (let c = 0; c < 5; c++) {
                    grid += `<img src="${logoWatermarkBase64}" alt="" style="width:140px;opacity:0.07;transform:rotate(-20deg);display:block;flex-shrink:0;" />`;
                }
                grid += '</div>';
            }
            grid += '</div>';
        }

        const tableHtml = tblContainer.innerHTML;
        const hojeStr = new Date().toLocaleDateString('pt-BR');
        const mesLabel = mesPlanejamentoEstrategicoSelecionado === 'todos' ? 'Todos os Meses' : mesPlanejamentoEstrategicoSelecionado;

        tempDiv.innerHTML = `
            ${grid}
            <div style="position:relative;z-index:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ffb74d;padding-bottom:20px;margin-bottom:25px;">
                    <div><img src="assets/img/apexlogo.png" alt="ApexTech Metais" style="height:50px;"></div>
                    <div style="text-align:right;">
                        <h1 style="margin:0;color:#333;font-size:1.8rem;text-transform:uppercase;">Planejamento Estratégico - Mês</h1>
                        <p style="margin:5px 0 0 0;color:#666;font-size:1rem;">Mês Referência: <strong>${mesLabel}</strong> | Gerado em: ${hojeStr}</p>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:25px; background:#f5f5f5; padding:15px; border-radius:8px; border:1px solid #ddd;">
                    <div><strong style="color:#666;">Investimento:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-inv').textContent}</span></div>
                    <div><strong style="color:#666;">Faturamento:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-fat').textContent}</span></div>
                    <div><strong style="color:#666;">Lucro Bruto:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-lucro').textContent}</span></div>
                    <div><strong style="color:#666;">% Bruto:</strong> <span style="font-size:1.2rem;color:#333;">${document.getElementById('plest-kpi-pct').textContent}</span></div>
                </div>
                <div>${tableHtml}</div>
            </div>
        `;
        
        document.body.appendChild(tempDiv);

        try {
            await new Promise(r => setTimeout(r, 400));
            const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: false });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            const pdfWidth = 297;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Planejamento_Estrategico_Mes_${mesLabel}_${hojeStr.replace(/\//g,'-')}.pdf`);
            _apexNotify('Sucesso', 'PDF Exportado com sucesso!', 'success');
        } catch (e) {
            console.error(e);
            _apexNotify('Erro', 'Falha ao exportar PDF: ' + e.message, 'error');
        } finally {
            document.body.removeChild(tempDiv);
        }
    };

    window.gerarPdfEstrategiaV3 = function(planoId) {
        if (!window._lastPlanosConsultados) return;
        const plano = window._lastPlanosConsultados.find(p => p.id === planoId);
        if (!plano) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        doc.setFillColor(13, 26, 38);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('APEXTECH METAIS', 15, 12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('ESTRATEGIA DE CRESCIMENTO E METAS (V3)', 15, 18);

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhes do Planejamento', 15, 33);
        
        let totalAlvo = 0;
        let totalReal = 0;
        let totalInvest = 0;
        let totalVol = 0;
        let totalFracao = 0;
        let totalVendaLiquida = 0;

        plano.itens.forEach(it => {
            const alvo = parseFloat(it.faturamento_alvo) || 0;
            const real = parseFloat(it.faturamento_realizado) || 0;
            const invest = parseFloat(it.investimento_necessario) || 0;
            const vol = parseFloat(it.volume_necessario) || 0;
            const fracao = parseFloat(it.fracao_pct) || 0;

            let tp = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id);
            const pRef = plano.frente === 'venda'
                ? parseFloat(tp?.preco_venda || tp?.venda_ref || 0)
                : parseFloat(tp?.preco_entregar || tp?.preco_compra || 0);

            const comissao = parseFloat(tp?.comissao || 0);
            const pisCofins = parseFloat(tp?.pis_cofins || 0);
            const fidc = parseFloat(tp?.fidc || 0);
            const icms = parseFloat(tp?.icms || 0);
            const freteColeta = parseFloat(tp?.frete_coleta || 0);
            const totalDedPct = comissao + pisCofins + fidc + icms;
            const valDeducoesUnit = pRef * (totalDedPct / 100);
            const vendaLiquidaUnit = Math.max(0, pRef - valDeducoesUnit - freteColeta);

            totalAlvo += alvo;
            totalReal += real;
            totalInvest += invest;
            totalVol += vol;
            totalFracao += fracao;
            totalVendaLiquida += (vol * vendaLiquidaUnit);
        });

        const count = plano.itens.length || 1;
        const mediaAlvo = totalAlvo / count;
        const mediaReal = totalReal / count;
        const mediaInvest = totalInvest / count;
        const mediaVol = totalVol / count;
        const mediaFracao = totalFracao / count;

        const totalFalta = Math.max(0, totalAlvo - totalReal);
        const mediaFalta = Math.max(0, mediaAlvo - mediaReal);

        const totalPct = totalAlvo > 0 ? ((totalReal / totalAlvo) * 100).toFixed(1) : '0.0';
        const mediaPct = mediaAlvo > 0 ? ((mediaReal / mediaAlvo) * 100).toFixed(1) : '0.0';

        const pVendaPond = totalVol > 0 ? (totalAlvo / totalVol) : 0;

        const lucroBruto = totalAlvo - totalInvest;
        const margemBrutaPct = totalAlvo > 0 ? (lucroBruto / totalAlvo) * 100 : 0;

        const lucroLiquido = totalVendaLiquida - totalInvest;
        const margemLiquidaPct = totalAlvo > 0 ? (lucroLiquido / totalAlvo) * 100 : 0;

        const taxaVendaLiquida = totalAlvo > 0 ? (totalVendaLiquida / totalAlvo) : 1;
        const pontoEquilibrioFat = taxaVendaLiquida > 0 ? (totalInvest / taxaVendaLiquida) : totalInvest;
        const pontoEquilibrioVol = pVendaPond > 0 ? (pontoEquilibrioFat / pVendaPond) : 0;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Titulo: ${plano.titulo}`, 15, 40);
        doc.text(`Periodo: ${window.fmtD(plano.data_inicial)} a ${window.fmtD(plano.data_final)}`, 15, 45);
        doc.text(`Estrategia: ${plano.frente === 'venda' ? 'Foco em Venda' : 'Foco em Compra'}`, 15, 50);

        doc.setFont('helvetica', 'bold');
        doc.text(`Métricas Globais & Financeiras:`, 110, 33);
        doc.setFont('helvetica', 'normal');
        doc.text(`Investimento Previsto: R$ ${window.fmtBRL(totalInvest)}`, 110, 39);
        doc.text(`Meta Global (Alvo): R$ ${window.fmtBRL(totalAlvo)}`, 110, 44);
        doc.text(`Total Realizado: R$ ${window.fmtBRL(totalReal)} (${totalPct}%)`, 110, 49);
        doc.text(`Margem Bruta: R$ ${window.fmtBRL(lucroBruto)} (${margemBrutaPct.toFixed(1)}%)`, 110, 54);
        doc.text(`Margem Liquida Est.: R$ ${window.fmtBRL(lucroLiquido)} (${margemLiquidaPct.toFixed(1)}%)`, 110, 59);
        doc.text(`Ponto de Equilibrio: R$ ${window.fmtBRL(pontoEquilibrioFat)} (${pontoEquilibrioVol.toLocaleString('pt-BR', {maximumFractionDigits:1})} kg)`, 110, 64);

        const headers = [['Produto', 'Mix (%)', 'Vol (kg)', 'Investimento', 'Meta Alvo', 'Realizado', 'Falta', '%']];
        const body = plano.itens.map(it => {
            const mNome = _listTabelaPrecosEstrategica.find(x => x.material_id === it.material_id)?.material_nome || 'Material ' + it.material_id;
            const vol = parseFloat(it.volume_necessario) || 0;
            const invest = parseFloat(it.investimento_necessario) || 0;
            const alvo = parseFloat(it.faturamento_alvo) || 0;
            const real = parseFloat(it.faturamento_realizado) || 0;
            const falta = Math.max(0, alvo - real);
            const pct = alvo > 0 ? ((real / alvo) * 100).toFixed(1) + '%' : '0%';
            
            return [
                mNome, 
                it.fracao_pct + '%', 
                vol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                'R$ ' + window.fmtBRL(invest),
                'R$ ' + window.fmtBRL(alvo), 
                'R$ ' + window.fmtBRL(real), 
                'R$ ' + window.fmtBRL(falta),
                pct
            ];
        });

        const foot = [
            [
                'TOTAL',
                totalFracao.toFixed(1) + '%',
                totalVol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                'R$ ' + window.fmtBRL(totalInvest),
                'R$ ' + window.fmtBRL(totalAlvo),
                'R$ ' + window.fmtBRL(totalReal),
                'R$ ' + window.fmtBRL(totalFalta),
                totalPct + '%'
            ],
            [
                'MEDIAS',
                mediaFracao.toFixed(1) + '%',
                mediaVol.toLocaleString('pt-BR', {maximumFractionDigits:1}),
                'R$ ' + window.fmtBRL(mediaInvest),
                'R$ ' + window.fmtBRL(mediaAlvo),
                'R$ ' + window.fmtBRL(mediaReal),
                'R$ ' + window.fmtBRL(mediaFalta),
                mediaPct + '%'
            ]
        ];

        doc.autoTable({
            startY: 70,
            head: headers,
            body: body,
            foot: foot,
            theme: 'grid',
            headStyles: { fillColor: [22, 36, 51] },
            footStyles: { fillColor: [13, 36, 51], textColor: [0, 229, 255], fontStyle: 'bold' },
            styles: { fontSize: 8 }
        });

        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(9);
        doc.text(`Relatorio gerado em: ${new Date().toLocaleString('pt-BR')} — ApexTech Metais`, 15, finalY);

        doc.save(`Planejamento_${plano.titulo.replace(/\s+/g, '_')}.pdf`);
    };

})();

    window.aprovarPedidoCompra = function() {
        if (!confirm('Deseja realmente aprovar este pedido? O status mudará para Aprovado e você será registrado como o aprovador.')) return;
        window._aprovar_pedido_compra_flag = true;
        document.getElementById('form-pedido-compra').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };
