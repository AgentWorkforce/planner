import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/Button';
import { useRelayConnection } from '@/hooks/useRelayConnection';
import { useCultivateGreenhouses } from '@/hooks/useCultivateGreenhouses';
import { useEffect } from 'react';

/**
 * SettingsPage - Application settings and preferences
 *
 * Provides user controls for:
 * - Theme (light/dark/system)
 * - Notification timing
 * - Graduation threshold
 * - Execution defaults
 * - Connection status
 *
 * All settings are automatically persisted to localStorage.
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { state: connectionState, reconnect } = useRelayConnection('User', false);
  const {
    settings,
    updateSettings,
    updateBubbleTiming,
    updateExecutionDefaults,
  } = useSettings();

  const { greenhouses, loading: greenhousesLoading } = useCultivateGreenhouses();

  // Sync theme from settings to useTheme hook
  useEffect(() => {
    if (settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings.theme, theme, setTheme]);

  return (
    <div className="min-h-screen bg-bg-deep">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="text-text-secondary hover:text-text-primary text-sm mb-4 inline-flex items-center gap-2 transition-colors"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary mt-4">Settings</h1>
        </div>

        {/* Theme Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">Appearance</h2>
          <div className="bg-bg-card rounded-lg border border-border-subtle p-6">
            <label className="block text-sm font-medium text-text-primary mb-3">
              Theme
            </label>
            <ToggleGroup
              type="single"
              value={settings.theme}
              onValueChange={(value) => {
                if (value) {
                  const newTheme = value as 'light' | 'dark' | 'system';
                  updateSettings({ theme: newTheme });
                  setTheme(newTheme);
                }
              }}
              variant="tabs"
            >
              <ToggleGroupItem value="light" aria-label="Light theme">
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" aria-label="System theme">
                System
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-text-muted mt-3">
              Choose your preferred color scheme or follow your system settings.
            </p>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">Notifications</h2>
          <div className="bg-bg-card rounded-lg border border-border-subtle p-6 space-y-5">
            <p className="text-sm text-text-muted mb-4">
              Control how long notification bubbles appear based on their priority level.
            </p>

            {/* Blocking */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Blocking (Critical) - {settings.bubble_timing.blocking}s
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={settings.bubble_timing.blocking}
                onChange={(e) =>
                  updateBubbleTiming({ blocking: Number(e.target.value) })
                }
                className="w-full accent-accent-primary"
              />
              <p className="text-xs text-text-muted mt-1">0 = stays until dismissed</p>
            </div>

            {/* Normal */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Normal - {settings.bubble_timing.normal}s
              </label>
              <input
                type="range"
                min="3"
                max="15"
                value={settings.bubble_timing.normal}
                onChange={(e) =>
                  updateBubbleTiming({ normal: Number(e.target.value) })
                }
                className="w-full accent-accent-primary"
              />
            </div>

            {/* FYI */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                FYI (Informational) - {settings.bubble_timing.fyi}s
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={settings.bubble_timing.fyi}
                onChange={(e) =>
                  updateBubbleTiming({ fyi: Number(e.target.value) })
                }
                className="w-full accent-accent-primary"
              />
            </div>
          </div>
        </section>

        {/* Graduation Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">Graduation</h2>
          <div className="bg-bg-card rounded-lg border border-border-subtle p-6">
            <label className="block text-sm font-medium text-text-primary mb-2">
              Graduation Threshold - {settings.graduation_threshold}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.graduation_threshold}
              onChange={(e) =>
                updateSettings({ graduation_threshold: Number(e.target.value) })
              }
              className="w-full accent-accent-primary"
            />
            <p className="text-xs text-text-muted mt-3">
              Minimum confidence percentage required before a project can graduate from ideation to planning.
            </p>
          </div>
        </section>

        {/* Execution Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">Execution</h2>
          <div className="bg-bg-card rounded-lg border border-border-subtle p-6 space-y-5">
            <p className="text-sm text-text-muted mb-4">
              Default settings for agent execution and task orchestration.
            </p>

            {/* Max Concurrent */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Max Concurrent Agents
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.execution_defaults.max_concurrent}
                onChange={(e) =>
                  updateExecutionDefaults({ max_concurrent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Timeout (seconds)
              </label>
              <input
                type="number"
                min="60"
                max="3600"
                step="30"
                value={settings.execution_defaults.timeout}
                onChange={(e) =>
                  updateExecutionDefaults({ timeout: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            {/* Retries */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Max Retries
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={settings.execution_defaults.retries}
                onChange={(e) =>
                  updateExecutionDefaults({ retries: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>
          </div>
        </section>

        {/* Connection Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">Connection</h2>
          <div className="bg-bg-card rounded-lg border border-border-subtle p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">Relay Status</p>
                <p className="text-sm text-text-muted">
                  {connectionState === 'connected' && 'Connected'}
                  {connectionState === 'connecting' && 'Connecting...'}
                  {connectionState === 'disconnected' && 'Disconnected'}
                  {connectionState === 'reconnecting' && 'Reconnecting...'}
                  {connectionState === 'error' && 'Connection Error'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Status indicator */}
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-success'
                      : connectionState === 'connecting' || connectionState === 'reconnecting'
                      ? 'bg-warning'
                      : 'bg-error'
                  }`}
                />
                {/* Reconnect button */}
                {connectionState !== 'connected' && connectionState !== 'connecting' && (
                  <Button variant="secondary" size="sm" onClick={reconnect}>
                    Reconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Signal Sources Section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">Signal Sources</h2>
          <div className="bg-bg-card rounded-lg border border-border-subtle p-6">
            {greenhousesLoading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : greenhouses.length === 0 ? (
              <p className="text-sm text-text-muted">
                No greenhouses configured. Use Quick Start from the dashboard to set up signal intake.
              </p>
            ) : (
              <div className="space-y-3">
                {greenhouses.map((gh) => (
                  <div
                    key={gh.id}
                    className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{gh.name}</p>
                      <p className="text-xs text-text-muted">
                        {gh.source_ids.length} source{gh.source_ids.length !== 1 ? 's' : ''} · {gh.mode}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
