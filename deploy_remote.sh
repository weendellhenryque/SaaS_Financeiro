#!/bin/bash
# ==============================================================================
# ⚙️ SCRIPT DE INSTALAÇÃO E DEPLOY REMOTO NA VPS - EXECUTADO NO SERVIDOR (TAR.GZ)
# ==============================================================================

set -e

echo "📂 Acessando diretório do backend..."
cd /root/saas_financeiro/backend

echo "📦 Extraindo arquivos do tarball (tar.gz)..."
tar -xzf saas_backend.tar.gz
rm -f saas_backend.tar.gz

echo "📦 Instalando dependências de produção (npm install)..."
npm install --production

echo "⚙️ Gerando cliente do Prisma..."
npx prisma generate

echo "📝 Verificando arquivo de configuração de produção (.env)..."
if [ ! -f .env ]; then
  echo 'DATABASE_URL="postgresql://saas_admin:SaasAdminPassword2026!@localhost:5432/saas_financeiro?schema=public"' > .env
  echo 'PORT=5000' >> .env
  echo "✅ Novo .env criado."
else
  echo "✅ .env existente preservado."
fi

echo "🔄 Iniciando servidor no gerenciador de processos PM2..."
pm2 delete saas-backend 2>/dev/null || true
pm2 start src/index.ts --name "saas-backend" --interpreter npx --interpreter-args tsx
pm2 save

echo "======================================================================"
echo "🚀 DEPLOY EFETUADO COM SUCESSO E SERVIDOR RODANDO NO PM2!"
echo "======================================================================"
