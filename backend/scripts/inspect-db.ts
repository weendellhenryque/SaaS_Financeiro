import { prisma } from '../src/db/prisma.js';

async function main() {
  console.log('--- PEM FILES IN DATABASE ---');
  const pemFiles = await prisma.driveFile.findMany({
    where: {
      fileName: {
        endsWith: '.pem',
        mode: 'insensitive'
      }
    }
  });

  if (pemFiles.length === 0) {
    console.log('No PEM files found in the database!');
  } else {
    for (const f of pemFiles) {
      console.log(`ID: ${f.id} | Name: ${f.fileName} | Status: ${f.indexStatus} | Size: ${f.sizeBytes} bytes | ClientId: ${f.clienteId} | Error: ${f.errorMessage}`);
    }
  }

  console.log('\n--- ALL FAILED FILES IN DATABASE ---');
  const failedFiles = await prisma.driveFile.findMany({
    where: {
      indexStatus: 'FAILED'
    },
    orderBy: { fileName: 'asc' }
  });

  for (const f of failedFiles) {
    console.log(`Failed Name: ${f.fileName} | Error: ${f.errorMessage}`);
  }
}

main()
  .catch(err => {
    console.error('Error querying database:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
