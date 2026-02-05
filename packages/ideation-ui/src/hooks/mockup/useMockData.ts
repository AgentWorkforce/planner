import { useCallback, useMemo, useState } from 'react';
import type { Block, Message } from '@/lib/mockup/block-utils';

const EMOJI_POOL = ['✨', '🧠', '🔧', '🎯', '📦', '📌', '🧩', '⚡️', '🛰️', '🪄', '🧱', '🗂️'];
const BLOCK_TYPES: Block['type'][] = ['feature', 'entity', 'integration', 'component', 'flow'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

export function useMockData() {
  const [blocks, setBlocks] = useState<Block[]>([
    {
      id: '1',
      type: 'feature',
      title: 'User Authentication',
      keyword: 'Login',
      emoji: '🔐',
      status: 'draft',
      maturity: 75,
      confidence: 72,
      content: `# User Authentication

## Summary
Allow users to sign in with email/password or OAuth providers.

## User Stories
- As a user, I can create an account with email
- As a user, I can log in with Google
- As a user, I can reset my password

## Key Decisions
- Use JWT tokens for session management
- Support Google and GitHub OAuth initially

## Open Questions
- Should we require email verification?
`,
    },
    {
      id: '2',
      type: 'entity',
      title: 'User Profile',
      keyword: 'User',
      emoji: '👤',
      status: 'draft',
      maturity: 45,
      confidence: 58,
      content: `# User Profile

## Summary
Core user entity storing account information.

## Fields
- id: UUID
- email: string (unique)
- name: string
- avatar_url: string (optional)
- created_at: timestamp

## Relationships
- has_many: sessions
- has_many: projects
`,
    },
    {
      id: '3',
      type: 'integration',
      title: 'Payment Processing',
      keyword: 'Payments',
      emoji: '💳',
      status: 'draft',
      maturity: 25,
      confidence: 64,
      content: `# Payment Processing

## Summary
Integrate Stripe for subscription billing.

## Requirements
- Monthly subscription plans
- Usage-based billing option
- Invoice generation
`,
    },
    {
      id: '4',
      type: 'component',
      title: 'Dashboard',
      keyword: 'Dashboard',
      emoji: '📊',
      status: 'approved',
      maturity: 90,
      confidence: 92,
      content: `# Dashboard Component

## Summary
Main landing page after login showing project overview.

## Layout
- Header with user menu
- Project grid/list
- Quick actions sidebar
`,
    },
    {
      id: '5',
      type: 'flow',
      title: 'Onboarding',
      keyword: 'Onboard',
      emoji: '🚀',
      status: 'draft',
      maturity: 60,
      confidence: 77,
      content: `# Onboarding Flow

## Summary
Guide new users through initial setup.

## Steps
1. Welcome screen
2. Profile setup
3. First project creation
4. Tutorial overlay
`,
    },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: "I'd love to hear about your project idea. What are you looking to build?",
      timestamp: new Date(Date.now() - 60000 * 5),
    },
    {
      id: '2',
      sender: 'user',
      text: 'I want to build a SaaS platform for project management with team collaboration features.',
      timestamp: new Date(Date.now() - 60000 * 4),
    },
    {
      id: '3',
      sender: 'agent',
      text: "Interesting! I'm starting to see some key concepts emerge. You'll need user authentication, team management, and project organization. I've created some initial blocks on the left - click any to see more details.",
      timestamp: new Date(Date.now() - 60000 * 3),
    },
  ]);

  const approveBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, status: 'approved' } : block)));
  }, []);

  const addBlock = useCallback(() => {
    const keyword = randomLetters(5);
    const maturity = clamp(Math.round(20 + Math.random() * 70), 20, 90);
    const confidence = clamp(Math.round(50 + Math.random() * 50), 50, 100);
    const emoji = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
    const type = BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];

    const newBlock: Block = {
      id: `${Date.now()}`,
      type,
      title: keyword,
      keyword,
      emoji,
      status: 'draft',
      maturity,
      confidence,
      content: `# ${keyword} Concept

## Summary
Newly spawned idea block for exploration.

## Notes
- Auto-generated draft for brainstorming
- Expand with details and acceptance criteria
`,
    };

    setBlocks((prev) => [newBlock, ...prev]);
  }, []);

  const addMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: `${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      const agentMessage: Message = {
        id: `${Date.now() + 1}`,
        sender: 'agent',
        text: 'I understand. Let me think about that and update the concepts...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMessage]);
    }, 1000);
  }, []);

  const sortedDraftBlocks = useMemo(
    () =>
      blocks
        .filter((block) => block.status === 'draft')
        .sort((a, b) => b.confidence - a.confidence || b.maturity - a.maturity),
    [blocks],
  );
  const draftBlocks = useMemo(() => sortedDraftBlocks.slice(0, 20), [sortedDraftBlocks]);
  const approvedBlocks = useMemo(() => blocks.filter((block) => block.status === 'approved'), [blocks]);

  return {
    blocks,
    messages,
    approveBlock,
    addBlock,
    addMessage,
    draftBlocks,
    approvedBlocks,
  };
}
