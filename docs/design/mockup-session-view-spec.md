# Session View Mockup Specification

> A freestanding mockup for the new ideation session layout with physics-based draft blocks, minimal chat, and approved blocks list.

## Overview

Build an isolated mockup page at `/mockup` in the `ideation-ui` package. This is a design exploration - it should not affect existing routes or components.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         LIGHT SANDY GRAY BACKGROUND                        │
│                                                                            │
│  ┌──────────────┐    ┌─────────────────────────┐    ┌───────────────────┐  │
│  │              │    │                         │    │ ┌───────────────┐ │  │
│  │  ┌────┐      │    │  Agent text minimal...  │    │ │ Login Feature │ │  │
│  │  │ 🔐 │      │    │                         │    │ └───────────────┘ │  │
│  │  └────┘      │    │  ┌─────────────────┐    │    │ ┌───────────────┐ │  │
│  │     ┌──────┐ │    │  │ User message    │    │    │ │ User Entity   │ │  │
│  │     │👤User│ │    │  │ in bubble       │    │    │ └───────────────┘ │  │
│  │     └──────┘ │    │  └─────────────────┘    │    │                   │  │
│  │  ┌────┐      │    │                         │    │                   │  │
│  │  │ 💳 │      │    │  Agent responds...      │    │                   │  │
│  │  └────┘      │    │                         │    │                   │  │
│  │              │    │                         │    │                   │  │
│  │   DRAFT      │    │  ┌───────────────────┐  │    │    APPROVED       │  │
│  │   BLOCKS     │    │  │ Type here...      │  │    │    BLOCKS         │  │
│  │   (physics)  │    │  └───────────────────┘  │    │    (stacked)      │  │
│  └──────────────┘    └─────────────────────────┘    └───────────────────┘  │
│       ~30%                   ~45%                         ~25%             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Framework**: React + TypeScript (existing ideation-ui setup)
- **Physics**: matter.js (`npm install matter-js @types/matter-js`)
- **Styling**: Tailwind CSS (existing setup)
- **Markdown**: react-markdown (for mini-spec rendering in drawer)

---

## File Structure

```
packages/ideation-ui/src/
├── pages/
│   └── MockupPage.tsx              # Main page component
├── components/
│   └── mockup/
│       ├── DraftBlocksCanvas.tsx   # Physics simulation container
│       ├── PhysicsBlock.tsx        # Individual block in physics sim
│       ├── MinimalChat.tsx         # Chat area component
│       ├── ChatMessage.tsx         # Individual message
│       ├── FloatingInput.tsx       # Text input at bottom
│       ├── ApprovedBlocksList.tsx  # Right column list
│       ├── ApprovedBlockCard.tsx   # Individual approved block
│       ├── BlockDetailDrawer.tsx   # Mini-spec viewer drawer
│       └── mockup-theme.css        # Light mode styles
├── hooks/
│   └── mockup/
│       ├── usePhysicsEngine.ts     # Matter.js lifecycle
│       └── useMockData.ts          # Sample blocks and messages
└── lib/
    └── mockup/
        └── block-utils.ts          # Emoji/keyword helpers
```

---

## Color Palette (Light Mode Only)

```css
:root {
  --mockup-bg: #f5f0e8;              /* Sandy gray background */
  --mockup-bg-subtle: #ebe6de;       /* Slightly darker for depth */
  --mockup-text: #2d2d2d;            /* Primary text */
  --mockup-text-muted: #7a7a7a;      /* Agent messages */
  --mockup-text-light: #9a9a9a;      /* Timestamps, hints */

  --mockup-user-bubble: #ffffff;     /* User message bubble */
  --mockup-user-bubble-shadow: rgba(0,0,0,0.08);

  --mockup-input-bg: #ffffff;        /* Input background */
  --mockup-input-border: #e0dbd3;    /* Input border */
  --mockup-input-focus: #4a7c59;     /* Focus ring */

  --mockup-block-draft: #e8e4dc;     /* Draft block fill */
  --mockup-block-draft-border: #d4cfc5;
  --mockup-block-approved: #ffffff;  /* Approved block fill */
  --mockup-block-approved-border: #4a7c59;

  --mockup-accent: #4a7c59;          /* Green accent */
  --mockup-accent-light: #e8f0eb;    /* Light green bg */
}
```

---

## Component Specifications

### 1. MockupPage.tsx

The main container with three-column flex layout.

