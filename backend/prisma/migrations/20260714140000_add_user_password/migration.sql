-- AlterTable: adiciona hash de senha para login web (email + senha)
ALTER TABLE "users" ADD COLUMN "passwordHash" VARCHAR(255);
