export type BlockStatus = 'draft' | 'approved';

export interface Block {
  id: string;
  type: string;
  title: string;
  keyword: string;
  emoji: string;
  status: BlockStatus;
  maturity: number;
  confidence: number;
  content: string;
}

export type MessageSender = 'user' | 'agent';

export interface Message {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
}

export interface BlockPosition {
  x: number;
  y: number;
  angle: number;
}

export const getBlockSize = (maturity: number): number => {
  const clamped = Math.min(100, Math.max(0, maturity));
  return 40 + clamped * 0.6;
};

export const shouldShowKeyword = (size: number): boolean => size > 60;

export const getConfidenceStyle = (confidence: number): { borderWidth: string; borderColor: string } => {
  const clamped = Math.min(100, Math.max(50, confidence));
  const ratio = (clamped - 50) / 50;
  const borderWidth = `${Math.round(1 + ratio * 2)}px`;
  const opacity = 0.1 + ratio * 0.9;
  const hue = 60 + ratio * 60;
  return {
    borderWidth,
    borderColor: `hsl(${hue} 70% 45% / ${opacity})`,
  };
};

export const formatTimestamp = (date: Date): string =>
  new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