```tsx
interface MockupPageProps {}

// Layout: single full-width container, no sidebars
// Three sections side-by-side using flex
// Background: var(--mockup-bg)
// Full viewport height: h-screen
// Padding: p-6 on all sides

// Structure:
<div className="h-screen w-full bg-[#f5f0e8] p-6 flex gap-6">
  <DraftBlocksCanvas />   {/* flex: 0 0 30% */}
  <MinimalChat />         {/* flex: 1 (takes remaining ~45%) */}
  <ApprovedBlocksList />  {/* flex: 0 0 25% */}
</div>
```

**State to manage:**
- `blocks: Block[]` - all blocks (draft and approved)
- `messages: Message[]` - chat messages
- `selectedBlock: Block | null` - for drawer
- `drawerOpen: boolean`

**Actions:**
- `approveBlock(id)` - moves block from draft to approved with animation
- `openBlockDetail(block)` - opens drawer
- `sendMessage(text)` - adds user message to chat

---

### 2. DraftBlocksCanvas.tsx

Physics simulation for draft blocks using matter.js.

```tsx
interface DraftBlocksCanvasProps {
  blocks: Block[];
  onBlockClick: (block: Block) => void;
  onBlockApprove: (id: string) => void;
}

// Container: relative positioning, full height of parent
// Background: slightly darker than page bg for visual separation
// Border-radius: rounded-2xl
// Overflow: hidden (blocks stay within bounds)
```

**Matter.js Setup:**

```typescript
// Engine configuration
const engine = Engine.create({
  gravity: { x: 0, y: 0 } // No global gravity - we'll use attraction
});

// World bounds - invisible walls
const walls = [
  Bodies.rectangle(width/2, 0, width, 20, { isStatic: true }),      // top
  Bodies.rectangle(width/2, height, width, 20, { isStatic: true }), // bottom
  Bodies.rectangle(0, height/2, 20, height, { isStatic: true }),    // left
  Bodies.rectangle(width, height/2, 20, height, { isStatic: true }) // right
];

// For each block, create a square body
const createBlockBody = (block: Block) => {
  const size = getBlockSize(block.maturity); // 40-100px
  return Bodies.rectangle(
    randomX, randomY,
    size, size,
    {
      restitution: 0.3,      // Bounce
      friction: 0.1,
      frictionAir: 0.02,     // Drag
      chamfer: { radius: 8 }, // Rounded corners
      label: block.id,
    }
  );
};

// Mouse constraint for dragging
const mouse = Mouse.create(canvasRef.current);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false }
  }
});

// Central attraction force (in update loop)
Events.on(engine, 'beforeUpdate', () => {
  const center = { x: width / 2, y: height / 2 };
  for (const body of bodies) {
    const dx = center.x - body.position.x;
    const dy = center.y - body.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const force = 0.00005 * body.mass;
    Body.applyForce(body, body.position, {
      x: (dx / distance) * force,
      y: (dy / distance) * force
    });
  }
});
```

**Drag & Release Behavior:**

```typescript
// On mouse up (release), snap back with shake effect
Events.on(mouseConstraint, 'enddrag', (event) => {
  const draggedBody = event.body;

  // Calculate snap-back position (gentle pull toward center)
  const targetX = width / 2 + (Math.random() - 0.5) * 100;
  const targetY = height / 2 + (Math.random() - 0.5) * 100;

  // Apply velocity toward target
  Body.setVelocity(draggedBody, {
    x: (targetX - draggedBody.position.x) * 0.1,
    y: (targetY - draggedBody.position.y) * 0.1
  });

  // Shake other blocks
  for (const body of bodies) {
    if (body !== draggedBody) {
      Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.002,
        y: (Math.random() - 0.5) * 0.002
      });
    }
  }
});
```

**Block Size Calculation:**

```typescript
const getBlockSize = (maturity: number): number => {
  // maturity: 0-100
  // size: 40px (min) to 100px (max)
  return 40 + (maturity * 0.6);
};
```

**Rendering Blocks (HTML overlay, not canvas drawing):**

