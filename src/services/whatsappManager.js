const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const sessionsDir = path.join(__dirname, '../../data/whatsapp_sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

class WhatsappManager {
    constructor() {
        this.sockets = new Map();
        this.qrCodes = new Map();
        this.statuses = new Map();
        this.memStore = null;
    }

    setMemStore(memStore) {
        this.memStore = memStore;
    }

    async iniciarInstancia(instanciaId) {
        if (this.sockets.has(instanciaId)) {
            const existingSock = this.sockets.get(instanciaId);
            if (this.statuses.get(instanciaId) === 'conectado') {
                return { status: 'conectado', qr: null };
            }
        }

        const instanceSessionDir = path.join(sessionsDir, instanciaId);
        if (!fs.existsSync(instanceSessionDir)) {
            fs.mkdirSync(instanceSessionDir, { recursive: true });
        }

        try {
            const { state, saveCreds } = await useMultiFileAuthState(instanceSessionDir);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
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
                        console.log(`[WhatsApp Manager] NOVO QR CODE GERADO para ${instanciaId}`);
                        this.atualizarMemStoreInstancia(instanciaId, 'aguardando_qr', qrDataUrl);
                    } catch (err) {
                        console.error(`[WhatsApp Manager] Erro ao converter QR code para DataURL:`, err);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    console.log(`[WhatsApp Manager] Conexão fechada para ${instanciaId}, motivo: ${statusCode}, reconectando: ${shouldReconnect}`);
                    
                    this.statuses.set(instanciaId, 'desconectado');
                    this.qrCodes.delete(instanciaId);
                    this.atualizarMemStoreInstancia(instanciaId, 'desconectado', null);

                    if (shouldReconnect) {
                        setTimeout(() => this.iniciarInstancia(instanciaId), 5000);
                    }
                } else if (connection === 'open') {
                    console.log(`[WhatsApp Manager] CONECTADO com sucesso para ${instanciaId}!`);
                    this.statuses.set(instanciaId, 'conectado');
                    this.qrCodes.delete(instanciaId);

                    const userNum = sock.user ? sock.user.id.split(':')[0] : '';
                    this.atualizarMemStoreInstancia(instanciaId, 'conectado', null, userNum ? `+${userNum}` : null);
                }
            });

            // Escuta mensagens recebidas no WhatsApp
            sock.ev.on('messages.upsert', async (m) => {
                try {
                    if (!m.messages || m.type !== 'notify') return;
                    for (const msg of m.messages) {
                        if (msg.key.fromMe) continue; // Ignora mensagens do próprio bot
                        const fromJid = msg.key.remoteJid;
                        if (!fromJid || fromJid.endsWith('@g.us')) continue; // Foca em conversas diretas CRM

                        const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[Mídia / Anexo]';
                        const pushName = msg.pushName || 'Contato WhatsApp';
                        const numLimpo = fromJid.split('@')[0];

                        this.registrarMensagemRecebida(instanciaId, numLimpo, pushName, texto);
                    }
                } catch (e) {
                    console.error('[WhatsApp Manager] Erro ao processar mensagem recebida:', e);
                }
            });

            return { status: this.statuses.get(instanciaId), qr: this.qrCodes.get(instanciaId) };
        } catch (e) {
            console.error(`[WhatsApp Manager] Falha ao iniciar Baileys para ${instanciaId}:`, e);
            this.statuses.set(instanciaId, 'erro');
            return { status: 'erro', qr: null };
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

    registrarMensagemRecebida(instanciaId, telefoneLimpo, nomeContato, mensagemTexto) {
        if (!this.memStore) return;
        
        const foneFmt = `+${telefoneLimpo}`;
        let conv = this.memStore.whatsapp_conversas.find(c => c.id === telefoneLimpo || c.telefone.replace(/\D/g, '') === telefoneLimpo);
        const inst = this.memStore.whatsapp_instancias.find(i => i.id === instanciaId);

        if (!conv) {
            conv = {
                id: telefoneLimpo,
                instancia_id: instanciaId,
                instancia_nome: inst ? inst.nome : 'WhatsApp',
                contato_nome: nomeContato,
                telefone: foneFmt,
                atendente_id: null,
                atendente_nome: 'Atendimento CRM',
                nao_lidas: 1,
                ultima_mensagem: mensagemTexto,
                atualizado_em: new Date().toISOString()
            };
            this.memStore.whatsapp_conversas.unshift(conv);
        } else {
            conv.nao_lidas = (conv.nao_lidas || 0) + 1;
            conv.ultima_mensagem = mensagemTexto;
            conv.atualizado_em = new Date().toISOString();
        }

        if (!this.memStore.whatsapp_mensagens) this.memStore.whatsapp_mensagens = [];
        this.memStore.whatsapp_mensagens.push({
            id: Date.now(),
            conversa_id: conv.id,
            instancia_id: instanciaId,
            remetente: 'cliente',
            remetente_nome: nomeContato,
            mensagem: mensagemTexto,
            tipo: 'texto',
            criado_em: new Date().toISOString()
        });
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
        }
    }
}

module.exports = new WhatsappManager();
