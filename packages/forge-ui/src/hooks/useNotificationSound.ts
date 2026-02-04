/**
 * useNotificationSound - Hook for playing notification sounds
 *
 * Provides a function to play notification sounds with localStorage
 * persistence for user preference (enabled/disabled).
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const NOTIFICATION_SOUND_KEY = 'forge-notification-sound-enabled';

// Base64-encoded simple notification sound (short beep)
// This is a tiny audio file that works without external dependencies
const NOTIFICATION_SOUND_DATA =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2EhIVpdWR6g4WDd3lwgISGhIKAgIGEg4aDgX98fYGDhYSCgIGBg4WEg4GAgYKEhIOCgYGCg4SEg4KBgYKDhISCgoGBgoOEg4OCgYGCg4SDg4KBgYKDg4SDgoGBgoKDhIOCgYGBgoOEg4KBgYGCg4SDgoGBgYKDhIOCgYGBgoKDg4KCgYGBgoODg4KBgYGCgoODgoKBgYGCgoODgoKBgYGCgoODgoGBgYGCgoODgoGBgYGCgoKDgoGBgYGCgoKCgoGBgYGCgoKCgYGBgYGCgoKCgYGBgYGBgoKCgYGBgYGBgoKBgYGBgYGBgoKBgYGBgYGBgoGBgYGBgYGBgYKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYE=';

interface UseNotificationSoundResult {
  play: () => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export function useNotificationSound(): UseNotificationSoundResult {
  const [isEnabled, setIsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(NOTIFICATION_SOUND_KEY);
    return stored === null ? true : stored === 'true';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio(NOTIFICATION_SOUND_DATA);
    audio.volume = 0.5;
    audioRef.current = audio;

    return () => {
      audioRef.current = null;
    };
  }, []);

  // Persist preference
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIFICATION_SOUND_KEY, String(enabled));
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!isEnabled);
  }, [isEnabled, setEnabled]);

  // Play sound function
  const play = useCallback(() => {
    if (!isEnabled || !audioRef.current) return;

    // Reset and play
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => {
      // Ignore autoplay restrictions - user interaction may be required
      console.debug('[useNotificationSound] Could not play sound:', err);
    });
  }, [isEnabled]);

  return {
    play,
    isEnabled,
    setEnabled,
    toggle,
  };
}

/**
 * useGateNotificationSound - Convenience hook that combines usePendingGates
 * with notification sounds for gate_reached events.
 */
export function useGateNotificationSound() {
  const { play, isEnabled, setEnabled, toggle } = useNotificationSound();

  const onGateReached = useCallback(() => {
    play();
  }, [play]);

  return {
    onGateReached,
    isSoundEnabled: isEnabled,
    setSoundEnabled: setEnabled,
    toggleSound: toggle,
  };
}
