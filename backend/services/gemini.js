const { GoogleGenAI } = require('@google/generative-ai');
const { GoogleGenAISchema } = require('@google/generative-ai');

// Inicializar a API do Gemini
// Observação: O pacote oficial usa a chave do process.env.GEMINI_API_KEY
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function parseWhatsAppMessage(messageText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GEMINI_API_KEY não configurada no arquivo .env");
    return {
      action: "unknown",
      replyMessage: "Olá! Recebi sua mensagem, mas a inteligência artificial do sistema está sem a chave de API (GEMINI_API_KEY) configurada no momento. Por favor, avise o administrador do sistema!"
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Usar o modelo de alto desempenho Gemini 2.5 Flash para processamento rápido de linguagem natural e evitar limites de cota
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const systemInstruction = `
Você é a IA de um SaaS Contábil inteligente. Sua tarefa é analisar mensagens de áudio transcritas ou mensagens de texto enviadas por clientes via WhatsApp e identificar comandos de contabilidade, principalmente atualizações de planilhas de fluxo de caixa, despesas ou receitas.

Formatos esperados na resposta (JSON):
{
  "action": "edit_spreadsheet" | "create_document" | "unknown",
  "documentName": "Nome da planilha ou documento que o usuário se referiu (Ex: 'Financeiro', 'Balanço', 'Despesas'. Padrão: 'Financeiro')",
  "data": {
    "date": "Data no formato AAAA-MM-DD. Use a data de hoje (${new Date().toISOString().split('T')[0]}) se nenhuma data for informada na mensagem",
    "description": "Descrição curta do lançamento (Ex: 'Aluguel do escritório', 'Combustível da frota')",
    "category": "Categoria simplificada (Ex: 'aluguel', 'energia', 'vendas', 'combustivel', 'suprimentos', 'impostos')",
    "amount": "Valor numérico (Ex: 150.00). Use números positivos tanto para despesa quanto receita, nós diferenciaremos com base no contexto."
  },
  "replyMessage": "Uma resposta bonita e profissional em português brasileiro para enviar de volta no WhatsApp do cliente, confirmando o que foi feito (Ex: 'Perfeito! Lancei R$ 150,00 em despesas de aluguel na sua planilha Financeiro.')"
}

Se a mensagem não contiver dados suficientes para fazer um lançamento contábil, defina "action" como "unknown" e crie uma resposta educada explicando o que precisa.
`;

    const prompt = `
Mensagem recebida: "${messageText}"

Gere o JSON correspondente conforme as instruções do sistema.
`;

    const result = await model.generateContent([
      { text: systemInstruction },
      { text: prompt }
    ]);

    const responseText = result.response.text();
    console.log("🤖 Resposta estruturada do Gemini:", responseText);
    
    return JSON.parse(responseText);
  } catch (err) {
    console.error("Erro ao chamar a API do Gemini:", err);
    return {
      action: "unknown",
      replyMessage: "Desculpe, ocorreu um erro interno ao processar sua solicitação de Inteligência Artificial. Por favor, tente novamente em instantes!"
    };
  }
}

module.exports = {
  parseWhatsAppMessage
};
