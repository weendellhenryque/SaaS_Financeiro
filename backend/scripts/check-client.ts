import { prisma } from '../src/db/prisma.js';

async function main() {
  const clientName = 'A E PRODUÇÕES ARTISTICAS';
  console.log(`--- SCANNING SPECIFICALLY FOR PEM/6 FILES FOR: ${clientName} ---`);
  
  const client = await prisma.cliente.findFirst({
    where: {
      nomeEmpresa: {
        contains: clientName,
        mode: 'insensitive'
      }
    }
  });

  if (!client) {
    console.log('Client not found!');
    return;
  }

  const files = await prisma.driveFile.findMany({
    where: { 
      clienteId: client.id,
      fileName: {
        contains: '684B2101',
        mode: 'insensitive'
      }
    }
  });

  console.log(`Found matching files in DB: ${files.length}`);
  for (const f of files) {
    console.log(`- ID: ${f.id} | Name: ${f.fileName} | Status: ${f.indexStatus} | MimeType: ${f.mimeType}`);
  }

  console.log('\n--- ALL ACTIVE FILES OF CLIENT (NO TRUNCATION) ---');
  const allFiles = await prisma.driveFile.findMany({
    where: { clienteId: client.id },
    orderBy: { fileName: 'asc' }
  });
  console.log(`Total active files in DB: ${allFiles.length}`);
  
  // Find where our file is
  const fileIndex = allFiles.findIndex(f => f.fileName.includes('684B2101'));
  console.log(`PEM File Index in sorted list: ${fileIndex}`);
  if (fileIndex !== -1) {
    console.log('Surrounding files:');
    for (let i = Math.max(0, fileIndex - 2); i <= Math.min(allFiles.length - 1, fileIndex + 2); i++) {
      console.log(`  [${i}] Name: ${allFiles[i].fileName} | Status: ${allFiles[i].indexStatus}`);
    }
  }
}

main()
  .catch(err => {
    console.error('Error:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
