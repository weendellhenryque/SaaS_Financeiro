# 📊 SaaS Financeiro & Inteligência Contábil — Grupo contábil Bastos & Luz

Plataforma premium de contabilidade digital em nuvem (SaaS) com gestão colaborativa de documentos (GED) integrada ao Google Drive (5TB) e um Robô Inteligente de WhatsApp integrado ao **Gemini 2.5 Flash** para classificação e lançamentos contábeis automáticos a partir de mensagens naturais de áudio e texto.

O sistema está **100% online em ambiente de produção** na VPS Hostinger sob o endereço:
👉 **[http://168.231.68.93/](http://168.231.68.93/)**

---

## 🛠️ Arquitetura e Tecnologias

### 💻 Frontend (Painel do Cliente)
* **Vite + React (JavaScript):** Aplicação SPA ágil e modular.
* **Design Premium (Glassmorphism):** Interface corporativa escura com efeitos translúcidos blur, animações sutis de pulso e transições suaves.
* **Foco no Cliente:** Painel adaptado para o cliente final, com selos de **Ambiente Seguro**, **Criptografia SSL Ativa** e sem informações cruas de infraestrutura técnica.
* **Componentes Principais:**
  * *Playground de Simulação WhatsApp:* Área para testes de envio contábil direto com IA.
  * *Histórico de Auditoria Geral (Ledger):* Feed de lançamentos dinâmico alimentado pelo PostgreSQL.
  * *Visualizador GED Drive:* Listagem e abertura de planilhas de forma integrada.

### ⚙️ Backend (API & Serviços)
* **Node.js + Express:** API Restful rápida e robusta.
* **Gemini 2.5 Flash:** Inteligência Artificial integrada para interpretar comandos de voz/texto contábeis e retornar dados estruturados JSON (data, valor, categoria, descrição).
* **Google Drive API (Drive Simulator):** Módulo inteligente para gerenciar planilhas financeiras de forma transparente.
* **Baileys (WhatsApp Session Client):** Conexão robusta ao protocolo do WhatsApp Web via QR Code em tempo real.
* **Prisma ORM & PostgreSQL 16:** Modelagem e persistência profissional estruturada em um banco de dados relacional de produção hospedado na VPS.

---

## 📂 Estrutura do Projeto

```text
SaaS_Financeiro/
├── frontend/                     # Aplicação React SPA
│   ├── src/
│   │   ├── App.jsx               # Dashboard Principal (Layout, Abas, Regras)
│   │   ├── App.css               # Folha de Estilos de Design System (Glassmorphic)
│   │   ├── main.jsx              # Ponto de entrada do React
│   │   └── assets/               # Vetores, Imagens e Recursos Estáticos
│   ├── package.json
│   └── vite.config.js
│
├── backend/                      # Servidor Express, Serviços & Banco
│   ├── routes/
│   │   └── api.js                # Rotas da API (WhatsApp, Drive, Logs, Simulação)
│   ├── services/
│   │   ├── gemini.js             # Integração IA Gemini 2.5 Flash
│   │   ├── whatsapp.js           # Gerenciador de conexão Baileys WhatsApp
│   │   └── googleDrive.js        # Integração e manipulação de Planilhas Google
│   ├── prisma/
│   │   └── schema.prisma         # Modelos do PostgreSQL (Tenant, User, Document, Logs)
│   ├── index.js                  # Ponto de Entrada da API & Semeador de Banco
│   ├── .env                      # Variáveis de ambiente de produção (Ignorado no Git)
│   └── package.json
│
├── deploy.js                     # Script local para Deploy do Backend na VPS
├── deploy_frontend.js            # Script local para Deploy do Frontend e Nginx na VPS
├── deploy_remote.sh              # Script rodado internamente na VPS para Setup do PM2
└── vps_setup.sh                  # Script Bash inicial para preparar o Ubuntu 24.04
```

---

## 🚀 Pipelines de Deploy Automático (Um Único Clique)

Para facilitar a manutenção contínua e eliminar processos manuais de upload via SSH, configuramos dois pipelines integrados em Node.js no diretório raiz do projeto:

### 📦 1. Deploy do Backend (API & Banco de Dados)
Compacta as atualizações locais do backend (ignorando dependências e bancos locais), transfere com segurança via SCP e, na VPS, instala dependências limpas de produção, gera as tabelas do Prisma Client e reinicia o serviço PM2 de forma automática.
```bash
node deploy.js
```

### 🎨 2. Deploy do Frontend (Painel & Nginx)
Compila o React localmente com otimizador Vite (`npm run build`), empacota a pasta `dist` gerada em tarball, faz o envio para a VPS, extrai o conteúdo no diretório web root `/var/www/saas_financeiro/frontend` e reconfigura o servidor Nginx para servir a SPA e criar o proxy reverso para `/api`.
```bash
node deploy_frontend.js
```

---

## 🔐 Segurança e Multi-tenancy

O sistema foi modelado arquiteturalmente no Prisma para dar suporte a múltiplos escritórios contábeis e clientes (Multi-tenant):
* **Tenant Isolation:** A tabela `Tenant` (configurada como *Grupo contábil Bastos & Luz*) isola logicamente todos os arquivos, atividades, usuários e sessões de WhatsApp.
* **Dados Protegidos:** O cabeçalho e a barra lateral do dashboard contêm indicadores visuais de segurança ativa como **Ambiente Seguro** e **Criptografia SSL Ativa (AES-256)**, ideais para acesso direto do cliente final.
