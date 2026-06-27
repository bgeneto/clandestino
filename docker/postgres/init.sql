-- Executado uma única vez na inicialização do cluster PostgreSQL.
-- O banco principal (clandestino) é criado via POSTGRES_DB.
-- Aqui criamos o banco dedicado para a suíte de testes de integração.
SELECT 'CREATE DATABASE clandestino_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'clandestino_test')
\gexec
