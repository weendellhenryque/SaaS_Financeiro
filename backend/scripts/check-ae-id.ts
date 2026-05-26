import { prisma } from '../src/db/prisma.js';

async function main() {
  const clients = await prisma.cliente.findMany({
    where: {
      nomeEmpresa: {
        contains: 'A E PRODUÇÕES',
        mode: 'insensitive'
      }
    }
  });
  console.log('Clients found:', clients);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
