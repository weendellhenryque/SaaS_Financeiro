import { prisma } from '../src/db/prisma.js';

async function main() {
  const result = await prisma.driveFile.updateMany({
    where: { 
      indexStatus: 'FAILED',
      NOT: {
        fileName: {
          endsWith: '.rar',
        }
      }
    },
    data: { 
      indexStatus: 'PENDING', 
      errorMessage: null 
    },
  });
  
  console.log(`✅ Resetado status de ${result.count} arquivos com falha (excluindo .rar) de volta para PENDING.`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
