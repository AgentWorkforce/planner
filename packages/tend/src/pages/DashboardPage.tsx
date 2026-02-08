import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TendLayout } from '@/components/layout/TendLayout';
import { StatusBar } from '@/components/status/StatusBar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConversationInput } from '@/components/conversation/ConversationInput';
import { ProjectsColumn } from '@/components/dashboard/ProjectsColumn';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useDashboardChat } from '@/hooks/useDashboardChat';

interface Project {
  id: string;
  name: string;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * DashboardPage
 *
 * Same three-column layout as project pages (the-now.md: "This layout never changes"):
 * - Left: Project DRAFTS as physics blocks (early-stage projects only).
 * - Center: AI conversation with the Navigator — discusses priorities, suggests next actions.
 *           NOT a project-creation form. Projects are created via [+ new] in the tree.
 * - Right: Projects as a tree. "Projects live in the tree (right column)." (the-now.md line 149)
 *
 * No forms. No wizards. The center is a real AI conversation.
 * (tend-spec.md §3.7: "Center: the AI discusses priorities, suggests next actions")
 *
 * @route /
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Navigator AI conversation
  const { messages, send, sending } = useDashboardChat();

  useEffect(() => {
    fetchProjects();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const fetchProjects = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setProjects(data.projects);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  };

  // Split projects: drafts (early-stage, session only) vs established (have plan or run)
  const drafts = projects.filter(p => p.session_id && !p.plan_id && !p.run_id);

  // Helper: phase text for tree items
  const getPhaseText = (project: Project): string | null => {
    if (project.run_id) return 'forging';
    if (project.plan_id) return 'planning';
    if (project.session_id) return 'ideating';
    return null;
  };


  // Build contextual greeting based on project state (the-conversation.md lines 158-170)
  // Returns JSX nodes so we can include clickable links for project names
  const getGreeting = (): { main: React.ReactNode; sub: React.ReactNode } => {
    // First time — no projects (the-conversation.md line 172)
    if (projects.length === 0) {
      return {
        main: 'What would you like to work on?',
        sub: null,
      };
    }

    // Sort by most recent activity
    const sorted = [...projects].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    // Active projects (with sessions/plans/runs)
    const active = sorted.filter(p => p.session_id || p.plan_id || p.run_id);
    const mostRecent = active[0];

    // Active work exists (the-conversation.md lines 161-163)
    // "Links, not buttons. Directional, not pushy."
    if (mostRecent) {
      return {
        main: (
          <>
            We were working on{' '}
            <Link
              to={`/projects/${mostRecent.id}`}
              className="text-accent-primary hover:underline"
            >
              {mostRecent.name}
            </Link>
            .
          </>
        ),
        sub: active.length > 1
          ? `You also have ${active.length - 1} other active project${active.length > 2 ? 's' : ''}. Pick one from the tree, or start something new.`
          : 'Pick it from the tree to continue, or start something new.',
      };
    }

    // Nothing active (the-conversation.md lines 167-168)
    return {
      main: `Nothing active right now.`,
      sub: 'Want to revisit a project from the tree, or start something new?',
    };
  };

  const greeting = getGreeting();

  // ─── Nav: just "tend" + theme toggle ───
  const nav = (
    <div className="flex items-center justify-between h-full px-4">
      <span className="text-text-primary text-sm font-medium tracking-wide">tend</span>
      <ThemeToggle />
    </div>
  );

  // ─── Left panel: project DRAFTS as physics blocks ───
  // "project drafts in progress — projects that haven't matured past early conversation"
  // (the-now.md lines 95-111)
  const leftPanel = (
    <ProjectsColumn
      projects={drafts}
      loading={loading}
      error={fetchError}
      onProjectClick={(id) => navigate(`/projects/${id}`)}
    />
  );

  // ─── Center: AI conversation with the Navigator ───
  // (tend-spec.md §3.7: "Center: the AI discusses priorities, suggests next actions")
  const center = (
    <div className="flex flex-col h-full">
      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col justify-end min-h-full gap-3">
          {/* Greeting as first assistant bubble — contextual based on project state */}
          <div className="max-w-lg">
            <div className="bg-bg-secondary rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm">
              <p className="text-text-primary text-sm leading-relaxed">
                {greeting.main}
              </p>
              {greeting.sub && (
                <p className="text-text-secondary text-sm leading-relaxed mt-1.5">
                  {greeting.sub}
                </p>
              )}
            </div>
          </div>

          {/* Conversation messages from Navigator AI */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? 'flex justify-end' : ''}
            >
              <div
                className={
                  msg.role === 'user'
                    ? 'max-w-lg bg-accent-primary/15 rounded-2xl rounded-br-sm px-5 py-3'
                    : 'max-w-lg bg-bg-secondary rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm'
                }
              >
                <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator while waiting for Navigator response */}
          {sending && (
            <div className="max-w-lg">
              <TypingIndicator />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat input at bottom — sends to Navigator AI, NOT project creation */}
      <div className="flex-shrink-0">
        <ConversationInput
          onSend={send}
          disabled={sending}
          placeholder="What would you like to work on?"
        />
      </div>
    </div>
  );

  // ─── Right panel: projects as ASCII tree ───
  // the-tree.md lines 205-248: "Text-based list with attention indicators. Not cards."
  // ASCII symbols for structure: └, ·, ⟳, 🔴
  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 font-mono text-sm">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : projects.length === 0 ? (
          /* Empty state — zen garden (the-conversation.md line 172) */
          <p className="text-text-muted">No projects yet</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const phase = getPhaseText(project);

              return (
                <button
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full text-left group"
                >
                  {/* Project name — typography for hierarchy, no decoration */}
                  <div className="text-text-primary font-semibold group-hover:text-accent-primary transition-colors truncate">
                    {project.name}
                  </div>
                  {/* Sub-line with └ prefix, phase, and time */}
                  {phase && (
                    <div className="text-text-muted text-xs mt-0.5 pl-0.5">
                      <span className="text-text-muted/60">└ </span>
                      {phase}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Separator + [+ new] at bottom-right of project tree */}
      {/* the-tree.md lines 219-238 */}
      <div className="px-4 pb-4">
        <div className="border-t border-border-subtle mb-3" />
        <button
          onClick={() => {
            const input = document.querySelector('[data-conversation-input]') as HTMLTextAreaElement;
            input?.focus();
          }}
          className="text-text-muted hover:text-text-secondary text-sm font-mono transition-colors"
        >
          [+ new]
        </button>
      </div>
    </div>
  );

  return (
    <TendLayout
      leftCollapsed={false}
      nav={nav}
      leftPanel={leftPanel}
      center={center}
      rightPanel={rightPanel}
      statusBar={<StatusBar connectionStatus="connected" />}
    />
  );
}
