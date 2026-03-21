import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env['ENCRYPTION_KEY']
  if (!raw) throw new Error('ENCRYPTION_KEY env var is not set')
  const key = Buffer.from(raw, 'hex')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex-encoded string (64 hex chars)')
  }
  return key
}

interface EncryptedPayload {
  iv: string
  tag: string
  data: string
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload: EncryptedPayload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const payload = JSON.parse(
    Buffer.from(ciphertext, 'base64').toString('utf8'),
  ) as EncryptedPayload
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const data = Buffer.from(payload.data, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}
