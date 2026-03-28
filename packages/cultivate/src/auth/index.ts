/**
 * Auth module exports
 *
 * Provides encryption functionality for source configuration credentials.
 */

// Encryption functions and types
export {
  initEncryption,
  encrypt,
  decrypt,
  validateEncryptionReady,
  deriveKey,
  isEncryptedCredential,
  type EncryptedCredential,
} from './encryption.js';

// Credential manager
export { CredentialManager } from './credential-manager.js';
