#!/bin/bash
# ==============================================================================
# 🚀 SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA DA VPS - SAAS FINANCEIRO / CONTÁBIL
# Sistema Operacional Alvo: Ubuntu 24.04 LTS
# ==============================================================================

# Encerrar o script se qualquer comando falhar
set -e

echo "======================================================================"
echo "🎯 Iniciando configuração do servidor Ubuntu 24.04..."
echo "======================================================================"

# 1. Atualizar o sistema de pacotes
echo "🔄 Atualizando listas de pacotes (apt update)..."
sudo apt-get update -y
echo "⬆️ Atualizando pacotes instalados (apt upgrade)..."
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# 2. Instalar dependências essenciais
echo "📦 Instalando dependências essenciais (curl, git, build-essential, etc)..."
sudo apt-get install -y curl git build-essential software-properties-common ufw

# 3. Instalar Node.js 20 LTS (NodeSource)
echo "🟢 Configurando repositório NodeSource para Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
echo "🟢 Instalando Node.js e NPM..."
sudo apt-get install -y nodejs

# Verificar instalações do Node.js e NPM
echo "✅ Node.js instalado: $(node -v)"
echo "✅ NPM instalado: $(npm -v)"

# 4. Instalar o PM2 (Gerenciador de Processos para o Node.js rodar em 24/7)
echo "🔄 Instalando PM2 globalmente..."
sudo npm install -g pm2
echo "✅ PM2 instalado com sucesso."

# 5. Instalar e Configurar o PostgreSQL
echo "🐘 Instalando PostgreSQL e utilitários..."
sudo apt-get install -y postgresql postgresql-contrib

echo "🐘 Iniciando e habilitando o serviço PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configurar Banco de Dados e Usuário
DB_NAME="saas_financeiro"
DB_USER="saas_admin"
DB_PASS="SaasAdminPassword2026!"

echo "🐘 Criando Banco de Dados e Usuário no PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || echo "Banco de dados já existe."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || echo "Usuário já existe."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
# Garantir permissões de esquema para o usuário do prisma
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "✅ PostgreSQL configurado com sucesso!"
echo "📍 Banco: $DB_NAME"
echo "📍 Usuário: $DB_USER"

# 6. Instalar e Configurar o Nginx
echo "🌐 Instalando Nginx..."
sudo apt-get install -y nginx
echo "🌐 Iniciando e habilitando o serviço Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx
echo "✅ Nginx instalado e rodando!"

# 7. Configurar Firewall (UFW)
echo "🛡️ Configurando o Firewall (UFW)..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
echo "✅ Firewall ativado e portas HTTP/HTTPS/SSH configuradas."

echo "======================================================================"
echo "🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"
echo "🖥️ Servidor pronto para hospedar a aplicação."
echo "======================================================================"
