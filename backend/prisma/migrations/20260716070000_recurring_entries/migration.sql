-- CreateTable: lançamentos recorrentes (contas fixas + renda mensal)
CREATE TABLE "recurring_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "categoryId" TEXT,
    "dayOfMonth" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "recurring_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_entries_userId_deletedAt_idx" ON "recurring_entries"("userId", "deletedAt");

ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
