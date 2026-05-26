const CHUNK_SIZE = 800; // tokens aproximados (~3200 caracteres em PT)
const OVERLAP = 100; // tokens de sobreposição

export interface Chunk {
  content: string;
  pageNumber?: number | null;
  chunkIndex: number;
}

export interface ChunkOptions {
  pageNumber?: number | null;
  maxChunkSize?: number;
  overlapSize?: number;
  fileName?: string;
}

/**
 * Quebra texto em chunks com overlap, tentando respeitar fronteiras de
 * parágrafo (\n\n) e depois sentença (.) para preservar contexto.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const clean = text.replace(/\s+\n/g, '\n').replace(/\0/g, '').trim();
  if (clean.length === 0) return [];

  const maxChunkSize = options.maxChunkSize ?? CHUNK_SIZE;
  const overlapSize = options.overlapSize ?? OVERLAP;
  const charsPerChunk = maxChunkSize * 4;
  const charsOverlap = overlapSize * 4;

  const chunks: Chunk[] = [];
  let cursor = 0;
  let idx = 0;

  while (cursor < clean.length) {
    let end = Math.min(cursor + charsPerChunk, clean.length);
    if (end < clean.length) {
      // tenta cortar em quebra de parágrafo
      const paragraphCut = clean.lastIndexOf('\n\n', end);
      if (paragraphCut > cursor + charsPerChunk / 2) {
        end = paragraphCut;
      } else {
        // ou em ponto final
        const sentenceCut = clean.lastIndexOf('. ', end);
        if (sentenceCut > cursor + charsPerChunk / 2) {
          end = sentenceCut + 1;
        }
      }
    }
    
    const slice = clean.slice(cursor, end).trim();
    if (slice.length > 0) {
      chunks.push({ 
        content: slice, 
        pageNumber: options.pageNumber, 
        chunkIndex: idx++ 
      });
    }

    // Se alcançou o final do texto, interrompe para evitar loop infinito
    if (end >= clean.length) {
      break;
    }

    cursor = end - charsOverlap;
    if (cursor <= 0) break;
  }
  return chunks;
}