```tsx
// Use matter.js for physics, but render with positioned divs
// This allows for rich content (emoji, text, click handlers)

{blocks.map((block) => {
  const body = bodyMap.get(block.id);
  if (!body) return null;

  const size = getBlockSize(block.maturity);
  const showKeyword = size > 60; // Only show keyword if block is big enough

  return (
    <div
      key={block.id}
      className="absolute cursor-pointer select-none"
      style={{
        left: body.position.x - size / 2,
        top: body.position.y - size / 2,
        width: size,
        height: size,
        transform: `rotate(${body.angle}rad)`,
        transition: 'width 0.3s ease, height 0.3s ease',
      }}
      onClick={() => onBlockClick(block)}
    >
      <PhysicsBlock block={block} size={size} showKeyword={showKeyword} />
    </div>
  );
})}
```

---

### 3. PhysicsBlock.tsx

Individual block rendered inside the physics canvas.

```tsx
interface PhysicsBlockProps {
  block: Block;
  size: number;
  showKeyword: boolean;
}

// Visual: Square with rounded corners (rounded-lg)
// Background: var(--mockup-block-draft)
// Border: 1px solid var(--mockup-block-draft-border)
// Shadow: subtle drop shadow
// Content: centered emoji, keyword below if space

// Structure:
<div className="w-full h-full rounded-lg bg-[#e8e4dc] border border-[#d4cfc5]
                shadow-sm flex flex-col items-center justify-center p-1
                hover:shadow-md hover:border-[#c4bfb5] transition-all">
  <span className="text-2xl">{block.emoji}</span>
  {showKeyword && (
    <span className="text-[10px] text-[#7a7a7a] mt-0.5 truncate max-w-full px-1">
      {block.keyword}
    </span>
  )}
</div>
```

---

### 4. MinimalChat.tsx

Chat area with minimal styling - agent text directly on background.

```tsx
interface MinimalChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

// Container: flex-1, flex flex-col, relative
// Messages area: flex-1 overflow-y-auto, padding
// Input: absolute bottom, floating

// Structure:
<div className="flex-1 flex flex-col relative">
  {/* Messages */}
  <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
    {messages.map((msg) => (
      <ChatMessage key={msg.id} message={msg} />
    ))}
  </div>

  {/* Floating input */}
  <FloatingInput onSend={onSendMessage} />
</div>
```

---

### 5. ChatMessage.tsx

Individual message with different styles for user vs agent.

```tsx
interface ChatMessageProps {
  message: Message;
}

// Agent message: plain text, muted color, no container
// User message: white bubble with shadow, right-aligned

// Agent style:
<div className="text-[#7a7a7a] text-sm leading-relaxed max-w-[85%]">
  {message.text}
</div>

// User style:
<div className="flex justify-end">
  <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm max-w-[75%]
                  text-[#2d2d2d] text-sm leading-relaxed">
    {message.text}
  </div>
</div>
```

---

### 6. FloatingInput.tsx

Text input floating at bottom of chat area.

```tsx
interface FloatingInputProps {
  onSend: (text: string) => void;
}

// Position: absolute bottom-4 left-4 right-4
// Height: 3 rows (~80px)
// Background: white
// Border: subtle border, focus ring on focus
// Shadow: medium shadow for floating effect

// Structure:
<div className="absolute bottom-4 left-4 right-4">
  <div className="bg-white rounded-xl border border-[#e0dbd3] shadow-md
                  focus-within:ring-2 focus-within:ring-[#4a7c59]/30
                  focus-within:border-[#4a7c59]">
    <textarea
      className="w-full h-20 px-4 py-3 resize-none bg-transparent
                 text-[#2d2d2d] text-sm placeholder:text-[#9a9a9a]
                 focus:outline-none"
      placeholder="Describe your idea..."
      rows={3}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSend(value);
          setValue('');
        }
      }}
    />
  </div>
</div>
```

---

### 7. ApprovedBlocksList.tsx

Vertical list of approved blocks on the right.

```tsx
interface ApprovedBlocksListProps {
  blocks: Block[];
  onBlockClick: (block: Block) => void;
}

// Container: flex-shrink-0, w-[25%], flex flex-col
// Header: small title "Approved"
// List: flex-1 overflow-y-auto, vertical stack with gap

// Structure:
<div className="w-[25%] flex-shrink-0 flex flex-col">
  <h3 className="text-xs font-medium text-[#7a7a7a] uppercase tracking-wide mb-3">
    Approved
  </h3>
  <div className="flex-1 overflow-y-auto space-y-2">
    {blocks.map((block) => (
      <ApprovedBlockCard
        key={block.id}
        block={block}
        onClick={() => onBlockClick(block)}
      />
    ))}
  </div>
</div>
```

---

