
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

    // Fornecedores do formulário de pedido. Lista própria e completa: window.localFornecedores é da tela de
    // Fornecedores e guarda só a página que estiver aberta lá, por isso a busca aqui não achava ninguém.
    let fornecedoresPedido = [];
    let cargaFornecedores = null;
    function carregarFornecedoresPedido(forcar) {
        if (cargaFornecedores && !forcar) return cargaFornecedores;
        cargaFornecedores = fetch('/api/fornecedores?limit=9999', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : []))
            .then(d => { fornecedoresPedido = Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []); return fornecedoresPedido; })
            .catch(e => { console.error('Erro ao carregar fornecedores:', e); cargaFornecedores = null; return fornecedoresPedido; });
        return cargaFornecedores;
    }
    const nomeFornecedor = (f) => f.nome || f.razao_social || f.nome_fantasia || f.fantasia || f.apelido || '';
    const apelidoFornecedor = (f) => { const a = f.apelido || f.nome_fantasia || f.fantasia || ''; return a && a !== nomeFornecedor(f) ? a : ''; };
    const foneFornecedor = (f) => f.fone1 || f.whatsapp || f.celular || f.fone2 || f.telefone || f.telefone1 || f.telefone2 || '';

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
                    <div style="font-weight:bold; font-size:0.92rem;">${p.fornecedor_nome || p.fornecedor_nome_avulso || 'Fornecedor avulso'} ${badgeCliente}</div>
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
        await carregarFornecedoresPedido(true);

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

        if (fornecedoresPedido.length === 0) {
            drop.innerHTML = '<div style="padding:12px 14px; color:#aaa; font-size:0.88rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando fornecedores...</div>';
            drop.style.display = 'block';
            await carregarFornecedoresPedido();
            // o usuário pode ter continuado a digitar enquanto a lista carregava
            const campo = document.getElementById('pedidoc-fornecedor-busca');
            if (campo) val = campo.value;
        }

        const rawVal = (val || '').trim();
        const q = normalizeTxt(rawVal);
        const searchTerms = q.split(/\s+/).filter(Boolean);
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

        let encontrados = [];
        if (searchTerms.length === 0) {
            encontrados = fornecedoresPedido;
        } else {
            const cleanQ = q.replace(/\D/g, '');
            encontrados = fornecedoresPedido.filter(f => {
                const alvo = normalizeTxt(`${f.nome||''} ${f.apelido||''} ${f.razao_social||''} ${f.nome_fantasia||''} ${f.fantasia||''} ${f.cnpj||''} ${f.cpf||''} ${f.email||''} ${f.cidade||''} ${f.codfor||''}`);
                const docs = String(f.cnpj || '').replace(/\D/g, '') + ' ' + String(f.cpf || '').replace(/\D/g, '');
                return (cleanQ.length >= 3 && docs.includes(cleanQ)) || searchTerms.every(t => alvo.includes(t));
            });
        }
        const resultados = encontrados.slice(0, 15);

        let html = `
            <div onclick="abrirCadastroFornecedorExpress('${rawVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" style="padding:10px 14px; background:#1b382b; color:#2AD07A; cursor:pointer; font-weight:bold; border-bottom:1px solid #1e4e8c; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-user-plus"></i> ${rawVal ? `Cadastrar novo fornecedor "${esc(rawVal)}"` : 'Cadastrar novo fornecedor'}
            </div>
        `;

        if (resultados.length > 0) {
            html += resultados.map(f => {
                const apelido = apelidoFornecedor(f);
                const local = [f.cidade, f.uf].filter(Boolean).join('/');
                const detalhes = [f.cnpj || f.cpf || 'Sem CNPJ/CPF', local, foneFornecedor(f)].filter(Boolean).join(' | ');
                return `
                <div onclick="selecionarFornecedorPedido(${parseInt(f.id)})" style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #1a2a3a;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background=''">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <strong style="color:#fff;">${esc(nomeFornecedor(f))}${apelido ? ` <span style="color:#aaa; font-weight:normal;">(${esc(apelido)})</span>` : ''}</strong>
                        <span style="background:#1b382b; color:#2AD07A; font-size:0.7rem; padding:1px 6px; border-radius:3px; font-weight:bold; white-space:nowrap;">CADASTRADO</span>
                    </div>
                    <div style="color:#aaa; font-size:0.8rem; margin-top:2px;">${esc(detalhes)}</div>
                </div>`;
            }).join('');
            if (encontrados.length > resultados.length) {
                html += `<div style="padding:8px 14px; color:#aaa; font-size:0.78rem;">Mostrando ${resultados.length} de ${encontrados.length}. Continue digitando para refinar.</div>`;
            }
        } else if (fornecedoresPedido.length === 0) {
            html += '<div style="padding:14px; color:#aaa; font-size:0.88rem;">Nenhum fornecedor cadastrado ou não foi possível carregar a lista.</div>';
        } else {
            html += `<div style="padding:14px; color:#aaa; font-size:0.88rem;">Nenhum fornecedor encontrado com "<strong>${esc(rawVal)}</strong>".</div>`;
        }

        drop.innerHTML = html;
        drop.style.display = 'block';
    };

    // "Cadastrar novo" leva à tela de Fornecedores (antes abria o cadastro de Clientes)
    window.redirecionarParaCadastroFornecedor = function(nomePrefill) {
        const drop = document.getElementById('pedidoc-fornecedor-dropdown');
        if (drop) drop.style.display = 'none';

        fecharModalPedidoCompra();

        const navFornecedores = document.getElementById('nav-fornecedores') || document.querySelector('.nav-item[data-target="fornecedores-view"]');
        if (navFornecedores) navFornecedores.click();

        setTimeout(() => {
            if (window.abrirModalFornecedor) window.abrirModalFornecedor();
            if (nomePrefill) {
                const elNome = document.getElementById('forn-razao');
                if (elNome && !elNome.value) elNome.value = nomePrefill;
            }
        }, 200);
    };

    window.abrirCadastroFornecedorExpress = function(nomePrefill) {
        redirecionarParaCadastroFornecedor(nomePrefill);
    };

    window.selecionarFornecedorPedido = async function(id) {
        if (fornecedoresPedido.length === 0) await carregarFornecedoresPedido();
        const c = fornecedoresPedido.find(x => x.id == id);
        if (!c) return;
        document.getElementById('pedidoc-fornecedor-id').value = c.id;
        document.getElementById('pedidoc-fornecedor-busca').value = nomeFornecedor(c);
        document.getElementById('pedidoc-fornecedor-dropdown').style.display = 'none';
        document.getElementById('fc-nome').textContent     = nomeFornecedor(c);
        document.getElementById('fc-cnpj').textContent     = c.cnpj || c.cpf || 'CNPJ Não informado';
        document.getElementById('fc-cidade').textContent   = c.cidade || '';
        document.getElementById('fc-uf').textContent       = c.uf || '';
        document.getElementById('fc-tel').textContent      = foneFornecedor(c) || '-';
        document.getElementById('fc-email').textContent    = c.email || '-';
        if (document.getElementById('fc-endereco')) document.getElementById('fc-endereco').textContent = c.endereco || 'Endereço principal de cadastro';
        
        const badge = document.getElementById('fc-status-badge');
        if (badge) {
            badge.style.background = '#1b382b';
            badge.style.color = '#2AD07A';
            badge.style.borderColor = '#2AD07A';
            badge.innerHTML = '<i class="fa-solid fa-user-check"></i> FORNECEDOR CADASTRADO NO SISTEMA';
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
        const c      = fornecedoresPedido.find(x => x.id == cliId) || {};
        const p = {
            numero: num,
            fornecedor_id: cliId ? parseInt(cliId) : null,
            fornecedor_nome: document.getElementById('fc-nome').textContent || document.getElementById('pedidoc-fornecedor-busca').value || '-',
            fornecedor_cnpj: document.getElementById('fc-cnpj').textContent || c.cnpj || c.cpf || '-',
            fornecedor_cidade: document.getElementById('fc-cidade').textContent || c.cidade || '-',
            fornecedor_uf: document.getElementById('fc-uf').textContent || c.uf || '-',
            fornecedor_telefone: document.getElementById('fc-tel').textContent || foneFornecedor(c) || '-',
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


    // O módulo de Planejamento Estratégico V3 vive em assets/js/modules/admin_estrategicov3.js.
    // A cópia antiga que ficava aqui era carregada depois e sobrescrevia a versão atual.

    function formatarMesAnoLabel(mesStr) {
        if (!mesStr) return '';
        const parts = mesStr.split('-');
        if (parts.length !== 2) return mesStr;
        const ano = parts[0];
        const mesIdx = parseInt(parts[1], 10);
        const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return (nomes[mesIdx] || '') + ' / ' + ano;
    }

})();

    window.aprovarPedidoCompra = function() {
        if (!confirm('Deseja realmente aprovar este pedido? O status mudará para Aprovado e você será registrado como o aprovador.')) return;
        window._aprovar_pedido_compra_flag = true;
        document.getElementById('form-pedido-compra').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };
