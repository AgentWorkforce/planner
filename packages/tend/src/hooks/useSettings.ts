import { useState, useEffect, useCallback } from 'react';

/**
 * User settings for notifications and agent preferences
 */
export interface TendSettings {
  notifications: {
    questionBubbles: boolean;
    soundAlerts: boolean;
  };
  agent: {
    defaultResponseSpeed: 'fast' | 'balanced' | 'thorough';
    autoApprove: boolean;
  };
}

const DEFAULT_SETTINGS: TendSettings = {
  notifications: {
    questionBubbles: true,
    soundAlerts: false,
  },
  agent: {
    defaultResponseSpeed: 'balanced',
    autoApprove: false,
  },
};

const SETTINGS_KEY = 'tend-settings';

/**
 * Load settings from localStorage
 */
function loadSettings(): TendSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('[useSettings] Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: TendSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[useSettings] Failed to save settings:', e);
  }
}

/**
 * useSettings hook
 *
 * Manages user preferences for notifications and agent behavior.
 * Settings persist to localStorage under 'tend-settings' key.
 *
 * @example
 * ```tsx
 * function SettingsPanel() {
 *   const { settings, updateSettings } = useSettings();
 *
 *   return (
 *     <div>
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={settings.notifications.questionBubbles}
 *           onChange={(e) => updateSettings({
 *             notifications: { ...settings.notifications, questionBubbles: e.target.checked }
 *           })}
 *         />
 *         Show question bubbles
 *       </label>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSettings() {
  const [settings, setSettings] = useState<TendSettings>(loadSettings);

  // Persist settings on change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Update specific settings
  const updateSettings = useCallback((updates: Partial<TendSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...updates,
      notifications: { ...prev.notifications, ...updates.notifications },
      agent: { ...prev.agent, ...updates.agent },
    }));
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
