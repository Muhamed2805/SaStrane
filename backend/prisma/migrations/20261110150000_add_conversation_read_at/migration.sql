-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "clientReadAt" TIMESTAMP(3),
ADD COLUMN     "executorReadAt" TIMESTAMP(3);

-- A side without unread messages has read the conversation up to its
-- last message.
UPDATE "Conversation" SET "clientReadAt" = "lastMessageAt"
WHERE "clientUnread" = 0 AND "lastMessageAt" IS NOT NULL;
UPDATE "Conversation" SET "executorReadAt" = "lastMessageAt"
WHERE "executorUnread" = 0 AND "lastMessageAt" IS NOT NULL;
