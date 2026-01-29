/**
 * usePlanEvents Hook Tests
 *
 * Tests for the real-time plan change subscription hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanEvents, type PlanChangeEvent } from './usePlanEvents';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: ((this: EventSource, ev: Event) => void) | null = null;
  onerror: ((this: EventSource, ev: Event) => void) | null = null;
  private listeners: Map<string, ((e: MessageEvent) => void)[]> = new Map();
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate async connection
    setTimeout(() => {
      if (this.onopen) {
        this.readyState = 1; // OPEN
        this.onopen.call(this as unknown as EventSource, new Event('open'));
      }
    }, 0);
  }

  addEventListener(type: string, callback: (e: MessageEvent) => void) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, callback: (e: MessageEvent) => void) {
    const listeners = this.listeners.get(type) || [];
    const index = listeners.indexOf(callback);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helper: simulate receiving an event
  simulateEvent(type: string, data: unknown) {
    const listeners = this.listeners.get(type) || [];
    const event = { data: JSON.stringify(data) } as MessageEvent;
    listeners.forEach((cb) => cb(event));
  }

  // Test helper: simulate error
  simulateError() {
    if (this.onerror) {
      this.readyState = 2;
      this.onerror.call(this as unknown as EventSource, new Event('error'));
    }
  }

  static clearInstances() {
    MockEventSource.instances = [];
  }

  static getLastInstance(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

describe('usePlanEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.clearInstances();
    // @ts-expect-error - mocking global
    globalThis.EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not connect when disabled', () => {
    const onEvent = vi.fn();
    renderHook(() => usePlanEvents('plan-123', false, onEvent));

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('does not connect when planId is null', () => {
    const onEvent = vi.fn();
    renderHook(() => usePlanEvents(null, true, onEvent));

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('connects when enabled with valid planId', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePlanEvents('plan-123', true, onEvent));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.getLastInstance()?.url).toBe('/api/plans/plan-123/events');

    // Run timers synchronously to trigger onopen
    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('calls onEvent when plan_change event received', async () => {
    const onEvent = vi.fn();
    renderHook(() => usePlanEvents('plan-123', true, onEvent));

    await act(async () => {
      vi.runAllTimers();
    });

    const eventData: PlanChangeEvent = {
      version: 2,
      changeType: 'step_added',
      stepId: 'step-456',
      timestamp: '2026-01-29T12:00:00.000Z',
    };

    act(() => {
      MockEventSource.getLastInstance()?.simulateEvent('plan_change', eventData);
    });

    expect(onEvent).toHaveBeenCalledWith(eventData);
  });

  it('closes connection when disabled', async () => {
    const onEvent = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => usePlanEvents('plan-123', enabled, onEvent),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      vi.runAllTimers();
    });

    const instance = MockEventSource.getLastInstance();
    expect(instance?.readyState).toBe(1); // OPEN

    rerender({ enabled: false });

    expect(instance?.readyState).toBe(2); // CLOSED
  });

  it('reconnects on error up to max retries', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePlanEvents('plan-123', true, onEvent));

    await act(async () => {
      vi.runAllTimers();
    });

    // Simulate first error
    act(() => {
      MockEventSource.getLastInstance()?.simulateError();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toContain('Reconnecting (1/5)');

    // Wait for reconnect delay
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Should have created a new EventSource
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('cleans up on unmount', async () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => usePlanEvents('plan-123', true, onEvent));

    await act(async () => {
      vi.runAllTimers();
    });

    const instance = MockEventSource.getLastInstance();

    unmount();

    expect(instance?.readyState).toBe(2); // CLOSED
  });

  it('reconnects when planId changes', async () => {
    const onEvent = vi.fn();
    const { rerender } = renderHook(
      ({ planId }) => usePlanEvents(planId, true, onEvent),
      { initialProps: { planId: 'plan-1' } }
    );

    await act(async () => {
      vi.runAllTimers();
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/plans/plan-1/events');

    rerender({ planId: 'plan-2' });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toBe('/api/plans/plan-2/events');
    expect(MockEventSource.instances[0].readyState).toBe(2); // Old one closed
  });

  it('resets retry count on successful connection', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePlanEvents('plan-123', true, onEvent));

    act(() => {
      vi.runAllTimers();
    });

    // Simulate error and reconnect
    act(() => {
      MockEventSource.getLastInstance()?.simulateError();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Successful reconnection
    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
