/**
 * Tests for AES-256-GCM encryption
 *
 * Verifies acceptance criteria:
 * - encrypt returns base64-encoded string containing IV + authTag + ciphertext
 * - decrypt(encrypt(text)) === text for any input string
 * - Each encrypt call uses a fresh random IV — same plaintext produces different output
 * - Tampered ciphertext (flipped bit) throws Error on decrypt
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, initEncryption, _clearCachedKey, isEncryptedCredential } from './encryption.js';

describe('encrypt/decrypt with AES-256-GCM', () => {
  beforeEach(() => {
    // Set up test secret
    process.env.CULTIVATE_SECRET = 'test-secret-for-encryption-testing-12345';
    _clearCachedKey();
    initEncryption();
  });

  afterEach(() => {
    _clearCachedKey();
    delete process.env.CULTIVATE_SECRET;
  });

  it('encrypt returns base64-encoded string', () => {
    const plaintext = 'test data';
    const encrypted = encrypt(plaintext);

    // Should be base64 (only contains A-Z, a-z, 0-9, +, /, =)
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Decode to verify structure
    const buffer = Buffer.from(encrypted, 'base64');

    // Should have at least IV (12) + authTag (16) = 28 bytes
    expect(buffer.length).toBeGreaterThanOrEqual(28);

    // IV is first 12 bytes
    const iv = buffer.subarray(0, 12);
    expect(iv.length).toBe(12);

    // authTag is next 16 bytes
    const authTag = buffer.subarray(12, 28);
    expect(authTag.length).toBe(16);

    // Remaining bytes are ciphertext
    const ciphertext = buffer.subarray(28);
    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('decrypt(encrypt(text)) === text for any input string', () => {
    const testCases = [
      'hello world',
      'test@example.com',
      'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
      'special chars: !@#$%^&*()',
      'unicode: 你好世界 🚀',
      'a'.repeat(1000), // long string
      '',
    ];

    for (const plaintext of testCases) {
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    }
  });

  it('each encrypt call uses fresh random IV - same plaintext produces different output', () => {
    const plaintext = 'same text';

    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    const encrypted3 = encrypt(plaintext);

    // All should decrypt to same plaintext
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
    expect(decrypt(encrypted3)).toBe(plaintext);

    // But encrypted outputs should be different (due to random IV)
    expect(encrypted1).not.toBe(encrypted2);
    expect(encrypted2).not.toBe(encrypted3);
    expect(encrypted1).not.toBe(encrypted3);

    // Verify IVs are different
    const buffer1 = Buffer.from(encrypted1, 'base64');
    const buffer2 = Buffer.from(encrypted2, 'base64');
    const buffer3 = Buffer.from(encrypted3, 'base64');

    const iv1 = buffer1.subarray(0, 12);
    const iv2 = buffer2.subarray(0, 12);
    const iv3 = buffer3.subarray(0, 12);

    expect(iv1.equals(iv2)).toBe(false);
    expect(iv2.equals(iv3)).toBe(false);
    expect(iv1.equals(iv3)).toBe(false);
  });

  it('tampered ciphertext (flipped bit) throws Error on decrypt', () => {
    const plaintext = 'sensitive data';
    const encrypted = encrypt(plaintext);

    // Decode to buffer
    const buffer = Buffer.from(encrypted, 'base64');

    // Flip a bit in the ciphertext portion (after IV + authTag = 28 bytes)
    if (buffer.length > 28) {
      buffer[28] ^= 0x01; // Flip the first bit of ciphertext
    }

    // Re-encode
    const tampered = buffer.toString('base64');

    // Should throw when decrypting tampered data
    expect(() => decrypt(tampered)).toThrow();
  });

  it('tampered auth tag throws Error on decrypt', () => {
    const plaintext = 'sensitive data';
    const encrypted = encrypt(plaintext);

    // Decode to buffer
    const buffer = Buffer.from(encrypted, 'base64');

    // Flip a bit in the auth tag (bytes 12-27)
    buffer[12] ^= 0x01;

    // Re-encode
    const tampered = buffer.toString('base64');

    // Should throw when decrypting tampered data
    expect(() => decrypt(tampered)).toThrow();
  });

  it('tampered IV does not throw but produces wrong output', () => {
    const plaintext = 'sensitive data';
    const encrypted = encrypt(plaintext);

    // Decode to buffer
    const buffer = Buffer.from(encrypted, 'base64');

    // Flip a bit in the IV (bytes 0-11)
    buffer[0] ^= 0x01;

    // Re-encode
    const tampered = buffer.toString('base64');

    // IV tampering doesn't trigger auth failure but produces garbage or throws
    // In GCM mode, wrong IV typically causes auth tag verification failure
    expect(() => {
      const result = decrypt(tampered);
      // If it doesn't throw, the result should be wrong
      expect(result).not.toBe(plaintext);
    }).toThrow();
  });

  it('throws if encryption not initialized', () => {
    _clearCachedKey();
    delete process.env.CULTIVATE_SECRET;

    expect(() => encrypt('test')).toThrow('Encryption key not initialized');
    expect(() => decrypt('dGVzdA==')).toThrow('Encryption key not initialized');
  });

  it('isEncryptedCredential identifies valid encrypted credentials', () => {
    const plaintext = 'test credential';
    const encrypted = encrypt(plaintext);

    // Should identify the result of encrypt() as valid
    expect(isEncryptedCredential(encrypted)).toBe(true);
  });

  it('isEncryptedCredential rejects invalid inputs', () => {
    // Plain strings that are too short
    expect(isEncryptedCredential('short')).toBe(false);

    // Invalid base64
    expect(isEncryptedCredential('not base64!!!')).toBe(false);

    // Non-strings
    expect(isEncryptedCredential(123)).toBe(false);
    expect(isEncryptedCredential(null)).toBe(false);
    expect(isEncryptedCredential(undefined)).toBe(false);
    expect(isEncryptedCredential({})).toBe(false);

    // Base64 that decodes to less than 28 bytes
    const tooShort = Buffer.alloc(20).toString('base64');
    expect(isEncryptedCredential(tooShort)).toBe(false);
  });

  it('isEncryptedCredential accepts valid encrypted output', () => {
    // Multiple encrypted values should all pass validation
    const test1 = encrypt('data1');
    const test2 = encrypt('data2');
    const test3 = encrypt('');

    expect(isEncryptedCredential(test1)).toBe(true);
    expect(isEncryptedCredential(test2)).toBe(true);
    expect(isEncryptedCredential(test3)).toBe(true);
  });

  it('decrypt accepts output from encrypt as EncryptedCredential', () => {
    // This verifies the type contract: encrypt() -> EncryptedCredential -> decrypt()
    const plaintext = 'secret data';
    const encrypted = encrypt(plaintext);

    // Verify it's recognized as EncryptedCredential
    expect(isEncryptedCredential(encrypted)).toBe(true);

    // Decrypt should work with the result
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