### 8. ApprovedBlockCard.tsx

Individual approved block in the list.

```tsx
interface ApprovedBlockCardProps {
  block: Block;
  onClick: () => void;
}

// All cards same size (uniform)
// Background: white
// Border: green accent border
// Content: emoji + title

// Structure:
<button
  onClick={onClick}
  className="w-full bg-white rounded-lg border border-[#4a7c59]/30
             px-3 py-2.5 text-left hover:border-[#4a7c59]
             hover:shadow-sm transition-all group"
>
  <div className="flex items-center gap-2">
    <span className="text-lg">{block.emoji}</span>
    <span className="text-sm text-[#2d2d2d] font-medium truncate">
      {block.title}
    </span>
  </div>
</button>
```

---

### 9. BlockDetailDrawer.tsx

Slide-in drawer showing full mini-spec with approve action.

```tsx
interface BlockDetailDrawerProps {
  block: Block | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
}

// Position: fixed right-0 top-0 bottom-0
// Width: 400px (or 80vw max on mobile)
// Background: white
// Shadow: large shadow on left edge
// Animation: slide in from right

// Structure:
<div className={cn(
  "fixed right-0 top-0 bottom-0 w-[400px] bg-white shadow-xl z-50",
  "transform transition-transform duration-300 ease-out",
  open ? "translate-x-0" : "translate-x-full"
)}>
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0dbd3]">
    <div className="flex items-center gap-2">
      <span className="text-xl">{block?.emoji}</span>
      <h2 className="text-lg font-semibold text-[#2d2d2d]">{block?.title}</h2>
    </div>
    <button onClick={onClose} className="p-1 hover:bg-[#f5f0e8] rounded">
      <XIcon className="w-5 h-5 text-[#7a7a7a]" />
    </button>
  </div>

  {/* Content - rendered markdown */}
  <div className="flex-1 overflow-y-auto px-4 py-4 prose prose-sm">
    <ReactMarkdown>{block?.content}</ReactMarkdown>
  </div>

  {/* Footer with approve button (only for draft blocks) */}
  {block?.status === 'draft' && (
    <div className="px-4 py-3 border-t border-[#e0dbd3]">
      <button
        onClick={() => onApprove(block.id)}
        className="w-full bg-[#4a7c59] text-white rounded-lg py-2.5
                   font-medium hover:bg-[#3d6549] transition-colors"
      >
        Approve
      </button>
    </div>
  )}
</div>

{/* Backdrop */}
{open && (
  <div
    className="fixed inset-0 bg-black/20 z-40"
    onClick={onClose}
  />
)}
```

---

### 10. usePhysicsEngine.ts

Hook managing matter.js lifecycle.

```typescript
interface UsePhysicsEngineOptions {
  containerRef: RefObject<HTMLDivElement>;
  blocks: Block[];
  onBlocksUpdate: (positions: Map<string, { x: number; y: number; angle: number }>) => void;
}

interface UsePhysicsEngineReturn {
  bodyMap: Map<string, Matter.Body>;
  isReady: boolean;
}

export function usePhysicsEngine(options: UsePhysicsEngineOptions): UsePhysicsEngineReturn {
  const { containerRef, blocks, onBlocksUpdate } = options;

  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const bodyMapRef = useRef<Map<string, Matter.Body>>(new Map());

  const [isReady, setIsReady] = useState(false);

  // Initialize engine
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Create engine
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;

    // Create walls
    const walls = [
      Bodies.rectangle(width/2, -10, width, 20, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(width/2, height+10, width, 20, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(-10, height/2, 20, height, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(width+10, height/2, 20, height, { isStatic: true, label: 'wall' }),
    ];
    World.add(engine.world, walls);

    // Mouse constraint
    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } }
    });
    World.add(engine.world, mouseConstraint);

    // Central attraction
    Events.on(engine, 'beforeUpdate', () => {
      const center = { x: width / 2, y: height / 2 };
      const bodies = Composite.allBodies(engine.world);

      for (const body of bodies) {
        if (body.isStatic || body.label === 'wall') continue;

        const dx = center.x - body.position.x;
        const dy = center.y - body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1) continue;

        const force = 0.00003 * body.mass;
        Body.applyForce(body, body.position, {
          x: (dx / distance) * force,
          y: (dy / distance) * force
        });
      }
    });

    // Shake on release
    Events.on(mouseConstraint, 'enddrag', (event) => {
      const bodies = Composite.allBodies(engine.world);
      for (const body of bodies) {
        if (body.isStatic || body === event.body) continue;
        Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * 0.001,
          y: (Math.random() - 0.5) * 0.001
        });
      }
    });

    // Update loop for React state sync
    Events.on(engine, 'afterUpdate', () => {
      const positions = new Map<string, { x: number; y: number; angle: number }>();
      bodyMapRef.current.forEach((body, id) => {
        positions.set(id, {
          x: body.position.x,
          y: body.position.y,
          angle: body.angle
        });
      });
      onBlocksUpdate(positions);
    });

    // Start runner
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    setIsReady(true);

    return () => {
      Runner.stop(runner);
      Engine.clear(engine);
    };
  }, []);

  // Sync blocks to bodies
  useEffect(() => {
    if (!engineRef.current || !isReady) return;

    const engine = engineRef.current;
    const container = containerRef.current;
    if (!container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Add new blocks
    for (const block of blocks) {
      if (block.status !== 'draft') continue;
      if (bodyMapRef.current.has(block.id)) continue;

      const size = 40 + (block.maturity * 0.6);
      const body = Bodies.rectangle(
        width / 2 + (Math.random() - 0.5) * 100,
        height / 2 + (Math.random() - 0.5) * 100,
        size, size,
        {
          restitution: 0.3,
          friction: 0.1,
          frictionAir: 0.02,
          chamfer: { radius: 8 },
          label: block.id,
        }
      );
      World.add(engine.world, body);
      bodyMapRef.current.set(block.id, body);
    }

    // Remove approved blocks
    for (const [id, body] of bodyMapRef.current) {
      const block = blocks.find(b => b.id === id);
      if (!block || block.status !== 'draft') {
        World.remove(engine.world, body);
        bodyMapRef.current.delete(id);
      }
    }

    // Update sizes for existing blocks
    for (const block of blocks) {
      if (block.status !== 'draft') continue;
      const body = bodyMapRef.current.get(block.id);
      if (!body) continue;

      const newSize = 40 + (block.maturity * 0.6);
      const currentSize = body.bounds.max.x - body.bounds.min.x;

      if (Math.abs(newSize - currentSize) > 1) {
        Body.scale(body, newSize / currentSize, newSize / currentSize);
      }
    }
  }, [blocks, isReady]);

  return {
    bodyMap: bodyMapRef.current,
    isReady
  };
}
```

---

### 11. useMockData.ts

Hook providing sample data for the mockup.

