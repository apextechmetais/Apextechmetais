// ─── TRILHA DE AUDITORIA ─────────────────────────────────────────────────────
    window.abrirModalAuditLogs = function() {
        const modal = document.getElementById('modal-audit-logs');
        if (modal) modal.style.display = 'flex';
        carregarAuditLogs();
    };

    window.fecharModalAuditLogs = function() {
        const modal = document.getElementById('modal-audit-logs');
        if (modal) modal.style.display = 'none';
    };

    window.carregarAuditLogs = async function() {
        const tbody = document.getElementById('audit-logs-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#777;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando logs...</td></tr>';
        try {
            const res = await fetch('/api/audit-logs');
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#aaa;">Nenhum registro de auditoria encontrado.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(log => `
                <tr style="border-bottom:1px solid #2a3b4c;">
                    <td style="padding:8px 10px; color:#aaa; font-size:0.8rem;">${new Date(log.criado_em).toLocaleString('pt-BR')}</td>
                    <td style="padding:8px 10px; font-weight:bold; color:#3e7cb1;">${log.usuario || 'Sistema'}</td>
                    <td style="padding:8px 10px;"><span style="background:#1e3a5f; color:#2AD07A; padding:3px 8px; border-radius:4px; font-size:0.78rem;">${log.acao}</span></td>
                    <td style="padding:8px 10px; color:#ddd; font-size:0.85rem;">${log.detalhe || '-'}</td>
                    <td style="padding:8px 10px; color:#888; font-size:0.78rem;">${log.ip || '-'}</td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#ff4d4d;">Erro ao carregar logs de auditoria.</td></tr>';
        }
    };

    // ══════════════════════════════════════════════════════════════════════════════
    // MÓDULO WEBCAM — completamente autocontido, modal criado via JS
    // ══════════════════════════════════════════════════════════════════════════════
    // IIFE start removed
        let _stream    = null;   // MediaStream ativo
        let _compIdx   = null;   // índice da linha que pediu a foto
        let _tipo      = 'separada';
        let _etapa     = 'Desmonte';
        let _captured  = null;   // base64 da foto capturada
        let _modal     = null;   // elemento DOM do modal
        let _video     = null;
        let _canvas    = null;
        let _preview   = null;
        let _onConfirmCallback = null; // callback especial para modos alternativos (ex: Recebimento)

        /* ── Cria o modal no DOM (uma única vez) ── */
        function _criarModal() {
            if (document.getElementById('_wcm_overlay')) return;

            const o = document.createElement('div');
            o.id = '_wcm_overlay';
            o.style.cssText = [
                'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.9)',
                'z-index:999999', 'display:flex', 'align-items:center',
                'justify-content:center', 'display:none'
            ].join(';');

            o.innerHTML = `
              <div style="width:96vw;max-width:1100px;background:#0d1a24;border:2px solid #2AD07A;
                          border-radius:14px;padding:22px;display:flex;flex-direction:column;
                          box-shadow:0 10px 60px #000;gap:14px;max-height:95vh;">
                <!-- cabeçalho -->
                <div style="display:flex;justify-content:space-between;align-items:center;
                            border-bottom:1px solid #1e3a5f;padding-bottom:12px;">
                  <h3 style="margin:0;color:#2AD07A;font-size:1.15rem;display:flex;align-items:center;gap:8px;">
                    <i class='fa-solid fa-camera'></i> Capturar Foto com Webcam
                  </h3>
                  <button id="_wcm_fechar" style="background:#e63946;color:#fff;border:none;
                    border-radius:6px;padding:7px 16px;font-weight:bold;cursor:pointer;font-size:0.9rem;">
                    ✕ Desligar e Sair
                  </button>
                </div>
                <!-- área de vídeo -->
                <div style="flex:1;background:#000;border-radius:10px;overflow:hidden;
                            border:2px solid #1e4e8c;position:relative;min-height:300px;
                            display:flex;align-items:center;justify-content:center;">
                  <video id="_wcm_video" autoplay playsinline muted
                         style="width:100%;height:100%;max-height:55vh;object-fit:contain;display:block;"></video>
                  <img   id="_wcm_preview"
                         style="display:none;width:100%;height:100%;max-height:55vh;object-fit:contain;">
                  <canvas id="_wcm_canvas" style="display:none;"></canvas>
                </div>
                <!-- botões -->
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                  <button id="_wcm_sair" style="background:#e63946;color:#fff;border:none;border-radius:8px;
                    padding:10px 22px;font-size:1rem;cursor:pointer;font-weight:bold;">
                    <i class='fa-solid fa-video-slash'></i> Cancelar
                  </button>
                  <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <button id="_wcm_snap" style="background:#1e4e8c;color:#fff;border:none;border-radius:8px;
                      padding:10px 26px;font-size:1.05rem;cursor:pointer;font-weight:bold;">
                      <i class='fa-solid fa-camera-retro'></i> Capturar Foto
                    </button>
                    <button id="_wcm_retry" style="display:none;background:#555;color:#fff;border:none;
                      border-radius:8px;padding:10px 20px;font-size:1rem;cursor:pointer;">
                      <i class='fa-solid fa-rotate-left'></i> Refazer
                    </button>
                    <button id="_wcm_ok" style="display:none;background:#2AD07A;color:#000;border:none;
                      border-radius:8px;padding:10px 26px;font-size:1.05rem;cursor:pointer;font-weight:bold;">
                      <i class='fa-solid fa-check'></i> ✔ Usar esta Foto
                    </button>
                  </div>
                </div>
              </div>`;

            document.body.appendChild(o);
            _modal   = o;
            _video   = o.querySelector('#_wcm_video');
            _canvas  = o.querySelector('#_wcm_canvas');
            _preview = o.querySelector('#_wcm_preview');

            o.querySelector('#_wcm_fechar').onclick = _fechar;
            o.querySelector('#_wcm_sair').onclick   = _fechar;
            o.querySelector('#_wcm_snap').onclick   = _capturar;
            o.querySelector('#_wcm_retry').onclick  = _refazer;
            o.querySelector('#_wcm_ok').onclick     = _confirmar;
        }

        /* ── Abre o modal e inicia a câmera ── */
        async function _abrir(compIdx, tipo, etapa) {
            _criarModal();
            _compIdx  = (compIdx !== undefined && compIdx !== null) ? compIdx : null;
            _tipo     = tipo  || 'separada';
            _etapa    = etapa || 'Desmonte';
            _captured = null;

            // reset visual
            _video.style.display   = 'block';
            _preview.style.display = 'none';
            _modal.querySelector('#_wcm_snap').style.display  = 'inline-block';
            _modal.querySelector('#_wcm_retry').style.display = 'none';
            _modal.querySelector('#_wcm_ok').style.display    = 'none';
            _modal.style.display = 'flex';

            // para qualquer stream anterior
            if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }

            try {
                _stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                _video.srcObject = _stream;
                await _video.play().catch(() => {});
            } catch(e) {
                _apexNotify('Sistema', 'Câmera não disponível: ' + e.message, 'info');
                _fechar();
            }
        }

        /* ── Captura o frame atual para o canvas ── */
        function _capturar() {
            if (!_stream || !_video.srcObject) { _apexNotify('Sistema', 'Câmera não ativa.', 'info'); return; }

            const w = _video.videoWidth  || 1280;
            const h = _video.videoHeight || 720;
            _canvas.width  = w;
            _canvas.height = h;
            _canvas.getContext('2d').drawImage(_video, 0, 0, w, h);

            const data = _canvas.toDataURL('image/jpeg', 0.9);
            if (!data || data.length < 100) { _apexNotify('Atenção', 'Falha na captura. Tente novamente.', 'error'); return; }

            _captured = data;
            _preview.src           = _captured;
            _video.style.display   = 'none';
            _preview.style.display = 'block';

            _modal.querySelector('#_wcm_snap').style.display  = 'none';
            _modal.querySelector('#_wcm_retry').style.display = 'inline-block';
            _modal.querySelector('#_wcm_ok').style.display    = 'inline-block';
        }

        /* ── Refaz a foto ── */
        function _refazer() {
            _captured              = null;
            _preview.style.display = 'none';
            _video.style.display   = 'block';
            _modal.querySelector('#_wcm_snap').style.display  = 'inline-block';
            _modal.querySelector('#_wcm_retry').style.display = 'none';
            _modal.querySelector('#_wcm_ok').style.display    = 'none';
        }

        /* ── Confirma: insere thumbnail na linha IMEDIATAMENTE ── */
        async function _confirmar() {
            if (!_captured) { _apexNotify('Sistema', 'Nenhuma foto capturada.', 'info'); return; }

            const img64   = _captured;
            const cIdx    = _compIdx;

            // 1. Fecha a câmera imediatamente
            _fechar();

            // 2. Se há um callback especial (ex: Recebimento), delega a ele e encerra
            if (typeof _onConfirmCallback === 'function') {
                const cb = _onConfirmCallback;
                _onConfirmCallback = null;
                try {
                    const byteString = atob(img64.split(',')[1]);
                    const mimeString = img64.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                    const blob = new Blob([ab], {type: mimeString});
                    cb(img64, blob);
                } catch(e) { console.warn('Webcam callback especial:', e); }
                return;
            }

            // 2. Insere thumbnail na célula da linha da tabela (acumulando fotos)
            if (cIdx !== null && componentesActivos && componentesActivos[cIdx]) {
                if (!componentesActivos[cIdx].fotosBase64) {
                    componentesActivos[cIdx].fotosBase64 = [];
                }
                componentesActivos[cIdx].fotosBase64.push(img64);

                const cell = document.getElementById('_tc_' + cIdx);
                if (cell) {
                    cell.innerHTML = _thumbsHtmlList(cIdx);
                } else {
                    if (typeof renderComponentesDesmonte === 'function') renderComponentesDesmonte();
                }

                // Alimenta também a Prévia do Laudo
                if (typeof adicionarPreviaLaudo === 'function') adicionarPreviaLaudo(cIdx, img64);
            }

            // 3. Upload em background (não bloqueia UI)
            if (typeof activeAmostraIdForDesmonte !== 'undefined' && activeAmostraIdForDesmonte) {
                try {
                    // Conversão segura de base64 para Blob para evitar bugs em alguns browsers com fetch(dataURI)
                    const byteString = atob(img64.split(',')[1]);
                    const mimeString = img64.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                    const blob = new Blob([ab], {type: mimeString});

                    const fd   = new FormData();
                    fd.append('tipo',  _tipo);
                    fd.append('etapa', _etapa || 'Desmonte');
                    // Vincula a foto ao componente específico da tabela
                    if (cIdx !== null) fd.append('componente_idx', String(cIdx));
                    fd.append('fotos', blob, 'webcam_comp' + (cIdx !== null ? cIdx : '') + '_' + Date.now() + '.jpg');
                    const r = await (await fetch('/api/amostras/' + activeAmostraIdForDesmonte + '/fotos', { method:'POST', body:fd })).json();
                    // API retorna { success: true, fotos: [{id, ...}] }
                    if (r.success && r.fotos && r.fotos[0] && cIdx !== null && componentesActivos[cIdx]) {
                        if (!componentesActivos[cIdx].fotosUrl) {
                            componentesActivos[cIdx].fotosUrl = [];
                        }
                        if (!componentesActivos[cIdx].fotosDbIds) {
                            componentesActivos[cIdx].fotosDbIds = [];
                        }
                        const fotoId = r.fotos[0].id;
                        const url = '/api/amostras/' + activeAmostraIdForDesmonte + '/fotos/' + fotoId + '/img';
                        componentesActivos[cIdx].fotosUrl.push(url);
                        componentesActivos[cIdx].fotosDbIds.push(fotoId);
                        componentesActivos[cIdx].foto = url; // Mantém fallback da última foto ativa
                        
                        // Atualiza a galeria principal imediatamente para o usuário ver
                        if (typeof carregarFotosAmostra === 'function') {
                            carregarFotosAmostra(activeAmostraIdForDesmonte);
                        }
                    }
                } catch(e) { console.warn('Upload webcam (background):', e); }
            }
        }

        /* ── Fecha e desliga a câmera ── */
        function _fechar() {
            if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
            if (_video)  { _video.srcObject = null; }
            if (_modal)  { _modal.style.display = 'none'; }
            _captured = null;
        }

        /* ── HTML do card thumbnail da lista de fotos por linha ── */
        function _thumbsHtmlList(idx) {
            const comp = componentesActivos[idx];
            if (!comp) return '';
            const listBase64 = comp.fotosBase64 || [];
            const listUrl = comp.fotosUrl || [];
            const defaultFoto = comp.foto ? [comp.foto] : [];
            const fotosArray = listBase64.length > 0 ? listBase64 : (listUrl.length > 0 ? listUrl : defaultFoto);

            let html = '<div style="display:flex; flex-direction:row; flex-wrap:wrap; gap:8px; align-items:center; justify-content:center;">';
            fotosArray.forEach((src, fIdx) => {
                html += '<div style="display:flex; flex-direction:column; align-items:center; gap:4px; position:relative;">' +
                  '<div style="width:64px; height:64px; border-radius:6px; overflow:hidden; border:2px solid #2AD07A; box-shadow:0 1px 6px rgba(0,0,0,0.3);">' +
                    '<img src="' + src + '" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="_WCM.ampliarSrc(\'' + src.replace(/'/g, "\\'") + '\')" title="Clique para ampliar">' +
                  '</div>' +
                  '<button type="button" onclick="_WCM.removerFotoDoComponente(' + idx + ',' + fIdx + ')" title="Remover esta foto" ' +
                    'style="position:absolute; top:-4px; right:-4px; background:#ff4d4d; color:#fff; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold;">' +
                    '✕</button>' +
                '</div>';
            });

            // Botão Adicionar Mais uma Foto na linha
            html += '<button type="button" onclick="_WCM.abrir(' + idx + ')" title="Adicionar mais uma foto" ' +
              'style="background:#1e3a5f; border:1px dashed #2AD07A; border-radius:6px; width:64px; height:64px; cursor:pointer; color:#2AD07A; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-size:0.75rem;">' +
              '<i class="fa-solid fa-plus" style="font-size:1.1rem;"></i> Foto</button>';

            html += '</div>';
            return html;
        }

        /* ── API pública ── */
        window._WCM = {
            abrir: function(compIdx, etapaStr) { _abrir(compIdx, 'separada', etapaStr || 'Desmonte'); },
            abrirGeral: function(tipo, etapa) { _compIdx = null; _onConfirmCallback = null; _abrir(null, tipo, etapa); },
            // Modo especial: ao confirmar chama callback(img64, blob) em vez do fluxo normal de componente
            abrirParaRecebimento: function(callback) {
                _compIdx = null;
                _onConfirmCallback = callback;
                _abrir(null, 'bruta', 'Recebimento');
            },
            removerFotoDoComponente: function(compIdx, fIdx) {
                const comp = componentesActivos[compIdx];
                if (!comp) return;
                if (comp.fotosBase64) comp.fotosBase64.splice(fIdx, 1);
                if (comp.fotosUrl) comp.fotosUrl.splice(fIdx, 1);
                
                // Fallback do atributo foto antigo
                const listBase64 = comp.fotosBase64 || [];
                const listUrl = comp.fotosUrl || [];
                comp.foto = listUrl[listUrl.length - 1] || listBase64[listBase64.length - 1] || '';

                const cell = document.getElementById('_tc_' + compIdx);
                if (cell) cell.innerHTML = _thumbsHtmlList(compIdx);
            },
            ampliarSrc: function(src) {
                const ov = document.createElement('div');
                ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
                ov.onclick = () => ov.remove();
                ov.innerHTML = '<img src="' + src + '" style="max-width:92vw;max-height:92vh;border-radius:10px;border:2px solid #2AD07A;">';
                document.body.appendChild(ov);
            },
            thumbsHtmlList: _thumbsHtmlList
        };

        // Mantém compatibilidade com funções antigas chamadas pelo HTML restante
        window.abrirWebcamModal      = function(tipo, etapa) { window._WCM.abrirGeral(tipo, etapa); };
        window.abrirWebcamModalComp  = function(idx, etapaStr)         { window._WCM.abrir(idx, etapaStr); };
        window.fecharWebcamModal     = _fechar;
        window.tirarFotoWebcam       = _capturar;
        window.refazerFotoWebcam     = _refazer;
        window.confirmarFotoWebcam   = _confirmar;
        window.ampliarFotoComp       = function(idx) { window._WCM.ampliarSrc(componentesActivos[idx]?.foto); };
    // IIFE end removed




    function renderComponentesDesmonte() {
        const body = document.getElementById('analise-componentes-body');
        if (!body) return;
        body.innerHTML = '';

        componentesActivos.forEach((c, idx) => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'position:relative; border-bottom:1px solid #1e3a5f;';
            const isCustom = c.material_id === 'NEW' || !!c.custom_name;

            // Thumbnail ancorado na linha: usa a lista de fotos acumuladas
            const hasPhotos = (c.fotosBase64 && c.fotosBase64.length > 0) || (c.fotosUrl && c.fotosUrl.length > 0) || !!c.foto;
            const thumbHtml = hasPhotos
                ? window._WCM.thumbsHtmlList(idx)
                : `<button class="btn-primary" type="button"
                       style="padding:6px 10px; background:#e07b39; color:#fff; font-size:0.78rem; font-weight:bold;
                              border-radius:6px; white-space:nowrap; box-shadow:0 0 8px rgba(224,123,57,0.5);"
                       onclick="abrirWebcamModalComp(${idx}, '${idx + 1}ª Camada')" title="Capturar foto desta camada">
                       <i class="fa-solid fa-camera"></i> Registrar Camada
                   </button>`;

            tr.innerHTML = `
                <td style="padding:8px 10px; min-width:220px;">
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <span style="font-size:0.7rem; font-weight:bold; color:#f0c040; text-transform:uppercase; letter-spacing:1px; margin-bottom:-2px;">${idx + 1}ª Camada</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" onclick="alterarSelecaoMaterialComp(${idx},'NEW')"
                                title="Material não cadastrado"
                                style="flex-shrink:0; background:${isCustom ? '#2AD07A' : '#1e3a5f'};
                                       color:${isCustom ? '#000' : '#2AD07A'}; border:1px solid #2AD07A;
                                       border-radius:5px; width:28px; height:28px; font-size:1rem;
                                       font-weight:bold; cursor:pointer; display:flex;
                                       align-items:center; justify-content:center;">+</button>
                            <select class="noble-input sel-comp-material"
                                style="flex:1; padding:5px; font-size:0.82rem; display:${isCustom ? 'none' : 'block'};"
                                onchange="alterarSelecaoMaterialComp(${idx}, this.value)">
                                ${localMateriais.map(m => `<option value="${m.id}" ${(!isCustom && m.id === c.material_id) ? 'selected' : ''}>${m.nome} (${m.categoria})</option>`).join('')}
                            </select>
                        </div>
                        <input type="text" class="noble-input inp-comp-custom"
                            style="display:${isCustom ? 'block' : 'none'}; padding:5px; font-size:0.82rem; border-color:#2AD07A;"
                            placeholder="Nome do material novo (ex: Ouro)..."
                            value="${c.custom_name || ''}"
                            oninput="atualizarComponenteData(${idx}, 'custom_name', this.value)">
                    </div>
                </td>
                <td style="padding:10px; text-align:right;">
                    <input type="number" step="0.001" class="noble-input val-comp-peso"
                        style="padding:6px; text-align:right; width:100px; font-size:0.85rem;"
                        value="${c.peso}"
                        oninput="atualizarComponenteData(${idx}, 'peso', this.value)">
                </td>
                <td style="padding:10px; text-align:right; font-weight:bold; font-size:0.9rem; color:#2AD07A;" class="val-comp-pct">${fmtBRL(c.percentual)} %</td>
                <td style="padding:10px;">
                    <select class="noble-input" style="padding:6px; font-size:0.85rem;"
                        onchange="atualizarComponenteData(${idx}, 'dificuldade', this.value)">
                        <option value="Fácil" ${c.dificuldade === 'Fácil' ? 'selected' : ''}>Fácil</option>
                        <option value="Média" ${c.dificuldade === 'Média' ? 'selected' : ''}>Média</option>
                        <option value="Alta" ${c.dificuldade === 'Alta' ? 'selected' : ''}>Alta</option>
                    </select>
                </td>
                <td style="padding:8px 10px; vertical-align:middle;" id="_tc_${idx}">
                    ${thumbHtml}
                </td>
                <td style="padding:10px;">
                    <input type="text" class="noble-input val-comp-obs"
                        style="padding:6px; font-size:0.85rem;"
                        value="${c.observacoes}"
                        oninput="atualizarComponenteData(${idx}, 'observacoes', this.value)">
                </td>
                <td style="padding:10px; text-align:center;">
                    <button class="btn-refresh" style="background:none; border:none; color:#ff4d4d; font-size:1.1rem;"
                        onclick="removerLinhaComponente(${idx})" title="Remover">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });

        calcularAnaliseAmostra();
    }

    // Amplia a foto do componente em lightbox simples
    window.ampliarFotoComp = function(idx) {
        const c = componentesActivos[idx];
        if (!c) return;
        const src = c.fotoBase64 || c.foto;
        if (!src) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center; cursor:pointer;';
        overlay.onclick = () => document.body.removeChild(overlay);
        overlay.innerHTML = `<img src="${src}" style="max-width:90vw; max-height:90vh; border-radius:10px; border:2px solid #2AD07A;">`;
        document.body.appendChild(overlay);
    };


    