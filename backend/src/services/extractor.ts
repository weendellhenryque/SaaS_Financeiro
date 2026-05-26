import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface ExtractedPage {
  pageNumber?: number;
  text: string;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  totalText: string;
  needsOcr: boolean;
  pageCount: number;
}

const MIN_TEXT_PER_PAGE = 50; // < 50 chars/página = provavelmente escaneado

/**
 * Extrai texto preservando estrutura por página (quando possível).
 */
export async function extract(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractionResult> {
  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return extractPdf(buffer);
  }
  if (
    mimeType.includes('wordprocessingml') ||
    fileName.toLowerCase().endsWith('.docx')
  ) {
    return extractDocx(buffer);
  }
  if (
    mimeType.includes('spreadsheetml') ||
    fileName.toLowerCase().endsWith('.xlsx') ||
    fileName.toLowerCase().endsWith('.xls')
  ) {
    return extractXlsx(buffer);
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('plain') ||
    fileName.toLowerCase().endsWith('.txt') ||
    fileName.toLowerCase().endsWith('.key') ||
    fileName.toLowerCase().endsWith('.pem')
  ) {
    const text = buffer.toString('utf-8');
    return {
      pages: [{ text }],
      totalText: text,
      needsOcr: false,
      pageCount: 1,
    };
  }

  throw new Error(`Formato não suportado: ${mimeType} (${fileName})`);
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const data = await pdfParse(buffer);
  const pageCount = data.numpages;
  // pdf-parse retorna todo o texto junto, sem separação clara por página
  const text = data.text.trim();
  const avgPerPage = text.length / Math.max(pageCount, 1);
  const needsOcr = avgPerPage < MIN_TEXT_PER_PAGE;
  return {
    pages: needsOcr ? [] : [{ text }],
    totalText: text,
    needsOcr,
    pageCount,
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    pages: [{ text: result.value }],
    totalText: result.value,
    needsOcr: false,
    pageCount: 1,
  };
}

async function extractXlsx(buffer: Buffer): Promise<ExtractionResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const pages: ExtractedPage[] = [];
  workbook.SheetNames.forEach((sheetName, idx) => {
    const sheet = workbook.Sheets[sheetName];
    // Converte para CSV preservando cabeçalho
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    // Anota a aba no texto para o RAG ter contexto
    const annotated = `[Planilha: ${sheetName}]\n${csv}`;
    pages.push({ pageNumber: idx + 1, text: annotated });
  });
  const totalText = pages.map((p) => p.text).join('\n\n');
  return {
    pages,
    totalText,
    needsOcr: false,
    pageCount: pages.length,
  };
}
