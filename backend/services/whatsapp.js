const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  BufferJSON
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

// Estado de conexão do WhatsApp
let sock = null;
let qrCodeData = null;
let connectionStatus = 'DISCONNECTED'; // 'CONNECTING', 'CONNECTED', 'DISCONNECTED'

// Inicializar serviço do WhatsApp
async function initWhatsApp(onMessageReceived) {
  connectionStatus = 'CONNECTING';
  const authFolder = path.join(__dirname, '../auth_info_baileys');
  
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true // Mostra no console para fallback
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Gerar QR Code em formato DataURL para o Frontend
      try {
        qrCodeData = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexão do WhatsApp fechada. Motivo:', lastDisconnect?.error, '. Reconectando:', shouldReconnect);
      connectionStatus = 'DISCONNECTED';
      qrCodeData = null;
      
      if (shouldReconnect) {
        // Tentar reconectar
        initWhatsApp(onMessageReceived);
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso!');
      connectionStatus = 'CONNECTED';
      qrCodeData = null;
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe && onMessageReceived) {
          try {
            await onMessageReceived(msg);
          } catch (err) {
            console.error('Erro ao processar mensagem do WhatsApp:', err);
          }
        }
      }
    }
  });
}

// Enviar mensagem de resposta no WhatsApp
async function sendMessage(to, text) {
  if (!sock) {
    throw new Error('Serviço de WhatsApp não inicializado.');
  }
  await sock.sendMessage(to, { text });
}

// Obter status atual do WhatsApp
function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qrCode: qrCodeData
  };
}

module.exports = {
  initWhatsApp,
  sendMessage,
  getWhatsAppStatus
};
