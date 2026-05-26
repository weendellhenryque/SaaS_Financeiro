import { prisma } from '../db/prisma.js';
import { listFilesInFolder } from '../services/drive.js';
import { IndexStatus } from '@prisma/client';

const SYNC_INTERVAL_MS = 60 * 1000; // 1 minuto entre varreduras

/**
 * Sincroniza o espelho de arquivos do Google Drive com o PostgreSQL.
 * Varre as pastas de todos os clientes ativos.
 */
export async function syncDriveOnce() {
  console.log('🔄 [SyncDrive] Iniciando varredura incremental de arquivos no Drive...');
  
  try {
    const clientes = await prisma.cliente.findMany({
      where: { isActive: true },
    });

    console.log(`[SyncDrive] Sincronizando arquivos para ${clientes.length} clientes...`);

    for (const cliente of clientes) {
      console.log(`[SyncDrive] Buscando arquivos no Drive para: "${cliente.nomeEmpresa}"...`);
      
      try {
        // 1. Listar arquivos reais da pasta no Google Drive
        const driveFiles = await listFilesInFolder(cliente.driveFolderId, true);
        const driveFileIds = new Set(driveFiles.map((f) => f.id));

        // 2. Buscar arquivos atualmente salvos no banco para este cliente
        const dbFiles = await prisma.driveFile.findMany({
          where: { clienteId: cliente.id },
          select: { id: true, driveFileId: true, modifiedTime: true },
        });
        const dbFileMap = new Map(dbFiles.map((f) => [f.driveFileId, f]));

        let addedCount = 0;
        let updatedCount = 0;

        // 3. Adicionar ou Atualizar arquivos no banco
        for (const df of driveFiles) {
          const dbFile = dbFileMap.get(df.id);
          const driveModifiedTime = new Date(df.modifiedTime);

          if (!dbFile) {
            // Arquivo novo
            await prisma.driveFile.create({
              data: {
                driveFileId: df.id,
                fileName: df.name,
                mimeType: df.mimeType,
                sizeBytes: BigInt(df.size || '0'),
                modifiedTime: driveModifiedTime,
                webViewLink: df.webViewLink || null,
                clienteId: cliente.id,
                indexStatus: IndexStatus.PENDING,
              },
            });
            addedCount++;
          } else {
            // Arquivo existente - verificar se mudou
            const dbModifiedTime = new Date(dbFile.modifiedTime);
            if (driveModifiedTime.getTime() > dbModifiedTime.getTime()) {
              await prisma.driveFile.update({
                where: { id: dbFile.id },
                data: {
                  fileName: df.name,
                  mimeType: df.mimeType,
                  sizeBytes: BigInt(df.size || '0'),
                  modifiedTime: driveModifiedTime,
                  webViewLink: df.webViewLink || null,
                  indexStatus: IndexStatus.PENDING, // Volta para pendente para reindexar!
                  errorMessage: null,
                  indexedAt: null,
                },
              });
              updatedCount++;
            }
          }
        }

        // 4. Excluir arquivos no banco que foram apagados no Drive
        let deletedCount = 0;
        for (const dbFile of dbFiles) {
          if (!driveFileIds.has(dbFile.driveFileId)) {
            // Foi deletado no Drive! Deleta do banco (Chunks serão cascade deletados!)
            await prisma.driveFile.delete({
              where: { id: dbFile.id },
            });
            deletedCount++;
          }
        }

        if (addedCount > 0 || updatedCount > 0 || deletedCount > 0) {
          console.log(`✨ [SyncDrive] Concluído para "${cliente.nomeEmpresa}": +${addedCount} novos, ~${updatedCount} atualizados, -${deletedCount} deletados.`);
        }
      } catch (folderErr: any) {
        console.error(`❌ [SyncDrive] Erro ao processar pasta do cliente "${cliente.nomeEmpresa}":`, folderErr.message);
      }
    }

    console.log('✅ [SyncDrive] Sincronização concluída com sucesso.');
  } catch (err: any) {
    console.error('❌ [SyncDrive] Erro geral na sincronização:', err.message);
  }
}

/**
 * Função principal para rodar o worker continuamente em segundo plano.
 */
async function main() {
  console.log('🚀 [Worker SyncDrive] Sincronizador de arquivos inicializado.');
  
  // Executa imediatamente na inicialização
  await syncDriveOnce();

  // Entra no loop infinito com intervalo regulado
  setInterval(async () => {
    await syncDriveOnce();
  }, SYNC_INTERVAL_MS);
}

// Executar se chamado diretamente pela linha de comando
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('syncDrive.ts')) {
  main().catch((err) => {
    console.error('❌ [Worker SyncDrive] Falha fatal:', err);
    process.exit(1);
  });
}
