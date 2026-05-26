import { prisma } from '../src/db/prisma.js';

async function main() {
  const c = await prisma.cliente.findFirst({
    where: {
      nomeEmpresa: {
        contains: 'A E PRODUÇÕES',
        mode: 'insensitive'
      }
    }
  });
  if (c) {
    const result = await prisma.driveFile.updateMany({
      where: {
        clienteId: c.id,
        fileName: {
          in: [
            'ChavePrivadaSoluti.key',
            'Codigo de Acesso MEI.txt'
          ]
        }
      },
      data: {
        indexStatus: 'PENDING',
        errorMessage: null
      }
    });
    console.log(`✅ Alterado status de ${result.count} arquivos de texto (.key e .txt) para PENDING para reprocessamento imediato.`);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
