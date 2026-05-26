// ==============================================================================
// 🚀 PIPELINE DE DEPLOY AUTOMÁTICO - NODE.JS
// ==============================================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VPS_IP = '168.231.68.93';
const REMOTE_DIR = '/root/saas_financeiro/backend';

console.log('======================================================================');
console.log('📦 1. Compactando arquivos do Backend com tar (ignorando node_modules)...');
console.log('======================================================================');

try {
  // Executar tar.exe do Windows para criar o tarball de forma rápida e nativa
  execSync('tar --exclude=node_modules --exclude=auth_info_baileys --exclude=dev.db -czf saas_backend.tar.gz -C backend .', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Arquivo saas_backend.tar.gz criado com sucesso!');
} catch (err) {
  console.error('❌ Erro ao compactar:', err);
  process.exit(1);
}

console.log('======================================================================');
console.log('🚀 2. Enviando saas_backend.tar.gz e script de deploy para a VPS...');
console.log('======================================================================');

try {
  // Garantir diretório remoto na VPS
  execSync(`ssh -o StrictHostKeyChecking=no root@${VPS_IP} "mkdir -p ${REMOTE_DIR}"`, { stdio: 'inherit' });
  
  // Copiar os arquivos via SCP de forma limpa
  execSync(`scp -o StrictHostKeyChecking=no saas_backend.tar.gz root@${VPS_IP}:${REMOTE_DIR}/saas_backend.tar.gz`, { stdio: 'inherit', cwd: __dirname });
  execSync(`scp -o StrictHostKeyChecking=no deploy_remote.sh root@${VPS_IP}:${REMOTE_DIR}/deploy_remote.sh`, { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Envio concluído com sucesso!');
} catch (err) {
  console.error('❌ Erro no envio via SCP:', err);
  process.exit(1);
}

console.log('======================================================================');
console.log('⚙️ 3. Executando script de instalação remoto na VPS...');
console.log('======================================================================');

try {
  // Executar o script de deploy remoto via SSH
  execSync(`ssh -o StrictHostKeyChecking=no root@${VPS_IP} "chmod +x ${REMOTE_DIR}/deploy_remote.sh && ${REMOTE_DIR}/deploy_remote.sh"`, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Erro na execução remota:', err);
  process.exit(1);
}

// Limpar o tarball local após deploy bem-sucedido
const tarballPath = path.join(__dirname, 'saas_backend.tar.gz');
if (fs.existsSync(tarballPath)) {
  fs.unlinkSync(tarballPath);
}

console.log('======================================================================');
console.log('🎉 DEPLOY CONCLUÍDO COM EXCELÊNCIA!');
console.log('======================================================================');
