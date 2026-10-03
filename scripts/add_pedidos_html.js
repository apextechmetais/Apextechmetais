const fs = require('fs');

let html = fs.readFileSync('../admin.html', 'utf8');

// 1. Adicionar item no sidebar (antes do módulo Financeiro)
const navFinanceiro = `<a href="#" class="nav-item" data-target="financeiro-view" id="nav-financeiro">`;
const navPedidos = `<a href="#" class="nav-item" data-target="pedidos-venda-view" id="nav-pedidos-venda">
                    <i class="fa-solid fa-file-invoice-dollar"></i>
                    <span>Pedidos de Venda</span>
                </a>
                `;
html = html.replace(navFinanceiro, navPedidos + navFinanceiro);

// 2. Adicionar a seção HTML antes do fechamento </body>
const pedidosSection = `
    <!-- ═══════════════════════════════════════════════════════════
         PEDIDOS DE VENDA
    ═══════════════════════════════════════════════════════════ -->
    <!-- View de listagem de pedidos -->
    <div id="pedidos-venda-view" class="view-section" style="display:none; padding:20px;">
        <header class="section-header">
            <div class="section-header-row">
                <div>
                    <h1><i class="fa-solid fa-file-invoice-dollar" style="color:#2AD07A;"></i> Pedidos de Venda</h1>
                    <p>Emita e gerencie pedidos vinculados aos clientes cadastrados.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" onclick="abrirNovoPedido()">
                        <i class="fa-solid fa-plus"></i> Novo Pedido
                    </button>
                </div>
            </div>
        </header>

        <!-- Filtros -->
        <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; align-items:center;">
            <input type="text" id="pedidos-search" class="noble-input" placeholder="🔍 Buscar por número, cliente..." style="flex:1; min-width:200px;" oninput="filtrarPedidos()">
            <select id="pedidos-status-filter" class="noble-input" style="width:160px;" onchange="filtrarPedidos()">
                <option value="">Todos os Status</option>
                <option value="Rascunho">Rascunho</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Em Separação">Em Separação</option>
                <option value="Faturado">Faturado</option>
                <option value="Entregue">Entregue</option>
                <option value="Cancelado">Cancelado</option>
            </select>
        </div>

        <!-- Tabela de pedidos -->
        <div class="table-container" style="border-radius:10px; overflow:hidden;">
            <table class="data-table" style="width:100%;">
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Cliente</th>
                        <th>Emissão</th>
                        <th>Entrega</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th style="width:100px;">Ações</th>
                    </tr>
                </thead>
                <tbody id="pedidos-tbody">
                    <tr><td colspan="7" style="text-align:center; padding:30px; color:#5a738e;"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Modal: Novo/Editar Pedido de Venda (fullscreen) -->
    <div id="modal-pedido-venda" class="fullscreen-overlay" style="display:none; align-items:flex-start; justify-content:center; z-index:1100; padding-top:20px; overflow-y:auto;">
        <div style="width:900px; max-width:98vw; background:#0d1a26; border:1px solid #1e4e8c; border-radius:12px; padding:0; margin-bottom:30px;">
            <!-- Header do modal -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#101a24; border-radius:12px 12px 0 0; padding:18px 24px; border-bottom:1px solid #223547;">
                <h3 style="margin:0; color:#fff; font-size:1.1rem;"><i class="fa-solid fa-file-invoice-dollar" style="color:#2AD07A;"></i> <span id="modal-pedido-titulo">Novo Pedido de Venda</span></h3>
                <button onclick="fecharModalPedido()" style="background:none; border:none; color:#aaa; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form id="form-pedido-venda" onsubmit="salvarPedido(event)" style="padding:24px;">
                <input type="hidden" id="pedido-id">

                <!-- Linha 1: Número e Status -->
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; margin-bottom:18px;">
                    <div class="form-group">
                        <label>Número do Pedido *</label>
                        <input type="text" id="pedido-numero" class="noble-input" readonly style="background:#162432; color:#7fa8c8;">
                    </div>
                    <div class="form-group">
                        <label>Data de Emissão *</label>
                        <input type="date" id="pedido-data-emissao" class="noble-input" required>
                    </div>
                    <div class="form-group">
                        <label>Data de Entrega</label>
                        <input type="date" id="pedido-data-entrega" class="noble-input">
                    </div>
                </div>

                <!-- Linha 2: Cliente -->
                <div style="margin-bottom:18px;">
                    <div class="form-group">
                        <label>Cliente *</label>
                        <div style="position:relative;">
                            <input type="text" id="pedido-cliente-busca" class="noble-input" placeholder="Digite o nome ou CNPJ do cliente..." autocomplete="off" oninput="buscarClientePedido(this.value)" required>
                            <input type="hidden" id="pedido-cliente-id">
                            <div id="pedido-cliente-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#0d1a26; border:1px solid #1e4e8c; border-radius:6px; z-index:1200; max-height:200px; overflow-y:auto;"></div>
                        </div>
                        <!-- Card do cliente selecionado -->
                        <div id="pedido-cliente-card" style="display:none; margin-top:10px; background:#162432; border-radius:8px; padding:12px; border-left:3px solid #2AD07A;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <strong id="cc-nome" style="color:#fff; font-size:1rem;"></strong>
                                    <div style="color:#7fa8c8; font-size:0.82rem; margin-top:3px;">
                                        <span id="cc-cnpj"></span> | <span id="cc-cidade"></span>-<span id="cc-uf"></span>
                                    </div>
                                    <div style="color:#7fa8c8; font-size:0.82rem;">
                                        <span id="cc-tel"></span> | <span id="cc-email"></span>
                                    </div>
                                </div>
                                <button type="button" onclick="limparClientePedido()" style="background:none; border:none; color:#aaa; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Linha 3: Condição e Observações -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:18px;">
                    <div class="form-group">
                        <label>Condição de Pagamento</label>
                        <select id="pedido-condicao" class="noble-input">
                            <option value="">Selecione...</option>
                            <option value="À Vista">À Vista</option>
                            <option value="7 dias">7 dias</option>
                            <option value="14 dias">14 dias</option>
                            <option value="21 dias">21 dias</option>
                            <option value="28 dias">28 dias</option>
                            <option value="30 dias">30 dias</option>
                            <option value="45 dias">45 dias</option>
                            <option value="60 dias">60 dias</option>
                            <option value="90 dias">90 dias</option>
                            <option value="FIDC">Antecipação FIDC</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="pedido-status" class="noble-input">
                            <option value="Rascunho">Rascunho</option>
                            <option value="Confirmado">Confirmado</option>
                            <option value="Em Separação">Em Separação</option>
                            <option value="Faturado">Faturado</option>
                            <option value="Entregue">Entregue</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>
                </div>

                <!-- Itens do Pedido -->
                <div style="background:#101a24; border-radius:10px; padding:15px; margin-bottom:18px; border:1px solid #223547;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; color:#fff;"><i class="fa-solid fa-list" style="color:#2AD07A;"></i> Itens do Pedido</h4>
                        <button type="button" class="btn-primary" onclick="adicionarItemPedido()" style="padding:6px 14px; font-size:0.82rem;">
                            <i class="fa-solid fa-plus"></i> Adicionar Item
                        </button>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="border-bottom:1px solid #223547; color:#7fa8c8;">
                                <th style="padding:8px 6px; text-align:left;">Descrição *</th>
                                <th style="padding:8px 6px; text-align:center; width:60px;">Und</th>
                                <th style="padding:8px 6px; text-align:right; width:90px;">Qtd</th>
                                <th style="padding:8px 6px; text-align:right; width:110px;">Preço Unit.</th>
                                <th style="padding:8px 6px; text-align:right; width:90px;">Desc%</th>
                                <th style="padding:8px 6px; text-align:right; width:110px;">Total</th>
                                <th style="width:40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="itens-pedido-tbody">
                        </tbody>
                    </table>
                    <div id="itens-vazio" style="text-align:center; padding:20px; color:#5a738e; font-size:0.9rem;">
                        <i class="fa-solid fa-box-open"></i> Adicione ao menos um item ao pedido.
                    </div>
                </div>

                <!-- Totais -->
                <div style="display:flex; justify-content:flex-end; margin-bottom:18px;">
                    <div style="background:#162432; border-radius:10px; padding:15px 20px; min-width:280px; border:1px solid #223547;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.9rem;">
                            <span style="color:#aaa;">Subtotal Itens:</span>
                            <span id="pedido-total-itens" style="color:#fff;">R$ 0,00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.9rem;">
                            <span style="color:#aaa;">Desconto Geral (%):</span>
                            <input type="number" id="pedido-desconto" class="noble-input" value="0" min="0" max="100" step="0.01" style="width:80px; text-align:right; padding:4px 8px; font-size:0.85rem;" oninput="recalcularPedido()">
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.9rem;">
                            <span style="color:#aaa;">Frete (R$):</span>
                            <input type="number" id="pedido-frete" class="noble-input" value="0" min="0" step="0.01" style="width:100px; text-align:right; padding:4px 8px; font-size:0.85rem;" oninput="recalcularPedido()">
                        </div>
                        <div style="display:flex; justify-content:space-between; padding-top:10px; border-top:1px solid #223547; font-size:1.1rem; font-weight:bold;">
                            <span style="color:#fff;">Total Geral:</span>
                            <span id="pedido-total-geral" style="color:#2AD07A;">R$ 0,00</span>
                        </div>
                    </div>
                </div>

                <!-- Observações -->
                <div class="form-group" style="margin-bottom:20px;">
                    <label>Observações</label>
                    <textarea id="pedido-obs" class="noble-input" rows="3" style="height:auto;" placeholder="Instruções de entrega, condições especiais..."></textarea>
                </div>

                <!-- Botões -->
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" class="btn-secondary" onclick="fecharModalPedido()"><i class="fa-solid fa-xmark"></i> Cancelar</button>
                    <button type="button" class="btn-secondary" onclick="imprimirPedido()" style="background:#3e7cb1;"><i class="fa-solid fa-print"></i> Imprimir PDF</button>
                    <button type="submit" class="btn-primary"><i class="fa-solid fa-save"></i> Salvar Pedido</button>
                </div>
            </form>
        </div>
    </div>
`;

// Inject before </body>
html = html.replace('</body>', pedidosSection + '\n</body>');

fs.writeFileSync('../admin.html', html);
console.log('OK: HTML de Pedidos de Venda adicionado!');
