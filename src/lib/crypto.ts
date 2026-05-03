import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes after base64 decode (got ${key.length} bytes)`
    )
  }

  return key
}

export function encrypt(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Encryption failed: plaintext must be a non-empty string')
  }

  try {
    const key = getKey()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':')
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('ENCRYPTION_KEY')) {
      throw err
    }
    throw new Error('Encryption failed')
  }
}

export function decrypt(ciphertext: string): string {
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    throw new Error('Decryption failed — invalid ciphertext or wrong key')
  }

  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Decryption failed — invalid ciphertext or wrong key')
  }

  try {
    const key = getKey()
    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const encrypted = Buffer.from(parts[2], 'base64')

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('ENCRYPTION_KEY')) {
      throw err
    }
    throw new Error('Decryption failed — invalid ciphertext or wrong key')
  }
}
