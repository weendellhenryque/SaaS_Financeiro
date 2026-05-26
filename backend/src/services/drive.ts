import { driveClient } from '../config/google.js';
import { Readable } from 'stream';

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
}

/**
 * Lista as pastas-cliente filhas da raiz.
 */
export async function listClientFolders(rootFolderId: string) {
  const folders: DriveFileInfo[] = [];
  let pageToken: string | undefined;
  do {
    const res = await driveClient.files.list({
      q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    folders.push(...((res.data.files ?? []) as DriveFileInfo[]));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return folders;
}

/**
 * Lista todos os arquivos dentro de uma pasta (recursivo opcional).
 */
export async function listFilesInFolder(folderId: string, recursive = true) {
  const files: DriveFileInfo[] = [];
  const stack = [folderId];
  while (stack.length) {
    const current = stack.pop()!;
    let pageToken: string | undefined;
    do {
      const res = await driveClient.files.list({
        q: `'${current}' in parents and trashed=false`,
        fields:
          'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, webViewLink)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files ?? []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (recursive) stack.push(f.id!);
        } else {
          files.push(f as DriveFileInfo);
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  return files;
}

/**
 * Baixa o conteúdo de um arquivo como Buffer.
 * Para Google Docs/Sheets nativos, exporta como DOCX/XLSX.
 */
export async function downloadFile(fileId: string, mimeType: string): Promise<Buffer> {
  const GOOGLE_DOC = 'application/vnd.google-apps.document';
  const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';

  if (mimeType === GOOGLE_DOC) {
    const res = await driveClient.files.export(
      {
        fileId,
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  if (mimeType === GOOGLE_SHEET) {
    const res = await driveClient.files.export(
      {
        fileId,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  const res = await driveClient.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Detecta mudanças desde o último token salvo.
 * Documentação: https://developers.google.com/drive/api/guides/manage-changes
 */
export async function getChanges(pageToken: string) {
  const changes: any[] = [];
  let currentToken: string | undefined = pageToken;
  let newStartPageToken: string | undefined;
  do {
    const res = await driveClient.changes.list({
      pageToken: currentToken,
      pageSize: 1000,
      fields:
        'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, size, modifiedTime, parents, webViewLink))',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    changes.push(...(res.data.changes ?? []));
    currentToken = res.data.nextPageToken ?? undefined;
    if (res.data.newStartPageToken) newStartPageToken = res.data.newStartPageToken;
  } while (currentToken);
  return { changes, newStartPageToken };
}

export async function getStartPageToken() {
  const res = await driveClient.changes.getStartPageToken({
    supportsAllDrives: true,
  });
  return res.data.startPageToken!;
}

export async function copyFile(fileId: string, newName: string, parentFolderId?: string): Promise<any> {
  let targetParentId = parentFolderId;

  console.log(`🔍 [copyFile] Iniciando cópia do arquivoId: ${fileId} para nome: ${newName}`);

  if (!targetParentId) {
    try {
      const fileMetadata = await driveClient.files.get({
        fileId,
        fields: 'parents, name, mimeType',
        supportsAllDrives: true,
      });
      console.log(`🔍 [copyFile] Metadados obtidos do arquivo original:`, JSON.stringify(fileMetadata.data));
      if (fileMetadata.data.parents && fileMetadata.data.parents.length > 0) {
        targetParentId = fileMetadata.data.parents[0];
        console.log(`🔍 [copyFile] Pasta-pai identificada: ${targetParentId}`);
      } else {
        console.log(`⚠️ [copyFile] O arquivo original não possui pasta-pai em comum com a Service Account.`);
      }
    } catch (err: any) {
      console.error(`❌ [copyFile] Erro ao obter pasta-pai do arquivo no Drive:`, err.message);
    }
  }

  const requestBody: any = {
    name: newName,
  };
  if (targetParentId) {
    requestBody.parents = [targetParentId];
    console.log(`🔍 [copyFile] Definindo pasta-pai no requestBody: [${targetParentId}]`);
  } else {
    console.log(`⚠️ [copyFile] Nenhum parentFolderId definido. Cópia será criada na raiz (My Drive da Service Account).`);
  }

  try {
    const res = await driveClient.files.copy({
      fileId,
      supportsAllDrives: true,
      supportsTeamDrives: true,
      requestBody,
      fields: 'id, name, mimeType, webViewLink',
    });
    console.log(`✅ [copyFile] Cópia efetuada com sucesso. Rascunho ID: ${res.data.id}`);
    return res.data;
  } catch (err: any) {
    console.error(`❌ [copyFile] Falha na chamada files.copy:`, err.message);
    throw err;
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  await driveClient.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}

export async function overwriteFile(originalFileId: string, draftFileId: string, mimeType: string): Promise<void> {
  const GOOGLE_DOC = 'application/vnd.google-apps.document';
  const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';

  let exportMime: string | undefined;
  if (mimeType === GOOGLE_DOC) {
    exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (mimeType === GOOGLE_SHEET) {
    exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  let buffer: Buffer;
  if (exportMime) {
    // É documento do Google, exporta como binário (docx/xlsx)
    const exportRes = await driveClient.files.export(
      {
        fileId: draftFileId,
        mimeType: exportMime,
      },
      { responseType: 'arraybuffer' }
    );
    buffer = Buffer.from(exportRes.data as ArrayBuffer);
  } else {
    // É binário normal (Word, Excel real)
    const getRes = await driveClient.files.get(
      {
        fileId: draftFileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'arraybuffer' }
    );
    buffer = Buffer.from(getRes.data as ArrayBuffer);
  }

  // Faz upload do buffer no arquivo original
  await driveClient.files.update({
    fileId: originalFileId,
    supportsAllDrives: true,
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
  });
}

/**
 * Atualiza o conteúdo binário de um arquivo diretamente na API do Google Drive usando um buffer local.
 */
export async function updateFileContent(fileId: string, buffer: Buffer, mimeType: string): Promise<void> {
  await driveClient.files.update({
    fileId,
    supportsAllDrives: true,
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
  });
}

