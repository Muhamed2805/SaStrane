-- Users can turn off activity emails.
ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- Tracks the unread-message emails, at most one per side until it reads
-- the conversation. Existing unread messages get no email.
ALTER TABLE "Conversation" ADD COLUMN "clientEmailedAt" TIMESTAMP(3),
ADD COLUMN "clientUnreadSince" TIMESTAMP(3),
ADD COLUMN "executorEmailedAt" TIMESTAMP(3),
ADD COLUMN "executorUnreadSince" TIMESTAMP(3);

CREATE INDEX "Conversation_clientUnreadSince_idx" ON "Conversation"("clientUnreadSince");

CREATE INDEX "Conversation_executorUnreadSince_idx" ON "Conversation"("executorUnreadSince");
