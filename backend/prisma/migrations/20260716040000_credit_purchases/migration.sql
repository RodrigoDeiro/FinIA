-- CreateTable: compras no cartão de crédito (parceladas)
CREATE TABLE "credit_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "installments" INTEGER NOT NULL,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "card" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_purchases_userId_deletedAt_idx" ON "credit_purchases"("userId", "deletedAt");

ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