```typescript
interface Block {
  id: string;
  type: string;
  title: string;
  keyword: string;
  emoji: string;
  status: 'draft' | 'approved';
  maturity: number; // 0-100
  content: string;  // markdown mini-spec
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

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
`
    },
    {
      id: '2',
      type: 'entity',
      title: 'User Profile',
      keyword: 'User',
      emoji: '👤',
      status: 'draft',
      maturity: 45,
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
`
    },
    {
      id: '3',
      type: 'integration',
      title: 'Payment Processing',
      keyword: 'Payments',
      emoji: '💳',
      status: 'draft',
      maturity: 25,
      content: `# Payment Processing

## Summary
Integrate Stripe for subscription billing.

## Requirements
- Monthly subscription plans
- Usage-based billing option
- Invoice generation
`
    },
    {
      id: '4',
      type: 'component',
      title: 'Dashboard',
      keyword: 'Dashboard',
      emoji: '📊',
      status: 'approved',
      maturity: 90,
      content: `# Dashboard Component

## Summary
Main landing page after login showing project overview.

## Layout
- Header with user menu
- Project grid/list
- Quick actions sidebar
`
    },
    {
      id: '5',
      type: 'flow',
      title: 'Onboarding',
      keyword: 'Onboard',
      emoji: '🚀',
      status: 'draft',
      maturity: 60,
      content: `# Onboarding Flow

## Summary
Guide new users through initial setup.

## Steps
1. Welcome screen
2. Profile setup
3. First project creation
4. Tutorial overlay
`
    },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: "I'd love to hear about your project idea. What are you looking to build?",
      timestamp: new Date(Date.now() - 60000 * 5)
    },
    {
      id: '2',
      sender: 'user',
      text: "I want to build a SaaS platform for project management with team collaboration features.",
      timestamp: new Date(Date.now() - 60000 * 4)
    },
    {
      id: '3',
      sender: 'agent',
      text: "Interesting! I'm starting to see some key concepts emerge. You'll need user authentication, team management, and project organization. I've created some initial blocks on the left - click any to see more details.",
      timestamp: new Date(Date.now() - 60000 * 3)
    },
  ]);

  const approveBlock = useCallback((id: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, status: 'approved' as const } : b
    ));
  }, []);

  const addMessage = useCallback((text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    // Simulate agent response
    setTimeout(() => {
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: "I understand. Let me think about that and update the concepts...",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentMsg]);
    }, 1000);
  }, []);

  return {
    blocks,
    messages,
    approveBlock,
    addMessage,
    draftBlocks: blocks.filter(b => b.status === 'draft'),
    approvedBlocks: blocks.filter(b => b.status === 'approved'),
  };
}
```

---

### 12. Approve Animation

When a block is approved, animate it from left to right.

```tsx
// In MockupPage, track animating blocks
const [animatingBlockId, setAnimatingBlockId] = useState<string | null>(null);
const [animationStartPos, setAnimationStartPos] = useState<{ x: number; y: number } | null>(null);

const handleApprove = (id: string) => {
  // Get current position from physics engine
  const body = bodyMap.get(id);
  if (body) {
    setAnimationStartPos({ x: body.position.x, y: body.position.y });
    setAnimatingBlockId(id);
  }

  // After animation completes, actually approve
  setTimeout(() => {
    approveBlock(id);
    setAnimatingBlockId(null);
    setAnimationStartPos(null);
  }, 500);
};

// Render animating block separately
{animatingBlockId && animationStartPos && (
  <div
    className="fixed z-50 pointer-events-none"
    style={{
      left: animationStartPos.x,
      top: animationStartPos.y,
      animation: 'approveSlide 500ms ease-out forwards',
    }}
  >
    <PhysicsBlock
      block={blocks.find(b => b.id === animatingBlockId)!}
      size={60}
      showKeyword={true}
    />
  </div>
)}

// CSS animation (add to mockup-theme.css)
@keyframes approveSlide {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: translateX(calc(70vw - 100%)) scale(0.8);
    opacity: 0;
  }
}
```

---

## Route Setup

Add to `App.tsx`:

```tsx
import { MockupPage } from '@/pages/MockupPage';

// In Routes:
<Route path="/mockup" element={<MockupPage />} />
```

---

## Implementation Order

1. **Setup** - Install matter-js, create file structure
2. **MockupPage** - Basic layout with three columns
3. **useMockData** - Sample blocks and messages
4. **MinimalChat + ChatMessage + FloatingInput** - Chat area (no physics yet)
5. **ApprovedBlocksList + ApprovedBlockCard** - Right column
6. **usePhysicsEngine** - Matter.js setup
7. **DraftBlocksCanvas + PhysicsBlock** - Physics simulation
8. **BlockDetailDrawer** - Mini-spec viewer
9. **Approve animation** - Transition effect
10. **Polish** - Shadows, hover states, transitions

---

## Testing Checklist

- [ ] Page loads at `/mockup`
- [ ] Draft blocks appear in physics simulation
- [ ] Blocks attract toward center
- [ ] Blocks collide and don't overlap
- [ ] Dragging a block works
- [ ] Releasing a dragged block snaps back
- [ ] Other blocks shake when one is released
- [ ] Clicking a block opens drawer
- [ ] Drawer shows mini-spec content
- [ ] Approve button moves block to approved list
- [ ] Approve animation plays smoothly
- [ ] Chat messages display correctly
- [ ] User messages show in bubbles
- [ ] Agent messages show as plain text
- [ ] Input allows multi-line text
- [ ] Enter sends message
- [ ] Approved blocks list shows all approved
- [ ] Clicking approved block reopens drawer

---

## Notes for Implementation

1. **matter-js rendering**: Don't use the built-in canvas renderer. Use matter.js only for physics calculations, then position HTML elements based on body positions. This allows for richer styling and click handlers.

2. **Animation frame sync**: Use `requestAnimationFrame` or matter.js's `afterUpdate` event to sync React state with physics positions. Avoid calling setState too frequently - batch updates.

3. **Block scaling**: When maturity changes, use `Body.scale()` to resize the physics body smoothly.

4. **Cleanup**: Make sure to properly cleanup matter.js engine on unmount to avoid memory leaks.

5. **Mobile**: This mockup is desktop-focused. Don't worry about mobile responsiveness for now.
