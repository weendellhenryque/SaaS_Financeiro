import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { prisma } from '../db/prisma.js';
import { resolveClienteFromQuestion } from './clienteResolver.js';
import { askRAG } from './rag.js';
import { QueryChannel } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock: WASocket | null = null;
let qrCodeData: string | null = null;
let connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' = 'DISCONNECTED';

/**
 * Inicializa a conexão com o WhatsApp via Baileys.
 */
export async function initWhatsApp() {
  if (sock) {
    console.log('🔄 [WhatsApp] Fechando conexão antiga antes de iniciar uma nova...');
    try {
      sock.ws.close();
    } catch (err) {}
    sock = null;
  }

  connectionStatus = 'CONNECTING';
  const authFolder = path.join(__dirname, '../../auth_info_baileys');

  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  // Busca dinamicamente a versão mais recente do WhatsApp Web suportada pelo Baileys
  let version = [2, 3000, 1017585038] as any; // Fallback recente
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
    console.log(`🌐 [WhatsApp] Versão do WhatsApp Web obtida: ${version.join('.')}`);
  } catch (err: any) {
    console.warn(`⚠️ [WhatsApp] Não foi possível obter versão recente, usando fallback:`, err.message);
  }

  sock = makeWASocket({
    logger: pino({ level: 'silent' }) as any,
    auth: state,
    version,
    browser: ['Chrome', 'Windows', '110.0.5481.177'], // Simula desktop padrão
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        qrCodeData = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error('❌ Erro ao gerar QR Code de WhatsApp:', err);
      }
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexão do WhatsApp encerrada. Reconectando:', shouldReconnect);
      console.error('❌ Detalhes do erro de desconexão:', lastDisconnect?.error);
      connectionStatus = 'DISCONNECTED';
      qrCodeData = null;

      if (shouldReconnect) {
        setTimeout(() => initWhatsApp(), 5000); // Aguarda 5s antes de reconectar
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso via Baileys!');
      connectionStatus = 'CONNECTED';
      qrCodeData = null;
    }
  });

  // Interceptador principal de mensagens
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || msg.key.fromMe) continue;

      // Obtém o texto da mensagem
      const question =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!question.trim()) continue;

      try {
        // Limpar número do remetente (formato puro E.164, ex: 5511999999999)
        const senderPhone = remoteJid.split('@')[0];
        console.log(`📱 [WhatsApp Bot] Mensagem recebida de "${senderPhone}": "${question}"`);

        // 1. Validar whitelist rígida no banco
        const user = await prisma.appUser.findUnique({
          where: { phoneE164: senderPhone, isActive: true },
        });

        if (!user) {
          console.warn(`🛑 [WhatsApp Bot] Acesso negado para o número não autorizado: "${senderPhone}"`);
          await sock!.sendMessage(remoteJid, {
            text: `Olá! Este número de telefone (${senderPhone}) não está autorizado a interagir com o assistente do *Grupo contábil Bastos & Luz*.\n\nSe você é um funcionário ou parceiro do grupo, solicite ao administrador a inclusão do seu WhatsApp no painel de acessos.`,
          });
          continue;
        }

        // 2. Notificar o usuário que a busca está em andamento (melhora a UX e reduz ansiedade)
        await sock!.sendMessage(remoteJid, {
          text: `🔍 *[Bastos & Luz]* Olá, ${user.name}! Estou analisando sua pergunta nos arquivos contábeis do cliente. Por favor, aguarde alguns instantes...`,
        });

        // 3. Resolver fuzzy qual cliente está sendo mencionado na pergunta
        const cliente = await resolveClienteFromQuestion(question);

        if (!cliente) {
          console.log('[WhatsApp Bot] Não foi possível resolver o cliente da pergunta.');
          await sock!.sendMessage(remoteJid, {
            text: `⚠️ *[Bastos & Luz]* Olá, ${user.name}! Não consegui identificar a qual cliente você se refere na pergunta. \n\nPoderia especificar o nome da empresa contábil ou razão social na pergunta para eu filtrar os documentos corretos?`,
          });
          continue;
        }

        // 4. Executar pipeline RAG cosseno com Gemini
        const ragResult = await askRAG(
          user.id,
          question,
          cliente.id,
          cliente.nomeEmpresa,
          QueryChannel.WHATSAPP
        );

        // 5. Formatar a resposta final contábil de forma rica
        let responseMessage = `🤖 *[Assistente Bastos & Luz]*\n`;
        responseMessage += `🏢 *Cliente:* ${cliente.nomeEmpresa}\n\n`;
        responseMessage += `${ragResult.answer}\n\n`;

        if (ragResult.sources && ragResult.sources.length > 0) {
          responseMessage += `📋 *Fontes consultadas:*\n`;
          ragResult.sources.forEach((s) => {
            const scorePercent = (s.score * 100).toFixed(0);
            const pageStr = s.pageNumber ? `(Pág. ${s.pageNumber}) ` : '';
            const linkStr = s.webViewLink ? `\n   🔗 Link Drive: ${s.webViewLink}` : '';
            responseMessage += `• 📄 _${s.fileName}_ ${pageStr}[Confiança: ${scorePercent}%]${linkStr}\n`;
          });
        }

        // 6. Responder no WhatsApp
        await sock!.sendMessage(remoteJid, { text: responseMessage });
        console.log(`✅ [WhatsApp Bot] Resposta enviada com sucesso para "${user.name}"`);

      } catch (err: any) {
        console.error('❌ Erro no processamento da mensagem do WhatsApp:', err.stack || err.message);
        try {
          await sock!.sendMessage(remoteJid, {
            text: `⚠️ *[Bastos & Luz]* Desculpe, ocorreu um erro técnico ao processar sua consulta: ${err.message}`,
          });
        } catch {}
      }
    }
  });
}

/**
 * Retorna o status de conexão atual e o QR Code ativo.
 */
export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qrCode: qrCodeData,
  };
}

/**
 * Envia uma mensagem arbitrária.
 */
export async function sendWhatsAppMessage(to: string, text: string) {
  if (!sock || connectionStatus !== 'CONNECTED') {
    throw new Error('Serviço do WhatsApp não está conectado.');
  }
  const formattedJid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(formattedJid, { text });
}
