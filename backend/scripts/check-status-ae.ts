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
    const files = await prisma.driveFile.findMany({
      where: {
        clienteId: c.id,
        fileName: {
          in: [
            'ChavePrivadaSoluti.key',
            'Codigo de Acesso MEI.txt',
            'DARC - COMPROVANTE.pdf',
            'DARC COMPROVANTE DE PGTO.pdf',
            'DARC.pdf',
            'DBE.pdf'
          ]
        }
      }
    });
    console.log('Files statuses in DB:');
    files.forEach(f => {
      console.log(`- File: ${f.fileName} | Status: ${f.indexStatus} | Error: ${f.errorMessage}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
