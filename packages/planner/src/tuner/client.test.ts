import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TunerClient, createTunerClient } from './client.js';
import { DEFAULT_PLANNER_CONFIG, PlannerConfigSchema } from './config.js';

// ============================================
// TunerClient - disabled mode
// ============================================

describe('TunerClient (disabled)', () => {
  it('should be disabled when no URL provided', () => {
    const client = new TunerClient();
    expect(client.getStatus()).toBe('disabled');
  });

  it('should return default config when disabled', () => {
    const client = new TunerClient();
    expect(client.getConfig()).toEqual(DEFAULT_PLANNER_CONFIG);
  });

  it('should be no-op on init when disabled', async () => {
    const client = new TunerClient();
    await client.init(); // should not throw
    expect(client.getStatus()).toBe('disabled');
  });

  it('should stop cleanly when disabled', () => {
    const client = new TunerClient();
    client.stop();
    expect(client.getStatus()).toBe('stopped');
  });
});

// ============================================
// TunerClient - initialization
// ============================================

describe('TunerClient (with URL)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be initializing when URL is provided', () => {
    const client = new TunerClient({ url: 'http://localhost:3100' });
    expect(client.getStatus()).toBe('initializing');
  });

  it('should fetch config on init and transition to connected', async () => {
    const mockConfig = PlannerConfigSchema.parse({
      version: 'test-1',
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000, // long interval to avoid auto-refresh
    });

    await client.init();

    expect(client.getStatus()).toBe('connected');
    expect(client.getConfig().version).toBe('test-1');
    expect(client.getLastFetchTime()).toBeInstanceOf(Date);
    expect(client.getLastError()).toBeNull();

    client.stop();
  });

  it('should call correct endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(DEFAULT_PLANNER_CONFIG), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3100/api/planner-config',
      expect.objectContaining({ method: 'GET' })
    );

    client.stop();
  });

  it('should gracefully handle fetch failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();

    expect(client.getStatus()).toBe('error');
    expect(client.getConfig()).toEqual(DEFAULT_PLANNER_CONFIG); // falls back
    expect(client.getLastError()).toBeInstanceOf(Error);
    expect(client.getLastError()?.message).toContain('Connection refused');

    client.stop();
  });

  it('should handle non-200 response', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    );

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();

    expect(client.getStatus()).toBe('error');
    expect(client.getLastError()?.message).toContain('500');
    expect(client.getConfig()).toEqual(DEFAULT_PLANNER_CONFIG);

    client.stop();
  });

  it('should handle invalid JSON response', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();

    expect(client.getStatus()).toBe('error');
    expect(client.getConfig()).toEqual(DEFAULT_PLANNER_CONFIG);

    client.stop();
  });
});

// ============================================
// TunerClient - refresh
// ============================================

describe('TunerClient (refresh)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should update config on manual refresh', async () => {
    const config1 = PlannerConfigSchema.parse({ version: 'v1' });
    const config2 = PlannerConfigSchema.parse({ version: 'v2' });

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(config1), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(config2), { status: 200 })
      );

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();
    expect(client.getConfig().version).toBe('v1');

    const refreshed = await client.refresh();
    expect(refreshed.version).toBe('v2');
    expect(client.getConfig().version).toBe('v2');

    client.stop();
  });

  it('should keep old config on refresh failure', async () => {
    const config1 = PlannerConfigSchema.parse({ version: 'v1' });

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(config1), { status: 200 })
      )
      .mockRejectedValueOnce(new Error('Network error'));

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();
    expect(client.getConfig().version).toBe('v1');

    await client.refresh();
    // Should still have v1 config
    expect(client.getConfig().version).toBe('v1');
    expect(client.getStatus()).toBe('error');

    client.stop();
  });
});

// ============================================
// TunerClient - stop
// ============================================

describe('TunerClient (stop)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should transition to stopped status', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(DEFAULT_PLANNER_CONFIG), { status: 200 })
    );

    const client = new TunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 60000,
    });

    await client.init();
    expect(client.getStatus()).toBe('connected');

    client.stop();
    expect(client.getStatus()).toBe('stopped');
  });
});

// ============================================
// createTunerClient factory
// ============================================

describe('createTunerClient', () => {
  it('should create disabled client without URL', () => {
    const client = createTunerClient();
    expect(client.getStatus()).toBe('disabled');
  });

  it('should create initializing client with URL', () => {
    const client = createTunerClient({ url: 'http://localhost:3100' });
    expect(client.getStatus()).toBe('initializing');
  });

  it('should accept custom refresh interval', () => {
    const client = createTunerClient({
      url: 'http://localhost:3100',
      refreshIntervalMs: 1000,
    });
    expect(client).toBeInstanceOf(TunerClient);
  });
});
