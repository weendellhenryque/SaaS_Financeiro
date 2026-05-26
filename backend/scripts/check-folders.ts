import { prisma } from '../src/db/prisma.js';

async function main() {
  const clients = await prisma.cliente.findMany();
  clients.forEach(c => {
    console.log(`Client: ${c.nomeEmpresa} | ID: ${c.id} | Folder: ${c.driveFolderId}`);
  });
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
