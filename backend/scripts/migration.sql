ALTER TABLE "DocChunk" ADD COLUMN "embedding" vector(768);
CREATE INDEX docchunk_embedding_hnsw_idx ON "DocChunk" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX cliente_nome_trgm_idx ON "Cliente" USING gin (nomeEmpresa gin_trgm_ops);
CREATE INDEX drivefile_filename_trgm_idx ON "DriveFile" USING gin ("fileName" gin_trgm_ops);
