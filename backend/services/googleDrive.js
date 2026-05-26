const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const keyPath = path.join(__dirname, '../google-service-account.json');
let authClient = null;

// Inicializar autenticação do Google
if (fs.existsSync(keyPath)) {
  try {
    authClient = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });
    console.log('✅ Credenciais do Google Cloud carregadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao configurar autenticação do Google:', err);
  }
} else {
  console.warn('⚠️ google-service-account.json não encontrado no diretório backend. As APIs do Google rodarão em modo de simulação/mock.');
}

// Obter clientes da API do Google
function getDriveClient() {
  if (!authClient) return null;
  return google.drive({ version: 'v3', auth: authClient });
}

function getSheetsClient() {
  if (!authClient) return null;
  return google.sheets({ version: 'v4', auth: authClient });
}

// 1. Listar arquivos da conta/pasta
async function listDriveFiles() {
  const drive = getDriveClient();
  if (!drive) {
    console.warn("Modo simulação: listDriveFiles()");
    return [];
  }

  try {
    const res = await drive.files.list({
      pageSize: 30,
      fields: 'files(id, name, mimeType, webViewLink, iconLink)',
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.document'"
    });
    return res.data.files || [];
  } catch (err) {
    console.error('Erro ao listar arquivos no Google Drive:', err);
    throw err;
  }
}

// 2. Criar uma nova Planilha no Google Drive
async function createGoogleSpreadsheet(name) {
  const drive = getDriveClient();
  const sheets = getSheetsClient();
  
  if (!drive || !sheets) {
    console.warn(`Modo simulação: Criando planilha '${name}'`);
    return {
      id: `mock-drive-id-${Date.now()}`,
      webViewLink: 'https://docs.google.com/spreadsheets/d/mock'
    };
  }

  try {
    // Criar arquivo de Planilha
    const fileMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, webViewLink'
    });

    const spreadsheetId = file.data.id;

    // Inicializar a planilha com um cabeçalho profissional de Contabilidade
    const headers = [['Data', 'Descrição', 'Categoria', 'Valor (R$)', 'Data de Lançamento']];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1:E1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: headers }
    });

    console.log(`✅ Planilha criada e inicializada: ${name} (ID: ${spreadsheetId})`);
    return file.data;
  } catch (err) {
    console.error(`Erro ao criar planilha '${name}':`, err);
    throw err;
  }
}

// 3. Adicionar linha à Planilha do Google
async function addRowToGoogleSpreadsheet(spreadsheetId, data) {
  const sheets = getSheetsClient();
  if (!sheets) {
    console.warn(`Modo simulação: Adicionando linha na planilha ID '${spreadsheetId}':`, data);
    return true;
  }

  try {
    const values = [[
      data.date,
      data.description,
      data.category,
      parseFloat(data.amount),
      new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A:E',
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    console.log(`✅ Linha inserida com sucesso na planilha ID: ${spreadsheetId}`);
    return true;
  } catch (err) {
    console.error('Erro ao adicionar linha na planilha do Google:', err);
    throw err;
  }
}

// 4. Buscar ou Criar Documento no Banco de Dados sincronizado com Google Drive
async function getOrCreateDocument(tenantId, documentName, type = 'spreadsheet') {
  // Buscar no banco de dados local/remoto
  let doc = await prisma.document.findFirst({
    where: {
      tenantId,
      name: { equals: documentName, mode: 'insensitive' }
    }
  });

  if (!doc) {
    console.log(`📂 Documento '${documentName}' não encontrado no Banco. Criando no Google Drive...`);
    let driveFileId = `mock-drive-${Date.now()}`;
    let webViewLink = 'https://docs.google.com/spreadsheets/d/mock';

    try {
      const googleFile = await createGoogleSpreadsheet(documentName);
      driveFileId = googleFile.id;
      webViewLink = googleFile.webViewLink;
    } catch (err) {
      console.warn('⚠️ Falha ao criar no Google Drive. Usando mock devido a credenciais ausentes.');
    }

    // Salvar metadados no Banco de Dados PostgreSQL
    doc = await prisma.document.create({
      data: {
        name: documentName,
        driveFileId,
        type,
        url: webViewLink,
        tenantId
      }
    });
    console.log(`📂 Registro de Documento salvo no Banco de Dados: ID ${doc.id}`);
  }

  return doc;
}

module.exports = {
  listDriveFiles,
  createGoogleSpreadsheet,
  addRowToGoogleSpreadsheet,
  getOrCreateDocument
};
