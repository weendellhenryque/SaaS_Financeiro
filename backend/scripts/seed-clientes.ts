import { listClientFolders } from '../src/services/drive.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/db/prisma.js';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Iniciando seeding do banco de dados...');

  // 1. Criar Usuários Contadores Parceiros
  console.log('👥 Criando usuários (Contadores)...');
  const passwordHash = await bcrypt.hash('BastosLuz2026!', 10);

  const usersToSeed = [
    {
      email: 'alessandro@bastoseluz.com.br',
      phoneE164: '5511999999999',
      name: 'Alessandro Bastos',
      passwordHash,
      isActive: true,
    },
    {
      email: 'mariana@bastoseluz.com.br',
      phoneE164: '5511988888888',
      name: 'Mariana Luz',
      passwordHash,
      isActive: true,
    },
  ];

  for (const u of usersToSeed) {
    const user = await prisma.appUser.upsert({
      where: { email: u.email },
      update: {
        phoneE164: u.phoneE164,
        name: u.name,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
      },
      create: u,
    });
    console.log(`   - Usuário ${user.name} (${user.email}) criado/atualizado.`);
  }

  // 2. Buscar Pastas-Cliente no Google Drive
  console.log('📂 Listando pastas-cliente no Google Drive...');
  const folders = await listClientFolders(env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  console.log(`   - ${folders.length} pastas encontradas.`);

  // 3. Salvar no Banco
  console.log('💾 Salvando clientes no banco de dados...');
  let seededCount = 0;
  for (const f of folders) {
    await prisma.cliente.upsert({
      where: { driveFolderId: f.id },
      update: {
        nomeEmpresa: f.name,
      },
      create: {
        driveFolderId: f.id,
        nomeEmpresa: f.name,
        isActive: true,
      },
    });
    seededCount++;
  }

  console.log(`✅ Seeding finalizado com sucesso! ${seededCount} clientes adicionados/atualizados.`);
}

main()
  .catch((err) => {
    console.error('❌ Erro no seeding:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
