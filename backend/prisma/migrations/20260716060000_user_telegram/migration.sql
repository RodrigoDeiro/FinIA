-- Vínculo do Telegram: chat_id do usuário (único quando presente)
ALTER TABLE "users" ADD COLUMN "telegramChatId" VARCHAR(32);
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");
