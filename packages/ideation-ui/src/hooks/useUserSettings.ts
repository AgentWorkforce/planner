import { useState, useEffect, useCallback } from 'react';

/**
 * User settings for ideation canvas
 */
export interface UserSettings {
  /** Enable auto-curation of blocks above threshold */
  autoCurateEnabled: boolean;
  /** Confidence threshold for auto-curation (default 90) */
  autoCurateThreshold: number;
  /** Minimum confidence for blocks to be visible (default 30) */
  blockVisibilityThreshold: number;
  /** UI theme preference */
  theme: 'system' | 'light' | 'dark';
}

const DEFAULT_SETTINGS: UserSettings = {
  autoCurateEnabled: false,
  autoCurateThreshold: 90,
  blockVisibilityThreshold: 30,
  theme: 'system',
};

const STORAGE_KEY = 'ideation-user-settings';

/**
 * Load settings from localStorage
 */
function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('[useUserSettings] Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[useUserSettings] Failed to save settings:', e);
  }
}

/**
 * useUserSettings hook
 *
 * Manages user preferences for the ideation canvas including:
 * - Auto-curation settings (enabled, threshold)
 * - Block visibility threshold
 * - Theme preference
 *
 * Settings persist to localStorage.
 *
 * @example
 * ```tsx
 * function SettingsPanel() {
 *   const { settings, updateSettings } = useUserSettings();
 *
 *   return (
 *     <div>
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={settings.autoCurateEnabled}
 *           onChange={(e) => updateSettings({ autoCurateEnabled: e.target.checked })}
 *         />
 *         Auto-curate blocks
 *       </label>
 *
 *       {settings.autoCurateEnabled && (
 *         <input
 *           type="range"
 *           min={60}
 *           max={100}
 *           value={settings.autoCurateThreshold}
 *           onChange={(e) => updateSettings({ autoCurateThreshold: Number(e.target.value) })}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  // Persist settings on change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Update specific settings
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
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

/**
 * Check if a block should be auto-curated based on user settings
 *
 * @param confidence - Block confidence (0-100)
 * @param settings - User settings
 * @returns True if block should be auto-curated
 */
export function shouldAutoCurate(confidence: number, settings: UserSettings): boolean {
  return settings.autoCurateEnabled && confidence >= settings.autoCurateThreshold;
}

/**
 * Check if a block should be visible based on user settings
 *
 * @param confidence - Block confidence (0-100)
 * @param settings - User settings
 * @returns True if block should be visible
 */
export function isBlockVisible(confidence: number, settings: UserSettings): boolean {
  return confidence >= settings.blockVisibilityThreshold;
}
