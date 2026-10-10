/**
 * Painel: troca das imagens fixas do site (tela "Configurar Home").
 * Cada espaço tem uma imagem padrão; o administrador pode enviar outra ou voltar à padrão.
 */
(function() {
    const avisar = (titulo, msg, tipo) => (window._apexNotify ? window._apexNotify(titulo, msg, tipo) : alert(msg));

    async function carregar() {
        const lista = document.getElementById('site-imagens-lista');
        if (!lista) return;
        try {
            const res = await fetch('/api/site-imagens', { cache: 'no-store' });
            const dados = await res.json();
            if (!res.ok) throw new Error(dados.error || 'Sem permissão para gerenciar as imagens.');
            const carimbo = Date.now();
            lista.innerHTML = dados.imagens.map(img => `
                <div style="background:#132433; border:1px solid #223547; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <div style="background:#0d1826; border-radius:8px; height:200px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <img src="/api/site-imagens/${img.slot}?t=${carimbo}" alt="" style="max-width:100%; max-height:100%; object-fit:contain;">
                    </div>
                    <div>
                        <strong style="color:#fff; display:block; font-size:0.95rem;">${img.rotulo}</strong>
                        <span style="color:${img.personalizada ? '#2AD07A' : '#a0b4c8'}; font-size:0.8rem;">
                            ${img.personalizada ? 'Imagem enviada em ' + new Date(img.atualizado_em).toLocaleString('pt-BR') : 'Usando a imagem padrão'}
                        </span>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <label class="btn-primary" style="cursor:pointer; margin:0;">
                            <i class="fa-solid fa-upload"></i> Trocar imagem
                            <input type="file" accept="${dados.tipos.join(',')}" data-slot="${img.slot}" style="display:none;">
                        </label>
                        ${img.personalizada ? `<button type="button" class="btn-secondary" data-restaurar="${img.slot}"><i class="fa-solid fa-rotate-left"></i> Voltar à padrão</button>` : ''}
                    </div>
                </div>
            `).join('') + `<p style="grid-column:1/-1; color:#7f95ab; font-size:0.8rem; margin:0;">Formatos: JPG, PNG ou WebP, até ${dados.max_mb} MB. Prefira fotos na horizontal com pelo menos 1200 px de largura.</p>`;
        } catch (e) {
            lista.innerHTML = `<p style="color:#ff6b6b; font-size:0.9rem;">${e.message}</p>`;
        }
    }

    async function enviar(slot, arquivo) {
        const corpo = new FormData();
        corpo.append('imagem', arquivo);
        try {
            const res = await fetch('/api/site-imagens/' + slot, { method: 'POST', body: corpo });
            const dados = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(dados.error || 'Não foi possível enviar a imagem.');
            avisar('Imagens do site', 'Imagem trocada. O site já mostra a nova foto.', 'success');
        } catch (e) {
            avisar('Imagens do site', e.message, 'error');
        }
        carregar();
    }

    async function restaurar(slot) {
        try {
            const res = await fetch('/api/site-imagens/' + slot, { method: 'DELETE' });
            const dados = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(dados.error || 'Não foi possível restaurar a imagem.');
            avisar('Imagens do site', 'Imagem padrão restaurada.', 'success');
        } catch (e) {
            avisar('Imagens do site', e.message, 'error');
        }
        carregar();
    }

    document.addEventListener('change', (e) => {
        const campo = e.target;
        if (campo && campo.matches && campo.matches('#site-imagens-lista input[type="file"]') && campo.files[0]) {
            enviar(campo.dataset.slot, campo.files[0]);
        }
    });
    document.addEventListener('click', (e) => {
        // Confirmação em dois cliques, no próprio botão (o painel não usa as caixas nativas do navegador)
        const botao = e.target.closest ? e.target.closest('[data-restaurar]') : null;
        if (botao) {
            if (botao.dataset.confirmar === '1') {
                restaurar(botao.dataset.restaurar);
            } else {
                botao.dataset.confirmar = '1';
                botao.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Clique de novo para confirmar';
                setTimeout(() => { if (botao.isConnected) { botao.dataset.confirmar = ''; botao.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Voltar à padrão'; } }, 4000);
            }
        }
        // carrega a lista ao abrir a tela "Configurar Home"
        const nav = e.target.closest ? e.target.closest('[data-target="home-config"]') : null;
        if (nav) carregar();
    });

    window.carregarSiteImagens = carregar;
})();
