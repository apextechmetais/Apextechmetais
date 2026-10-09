// Stub do Baileys para o Jest: o pacote real é ESM e não é carregado pelo transformador do Jest.
// Nenhum teste abre sessão de WhatsApp de verdade.
module.exports = {
    default: () => {
        throw new Error('Baileys não está disponível em ambiente de teste');
    },
    useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => {} }),
    DisconnectReason: {},
    downloadMediaMessage: async () => Buffer.alloc(0)
};
