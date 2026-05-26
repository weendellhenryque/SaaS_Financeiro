import { prisma } from '../src/db/prisma.js';

async function main() {
  console.log('🔄 Resetando MFA do usuário Alessandro Bastos...');
  
  const user = await prisma.appUser.update({
    where: { email: 'alessandro@bastoseluz.com.br' },
    data: { totpSecret: null },
  });

  console.log(`✅ MFA Resetado com sucesso para ${user.name}!`);
  console.log('O segredo totpSecret agora está NULL. No próximo login, o QR Code de configuração será exibido.');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
