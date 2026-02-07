import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../useSettings';

describe('useSettings', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      notifications: {
        questionBubbles: true,
        soundAlerts: false,
      },
      agent: {
        defaultResponseSpeed: 'balanced',
        autoApprove: false,
      },
    });
  });

  it('should persist settings to localStorage', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({
        notifications: {
          questionBubbles: false,
          soundAlerts: true,
        },
      });
    });

    // Check localStorage
    const stored = localStorage.getItem('tend-settings');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.notifications.questionBubbles).toBe(false);
    expect(parsed.notifications.soundAlerts).toBe(true);
  });

  it('should load settings from localStorage', () => {
    // Pre-populate localStorage
    localStorage.setItem(
      'tend-settings',
      JSON.stringify({
        notifications: {
          questionBubbles: false,
          soundAlerts: true,
        },
        agent: {
          defaultResponseSpeed: 'fast',
          autoApprove: true,
        },
      })
    );

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.notifications.questionBubbles).toBe(false);
    expect(result.current.settings.notifications.soundAlerts).toBe(true);
    expect(result.current.settings.agent.defaultResponseSpeed).toBe('fast');
    expect(result.current.settings.agent.autoApprove).toBe(true);
  });

  it('should reset to defaults', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({
        notifications: {
          questionBubbles: false,
          soundAlerts: true,
        },
      });
    });

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings).toEqual({
      notifications: {
        questionBubbles: true,
        soundAlerts: false,
      },
      agent: {
        defaultResponseSpeed: 'balanced',
        autoApprove: false,
      },
    });
  });

  it('should merge updates with existing settings', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({
        notifications: {
          questionBubbles: false,
        } as any,
      });
    });

    // Other notification setting should remain unchanged
    expect(result.current.settings.notifications.soundAlerts).toBe(false);
    expect(result.current.settings.agent.defaultResponseSpeed).toBe('balanced');
  });
});
