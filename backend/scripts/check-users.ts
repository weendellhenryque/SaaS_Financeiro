import { prisma } from '../src/db/prisma.js';

async function main() {
  const users = await prisma.appUser.findMany();
  console.log('👥 USUÁRIOS NO BANCO DE DADOS:');
  for (const u of users) {
    console.log(`   - Nome: ${u.name}`);
    console.log(`     Email: ${u.email}`);
    console.log(`     MFA Secret: ${u.totpSecret || 'NÃO CONFIGURADO (NULL)'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
