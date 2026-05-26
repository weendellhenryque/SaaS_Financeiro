import { prisma } from '../src/db/prisma.js';
import { listFilesInFolder } from '../src/services/drive.js';

async function main() {
  console.log('--- SEARCHING FOR .PEM FILES ON GOOGLE DRIVE ---');
  const clients = await prisma.cliente.findMany();
  let foundCount = 0;
  
  for (const c of clients) {
    try {
      const driveFiles = await listFilesInFolder(c.driveFolderId, true);
      const pemFiles = driveFiles.filter(f => f.name.toLowerCase().endsWith('.pem'));
      
      if (pemFiles.length > 0) {
        console.log(`\nClient: ${c.nomeEmpresa} has ${pemFiles.length} PEM files:`);
        for (const f of pemFiles) {
          console.log(`  - ID: ${f.id} | Name: ${f.name} | MimeType: ${f.mimeType} | Size: ${f.size}`);
          foundCount++;
        }
      }
    } catch (err: any) {
      console.error(`  Error listing files for ${c.nomeEmpresa}:`, err.message);
    }
  }

  if (foundCount === 0) {
    console.log('\nNo PEM files found in Google Drive for ANY client!');
  } else {
    console.log(`\nFound a total of ${foundCount} PEM files on Google Drive.`);
  }
}

main()
  .catch(err => {
    console.error('Error:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
