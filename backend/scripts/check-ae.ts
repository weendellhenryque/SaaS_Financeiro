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
  console.log('Client found:', c);
  if (c) {
    const files = await prisma.driveFile.findMany({
      where: { clienteId: c.id },
      orderBy: { fileName: 'asc' }
    });
    console.log(`Files count for client: ${files.length}`);
    for (const f of files) {
      console.log(`- ID: ${f.id} | Name: ${f.fileName} | Status: ${f.indexStatus} | Error: ${f.errorMessage || 'None'}`);
    }
  } else {
    console.log('Client "A E PRODUÇÕES" not found in DB!');
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
