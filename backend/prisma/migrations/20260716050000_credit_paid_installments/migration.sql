-- Controle manual de parcelas pagas (usuário marca "Paguei")
ALTER TABLE "credit_purchases" ADD COLUMN "paidInstallments" INTEGER NOT NULL DEFAULT 0;
