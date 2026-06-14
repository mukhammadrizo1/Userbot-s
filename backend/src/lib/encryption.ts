import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'userbot-session-encryption-salt-v1';

/**
 * Derives a 256-bit encryption key from the master key using scrypt.
 * scrypt is memory-hard, making brute-force attacks expensive.
 */
function deriveKey(masterKey: string): Buffer {
  return crypto.scryptSync(masterKey, SALT, KEY_LENGTH);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns format: iv_hex:authTag_hex:ciphertext_hex
 *
 * GCM provides both confidentiality and authenticity:
 * - The auth tag ensures the ciphertext hasn't been tampered with
 * - The IV ensures identical plaintexts produce different ciphertexts
 */
export function encrypt(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: iv_hex:authTag_hex:ciphertext_hex
 *
 * Throws if the auth tag doesn't match (data was tampered with)
 * or if the master key is wrong.
 */
export function decrypt(encryptedData: string, masterKey: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const key = deriveKey(masterKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a cryptographically secure random key suitable for ENCRYPTION_MASTER_KEY.
 * Returns a 64-character hex string (256 bits).
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
