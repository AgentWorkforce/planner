import { useParams } from 'react-router-dom';
import { ChannelView } from '@/components/channels';

export function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();

  if (!channelId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted">No channel selected</div>
      </div>
    );
  }

  // Decode the channel ID (it may be URL-encoded)
  const decodedChannelId = decodeURIComponent(channelId);

  // Full height container for chat-app style layout
  return (
    <div className="h-full flex flex-col">
      <ChannelView channelId={decodedChannelId} />
    </div>
  );
}
