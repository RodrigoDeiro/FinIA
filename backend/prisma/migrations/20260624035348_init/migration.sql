-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'INVESTMENT', 'TRANSFER', 'DEBT');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('WHATSAPP', 'WEB', 'IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ParseMethod" AS ENUM ('DETERMINISTIC', 'AI', 'HYBRID', 'MANUAL');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "CategoryOrigin" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'WEEKLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ABANDONED', 'PAUSED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('SPENDING_INCREASE', 'SPENDING_DECREASE', 'CATEGORY_RANKING', 'BUDGET_ALERT', 'GOAL_PROGRESS', 'SAVINGS_TREND', 'ANOMALY', 'GENERIC');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_DELETED', 'CATEGORY_CORRECTED', 'SESSION_STARTED', 'SESSION_REVOKED', 'REPORT_GENERATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120),
    "email" VARCHAR(255),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "language" VARCHAR(5) NOT NULL DEFAULT 'pt',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CHECKING',
    "institution" VARCHAR(80),
    "color" VARCHAR(6),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "cachedBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "origin" "CategoryOrigin" NOT NULL DEFAULT 'USER',
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "icon" VARCHAR(40),
    "color" VARCHAR(6),
    "applicableTo" "TransactionType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryId" TEXT NOT NULL,
    "defaultType" "TransactionType" NOT NULL DEFAULT 'EXPENSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'WHATSAPP',
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "date" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(500),
    "merchantName" VARCHAR(120),
    "originalText" VARCHAR(1000),
    "parseMethod" "ParseMethod" NOT NULL DEFAULT 'DETERMINISTIC',
    "parseConfidence" DECIMAL(3,2),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "investmentTicker" VARCHAR(20),
    "investmentQuantity" DECIMAL(20,8),
    "investmentInstitution" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" VARCHAR(20) NOT NULL,
    "providerMessageId" VARCHAR(120) NOT NULL,
    "fromPhone" VARCHAR(20) NOT NULL,
    "messageType" VARCHAR(20) NOT NULL,
    "text" TEXT,
    "mediaUrl" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "transactionId" TEXT,
    "providerTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" VARCHAR(255) NOT NULL,
    "userAgent" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "alertThreshold" DECIMAL(3,2) NOT NULL DEFAULT 0.80,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "targetAmount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "currentAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "categoryId" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" VARCHAR(40),
    "seenAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" VARCHAR(40) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "format" VARCHAR(10) NOT NULL,
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" VARCHAR(40) NOT NULL,
    "resourceId" VARCHAR(40),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_isDefault_idx" ON "accounts"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "accounts_deletedAt_idx" ON "accounts"("deletedAt");

-- CreateIndex
CREATE INDEX "categories_userId_idx" ON "categories"("userId");

-- CreateIndex
CREATE INDEX "categories_origin_idx" ON "categories"("origin");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_deletedAt_idx" ON "categories"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_slug_key" ON "categories"("userId", "slug");

-- CreateIndex
CREATE INDEX "merchants_userId_idx" ON "merchants"("userId");

-- CreateIndex
CREATE INDEX "merchants_slug_idx" ON "merchants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_userId_slug_key" ON "merchants"("userId", "slug");

-- CreateIndex
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_accountId_date_idx" ON "transactions"("userId", "accountId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_categoryId_date_idx" ON "transactions"("userId", "categoryId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_type_date_idx" ON "transactions"("userId", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_needsReview_idx" ON "transactions"("userId", "needsReview");

-- CreateIndex
CREATE INDEX "transactions_deletedAt_idx" ON "transactions"("deletedAt");

-- CreateIndex
CREATE INDEX "message_logs_userId_createdAt_idx" ON "message_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "message_logs_fromPhone_createdAt_idx" ON "message_logs"("fromPhone", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "message_logs_processed_idx" ON "message_logs"("processed");

-- CreateIndex
CREATE UNIQUE INDEX "message_logs_provider_providerMessageId_key" ON "message_logs"("provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "budgets_userId_active_idx" ON "budgets"("userId", "active");

-- CreateIndex
CREATE INDEX "budgets_userId_categoryId_idx" ON "budgets"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "budgets_deletedAt_idx" ON "budgets"("deletedAt");

-- CreateIndex
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");

-- CreateIndex
CREATE INDEX "goals_deletedAt_idx" ON "goals"("deletedAt");

-- CreateIndex
CREATE INDEX "ai_insights_userId_createdAt_idx" ON "ai_insights"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_insights_userId_seenAt_idx" ON "ai_insights"("userId", "seenAt");

-- CreateIndex
CREATE INDEX "ai_insights_userId_type_idx" ON "ai_insights"("userId", "type");

-- CreateIndex
CREATE INDEX "reports_userId_createdAt_idx" ON "reports"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
