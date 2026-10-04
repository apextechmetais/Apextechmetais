// ─── MÓDULO DE WHATSAPP EMPRESARIAL (WA-AKG MULTI-ACCOUNT & BROADCAST) ───────
(function() {
    let _instancias = [];
    let _conversas = [];
    let _contatos = [];
    let _conversaAtivaId = null;
    let _mensagensAtivas = [];

    window.carregarWhatsappModulo = async function(isUserClick = false) {
        try {
            console.log('[WhatsApp] Resincronizando módulo com os celulares conectados...');
            if (isUserClick && window._apexNotify) {
                window._apexNotify('Resincronizando...', 'Verificando celulares conectados e resincronizando conversas...', 'info');
            }

            try {
                await fetch('/api/whatsapp/resincronizar', { method: 'POST' });
            } catch (errSync) {
                console.warn('[WhatsApp Resync] aviso:', errSync.message);
            }

            await window.carregarInstanciasWhatsapp();
            await window.carregarContatosWhatsapp();
            await window.carregarConversasWhatsapp();
            await window.carregarAuditoriaWhatsapp();
            iniciarRealtimeSyncWhatsapp();

            if (isUserClick && window._apexNotify) {
                window._apexNotify('Sistema Resincronizado!', 'Contatos e conversas sincronizados com sucesso do WhatsApp Web!', 'success');
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao carregar módulo:', e);
        }
    };

    // ─── 1. GESTÃO DE INSTÂNCIAS / CELULARES DO TIME (QR CODE) ───
    window.carregarInstanciasWhatsapp = async function() {
        try {
            const res = await fetch('/api/whatsapp/instancias');
            const data = await res.json();
            if (data.success && Array.isArray(data.instancias)) {
                _instancias = data.instancias;

                // Popula o filtro de contas no topo e selects dos modais
                const selFiltro = document.getElementById('wa-select-instancia-filtro');
                const selResp = document.getElementById('wa-select-responder-como');
                const selDisp = document.getElementById('wa-disparo-select-instancia');

                if (selFiltro) {
                    const curVal = selFiltro.value;
                    selFiltro.innerHTML = '<option value="">📱 Todas as Contas (Visão Geral ADM Master)</option>';
                    _instancias.forEach(i => {
                        selFiltro.innerHTML += `<option value="${i.id}">📱 ${i.nome} (${i.responsavel})</option>`;
                    });
                    selFiltro.value = curVal;
                }

                if (selResp) {
                    selResp.innerHTML = '';
                    _instancias.forEach(i => {
                        selResp.innerHTML += `<option value="${i.id}">📱 ${i.nome}</option>`;
                    });
                }

                if (selDisp) {
                    selDisp.innerHTML = '';
                    _instancias.forEach(i => {
                        selDisp.innerHTML += `<option value="${i.id}">📱 ${i.nome} (${i.responsavel})</option>`;
                    });
                }

                // Badges no topo
                const badgeContainer = document.getElementById('wa-instancias-resumo-badges');
                if (badgeContainer) {
                    const ativas = _instancias.filter(i => i.status === 'conectado').length;
                    badgeContainer.innerHTML = `<span class="badge bg-success" style="font-size:0.75rem; padding:6px 10px;"><i class="fa-solid fa-circle-check"></i> ${ativas} Celulares Conectados</span>`;
                }

                window.renderInstanciasTabela();
            }
        } catch (e) {
            console.warn('[WhatsApp] Erro ao carregar instâncias:', e);
        }
    };

    window.abrirModalInstanciasWhatsapp = function() {
        document.getElementById('modal-wa-instancias').style.display = 'flex';
        window.renderInstanciasTabela();
    };

    window.fecharModalInstanciasWhatsapp = function() {
        document.getElementById('modal-wa-instancias').style.display = 'none';
    };

    let _instanciaEmConexaoId = null;

    window.renderInstanciasTabela = function() {
        const tbody = document.getElementById('wa-tbody-instancias');
        if (!tbody) return;

        if (!_instancias || _instancias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Nenhum celular cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        _instancias.forEach(i => {
            const isConnected = i.status === 'conectado';
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:bold; color:#fff;">${i.nome}</td>
                    <td style="color:#aaa;">${i.numero}</td>
                    <td style="color:#38bdf8; font-weight:bold;">${i.responsavel}</td>
                    <td>
                        <span class="badge ${isConnected ? 'bg-success' : 'bg-warning text-dark'}" style="font-size:0.75rem;">
                            ${isConnected ? 'Conectado (WhatsApp Web OK)' : 'Aguardando QR Code'}
                        </span>
                    </td>
                    <td>
                        ${!isConnected || i.qr_code ? 
                            `<button type="button" class="btn-primary" onclick="abrirQrCodeScannerWhatsapp('${i.id}')" style="font-size:0.75rem; padding:5px 10px; background:#25D366; color:#0d1826; border:none; border-radius:4px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-qrcode"></i> Escanear QR Code</button>` :
                            `<button type="button" class="btn-secondary" onclick="desconectarInstancia('${i.id}')" style="font-size:0.75rem; padding:4px 8px; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-power-off"></i> Desconectar</button>`
                        }
                    </td>
                </tr>
            `;
        });
    };

    let _qrPollTimer = null;

    window.abrirQrCodeScannerWhatsapp = async function(id) {
        _instanciaEmConexaoId = id;
        const inst = _instancias.find(i => i.id === id);
        const nomeEl = document.getElementById('wa-qr-conta-nome');
        const imgEl = document.getElementById('wa-qr-code-img');

        const loadBox = document.getElementById('wa-qr-loading-box');
        const iconCenter = document.getElementById('wa-qr-icon-center');

        if (nomeEl) nomeEl.textContent = `Conta / Celular: ${inst ? inst.nome + ' (' + inst.responsavel + ')' : 'Celular Empresa'}`;
        if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
        if (loadBox) loadBox.style.display = 'flex';
        if (iconCenter) iconCenter.style.display = 'none';

        const modal = document.getElementById('modal-wa-qrcode-scanner');
        if (modal) modal.style.display = 'flex';

        // Inicia escuta do Baileys para a instância
        try {
            await fetch(`/api/whatsapp/instancias/${id}/conectar`, { method: 'POST' });
        } catch (e) {}

        const buscarQrCode = async () => {
            if (!_instanciaEmConexaoId || _instanciaEmConexaoId !== id) return;
            try {
                const res = await fetch(`/api/whatsapp/instancias/${id}/qr`);
                const data = await res.json();

                if (data.status === 'conectado') {
                    window.fecharModalQrScannerWhatsapp();
                    await window.carregarInstanciasWhatsapp();
                    if (window._apexNotify) window._apexNotify('WhatsApp Web Conectado!', 'Celular emparelhado com sucesso via WhatsApp Web!', 'success');
                    return;
                }

                if (data.qr && imgEl) {
                    imgEl.src = data.qr;
                    imgEl.style.display = 'block';
                    if (loadBox) loadBox.style.display = 'none';
                    if (iconCenter) iconCenter.style.display = 'block';
                }
            } catch (e) {
                console.warn('[WhatsApp QR] Aguardando QR Code...', e);
            }
        };

        await buscarQrCode();

        if (_qrPollTimer) clearInterval(_qrPollTimer);
        _qrPollTimer = setInterval(buscarQrCode, 2500);
    };

    window.fecharModalQrScannerWhatsapp = function() {
        const modal = document.getElementById('modal-wa-qrcode-scanner');
        if (modal) modal.style.display = 'none';
        if (_qrPollTimer) {
            clearInterval(_qrPollTimer);
            _qrPollTimer = null;
        }
        _instanciaEmConexaoId = null;
    };

    window.confirmarConexaoQrWhatsapp = async function() {
        if (!_instanciaEmConexaoId) _instanciaEmConexaoId = 'inst_1';

        try {
            const res = await fetch(`/api/whatsapp/instancias/${_instanciaEmConexaoId}/conectar`, { method: 'POST' });
            if (res.ok) {
                window.fecharModalQrScannerWhatsapp();
                await window.carregarInstanciasWhatsapp();
                if (window._apexNotify) window._apexNotify('WhatsApp Conectado!', 'QR Code lido com sucesso! A conta agora está ativa para envio e recebimento.', 'success');
            }
        } catch (e) {
            console.error(e);
        }
    };

    window.criarNovaInstanciaWhatsapp = async function() {
        const nome = document.getElementById('wa-novo-inst-nome').value;
        const numero = document.getElementById('wa-novo-inst-numero').value;
        const resp = document.getElementById('wa-novo-inst-resp').value;

        if (!nome) {
            if (window._apexNotify) window._apexNotify('Atenção', 'Digite o nome da conta/celular.', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/whatsapp/instancias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, numero, responsavel: resp })
            });
            const data = await res.json();
            if (res.ok && data.instancia) {
                document.getElementById('wa-novo-inst-nome').value = '';
                document.getElementById('wa-novo-inst-numero').value = '';
                document.getElementById('wa-novo-inst-resp').value = '';
                await window.carregarInstanciasWhatsapp();
                // Abre o scanner do QR Code imediatamente para o usuário escanear
                window.abrirQrCodeScannerWhatsapp(data.instancia.id);
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao criar conta:', e);
        }
    };

    window.simularScannearQR = async function(id) {
        try {
            const res = await fetch(`/api/whatsapp/instancias/${id}/conectar`, { method: 'POST' });
            if (res.ok) {
                await window.carregarInstanciasWhatsapp();
                if (window._apexNotify) window._apexNotify('Conectado!', 'WhatsApp Web emparelhado via QR Code com sucesso.', 'success');
            }
        } catch (e) {
            console.error(e);
        }
    };

    window.desconectarInstancia = async function(id) {
        try {
            const res = await fetch(`/api/whatsapp/instancias/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await window.carregarInstanciasWhatsapp();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // ─── 2. GESTÃO E IMPORTAÇÃO DE CONTATOS ───
    window.carregarContatosWhatsapp = async function() {
        try {
            const res = await fetch('/api/whatsapp/contatos');
            const data = await res.json();
            if (data.success && Array.isArray(data.contatos)) {
                _contatos = data.contatos;
                const el = document.getElementById('wa-total-contatos-badge');
                if (el) el.textContent = `Total no catálogo: ${_contatos.length} contatos`;
            }
        } catch (e) {
            console.warn('[WhatsApp] Erro contatos:', e);
        }
    };

    window.abrirModalContatosWhatsapp = function() {
        document.getElementById('modal-wa-contatos').style.display = 'flex';
    };

    window.fecharModalContatosWhatsapp = function() {
        document.getElementById('modal-wa-contatos').style.display = 'none';
    };

    window.processarImportacaoContatosWhatsapp = async function() {
        const texto = document.getElementById('wa-importar-texto').value;
        if (!texto || !texto.trim()) {
            if (window._apexNotify) window._apexNotify('Atenção', 'Cole a lista de contatos para importar.', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/whatsapp/contatos/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto_csv: texto })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('wa-importar-texto').value = '';
                await window.carregarContatosWhatsapp();
                window.fecharModalContatosWhatsapp();
                if (window._apexNotify) window._apexNotify('Sucesso', `${data.adicionados} novos contatos importados!`, 'success');
            }
        } catch (e) {
            console.error(e);
        }
    };

    function _obterIniciaisOuAvatar(nome) {
        if (!nome || nome.startsWith('+')) return '<i class="fa-solid fa-user"></i>';
        const partes = nome.trim().split(' ');
        if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
        return nome.slice(0, 2).toUpperCase();
    }

    function _gerarCorAvatar(nome) {
        if (!nome) return '#005c4b';
        let hash = 0;
        for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 55%, 32%)`;
    }

    let _realtimeSyncTimer = null;

    function iniciarRealtimeSyncWhatsapp() {
        if (_realtimeSyncTimer) clearInterval(_realtimeSyncTimer);
        _realtimeSyncTimer = setInterval(async () => {
            const wppView = document.getElementById('whatsapp-view');
            if (wppView && wppView.style.display !== 'none') {
                try {
                    const busca = document.getElementById('wa-busca-contato')?.value || '';
                    const instId = document.getElementById('wa-select-instancia-filtro')?.value || '';
                    const res = await fetch(`/api/whatsapp/conversas?busca=${encodeURIComponent(busca)}&instancia_id=${encodeURIComponent(instId)}`);
                    const data = await res.json();

                    if (data.success && Array.isArray(data.conversas)) {
                        _conversas = data.conversas;
                        window.renderListaConversas(_conversas);
                    }

                    if (_conversaAtivaId) {
                        const mRes = await fetch(`/api/whatsapp/conversas/${_conversaAtivaId}/mensagens`);
                        const mData = await mRes.json();
                        if (mData.success && Array.isArray(mData.mensagens)) {
                            if (mData.mensagens.length !== _mensagensAtivas.length) {
                                _mensagensAtivas = mData.mensagens;
                                window.renderMensagensChat(_mensagensAtivas);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[WhatsApp Realtime Sync] Silent warning:', e);
                }
            }
        }, 2500);
    }

    // ─── 3. LISTA DE CONVERSAS & FILTROS (ESTILO WHATSAPP WEB) ───
    window.carregarConversasWhatsapp = async function() {
        try {
            const busca = document.getElementById('wa-busca-contato')?.value || '';
            const instId = document.getElementById('wa-select-instancia-filtro')?.value || '';
            
            const res = await fetch(`/api/whatsapp/conversas?busca=${encodeURIComponent(busca)}&instancia_id=${encodeURIComponent(instId)}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.conversas)) {
                _conversas = data.conversas;
                window.renderListaConversas(_conversas);
                
                if (!_conversaAtivaId && _conversas.length > 0) {
                    window.selecionarConversaWhatsapp(_conversas[0].id);
                }
            }
        } catch (e) {
            console.error('[WhatsApp] Erro conversas:', e);
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
            div.style.cssText = `padding:12px 14px; border-bottom:1px solid #112233; cursor:pointer; background:${isActive ? '#182d40' : 'transparent'}; border-left:${isActive ? '4px solid #25D366' : '4px solid transparent'}; transition:0.2s; display:flex; align-items:center; gap:12px;`;
            div.onclick = () => window.selecionarConversaWhatsapp(c.id);

            const horaStr = c.atualizado_em ? new Date(c.atualizado_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '';
            const avatarBg = _gerarCorAvatar(c.contato_nome);
            const avatarTxt = _obterIniciaisOuAvatar(c.contato_nome);

            div.innerHTML = `
                <div style="width:44px; height:44px; border-radius:50%; background:${avatarBg}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.95rem; flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
                    ${avatarTxt}
                </div>
                <div style="flex:1; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <div style="font-weight:bold; color:#fff; font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.contato_nome}</div>
                        <small style="color:#8696a0; font-size:0.75rem; flex-shrink:0;">${horaStr}</small>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="color:#8696a0; font-size:0.82rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:190px;">${c.ultima_mensagem || ''}</div>
                        ${c.nao_lidas > 0 ? `<span style="background:#25D366; color:#0d1826; font-weight:800; font-size:0.72rem; padding:2px 7px; border-radius:12px; min-width:20px; text-align:center;">${c.nao_lidas}</span>` : ''}
                    </div>
                    <div style="margin-top:3px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.7rem; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 6px; border-radius:4px;"><i class="fa-solid fa-mobile-screen"></i> ${c.instancia_nome || 'WhatsApp'}</span>
                        <span style="font-size:0.7rem; color:#aaa;">${c.telefone || ''}</span>
                    </div>
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
            const avatarEl = document.getElementById('wa-header-avatar');
            if (avatarEl) {
                avatarEl.style.background = _gerarCorAvatar(conv.contato_nome);
                avatarEl.innerHTML = _obterIniciaisOuAvatar(conv.contato_nome);
            }
            document.getElementById('wa-header-nome').textContent = conv.contato_nome;
            document.getElementById('wa-header-telefone').textContent = conv.telefone;
            document.getElementById('wa-header-atendente').textContent = `${conv.instancia_nome} (${conv.atendente_nome || 'Livre'})`;
        }

        try {
            const res = await fetch(`/api/whatsapp/conversas/${conversaId}/mensagens`);
            const data = await res.json();
            if (data.success && Array.isArray(data.mensagens)) {
                _mensagensAtivas = data.mensagens;
                window.renderMensagensChat(_mensagensAtivas);
            }
        } catch (e) {
            console.error('[WhatsApp] Erro mensagens:', e);
        }
    };

    window.renderMensagensChat = function(mensagens) {
        const body = document.getElementById('wa-chat-body');
        if (!body) return;

        if (!mensagens || mensagens.length === 0) {
            body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:50px;">Selecione uma conversa ao lado para visualizar a troca de mensagens.</div>';
            return;
        }

        body.innerHTML = '';
        mensagens.forEach(m => {
            const isMe = m.remetente === 'atendente' || m.remetente === 'sistema_tabela' || m.remetente === 'disparo_massa';
            const horaStr = m.criado_em ? new Date(m.criado_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;`;

            let bgMsg = isMe ? '#005c4b' : '#202c33';
            let borderMsg = isMe ? '1px solid #005c4b' : '1px solid #2a3942';

            let mediaHtml = '';
            if (m.anexo_url) {
                if (m.tipo === 'imagem' || m.anexo_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                    mediaHtml = `<div style="margin-bottom:6px;"><img src="${m.anexo_url}" alt="Foto WhatsApp" style="max-width:280px; max-height:280px; border-radius:8px; display:block; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
                } else if (m.tipo === 'documento' || m.anexo_url.match(/\.(pdf|doc|docx|xls|xlsx|txt)$/i)) {
                    const fname = m.mensagem || 'Documento PDF';
                    mediaHtml = `<a href="${m.anexo_url}" target="_blank" style="background:#0b141a; padding:10px 14px; border-radius:6px; border-left:4px solid #38bdf8; color:#38bdf8; display:flex; align-items:center; gap:10px; text-decoration:none; margin-bottom:6px; font-size:0.85rem;"><i class="fa-solid fa-file-pdf" style="font-size:1.6rem; color:#ff4d4d;"></i> <div><strong style="color:#fff; display:block;">${fname}</strong><small style="color:#aaa;">Clique para visualizar/baixar</small></div></a>`;
                } else if (m.tipo === 'audio' || m.anexo_url.match(/\.(mp3|ogg|wav|m4a)$/i)) {
                    mediaHtml = `<div style="margin-bottom:6px;"><audio controls src="${m.anexo_url}" style="max-width:260px; height:36px;"></audio></div>`;
                }
            }

            let msgHtml = m.mensagem ? m.mensagem.replace(/\n/g, '<br>') : '';
            if (m.tipo === 'tabela_sistema') {
                msgHtml = `<div style="background:#0b141a; padding:10px; border-radius:6px; border-left:3px solid #25D366; margin-bottom:5px;"><i class="fa-solid fa-file-invoice" style="color:#25D366;"></i> <strong>Transmissão de Tabela do Sistema</strong></div>` + msgHtml;
            } else if (m.tipo === 'disparo_massa') {
                msgHtml = `<div style="background:#0b141a; padding:10px; border-radius:6px; border-left:3px solid #ffb74d; margin-bottom:5px;"><i class="fa-solid fa-bullhorn" style="color:#ffb74d;"></i> <strong>Disparo em Massa (Broadcast)</strong></div>` + msgHtml;
            }

            wrapper.innerHTML = `
                <div style="max-width:75%; background:${bgMsg}; border:${borderMsg}; border-radius:8px; padding:10px 14px; color:#fff; font-size:0.9rem; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                    <div style="font-size:0.75rem; color:#25D366; font-weight:bold; margin-bottom:4px;">${m.remetente_nome}</div>
                    ${mediaHtml}
                    <div>${msgHtml}</div>
                    <div style="text-align:right; font-size:0.7rem; color:#94a3b8; margin-top:4px;">${horaStr} ${isMe ? '<i class="fa-solid fa-check-double" style="color:#53bdeb;"></i>' : ''}</div>
                </div>
            `;
            body.appendChild(wrapper);
        });

        body.scrollTop = body.scrollHeight;
    };

    window.enviarMediaWhatsapp = async function(inputEl) {
        if (!inputEl || !inputEl.files || inputEl.files.length === 0 || !_conversaAtivaId) return;

        const arquivo = inputEl.files[0];
        const instId = document.getElementById('wa-select-responder-como')?.value || 'inst_1';

        const formData = new FormData();
        formData.append('conversa_id', _conversaAtivaId);
        formData.append('instancia_id', instId);
        formData.append('arquivo', arquivo);
        formData.append('usuario_nome', window.currentUser ? window.currentUser.nome : 'Administrador Master');

        try {
            if (window._apexNotify) window._apexNotify('Enviando mídia...', `Enviando ${arquivo.name} pelo WhatsApp...`, 'info');

            const res = await fetch('/api/whatsapp/enviar-media', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                inputEl.value = '';
                await window.selecionarConversaWhatsapp(_conversaAtivaId);
                await window.carregarConversasWhatsapp();
                if (window._apexNotify) window._apexNotify('Mídia Enviada!', 'Arquivo/Foto transmitido com sucesso via WhatsApp Web!', 'success');
            }
        } catch (e) {
            console.error('[WhatsApp] Erro ao enviar mídia:', e);
        }
    };

    window.renomearContatoAtualWhatsapp = async function() {
        if (!_conversaAtivaId) return;
        const conv = _conversas.find(c => String(c.id) === String(_conversaAtivaId));
        const nomeAtual = conv ? conv.contato_nome : '';

        const novoNome = prompt('Digite o nome deste contato no CRM:', nomeAtual);
        if (!novoNome || !novoNome.trim()) return;

        try {
            const res = await fetch(`/api/whatsapp/conversas/${_conversaAtivaId}/nome`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ novo_nome: novoNome.trim() })
            });
            const data = await res.json();
            if (data.success) {
                await window.carregarConversasWhatsapp();
                window.selecionarConversaWhatsapp(_conversaAtivaId);
                if (window._apexNotify) window._apexNotify('Contato Atualizado!', `Nome alterado para ${data.contato_nome}`, 'success');
            }
        } catch (e) {
            console.error('[WhatsApp Rename] Erro:', e);
        }
    };

    window.enviarMensagemWhatsapp = async function() {
        const input = document.getElementById('wa-input-mensagem');
        if (!input || !input.value.trim() || !_conversaAtivaId) return;

        const texto = input.value.trim();
        input.value = '';
        const instId = document.getElementById('wa-select-responder-como')?.value || 'inst_1';

        try {
            const res = await fetch('/api/whatsapp/enviar-mensagem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversa_id: _conversaAtivaId,
                    instancia_id: instId,
                    mensagem: texto,
                    usuario_nome: window.currentUser ? window.currentUser.nome : 'Administrador Master'
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
        const instId = document.getElementById('wa-select-responder-como')?.value || 'inst_1';

        try {
            const res = await fetch('/api/whatsapp/enviar-tabela', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversa_id: _conversaAtivaId,
                    instancia_id: instId,
                    tabela_tipo: tipoTabela,
                    titulo_personalizado: titulo,
                    observacoes: obs,
                    usuario_nome: window.currentUser ? window.currentUser.nome : 'Administrador Master'
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

    // ─── 4. DISPARO EM MASSA PARA TODOS OS CONTATOS ───
    window.abrirModalDisparoMassaWhatsapp = function() {
        document.getElementById('modal-wa-disparo-massa').style.display = 'flex';
    };

    window.fecharModalDisparoMassaWhatsapp = function() {
        document.getElementById('modal-wa-disparo-massa').style.display = 'none';
    };

    window.executarDisparoEmMassaWhatsapp = async function() {
        const texto = document.getElementById('wa-disparo-mensagem-texto').value;
        const tabela = document.getElementById('wa-disparo-select-tabela').value;
        const instId = document.getElementById('wa-disparo-select-instancia').value;

        if (!texto && !tabela) {
            if (window._apexNotify) window._apexNotify('Atenção', 'Digite uma mensagem ou selecione uma tabela para o disparo.', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/whatsapp/disparo-massa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensagem: texto,
                    tabela_tipo: tabela,
                    instancia_id: instId,
                    usuario_nome: window.currentUser ? window.currentUser.nome : 'Administrador Master'
                })
            });
            const data = await res.json();
            if (data.success) {
                window.fecharModalDisparoMassaWhatsapp();
                document.getElementById('wa-disparo-mensagem-texto').value = '';
                if (window._apexNotify) window._apexNotify('Disparo Concluído', `Mensagem enviada com sucesso para ${data.disparados} contatos!`, 'success');
                await window.carregarConversasWhatsapp();
                await window.carregarAuditoriaWhatsapp();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // ─── 5. AUDITORIA ADM MASTER ───
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
                            <td><span style="color:#00e5ff; font-size:0.75rem;">${r.instancia_nome}</span><br><small style="color:#38bdf8;">${r.atendente}</small></td>
                            <td style="text-align:center; font-weight:bold; color:#25D366;">${r.total_mensagens}</td>
                            <td>${new Date(r.ultima_interacao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</td>
                        </tr>
                    `;
                });
            }
        } catch (e) {
            console.warn('[WhatsApp] Erro na auditoria:', e);
        }
    };
})();
