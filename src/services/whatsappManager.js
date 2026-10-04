const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const sessionsDir = path.join(__dirname, '../../data/whatsapp_sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

const mediaDir = path.join(__dirname, '../../data/whatsapp_media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

function extrairTextoMensagem(msg) {
    if (!msg || !msg.message) return '';
    const m = msg.message;
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text;
    if (m.imageMessage) return m.imageMessage.caption || '📷 [Imagem / Foto]';
    if (m.videoMessage) return m.videoMessage.caption || '🎥 [Vídeo]';
    if (m.documentMessage) return `📄 [Documento: ${m.documentMessage.fileName || 'Arquivo'}]`;
    if (m.audioMessage) return '🎵 [Áudio / Mensagem de Voz]';
    if (m.stickerMessage) return '🎨 [Figurinha]';
    if (m.contactMessage) return '👤 [Contato Compartilhado]';
    if (m.locationMessage) return '📍 [Localização]';
    return '[Mensagem WhatsApp]';
}

class WhatsappManager {
    constructor() {
        this.sockets = new Map();
        this.qrCodes = new Map();
        this.statuses = new Map();
        this.contatosMap = new Map();
        this.memStore = null;
    }

    setMemStore(memStore) {
        this.memStore = memStore;
        this.restaurarSessoesSalvas();
    }

    async restaurarSessoesSalvas() {
        try {
            if (!fs.existsSync(sessionsDir)) return;
            const folders = fs.readdirSync(sessionsDir);
            for (const folder of folders) {
                const credsPath = path.join(sessionsDir, folder, 'creds.json');
                if (fs.existsSync(credsPath)) {
                    console.log(`[WhatsApp Manager] Restaurando sessão salva do WhatsApp Web para ${folder}...`);
                    if (this.memStore && this.memStore.whatsapp_instancias) {
                        let inst = this.memStore.whatsapp_instancias.find(i => i.id === folder);
                        if (!inst) {
                            inst = {
                                id: folder,
                                nome: `Celular Conectado (${folder})`,
                                numero: 'Reconectando...',
                                responsavel: 'Funcionário / Empresa',
                                status: 'reconectando',
                                qr_code: null,
                                criado_em: new Date().toISOString()
                            };
                            this.memStore.whatsapp_instancias.push(inst);
                        } else {
                            inst.status = 'reconectando';
                        }
                    }
                    this.iniciarInstancia(folder).catch(err => {
                        console.error(`[WhatsApp Manager] Erro ao auto-restaurar ${folder}:`, err.message);
                    });
                }
            }
        } catch (e) {
            console.error('[WhatsApp Manager] Erro ao buscar sessões salvas:', e);
        }
    }

    async resincronizarTudo() {
        console.log('[WhatsApp Manager] Forçando resincronização geral de sessões e contatos...');
        if (fs.existsSync(sessionsDir)) {
            const folders = fs.readdirSync(sessionsDir);
            for (const folder of folders) {
                const credsPath = path.join(sessionsDir, folder, 'creds.json');
                if (fs.existsSync(credsPath)) {
                    let inst = this.memStore.whatsapp_instancias.find(i => i.id === folder);
                    if (!inst) {
                        inst = {
                            id: folder,
                            nome: `Celular Empresa (${folder})`,
                            numero: 'Conectando...',
                            responsavel: 'Funcionário',
                            status: 'reconectando',
                            qr_code: null,
                            criado_em: new Date().toISOString()
                        };
                        this.memStore.whatsapp_instancias.push(inst);
                    }

                    if (!this.sockets.has(folder) || this.statuses.get(folder) !== 'conectado') {
                        await this.iniciarInstancia(folder).catch(() => {});
                    } else {
                        inst.status = 'conectado';
                        const sock = this.sockets.get(folder);
                        if (sock && sock.user) {
                            const num = sock.user.id.split(':')[0];
                            inst.numero = `+${num}`;
                        }
                    }
                }
            }
        }
        return {
            instancias: this.memStore ? this.memStore.whatsapp_instancias : [],
            conversas: this.memStore ? this.memStore.whatsapp_conversas : [],
            contatos: this.memStore ? this.memStore.whatsapp_contatos : []
        };
    }

    async iniciarInstancia(instanciaId) {
        if (this.sockets.has(instanciaId)) {
            if (this.statuses.get(instanciaId) === 'conectado') {
                return { status: 'conectado', qr: null };
            }
            if (this.qrCodes.has(instanciaId)) {
                return { status: this.statuses.get(instanciaId), qr: this.qrCodes.get(instanciaId) };
            }
        }

        const instanceSessionDir = path.join(sessionsDir, instanciaId);
        if (!fs.existsSync(instanceSessionDir)) {
            fs.mkdirSync(instanceSessionDir, { recursive: true });
        }

        try {
            const { state, saveCreds } = await useMultiFileAuthState(instanceSessionDir);

            const sock = makeWASocket({
                auth: state,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ['Apex CRM WhatsApp', 'Chrome', '120.0.0.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
                generateHighQualityLinkPreview: true
            });

            this.sockets.set(instanciaId, sock);
            this.statuses.set(instanciaId, 'iniciando');

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    try {
                        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
                        this.qrCodes.set(instanciaId, qrDataUrl);
                        this.statuses.set(instanciaId, 'aguardando_qr');
                        console.log(`[WhatsApp Manager] NOVO QR CODE GERADO AUTÊNTICO para ${instanciaId}`);
                        this.atualizarMemStoreInstancia(instanciaId, 'aguardando_qr', qrDataUrl);
                    } catch (err) {
                        console.error(`[WhatsApp Manager] Erro ao converter QR code para DataURL:`, err);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                    console.log(`[WhatsApp Manager] Conexão fechada para ${instanciaId}, statusCode: ${statusCode}, deslogadoPeloCelular: ${isLoggedOut}`);
                    
                    this.qrCodes.delete(instanciaId);

                    if (isLoggedOut) {
                        console.log(`[WhatsApp Manager] Sessão encerrada/deslogada pelo celular para ${instanciaId}. Removendo sessão...`);
                        this.statuses.set(instanciaId, 'desconectado');
                        this.sockets.delete(instanciaId);
                        this.atualizarMemStoreInstancia(instanciaId, 'desconectado', null);
                        try {
                            fs.rmSync(instanceSessionDir, { recursive: true, force: true });
                        } catch (e) {}
                    } else {
                        // Manter conectado continuamente - reconectar em caso de instabilidade de rede ou reinício
                        this.statuses.set(instanciaId, 'reconectando');
                        this.atualizarMemStoreInstancia(instanciaId, 'reconectando', null);
                        console.log(`[WhatsApp Manager] Reconectando automaticamente ${instanciaId} em 3 segundos (Sessão mantida)...`);
                        setTimeout(() => this.iniciarInstancia(instanciaId), 3000);
                    }
                } else if (connection === 'open') {
                    console.log(`[WhatsApp Manager] CONECTADO E ESPELHADO COM SUCESSO 24/7 para ${instanciaId}!`);
                    this.statuses.set(instanciaId, 'conectado');
                    this.qrCodes.delete(instanciaId);

                    const userNum = sock.user ? sock.user.id.split(':')[0] : '';
                    this.atualizarMemStoreInstancia(instanciaId, 'conectado', null, userNum ? `+${userNum}` : null);
                }
            });

            // ─── 1. SINCRONIZAÇÃO HISTÓRICA DO WHATSAPP WEB ───
            sock.ev.on('messaging-history.set', async ({ contacts, messages }) => {
                console.log(`[WhatsApp Manager] Sincronizando histórico do celular para ${instanciaId}...`);
                if (contacts && Array.isArray(contacts)) {
                    for (const c of contacts) {
                        if (!c.id || c.id.endsWith('@g.us') || c.id === 'status@broadcast') continue;
                        const num = c.id.split('@')[0];
                        const nome = c.name || c.notify || c.verifiedName || `+${num}`;
                        this.sincronizarContatoMirror(num, nome);
                    }
                }

                if (messages && Array.isArray(messages)) {
                    for (const msg of messages) {
                        await this.processarMensagemIndividual(instanciaId, msg, sock);
                    }
                }
            });

            // ─── 2. ESPELHAMENTO DE CONTATOS DO TELEFONE ───
            sock.ev.on('contacts.upsert', (contacts) => {
                for (const c of contacts) {
                    if (!c.id || c.id.endsWith('@g.us') || c.id === 'status@broadcast') continue;
                    const num = c.id.split('@')[0];
                    const nome = c.name || c.notify || c.verifiedName || `+${num}`;
                    this.sincronizarContatoMirror(num, nome);
                }
            });

            // ─── 3. ESPELHAMENTO EM TEMPO REAL DE MENSAGENS E MÍDIAS ───
            sock.ev.on('messages.upsert', async (m) => {
                try {
                    if (!m.messages) return;
                    for (const msg of m.messages) {
                        await this.processarMensagemIndividual(instanciaId, msg, sock);
                    }
                } catch (e) {
                    console.error('[WhatsApp Manager] Erro ao espelhar mensagem:', e);
                }
            });

            return { status: this.statuses.get(instanciaId), qr: this.qrCodes.get(instanciaId) };
        } catch (e) {
            console.error(`[WhatsApp Manager] Falha ao iniciar Baileys para ${instanciaId}:`, e);
            this.statuses.set(instanciaId, 'erro');
            return { status: 'erro', qr: null };
        }
    }

    async processarMensagemIndividual(instanciaId, msg, sock) {
        try {
            const fromJid = msg.key.remoteJid;
            if (!fromJid || fromJid.endsWith('@g.us') || fromJid === 'status@broadcast') return;

            const numLimpo = fromJid.split('@')[0];
            const isMe = msg.key.fromMe;
            const texto = extrairTextoMensagem(msg);
            
            let anexoUrl = null;
            let msgTipo = 'texto';

            if (msg.message?.imageMessage || msg.message?.documentMessage || msg.message?.videoMessage || msg.message?.audioMessage) {
                try {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const isImg = !!msg.message.imageMessage;
                    const isDoc = !!msg.message.documentMessage;
                    const isAud = !!msg.message.audioMessage;
                    const origName = msg.message?.documentMessage?.fileName || '';
                    const ext = isImg ? '.jpg' : isDoc ? (path.extname(origName) || '.pdf') : isAud ? '.mp3' : '.mp4';
                    
                    const filename = `media_${Date.now()}_${Math.floor(Math.random()*10000)}${ext}`;
                    const filepath = path.join(mediaDir, filename);
                    fs.writeFileSync(filepath, buffer);
                    
                    anexoUrl = `/whatsapp-media/${filename}`;
                    msgTipo = isImg ? 'imagem' : isDoc ? 'documento' : isAud ? 'audio' : 'video';
                } catch (errMedia) {
                    console.warn('[WhatsApp Media] Erro ao baixar mídia (continuando com texto):', errMedia.message);
                }
            }

            const pushName = msg.pushName || (isMe ? 'Funcionário / Sistema' : `Contato +${numLimpo}`);
            const ts = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp.low) : null;

            this.sincronizarMensagemMirror(instanciaId, numLimpo, pushName, texto, isMe, ts, anexoUrl, msgTipo);
        } catch (errProc) {
            console.error('[WhatsApp Process Message] Erro:', errProc);
        }
    }

    atualizarMemStoreInstancia(instanciaId, status, qrCode, numero) {
        if (!this.memStore || !this.memStore.whatsapp_instancias) return;
        const inst = this.memStore.whatsapp_instancias.find(i => i.id === instanciaId);
        if (inst) {
            inst.status = status;
            inst.qr_code = qrCode;
            if (numero) inst.numero = numero;
        }
    }

    sincronizarContatoMirror(telefoneLimpo, nomeContato) {
        if (!this.memStore || !telefoneLimpo) return;
        if (!this.memStore.whatsapp_contatos) this.memStore.whatsapp_contatos = [];
        
        const foneFmt = `+${telefoneLimpo}`;
        const ehNomeValido = nomeContato && !nomeContato.startsWith('+') && nomeContato !== 'Funcionário' && nomeContato !== 'Atendente';

        if (ehNomeValido) {
            this.contatosMap.set(telefoneLimpo, nomeContato);
        }

        let c = this.memStore.whatsapp_contatos.find(item => item.telefone.replace(/\D/g, '') === telefoneLimpo);
        if (!c) {
            this.memStore.whatsapp_contatos.push({
                id: Date.now() + Math.floor(Math.random() * 10000),
                nome: (ehNomeValido ? nomeContato : foneFmt),
                telefone: foneFmt,
                empresa: 'WhatsApp Sync',
                categoria: 'Contato Telefone',
                cidade: ''
            });
        } else if (ehNomeValido && (c.nome.startsWith('+') || c.nome.includes('Contato') || c.nome === 'Funcionário')) {
            c.nome = nomeContato;
        }
    }

    sincronizarMensagemMirror(instanciaId, telefoneLimpo, nomeContato, mensagemTexto, enviadaPeloCelular, timestamp, anexoUrl, msgTipo) {
        if (!this.memStore) return;
        const foneFmt = `+${telefoneLimpo}`;
        let conv = this.memStore.whatsapp_conversas.find(c => c.id === telefoneLimpo || c.telefone.replace(/\D/g, '') === telefoneLimpo);
        const inst = this.memStore.whatsapp_instancias.find(i => i.id === instanciaId);
        const dataHora = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

        const ehNomeValido = nomeContato && !nomeContato.startsWith('+') && nomeContato !== 'Funcionário' && nomeContato !== 'Atendente';
        if (ehNomeValido) {
            this.contatosMap.set(telefoneLimpo, nomeContato);
        }
        const nomeFinal = (ehNomeValido ? nomeContato : (this.contatosMap.get(telefoneLimpo) || foneFmt));

        if (!conv) {
            conv = {
                id: telefoneLimpo,
                instancia_id: instanciaId,
                instancia_nome: inst ? inst.nome : 'WhatsApp',
                contato_nome: nomeFinal,
                telefone: foneFmt,
                atendente_id: null,
                atendente_nome: enviadaPeloCelular ? (inst ? inst.responsavel : 'Atendente') : 'Cliente',
                nao_lidas: enviadaPeloCelular ? 0 : 1,
                ultima_mensagem: mensagemTexto,
                atualizado_em: dataHora
            };
            this.memStore.whatsapp_conversas.unshift(conv);
        } else {
            if (!enviadaPeloCelular) conv.nao_lidas = (conv.nao_lidas || 0) + 1;
            conv.ultima_mensagem = mensagemTexto;
            conv.atualizado_em = dataHora;
            if (ehNomeValido || conv.contato_nome.startsWith('+') || conv.contato_nome === 'Funcionário' || conv.contato_nome === 'Johnny Braga') {
                conv.contato_nome = nomeFinal;
            }
        }

        if (!this.memStore.whatsapp_mensagens) this.memStore.whatsapp_mensagens = [];

        // Evita mensagens duplicadas
        const jaExiste = this.memStore.whatsapp_mensagens.some(m => 
            String(m.conversa_id) === String(conv.id) && m.mensagem === mensagemTexto && Math.abs(new Date(m.criado_em) - new Date(dataHora)) < 5000
        );

        if (!jaExiste) {
            this.memStore.whatsapp_mensagens.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                conversa_id: conv.id,
                instancia_id: instanciaId,
                remetente: enviadaPeloCelular ? 'atendente' : 'cliente',
                remetente_nome: enviadaPeloCelular ? (inst ? inst.responsavel : 'Funcionário Celular') : (conv.contato_nome || nomeContato),
                mensagem: mensagemTexto,
                tipo: msgTipo || 'texto',
                anexo_url: anexoUrl || null,
                criado_em: dataHora
            });
        }

        this.sincronizarContatoMirror(telefoneLimpo, conv.contato_nome);
    }

    async obterQrCode(instanciaId) {
        if (!this.sockets.has(instanciaId) || this.statuses.get(instanciaId) === 'desconectado') {
            await this.iniciarInstancia(instanciaId);
        }
        return {
            status: this.statuses.get(instanciaId) || 'iniciando',
            qr: this.qrCodes.get(instanciaId) || null
        };
    }

    async enviarMensagem(instanciaId, telefone, mensagemTexto) {
        const sock = this.sockets.get(instanciaId);
        if (!sock || this.statuses.get(instanciaId) !== 'conectado') {
            throw new Error(`Instância ${instanciaId} não está conectada no WhatsApp Web.`);
        }

        const cleanNum = telefone.replace(/\D/g, '');
        const jid = `${cleanNum}@s.whatsapp.net`;

        const result = await sock.sendMessage(jid, { text: mensagemTexto });
        return result;
    }

    async enviarMedia(instanciaId, telefone, fileBuffer, fileName, fileMimeType, legenda) {
        const sock = this.sockets.get(instanciaId);
        if (!sock || this.statuses.get(instanciaId) !== 'conectado') {
            throw new Error(`Instância ${instanciaId} não está conectada no WhatsApp Web.`);
        }

        const cleanNum = telefone.replace(/\D/g, '');
        const jid = `${cleanNum}@s.whatsapp.net`;

        if (fileMimeType.startsWith('image/')) {
            return await sock.sendMessage(jid, { image: fileBuffer, caption: legenda || '' });
        } else if (fileMimeType.startsWith('audio/')) {
            return await sock.sendMessage(jid, { audio: fileBuffer, ptt: true, mimetype: fileMimeType });
        } else {
            return await sock.sendMessage(jid, { document: fileBuffer, fileName: fileName || 'arquivo', mimetype: fileMimeType, caption: legenda || '' });
        }
    }

    async desconectar(instanciaId) {
        if (this.sockets.has(instanciaId)) {
            const sock = this.sockets.get(instanciaId);
            try {
                await sock.logout();
            } catch (e) {}
            this.sockets.delete(instanciaId);
            this.qrCodes.delete(instanciaId);
            this.statuses.set(instanciaId, 'desconectado');
            this.atualizarMemStoreInstancia(instanciaId, 'desconectado', null);
            const instanceSessionDir = path.join(sessionsDir, instanciaId);
            try {
                fs.rmSync(instanceSessionDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
}

module.exports = new WhatsappManager();
