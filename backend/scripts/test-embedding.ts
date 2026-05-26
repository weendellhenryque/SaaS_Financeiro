import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../src/config/env.js';

async function main() {
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  const models = ['gemini-embedding-2', 'gemini-embedding-2-preview', 'gemini-embedding-001'];

  for (const modelName of models) {
    try {
      console.log(`🧪 Testando modelo "${modelName}" com outputDimensionality: 768...`);
      const model = client.getGenerativeModel({ model: modelName });
      
      const res = await model.embedContent({
        content: { parts: [{ text: 'hello' }] },
        outputDimensionality: 768,
      });
      
      const dims = res.embedding.values.length;
      console.log(`   ✅ SUCESSO! Dimensões do vetor: ${dims}`);
    } catch (err: any) {
      console.log(`   ❌ Falhou para "${modelName}":`, err.message);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
