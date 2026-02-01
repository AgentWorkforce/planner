import { useParams } from 'react-router-dom';
import { SessionChatView } from '@/components/chat';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-text-primary text-lg mb-2">Invalid session</p>
        <p className="text-text-muted text-sm">No session ID provided.</p>
      </div>
    );
  }

  return <SessionChatView sessionId={id} />;
}
