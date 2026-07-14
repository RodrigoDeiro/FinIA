-- Cria o banco usado pela Evolution API (WhatsApp), separado do banco do FinIA.
-- Roda apenas na PRIMEIRA inicialização do volume do Postgres.
SELECT 'CREATE DATABASE evolution'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
