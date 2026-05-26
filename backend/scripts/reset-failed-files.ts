import { prisma } from '../src/db/prisma.js';

async function main() {
  console.log('--- RESETTING FAILED TEXT/PEM/KEY FILES TO PENDING ---');
  
  const failedFiles = await prisma.driveFile.findMany({
    where: {
      indexStatus: 'FAILED',
    }
  });

  console.log(`Found ${failedFiles.length} total FAILED files in the database.`);

  let resetCount = 0;
  for (const f of failedFiles) {
    const ext = f.fileName.split('.').pop()?.toLowerCase() || '';
    const isTextLike = ['txt', 'pem', 'key'].includes(ext) || f.mimeType.startsWith('text/') || f.mimeType.includes('plain');
    
    if (isTextLike) {
      await prisma.driveFile.update({
        where: { id: f.id },
        data: {
          indexStatus: 'PENDING',
          errorMessage: null
        }
      });
      console.log(`  Reset: "${f.fileName}" (MimeType: ${f.mimeType})`);
      resetCount++;
    }
  }

  console.log(`\nSuccessfully reset ${resetCount} text-like failed files to PENDING.`);
}

main()
  .catch(err => {
    console.error('Error:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
