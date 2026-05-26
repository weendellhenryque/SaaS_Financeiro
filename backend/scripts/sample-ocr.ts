import { listClientFolders, listFilesInFolder, downloadFile } from '../src/services/drive.js';
import pdfParse from 'pdf-parse';
import { env } from '../src/config/env.js';

const SAMPLE_SIZE = 50;
const TEXT_THRESHOLD = 100;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  console.log('🔍 Listando todas as pastas-cliente...');
  const folders = await listClientFolders(env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  console.log(`📂 ${folders.length} pastas encontradas`);
  console.log('📄 Coletando todos os PDFs...');
  const allPdfs: Array<{ id: string; name: string }> = [];
  for (const folder of folders) {
    const files = await listFilesInFolder(folder.id);
    allPdfs.push(
      ...files
        .filter((f) => f.mimeType === 'application/pdf')
        .map((f) => ({ id: f.id, name: f.name })),
    );
  }
  console.log(`📄 ${allPdfs.length} PDFs no acervo total`);
  if (allPdfs.length === 0) {
    console.log('Nenhum PDF encontrado.');
    return;
  }
  const sample = shuffle(allPdfs).slice(0, SAMPLE_SIZE);
  console.log(`\n🧪 Amostra de ${sample.length} arquivos:\n`);
  let scanned = 0;
  let textual = 0;
  let errors = 0;
  for (const file of sample) {
    try {
      const buffer = await downloadFile(file.id, 'application/pdf');
      const parsed = await pdfParse(buffer);
      const len = parsed.text.trim().length;
      const isScanned = len < TEXT_THRESHOLD;
      if (isScanned) scanned++;
      else textual++;
      console.log(
        `${isScanned ? '[📷 Escaneado] ' : '[📝 Textual] '} ${file.name.slice(0, 60)} — ${len} chars`,
      );
    } catch (err: any) {
      errors++;
      console.log(`⚠️ ${file.name}: erro ${err.message}`);
    }
  }
  console.log('\n📊 RESULTADO:');
  console.log(`   Textual: ${textual} (${((textual / sample.length) * 100).toFixed(1)}%)`);
  console.log(`   Escaneado: ${scanned} (${((scanned / sample.length) * 100).toFixed(1)}%)`);
  console.log(`   ⚠️ Erros: ${errors}`);
  const estimatedScanned = Math.round((scanned / sample.length) * allPdfs.length);
  const estimatedOcrCost = estimatedScanned * 5 * 0.0015; // ~5 páginas/arquivo @ $1.50/1000
  console.log(`\n🔮 Estimativa de PDFs escaneados no acervo: ~${estimatedScanned}`);
  console.log(`   Custo aproximado de OCR único: ~US$ ${estimatedOcrCost.toFixed(2)}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
