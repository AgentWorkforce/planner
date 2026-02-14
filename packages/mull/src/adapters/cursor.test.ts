import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCursor, setCursor } from './cursor.js';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('cursor persistence', () => {
  let tmpDir: string;
  let mullDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mull-cursor-test-'));
    mullDir = path.join(tmpDir, '.mull');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('getCursor', () => {
    it('returns null when no cursor file exists', async () => {
      const result = await getCursor('trajectory', 'session-1', mullDir);
      expect(result).toBeNull();
    });

    it('returns cursor data when file exists', async () => {
      // Write a cursor first
      await setCursor('relay', 'session-abc', '2026-01-15T10:30:00.000Z', mullDir);

      const result = await getCursor('relay', 'session-abc', mullDir);
      expect(result).toEqual({
        last_mulled_at: '2026-01-15T10:30:00.000Z',
        adapter_type: 'relay',
        session_id: 'session-abc',
      });
    });

    it('throws on invalid adapterType characters', async () => {
      await expect(getCursor('../escape', 'session-1', mullDir)).rejects.toThrow(
        'Invalid adapterType',
      );
    });

    it('throws on invalid sessionId characters', async () => {
      await expect(getCursor('relay', 'session/../../etc', mullDir)).rejects.toThrow(
        'Invalid sessionId',
      );
    });

    it('throws on corrupt (non-JSON) cursor file', async () => {
      const dir = path.join(mullDir, 'cursors', 'relay');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'corrupt-session.json'), 'not valid json{{{', 'utf-8');

      await expect(getCursor('relay', 'corrupt-session', mullDir)).rejects.toThrow();
    });
  });

  describe('setCursor', () => {
    it('creates directories and writes cursor file', async () => {
      await setCursor('trajectory', 'sess-42', '2026-02-10T08:00:00.000Z', mullDir);

      const filePath = path.join(mullDir, 'cursors', 'trajectory', 'sess-42.json');
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      expect(parsed).toEqual({
        last_mulled_at: '2026-02-10T08:00:00.000Z',
        adapter_type: 'trajectory',
        session_id: 'sess-42',
      });
    });

    it('overwrites existing cursor file', async () => {
      await setCursor('relay', 'sess-1', '2026-01-01T00:00:00.000Z', mullDir);
      await setCursor('relay', 'sess-1', '2026-02-01T12:00:00.000Z', mullDir);

      const result = await getCursor('relay', 'sess-1', mullDir);
      expect(result!.last_mulled_at).toBe('2026-02-01T12:00:00.000Z');
    });

    it('handles multiple adapters for same session independently', async () => {
      await setCursor('trajectory', 'shared-session', '2026-01-01T00:00:00.000Z', mullDir);
      await setCursor('relay', 'shared-session', '2026-01-02T00:00:00.000Z', mullDir);
      await setCursor('transcript', 'shared-session', '2026-01-03T00:00:00.000Z', mullDir);

      const traj = await getCursor('trajectory', 'shared-session', mullDir);
      const relay = await getCursor('relay', 'shared-session', mullDir);
      const trans = await getCursor('transcript', 'shared-session', mullDir);

      expect(traj!.last_mulled_at).toBe('2026-01-01T00:00:00.000Z');
      expect(relay!.last_mulled_at).toBe('2026-01-02T00:00:00.000Z');
      expect(trans!.last_mulled_at).toBe('2026-01-03T00:00:00.000Z');
    });

    it('handles multiple sessions for same adapter independently', async () => {
      await setCursor('relay', 'session-A', '2026-01-01T00:00:00.000Z', mullDir);
      await setCursor('relay', 'session-B', '2026-02-01T00:00:00.000Z', mullDir);
      await setCursor('relay', 'session-C', '2026-03-01T00:00:00.000Z', mullDir);

      const a = await getCursor('relay', 'session-A', mullDir);
      const b = await getCursor('relay', 'session-B', mullDir);
      const c = await getCursor('relay', 'session-C', mullDir);

      expect(a!.last_mulled_at).toBe('2026-01-01T00:00:00.000Z');
      expect(b!.last_mulled_at).toBe('2026-02-01T00:00:00.000Z');
      expect(c!.last_mulled_at).toBe('2026-03-01T00:00:00.000Z');

      // Updating one session doesn't affect others
      await setCursor('relay', 'session-B', '2026-06-01T00:00:00.000Z', mullDir);
      expect((await getCursor('relay', 'session-A', mullDir))!.last_mulled_at).toBe('2026-01-01T00:00:00.000Z');
      expect((await getCursor('relay', 'session-B', mullDir))!.last_mulled_at).toBe('2026-06-01T00:00:00.000Z');
      expect((await getCursor('relay', 'session-C', mullDir))!.last_mulled_at).toBe('2026-03-01T00:00:00.000Z');
    });

    it('writes valid JSON readable by any process', async () => {
      await setCursor('trajectory', 'sess-json', '2026-06-15T18:30:00.000Z', mullDir);

      const filePath = path.join(mullDir, 'cursors', 'trajectory', 'sess-json.json');
      const raw = await readFile(filePath, 'utf-8');

      // Should not throw - valid JSON
      const parsed = JSON.parse(raw);
      expect(parsed.last_mulled_at).toBe('2026-06-15T18:30:00.000Z');
      expect(parsed.adapter_type).toBe('trajectory');
      expect(parsed.session_id).toBe('sess-json');

      // Ends with newline for POSIX compliance
      expect(raw.endsWith('\n')).toBe(true);
    });

    it('throws on invalid adapterType characters', async () => {
      await expect(
        setCursor('relay/../hack', 'sess-1', '2026-01-01T00:00:00.000Z', mullDir),
      ).rejects.toThrow('Invalid adapterType');
    });

    it('throws on invalid sessionId characters', async () => {
      await expect(
        setCursor('relay', 'sess.bad', '2026-01-01T00:00:00.000Z', mullDir),
      ).rejects.toThrow('Invalid sessionId');
    });
  });

  describe('default mullDir', () => {
    it('defaults to .mull in cwd when mullDir not provided', async () => {
      // We can't easily test the default without changing cwd,
      // but we verify the function signatures accept optional mullDir
      const result = await getCursor('relay', 'nonexistent');
      expect(result).toBeNull();
    });
  });
});
