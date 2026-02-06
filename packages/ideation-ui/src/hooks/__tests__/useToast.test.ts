import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToast, clearAllToasts } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllToasts(); // Clear any toasts from previous tests
  });

  afterEach(() => {
    clearAllToasts(); // Clean up after each test
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should add a toast notification', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Test Toast',
        description: 'Test Description',
        variant: 'success',
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.title).toBe('Test Toast');
    expect(result.current.toasts[0]!.description).toBe('Test Description');
    expect(result.current.toasts[0]!.variant).toBe('success');
  });

  it('should auto-dismiss toast after duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Auto-dismiss Toast',
        duration: 3000,
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward time by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Toast should be removed after timeout
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should not auto-dismiss when duration is 0', async () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Persistent Toast',
        duration: 0,
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Toast should still be there
    expect(result.current.toasts).toHaveLength(1);
  });

  it('should manually dismiss a toast', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string;
    act(() => {
      toastId = result.current.toast({
        title: 'Dismissible Toast',
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0]!.title).toBe('Toast 1');
    expect(result.current.toasts[1]!.title).toBe('Toast 2');
    expect(result.current.toasts[2]!.title).toBe('Toast 3');
  });

  it('should use default values for optional fields', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Minimal Toast',
      });
    });

    const toast = result.current.toasts[0]!;
    expect(toast.variant).toBe('info');
    expect(toast.duration).toBe(3000);
    expect(toast.description).toBeUndefined();
  });

  it('should generate unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    let id1: string = '';
    let id2: string = '';
    act(() => {
      id1 = result.current.toast({ title: 'Toast 1' });
      id2 = result.current.toast({ title: 'Toast 2' });
    });

    expect(id1).not.toBe(id2);
  });

  it('should sync state across multiple hook instances', () => {
    const { result: result1 } = renderHook(() => useToast());
    const { result: result2 } = renderHook(() => useToast());

    act(() => {
      result1.current.toast({ title: 'Shared Toast' });
    });

    // Both hooks should see the same toast
    expect(result1.current.toasts).toHaveLength(1);
    expect(result2.current.toasts).toHaveLength(1);
    expect(result1.current.toasts[0]!.id).toBe(result2.current.toasts[0]!.id);
  });

  it('should handle all toast variants', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Success', variant: 'success' });
      result.current.toast({ title: 'Error', variant: 'error' });
      result.current.toast({ title: 'Info', variant: 'info' });
      result.current.toast({ title: 'Warning', variant: 'warning' });
    });

    expect(result.current.toasts).toHaveLength(4);
    expect(result.current.toasts[0]!.variant).toBe('success');
    expect(result.current.toasts[1]!.variant).toBe('error');
    expect(result.current.toasts[2]!.variant).toBe('info');
    expect(result.current.toasts[3]!.variant).toBe('warning');
  });
});
