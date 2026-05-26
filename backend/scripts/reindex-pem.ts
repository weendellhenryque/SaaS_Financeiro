import { prisma } from '../src/db/prisma.js';

async function main() {
  const result = await prisma.driveFile.updateMany({
    where: {
      fileName: {
        endsWith: '.pem'
      }
    },
    data: {
      indexStatus: 'PENDING',
      errorMessage: null
    }
  });
  console.log(`✅ Alterado status de ${result.count} arquivos .pem para PENDING para reprocessamento imediato.`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
