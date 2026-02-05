/**
 * Navigator Agent Prompt
 *
 * The Navigator is a meta-level assistant that helps users navigate their workflow.
 * It lives in the dashboard and provides guidance on what to work on next.
 */

// =============================================================================
// Types
// =============================================================================

export interface NavigatorPromptContext {
  /** Currently visible sessions for context */
  sessionSummaries?: SessionSummary[];
  /** User's recent activity for personalization */
  recentActivity?: RecentActivity;
}

export interface SessionSummary {
  id: string;
  status: 'active' | 'abandoned';
  initialIntent: string;
  messageCount: number;
  blockCount: number;
  lastActivity: string;
  hasHandoff: boolean;
  initiativeId?: string;
}

export interface RecentActivity {
  lastSessionId?: string;
  lastActivityTime?: string;
  frequentInitiatives?: string[];
}

// =============================================================================
// System Prompt
// =============================================================================

export function getNavigatorPrompt(context: NavigatorPromptContext = {}): string {
  const { sessionSummaries = [], recentActivity } = context;

  const sessionContext = sessionSummaries.length > 0
    ? buildSessionContext(sessionSummaries)
    : 'No sessions available yet.';

  const activityContext = recentActivity
    ? buildActivityContext(recentActivity)
    : '';

  return `You are the Navigator, a friendly workflow guide helping users decide what to work on next.

## Your Purpose
You help users navigate their ideation workflow by:
- Suggesting which session to continue based on state and momentum
- Recommending starting new sessions when appropriate
- Providing context-aware workflow guidance
- Keeping users productive and focused

## Your Personality
- Conversational and helpful, like a knowledgeable colleague
- Concise - respect the user's time
- Proactive in suggestions but not pushy
- Aware of context (recent activity, session states, priorities)

## Current Context
${sessionContext}
${activityContext}

## Session States Explained
- **Active**: Session in progress, conversation ongoing
- **Abandoned**: User marked as not pursuing (can be resumed)

## Session Signals to Watch For
When recommending sessions, consider:
- **Momentum**: Sessions with recent activity may benefit from continuation
- **Completeness**: Sessions with many blocks may be ready for handoff
- **Staleness**: Sessions untouched for days might need fresh perspective
- **No handoff yet**: Active sessions that haven't been sent to planner

## Workflow Patterns
Common user intentions you can help with:
1. "Continue where I left off" - Resume most recent active session
2. "Start something new" - Create fresh session from intent
3. "Review my progress" - Overview of all sessions
4. "Clean up" - Identify abandoned/stale sessions
5. "What should I focus on?" - Prioritized recommendation

## Response Guidelines

### When User Asks What to Work On
Analyze their sessions and suggest the highest-value next action:
- If they have an active session with momentum, suggest continuing it
- If all sessions are stale, suggest starting fresh or reviewing
- If they have many forming blocks, suggest focusing on crystallization

### When User Wants to Start New
Help them articulate their intent clearly:
- Ask clarifying questions if the idea is vague
- Suggest related existing sessions if there's overlap
- Confirm before creating to avoid duplicates

### When User Seems Stuck
Offer gentle guidance:
- Remind them of session context they might have forgotten
- Suggest alternative approaches
- Offer to explain the workflow

## Tools Available
- list_sessions: See all sessions with their current states
- recommend_action: Get a suggested next action based on context
- start_new_session: Create a new session from an intent

## Important Behaviors

### DO:
- Be helpful and direct
- Provide actionable suggestions
- Consider user's context and history
- Keep responses focused and brief

### DON'T:
- Overwhelm with information
- Make assumptions about priorities without asking
- Push users toward actions they didn't request
- Explain the system architecture (keep it simple)

Remember: You're a guide, not a gatekeeper. Help users get into flow quickly.`;
}

// =============================================================================
// Context Builders
// =============================================================================

function buildSessionContext(sessions: SessionSummary[]): string {
  const active = sessions.filter(s => s.status === 'active');
  const abandoned = sessions.filter(s => s.status === 'abandoned');

  const lines: string[] = [];

  lines.push(`Sessions Overview: ${sessions.length} total (${active.length} active, ${abandoned.length} abandoned)`);

  if (active.length > 0) {
    lines.push('\nActive Sessions:');
    for (const s of active.slice(0, 5)) {
      const handoffStatus = s.hasHandoff ? ' [sent to planner]' : '';
      const blockInfo = s.blockCount > 0 ? ` - ${s.blockCount} blocks` : '';
      lines.push(`- "${s.initialIntent}" (${s.messageCount} messages${blockInfo})${handoffStatus}`);
    }
    if (active.length > 5) {
      lines.push(`  ... and ${active.length - 5} more`);
    }
  }

  if (abandoned.length > 0 && abandoned.length <= 3) {
    lines.push('\nAbandoned Sessions:');
    for (const s of abandoned) {
      lines.push(`- "${s.initialIntent}"`);
    }
  } else if (abandoned.length > 3) {
    lines.push(`\n${abandoned.length} abandoned sessions in parking lot`);
  }

  return lines.join('\n');
}

function buildActivityContext(activity: RecentActivity): string {
  const lines: string[] = ['\nRecent Activity:'];

  if (activity.lastSessionId) {
    lines.push(`- Last worked on session: ${activity.lastSessionId}`);
  }

  if (activity.lastActivityTime) {
    lines.push(`- Last activity: ${activity.lastActivityTime}`);
  }

  if (activity.frequentInitiatives && activity.frequentInitiatives.length > 0) {
    lines.push(`- Frequent initiatives: ${activity.frequentInitiatives.join(', ')}`);
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

// =============================================================================
// Welcome Messages
// =============================================================================

export function getNavigatorWelcome(hasAnySessions: boolean): string {
  if (!hasAnySessions) {
    return `Hi! I'm here to help you navigate your ideation workflow.

It looks like you're just getting started - no sessions yet. Would you like to:
- **Start a new session** - Tell me about an idea you want to explore
- **Learn more** - I can explain how ideation sessions work`;
  }

  return `Hi! I'm your workflow navigator. I can help you decide what to work on next.

What would you like to do?
- Continue an existing session
- Start something new
- Get a recommendation on what to focus on`;
}

export function getRecommendationResponse(
  recommendation: NavigatorRecommendation
): string {
  const { type, reason, sessionId, intent } = recommendation;

  switch (type) {
    case 'continue_session':
      return `I'd suggest continuing your session "${intent}".

${reason}

Would you like to jump back in?`;

    case 'start_new':
      return `It might be a good time to start fresh.

${reason}

What idea would you like to explore?`;

    case 'review_sessions':
      return `You have several sessions that could use attention.

${reason}

Would you like me to walk through them?`;

    case 'handoff_ready':
      return `Your session "${intent}" looks ready for the next step.

${reason}

Would you like to send it to the planner?`;

    default:
      return `${reason}\n\nHow can I help you move forward?`;
  }
}

// =============================================================================
// Recommendation Types
// =============================================================================

export interface NavigatorRecommendation {
  type: 'continue_session' | 'start_new' | 'review_sessions' | 'handoff_ready';
  reason: string;
  sessionId?: string;
  intent?: string;
  confidence: 'low' | 'medium' | 'high';
}
