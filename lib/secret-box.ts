import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function key() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) throw new Error('TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED');
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string) {
  if (!value) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return '';
  if (!value.startsWith(PREFIX)) return value;
  const [ivValue, tagValue, encryptedValue] = value.slice(PREFIX.length).split('.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}
