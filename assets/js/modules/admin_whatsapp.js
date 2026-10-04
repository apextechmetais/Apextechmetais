// ─── MÓDULO DE WHATSAPP EMPRESARIAL (WA-AKG INTEGRATION) ─────────────────
(function() {
    let _conversas = [];
    let _conversaAtivaId = null;
    let _mensagensAtivas = [];

    window.carregarWhatsappModulo = async function() {
        try {
            console.log('[WhatsApp] Inicializando módulo...');
            await window.verificarStatusWhatsapp();
            await window.carregarConversasWhatsapp();
            await window.carregarAuditoriaWhatsapp();
        } catch (e) {
            console.error('[WhatsApp] Erro ao carregar módulo:', e);
        }
    };

    window.verificarStatusWhatsapp = async function() {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            const badgeEl = document.getElementById('wa-status-badge');
            if (badgeEl) {
                if (data.status === 'conectado') {
                    badgeEl.className = 'badge bg-success';
                    badgeEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Instância Conectada';
                } else {
                    badgeEl.className = 'badge bg-warning text-dark';
                    badgeEl.innerHTML = '<i class="fa-solid fa-qrcode"></i> Desconectado (Escaneie QR)';
                }
            }
        } catch (e) {
            console.warn('[WhatsApp] Erro ao checar status:', e);
        }
    };

    window.carregarConversasWhatsapp = async function() {
        try {
            const busca = document.getElementById('wa-busca-contato')?.value || '';
            const res = await fetch(`/api/whatsapp/conversas?busca=${encodeURIComponent(busca)}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.conversas)) {
                _conversas = data.conversas;
                window.renderListaConversas(_conversas);
                
                // Se nenhuma conversa selecionada e temos conversas, selecione a primeira
                if (!_conversaAtivaId && _conversas.length > 0) {
                    window.selecionarConversaWhatsapp(_conversas[0].id);
                }
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao buscar conversas:', e);
        }
    };

    window.renderListaConversas = function(conversas) {
        const container = document.getElementById('wa-lista-conversas');
        if (!container) return;

        if (!conversas || conversas.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#aaa;">Nenhuma conversa encontrada.</div>';
            return;
        }

        container.innerHTML = '';
        conversas.forEach(c => {
            const isActive = String(c.id) === String(_conversaAtivaId);
            const div = document.createElement('div');
            div.className = `wa-chat-item ${isActive ? 'active' : ''}`;
            div.style.cssText = `padding:12px; border-bottom:1px solid #1e293b; cursor:pointer; background:${isActive ? '#1e293b' : 'transparent'}; border-left:${isActive ? '4px solid #25D366' : '4px solid transparent'}; transition:0.2s;`;
            div.onclick = () => window.selecionarConversaWhatsapp(c.id);

            const horaStr = new Date(c.atualizado_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-weight:bold; color:#fff; font-size:0.95rem;">${c.contato_nome}</div>
                    <small style="color:#aaa; font-size:0.75rem;">${horaStr}</small>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="color:#94a3b8; font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${c.ultima_mensagem}</div>
                    ${c.nao_lidas > 0 ? `<span style="background:#25D366; color:#0d1826; font-weight:800; font-size:0.7rem; padding:2px 6px; border-radius:10px;">${c.nao_lidas}</span>` : ''}
                </div>
                <div style="margin-top:4px;">
                    <span style="font-size:0.7rem; color:#38bdf8; background:rgba(56,189,248,0.1); padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-user-gear"></i> ${c.atendente_nome || 'Sem Atendente'}</span>
                </div>
            `;
            container.appendChild(div);
        });
    };

    window.selecionarConversaWhatsapp = async function(conversaId) {
        _conversaAtivaId = conversaId;
        window.renderListaConversas(_conversas);

        const conv = _conversas.find(c => String(c.id) === String(conversaId));
        if (conv) {
            document.getElementById('wa-header-nome').textContent = conv.contato_nome;
            document.getElementById('wa-header-telefone').textContent = conv.telefone;
            document.getElementById('wa-header-atendente').textContent = conv.atendente_nome || 'Sem Atendente';
        }

        try {
            const res = await fetch(`/api/whatsapp/conversas/${conversaId}/mensagens`);
            const data = await res.json();
            if (data.success && Array.isArray(data.mensagens)) {
                _mensagensAtivas = data.mensagens;
                window.renderMensagensChat(_mensagensAtivas);
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao carregar mensagens:', e);
        }
    };

    window.renderMensagensChat = function(mensagens) {
        const body = document.getElementById('wa-chat-body');
        if (!body) return;

        if (!mensagens || mensagens.length === 0) {
            body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:40px;">Nenhuma mensagem registrada nesta conversa.</div>';
            return;
        }

        body.innerHTML = '';
        mensagens.forEach(m => {
            const isMe = m.remetente === 'atendente' || m.remetente === 'sistema_tabela';
            const horaStr = new Date(m.criado_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

            const wrapper = document.createElement('div');
            wrapper.style.cssText = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;`;

            let bgMsg = isMe ? '#054640' : '#202c33';
            let borderMsg = isMe ? '1px solid #128C7E' : '1px solid #2a3942';

            let msgHtml = m.mensagem.replace(/\n/g, '<br>');
            if (m.tipo === 'tabela_sistema') {
                msgHtml = `<div style="background:#0b141a; padding:10px; border-radius:6px; border-left:3px solid #25D366; margin-bottom:5px;"><i class="fa-solid fa-file-invoice" style="color:#25D366;"></i> <strong>Transmissão de Tabela do Sistema</strong></div>` + msgHtml;
            }

            wrapper.innerHTML = `
                <div style="max-width:75%; background:${bgMsg}; border:${borderMsg}; border-radius:8px; padding:10px 14px; color:#fff; font-size:0.9rem; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                    <div style="font-size:0.75rem; color:#25D366; font-weight:bold; margin-bottom:4px;">${m.remetente_nome}</div>
                    <div>${msgHtml}</div>
                    <div style="text-align:right; font-size:0.7rem; color:#94a3b8; margin-top:4px;">${horaStr} ${isMe ? '<i class="fa-solid fa-check-double" style="color:#53bdeb;"></i>' : ''}</div>
                </div>
            `;
            body.appendChild(wrapper);
        });

        body.scrollTop = body.scrollHeight;
    };

    window.enviarMensagemWhatsapp = async function() {
        const input = document.getElementById('wa-input-mensagem');
        if (!input || !input.value.trim() || !_conversaAtivaId) return;

        const texto = input.value.trim();
        input.value = '';

        try {
            const res = await fetch('/api/whatsapp/enviar-mensagem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversa_id: _conversaAtivaId,
                    mensagem: texto,
                    usuario_nome: window.currentUser ? window.currentUser.nome : 'Administrador'
                })
            });
            if (res.ok) {
                await window.selecionarConversaWhatsapp(_conversaAtivaId);
                await window.carregarConversasWhatsapp();
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao enviar mensagem:', e);
        }
    };

    window.dispararTabelaSistemaWhatsapp = async function() {
        if (!_conversaAtivaId) {
            if (window._apexNotify) window._apexNotify('Atenção', 'Selecione uma conversa para enviar a tabela.', 'warning');
            return;
        }

        const tipoTabela = document.getElementById('wa-select-tabela-tipo').value;
        const titulo = document.getElementById('wa-titulo-disparo').value;
        const obs = document.getElementById('wa-obs-disparo').value;

        try {
            const res = await fetch('/api/whatsapp/enviar-tabela', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversa_id: _conversaAtivaId,
                    tabela_tipo: tipoTabela,
                    titulo_personalizado: titulo,
                    observacoes: obs,
                    usuario_nome: window.currentUser ? window.currentUser.nome : 'Administrador'
                })
            });
            if (res.ok) {
                if (window._apexNotify) window._apexNotify('Sucesso', 'Tabela enviada com sucesso via WhatsApp!', 'success');
                document.getElementById('wa-titulo-disparo').value = '';
                document.getElementById('wa-obs-disparo').value = '';
                await window.selecionarConversaWhatsapp(_conversaAtivaId);
                await window.carregarConversasWhatsapp();
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao disparar tabela:', e);
        }
    };

    window.carregarAuditoriaWhatsapp = async function() {
        try {
            const res = await fetch('/api/whatsapp/auditoria');
            const data = await res.json();
            if (data.success && data.resumo_conversas) {
                const tbody = document.getElementById('wa-tbody-auditoria');
                if (!tbody) return;
                tbody.innerHTML = '';
                data.resumo_conversas.forEach(r => {
                    tbody.innerHTML += `
                        <tr>
                            <td style="font-weight:bold; color:#fff;">${r.contato_nome} <br><small style="color:#aaa;">${r.telefone}</small></td>
                            <td><span style="color:#38bdf8; font-weight:bold;">${r.atendente}</span></td>
                            <td style="text-align:center;">${r.total_mensagens}</td>
                            <td>${new Date(r.ultima_interacao).toLocaleString('pt-BR')}</td>
                            <td style="text-align:center;"><span class="badge bg-success">Registrado</span></td>
                        </tr>
                    `;
                });
            }
        } catch (e) {
            console.warn('[WhatsApp] Erro na auditoria:', e);
        }
    };
})();
