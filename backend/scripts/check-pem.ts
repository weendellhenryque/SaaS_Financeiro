import { prisma } from '../src/db/prisma.js';

async function main() {
  const files = await prisma.driveFile.findMany({
    where: {
      fileName: {
        endsWith: '.pem'
      }
    }
  });
  console.log(`Found ${files.length} .pem files:`);
  files.forEach(f => {
    console.log(`- File: ${f.fileName} | Status: ${f.indexStatus} | Error: ${f.errorMessage}`);
  });
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
