import { useState, useEffect, useCallback } from 'react';

/**
 * TendSettings - User preferences for the Tend application
 */
export interface TendSettings {
  /** Theme preference: light, dark, or system */
  theme: 'light' | 'dark' | 'system';

  /** Notification bubble timing (seconds, 0 = stays until dismissed) */
  bubble_timing: {
    blocking: number;
    normal: number;
    fyi: number;
  };

  /** Graduation threshold percentage (0-100) */
  graduation_threshold: number;

  /** Whether to show cost information in UI */
  cost_visibility: boolean;

  /** Default execution parameters */
  execution_defaults: {
    max_concurrent: number;
    timeout: number;
    retries: number;
  };
}

const DEFAULT_SETTINGS: TendSettings = {
  theme: 'system',
  bubble_timing: {
    blocking: 0, // 0 = stays until dismissed
    normal: 5,
    fyi: 10,
  },
  graduation_threshold: 85,
  cost_visibility: false,
  execution_defaults: {
    max_concurrent: 3,
    timeout: 300,
    retries: 2,
  },
};

const STORAGE_KEY = 'tend-settings';

/**
 * Load settings from localStorage
 */
function loadSettings(): TendSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[useSettings] Failed to save settings:', e);
  }
}

/**
 * useSettings - Hook for managing user settings with localStorage persistence
 *
 * All settings changes are automatically persisted to localStorage.
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { settings, updateSettings, resetSettings } = useSettings();
 *
 *   return (
 *     <div>
 *       <input
 *         type="range"
 *         value={settings.graduation_threshold}
 *         onChange={(e) => updateSettings({ graduation_threshold: Number(e.target.value) })}
 *       />
 *       <button onClick={resetSettings}>Reset to Defaults</button>
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
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update nested bubble_timing
  const updateBubbleTiming = useCallback(
    (timing: Partial<TendSettings['bubble_timing']>) => {
      setSettings((prev) => ({
        ...prev,
        bubble_timing: { ...prev.bubble_timing, ...timing },
      }));
    },
    []
  );

  // Update nested execution_defaults
  const updateExecutionDefaults = useCallback(
    (defaults: Partial<TendSettings['execution_defaults']>) => {
      setSettings((prev) => ({
        ...prev,
        execution_defaults: { ...prev.execution_defaults, ...defaults },
      }));
    },
    []
  );

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    updateBubbleTiming,
    updateExecutionDefaults,
    resetSettings,
  };
}
