import { MessagesView } from '@/features/messages/components/messages-view';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MessagesView conversationId={id} />;
}
