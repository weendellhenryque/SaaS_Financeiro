// ==============================================================================
// 🚀 PIPELINE DE DEPLOY DO FRONTEND - NODE.JS
// ==============================================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VPS_IP = '168.231.68.93';
const REMOTE_WEB_ROOT = '/var/www/saas_financeiro/frontend';
const REMOTE_TEMP_DIR = '/root/saas_financeiro';

console.log('======================================================================');
console.log('🏗️  1. Compilando o Frontend React/Vite para Produção...');
console.log('======================================================================');

try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, 'frontend') });
  console.log('✅ Compilação concluída com sucesso (pasta dist criada)!');
} catch (err) {
  console.error('❌ Erro ao compilar o frontend:', err);
  process.exit(1);
}

console.log('======================================================================');
console.log('📦 2. Compactando arquivos compilados (dist) com tar...');
console.log('======================================================================');

try {
  // Compactar a pasta dist do frontend
  execSync('tar -czf saas_frontend.tar.gz -C frontend/dist .', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Arquivo saas_frontend.tar.gz criado com sucesso!');
} catch (err) {
  console.error('❌ Erro ao compactar:', err);
  process.exit(1);
}

console.log('======================================================================');
console.log('🚀 3. Enviando saas_frontend.tar.gz para a VPS...');
console.log('======================================================================');

try {
  // Garantir diretório temporário remoto na VPS
  execSync(`ssh -o StrictHostKeyChecking=no root@${VPS_IP} "mkdir -p ${REMOTE_TEMP_DIR}"`, { stdio: 'inherit' });
  
  // Copiar o tarball via SCP
  execSync(`scp -o StrictHostKeyChecking=no saas_frontend.tar.gz root@${VPS_IP}:${REMOTE_TEMP_DIR}/saas_frontend.tar.gz`, { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Envio do tarball concluído!');
} catch (err) {
  console.error('❌ Erro no envio via SCP:', err);
  process.exit(1);
}

console.log('======================================================================');
console.log('⚙️  4. Configurando Nginx e Extraindo Frontend na VPS...');
console.log('======================================================================');

const remoteScript = `
set -e
echo "📂 Criando diretório web root..."
mkdir -p ${REMOTE_WEB_ROOT}
rm -rf ${REMOTE_WEB_ROOT}/*

echo "📦 Extraindo arquivos do frontend para o web root..."
tar -xzf ${REMOTE_TEMP_DIR}/saas_frontend.tar.gz -C ${REMOTE_WEB_ROOT}
rm -f ${REMOTE_TEMP_DIR}/saas_frontend.tar.gz

echo "⚙️ Configurando Nginx (SPA + API Proxy)..."
cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root ${REMOTE_WEB_ROOT};
    index index.html;

    # Frontend routes - SPA routing support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo "🔍 Testando configuração do Nginx..."
nginx -t

echo "🔄 Reiniciando serviço do Nginx..."
systemctl restart nginx

echo "✅ Frontend configurado e Nginx reiniciado com sucesso!"
`;

try {
  // Executar os comandos na VPS
  fs.writeFileSync(path.join(__dirname, 'deploy_frontend_vps.sh'), remoteScript.trim());
  execSync(`scp -o StrictHostKeyChecking=no deploy_frontend_vps.sh root@${VPS_IP}:${REMOTE_TEMP_DIR}/deploy_frontend_vps.sh`, { stdio: 'inherit', cwd: __dirname });
  execSync(`ssh -o StrictHostKeyChecking=no root@${VPS_IP} "chmod +x ${REMOTE_TEMP_DIR}/deploy_frontend_vps.sh && ${REMOTE_TEMP_DIR}/deploy_frontend_vps.sh && rm -f ${REMOTE_TEMP_DIR}/deploy_frontend_vps.sh"`, { stdio: 'inherit' });
  
  // Apagar script local temporário
  fs.unlinkSync(path.join(__dirname, 'deploy_frontend_vps.sh'));
} catch (err) {
  console.error('❌ Erro na configuração remota da VPS:', err);
  process.exit(1);
}

// Limpar tarball local
const tarballPath = path.join(__dirname, 'saas_frontend.tar.gz');
if (fs.existsSync(tarballPath)) {
  fs.unlinkSync(tarballPath);
}

console.log('======================================================================');
console.log('🎉 DEPLOY DO FRONTEND CONCLUÍDO COM SUCESSO!');
console.log('🔗 Link de Acesso: http://' + VPS_IP + '/');
console.log('======================================================================');
