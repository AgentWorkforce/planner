import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhysicsEngine } from './usePhysicsEngine';
import type { RefObject } from 'react';

describe('usePhysicsEngine', () => {
  let container: HTMLDivElement;
  let containerRef: RefObject<HTMLDivElement>;

  beforeEach(() => {
    // Create a mock container element
    container = document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', { value: 800, writable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 600, writable: true });
    document.body.appendChild(container);

    containerRef = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllTimers();
  });

  it('should initialize physics engine', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    // Wait for the effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.engine).not.toBeNull();
    expect(result.current.isReady).toBe(true);
    expect(result.current.bodies.size).toBe(0);
  });

  it('should become ready after initialization', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    // Wait for the effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.engine).not.toBeNull();
  });

  it('should add a body to the physics world', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.addBody({ id: 'test-body', radius: 40 });
    });

    // Allow physics tick to update positions
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.bodies.has('test-body')).toBe(true);
    const body = result.current.bodies.get('test-body');
    expect(body).toBeDefined();
    expect(body?.radius).toBeCloseTo(40, 0);
  });

  it('should remove a body from the physics world', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.addBody({ id: 'test-body', radius: 40 });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.bodies.has('test-body')).toBe(true);

    act(() => {
      result.current.removeBody('test-body');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.bodies.has('test-body')).toBe(false);
  });

  it('should update body radius', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.addBody({ id: 'test-body', radius: 40 });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const initialBody = result.current.bodies.get('test-body');
    expect(initialBody?.radius).toBeCloseTo(40, 0);

    act(() => {
      result.current.updateBodyRadius('test-body', 60);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const updatedBody = result.current.bodies.get('test-body');
    expect(updatedBody?.radius).toBeCloseTo(60, 0);
  });

  it('should spawn bodies near center with random offset', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.addBody({ id: 'test-body-1', radius: 40 });
      result.current.addBody({ id: 'test-body-2', radius: 40 });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const body1 = result.current.bodies.get('test-body-1');
    const body2 = result.current.bodies.get('test-body-2');

    // Bodies should be near center (400, 300) with random offset
    expect(body1?.x).toBeGreaterThan(200);
    expect(body1?.x).toBeLessThan(600);
    expect(body1?.y).toBeGreaterThan(100);
    expect(body1?.y).toBeLessThan(500);

    expect(body2?.x).toBeGreaterThan(200);
    expect(body2?.x).toBeLessThan(600);
    expect(body2?.y).toBeGreaterThan(100);
    expect(body2?.y).toBeLessThan(500);
  });

  it('should allow custom spawn position', async () => {
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.addBody({ id: 'test-body', radius: 40, x: 100, y: 200 });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const body = result.current.bodies.get('test-body');
    expect(body?.x).toBeCloseTo(100, 0);
    expect(body?.y).toBeCloseTo(200, 0);
  });

  it('should warn when adding duplicate body', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.addBody({ id: 'test-body', radius: 40 });
      result.current.addBody({ id: 'test-body', radius: 50 }); // Duplicate
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Body with id "test-body" already exists'),
    );

    consoleWarnSpy.mockRestore();
  });

  it('should warn when removing non-existent body', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.removeBody('non-existent');
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Body with id "non-existent" not found'),
    );

    consoleWarnSpy.mockRestore();
  });

  it('should clean up on unmount', async () => {
    const { result, unmount } = renderHook(() => usePhysicsEngine(containerRef));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.engine).not.toBeNull();

    unmount();

    // After unmount, the hook should no longer be active
    // This is implicitly tested by the cleanup function running without errors
  });
});
