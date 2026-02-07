/**
 * SettingsPage
 *
 * User settings and preferences.
 *
 * @route /settings
 */

import { useTheme, useSettings } from '@/hooks';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings, resetSettings } = useSettings();

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>

      {/* Theme Section */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Theme</h2>
        <div className="bg-bg-elevated rounded-lg border border-border-subtle p-4">
          <p className="text-sm text-text-muted mb-4">
            Choose how Tend looks. System matches your device preference.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-accent-green text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-accent-green text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                theme === 'system'
                  ? 'bg-accent-green text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              System
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Notifications</h2>
        <div className="bg-bg-elevated rounded-lg border border-border-subtle p-4 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium text-text-primary">Question Bubbles</div>
              <div className="text-sm text-text-muted">
                Show visual notifications when agents ask questions
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.questionBubbles}
              onChange={(e) =>
                updateSettings({
                  notifications: {
                    ...settings.notifications,
                    questionBubbles: e.target.checked,
                  },
                })
              }
              className="w-4 h-4 accent-accent-green"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium text-text-primary">Sound Alerts</div>
              <div className="text-sm text-text-muted">
                Play sound when important events occur
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.soundAlerts}
              onChange={(e) =>
                updateSettings({
                  notifications: {
                    ...settings.notifications,
                    soundAlerts: e.target.checked,
                  },
                })
              }
              className="w-4 h-4 accent-accent-green"
            />
          </label>
        </div>
      </section>

      {/* Agent Preferences Section */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Agent Preferences</h2>
        <div className="bg-bg-elevated rounded-lg border border-border-subtle p-4 space-y-6">
          <div>
            <label className="text-sm font-medium text-text-primary mb-3 block">
              Default Response Speed
            </label>
            <p className="text-sm text-text-muted mb-3">
              How quickly agents should respond. Faster = less thorough, slower = more detail.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  updateSettings({
                    agent: { ...settings.agent, defaultResponseSpeed: 'fast' },
                  })
                }
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  settings.agent.defaultResponseSpeed === 'fast'
                    ? 'bg-accent-green text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                Fast
              </button>
              <button
                onClick={() =>
                  updateSettings({
                    agent: { ...settings.agent, defaultResponseSpeed: 'balanced' },
                  })
                }
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  settings.agent.defaultResponseSpeed === 'balanced'
                    ? 'bg-accent-green text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                Balanced
              </button>
              <button
                onClick={() =>
                  updateSettings({
                    agent: { ...settings.agent, defaultResponseSpeed: 'thorough' },
                  })
                }
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  settings.agent.defaultResponseSpeed === 'thorough'
                    ? 'bg-accent-green text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                Thorough
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium text-text-primary">Auto-approve Actions</div>
              <div className="text-sm text-text-muted">
                Automatically approve low-risk agent actions
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.agent.autoApprove}
              onChange={(e) =>
                updateSettings({
                  agent: { ...settings.agent, autoApprove: e.target.checked },
                })
              }
              className="w-4 h-4 accent-accent-green"
            />
          </label>
        </div>
      </section>

      {/* About Section */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">About</h2>
        <div className="bg-bg-elevated rounded-lg border border-border-subtle p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Version</span>
            <span className="text-sm text-text-primary font-mono">0.1.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Environment</span>
            <span className="text-sm text-text-primary font-mono">
              {(import.meta as any).env?.MODE || 'development'}
            </span>
          </div>
          <div className="border-t border-border-subtle pt-4 mt-4">
            <button
              onClick={resetSettings}
              className="text-sm text-error hover:text-error font-medium"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
