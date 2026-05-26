import { prisma } from '../src/db/prisma.js';

async function main() {
  const fileCount = await prisma.driveFile.count();
  const clientCount = await prisma.cliente.count();
  const chunkCount = await prisma.docChunk.count();
  
  console.log(`📊 ESTATÍSTICAS DO BANCO DE DADOS:`);
  console.log(`   - Clientes: ${clientCount}`);
  console.log(`   - Arquivos: ${fileCount}`);
  console.log(`   - Fragmentos (Chunks): ${chunkCount}`);

  console.log(`\n📂 PRIMEIROS 5 ARQUIVOS COM FALHA E ERRO:`);
  const failedFiles = await prisma.driveFile.findMany({
    where: { indexStatus: 'FAILED' },
    take: 5,
  });

  for (const f of failedFiles) {
    console.log(`   - ${f.fileName} (${f.mimeType}): ${f.errorMessage}`);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
