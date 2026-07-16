-- phoneNumber passa a ser opcional (cadastro web por email+senha não tem telefone)
ALTER TABLE "users" ALTER COLUMN "phoneNumber" DROP NOT NULL;
