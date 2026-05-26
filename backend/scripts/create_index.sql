CREATE INDEX cliente_nome_trgm_idx ON "Cliente" USING gin ("nomeEmpresa" gin_trgm_ops);
