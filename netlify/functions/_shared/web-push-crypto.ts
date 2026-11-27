/**
 * Web push, built from Node's own crypto. No extra npm package.
 *
 * Two standards are used:
 *   - VAPID (RFC 8292): a short signed token that tells the phone's push
 *     service who is sending. Signed with ES256 (P-256 + SHA-256) using the
 *     project's VAPID key pair.
 *   - Message encryption (RFC 8291, "aes128gcm"): the notification text is
 *     encrypted so that only the farmer's phone can read it, using the keys
 *     the phone gave us when it subscribed.
 *
 * Keys come from the environment as base64url text:
 *   VAPID_PUBLIC_KEY   65 bytes, the uncompressed P-256 point
 *   VAPID_PRIVATE_KEY  32 bytes, the private number d
 *   VAPID_SUBJECT      a `mailto:` or `https:` contact for the push services
 *
 * Nothing here logs, and nothing here touches the network: it only builds the
 * request. `push-send.ts` sends it.
 */

import { createECDH, createCipheriv, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto';

/** Largest record size we announce. Push services accept up to 4096 bytes. */
const RECORD_SIZE = 4096;
/** One record holds: plaintext + 1 delimiter byte + 16 byte GCM tag. */
export const MAX_PLAINTEXT_BYTES = RECORD_SIZE - 17;

/** VAPID tokens may live at most 24 hours; we ask for 12. */
const VAPID_TOKEN_SECONDS = 12 * 60 * 60;

export const fromBase64Url = (value: string): Buffer => Buffer.from(String(value).trim(), 'base64url');
export const toBase64Url = (value: Buffer | Uint8Array): string => Buffer.from(value).toString('base64url');

export interface VapidKeys {
  /** base64url, 65 bytes uncompressed point. */
  publicKey: string;
  /** base64url, 32 bytes. */
  privateKey: string;
  /** `mailto:` or `https:` address. */
  subject: string;
}

/** The VAPID keys from the environment, or null when any is missing or malformed. */
export const readVapidKeys = (env: Record<string, string | undefined> = process.env): VapidKeys | null => {
  const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (env.VAPID_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^(mailto:|https:\/\/)/i.test(subject)) return null;
  try {
    if (fromBase64Url(publicKey).length !== 65 || fromBase64Url(privateKey).length !== 32) return null;
  } catch {
    return null;
  }
  return { publicKey, privateKey, subject };
};

/** A signed VAPID token for one push service. `now` is injectable for tests. */
export const createVapidJwt = (
  endpoint: string,
  keys: VapidKeys,
  nowMs: number = Date.now(),
  lifetimeSeconds: number = VAPID_TOKEN_SECONDS
): string => {
  const audience = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: audience,
    exp: Math.floor(nowMs / 1000) + Math.min(lifetimeSeconds, VAPID_TOKEN_SECONDS),
    sub: keys.subject,
  };
  const unsigned = `${toBase64Url(Buffer.from(JSON.stringify(header)))}.${toBase64Url(Buffer.from(JSON.stringify(claims)))}`;

  const point = fromBase64Url(keys.publicKey);
  const privateKey = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: toBase64Url(point.subarray(1, 33)),
      y: toBase64Url(point.subarray(33, 65)),
      d: keys.privateKey,
    },
    format: 'jwk',
  });
  // ES256 wants the raw r||s pair (64 bytes), not the DER form.
  const signature = sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${toBase64Url(signature)}`;
};

/** Values a test may fix so the output is repeatable. Never set in production. */
export interface EncryptOverrides {
  /** 16 bytes. */
  salt?: Buffer;
  /** The 32-byte private number of the one-time sender key. */
  ephemeralPrivateKey?: Buffer;
}

const hkdf = (ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer =>
  Buffer.from(hkdfSync('sha256', ikm, salt, info, length));

/**
 * Encrypt a message for one phone (RFC 8291, aes128gcm). Returns the whole
 * request body: header (salt, record size, sender key) followed by one record.
 *
 * @param plaintext   the message bytes (at most MAX_PLAINTEXT_BYTES)
 * @param uaPublic    the phone's public key (`p256dh`), 65 bytes
 * @param authSecret  the phone's `auth` secret, 16 bytes
 */
export const encryptPayload = (
  plaintext: Buffer,
  uaPublic: Buffer,
  authSecret: Buffer,
  overrides: EncryptOverrides = {}
): Buffer => {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error('push_payload_too_large');
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('push_bad_p256dh');
  if (authSecret.length < 1) throw new Error('push_bad_auth');

  const salt = overrides.salt ?? randomBytes(16);
  if (salt.length !== 16) throw new Error('push_bad_salt');

  const ecdh = createECDH('prime256v1');
  if (overrides.ephemeralPrivateKey) ecdh.setPrivateKey(overrides.ephemeralPrivateKey);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65 bytes, uncompressed
  const sharedSecret = ecdh.computeSecret(uaPublic);

  // Mix the phone's auth secret and both public keys into the input key.
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  // One and only record, so it carries the "last record" delimiter 0x02.
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([0x02])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
};

/** What a phone gave us when it subscribed. */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface BuiltPushRequest {
  url: string;
  init: { method: 'POST'; headers: Record<string, string>; body: Buffer };
}

export interface BuildOptions {
  /** Seconds the push service may hold the message while the phone is off. */
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  nowMs?: number;
  overrides?: EncryptOverrides;
}

/** The ready-to-send request for one phone: encrypted body plus VAPID headers. */
export const buildPushRequest = (
  target: PushTarget,
  payload: string | Buffer,
  keys: VapidKeys,
  options: BuildOptions = {}
): BuiltPushRequest => {
  const url = new URL(target.endpoint);
  if (url.protocol !== 'https:') throw new Error('push_endpoint_not_https');
  const body = encryptPayload(
    Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8'),
    fromBase64Url(target.p256dh),
    fromBase64Url(target.auth),
    options.overrides
  );
  const jwt = createVapidJwt(target.endpoint, keys, options.nowMs);
  return {
    url: target.endpoint,
    init: {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttl ?? 86400),
        Urgency: options.urgency ?? 'normal',
      },
      body,
    },
  };
};
