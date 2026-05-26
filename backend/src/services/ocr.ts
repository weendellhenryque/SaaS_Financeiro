import { visionClient } from '../config/google.js';

interface OcrResult {
  text: string;
  pageCount: number;
}

/**
 * Realiza OCR usando o Google Cloud Vision API.
 * Suporta imagens diretamente (PNG, JPEG) e PDFs escaneados (até 5 páginas via lote síncrono).
 */
export async function performOcr(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  try {
    if (mimeType.toLowerCase() === 'application/pdf') {
      console.log(`[OCR] Iniciando OCR síncrono para PDF (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);
      
      const request = {
        requests: [
          {
            inputConfig: {
              content: buffer.toString('base64'),
              mimeType: 'application/pdf',
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            // Limita síncrono do Vision API a 5 páginas por requisição (limite oficial do Google Cloud Vision online)
            pages: [1, 2, 3, 4, 5],
          },
        ],
      };

      const [response] = await visionClient.batchAnnotateFiles(request as any);
      
      const responses = response.responses;
      if (!responses || responses.length === 0) {
        throw new Error('Nenhuma resposta retornada do Vision API.');
      }

      const fileResponse = responses[0];
      if (fileResponse.error) {
        throw new Error(`Erro do Vision API: ${fileResponse.error.message}`);
      }

      // Concatenar texto de todas as páginas identificadas
      let fullText = '';
      const pages = fileResponse.responses ?? [];
      
      for (const pageResponse of pages) {
        if (pageResponse.fullTextAnnotation?.text) {
          fullText += pageResponse.fullTextAnnotation.text + '\n';
        }
      }

      return {
        text: fullText.trim(),
        pageCount: pages.length || 1,
      };
    } else {
      // É uma imagem (PNG, JPEG, etc.)
      console.log(`[OCR] Iniciando OCR para imagem (${mimeType})...`);
      
      const [result] = await visionClient.documentTextDetection({
        image: { content: buffer },
      });

      const fullText = result.fullTextAnnotation?.text ?? '';
      
      return {
        text: fullText.trim(),
        pageCount: 1,
      };
    }
  } catch (err: any) {
    console.error('❌ Erro durante execução do OCR no Vision API:', err.message);
    throw err;
  }
}
