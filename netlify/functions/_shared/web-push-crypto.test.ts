import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildPushRequest,
  createVapidJwt,
  encryptPayload,
  fromBase64Url,
  readVapidKeys,
  toBase64Url,
  type VapidKeys,
} from './web-push-crypto';

// RFC 8291 Section 5 example.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

const newVapidKeys = (): VapidKeys => {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: toBase64Url(ecdh.getPublicKey()),
    privateKey: toBase64Url(ecdh.getPrivateKey()),
    subject: 'mailto:test@example.com',
  };
};

describe('RFC 8291 payload encryption', () => {
  it('produces exactly the body of the RFC 8291 section 5 example', () => {
    const body = encryptPayload(
      Buffer.from(RFC.plaintext),
      fromBase64Url(RFC.uaPublic),
      fromBase64Url(RFC.auth),
      { salt: fromBase64Url(RFC.salt), ephemeralPrivateKey: fromBase64Url(RFC.asPrivate) }
    );
    expect(toBase64Url(body)).toBe(RFC.body);
  });

  it('writes the header: salt, record size 4096, key length 65, sender key', () => {
    const body = encryptPayload(Buffer.from('hi'), fromBase64Url(RFC.uaPublic), fromBase64Url(RFC.auth));
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(body[21]).toBe(0x04);
    // header 86 + plaintext 2 + delimiter 1 + tag 16
    expect(body.length).toBe(86 + 2 + 1 + 16);
  });

  it('uses a fresh salt and sender key each time', () => {
    const a = encryptPayload(Buffer.from('hi'), fromBase64Url(RFC.uaPublic), fromBase64Url(RFC.auth));
    const b = encryptPayload(Buffer.from('hi'), fromBase64Url(RFC.uaPublic), fromBase64Url(RFC.auth));
    expect(a.equals(b)).toBe(false);
  });

  it('can be decrypted by the phone that holds the private key', () => {
    const phone = createECDH('prime256v1');
    phone.generateKeys();
    const auth = Buffer.from('0123456789abcdef');
    const message = JSON.stringify({ title: 'আপনার এলাকায় সতর্কতা', body: 'x', url: '/#home' });
    const body = encryptPayload(Buffer.from(message), phone.getPublicKey(), auth);

    const salt = body.subarray(0, 16);
    const idlen = body[20];
    const asPublic = body.subarray(21, 21 + idlen);
    const record = body.subarray(21 + idlen);
    const secret = phone.computeSecret(asPublic);
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), phone.getPublicKey(), asPublic]);
    const ikm = Buffer.from(hkdfSync('sha256', secret, auth, keyInfo, 32));
    const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
    const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(record.subarray(record.length - 16));
    const plain = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
    expect(plain[plain.length - 1]).toBe(0x02);
    expect(plain.subarray(0, plain.length - 1).toString('utf8')).toBe(message);
  });

  it('rejects a message that cannot fit one record', () => {
    expect(() =>
      encryptPayload(Buffer.alloc(5000), fromBase64Url(RFC.uaPublic), fromBase64Url(RFC.auth))
    ).toThrow();
  });

  it('rejects a malformed phone key', () => {
    expect(() => encryptPayload(Buffer.from('x'), Buffer.alloc(10), fromBase64Url(RFC.auth))).toThrow();
  });
});

describe('VAPID token', () => {
  const keys = newVapidKeys();
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123?x=1';
  const now = Date.UTC(2026, 10, 28, 1, 0, 0);

  it('has the right claims and verifies with the public key', () => {
    const jwt = createVapidJwt(endpoint, keys, now);
    const [h, p, s] = jwt.split('.');
    expect(JSON.parse(fromBase64Url(h).toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    const claims = JSON.parse(fromBase64Url(p).toString());
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toBe('mailto:test@example.com');
    expect(claims.exp).toBe(Math.floor(now / 1000) + 12 * 3600);

    const point = fromBase64Url(keys.publicKey);
    const publicKey = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: toBase64Url(point.subarray(1, 33)), y: toBase64Url(point.subarray(33, 65)) },
      format: 'jwk',
    });
    const signature = fromBase64Url(s);
    expect(signature.length).toBe(64);
    expect(verify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)).toBe(true);
    // A changed claim must not verify.
    expect(verify('sha256', Buffer.from(`${h}.${p}x`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)).toBe(false);
  });

  it('never asks for more than 12 hours', () => {
    const jwt = createVapidJwt(endpoint, keys, now, 7 * 24 * 3600);
    const claims = JSON.parse(fromBase64Url(jwt.split('.')[1]).toString());
    expect(claims.exp - Math.floor(now / 1000)).toBeLessThanOrEqual(12 * 3600);
  });
});

describe('buildPushRequest', () => {
  it('sets the headers a push service expects', () => {
    const keys = newVapidKeys();
    const phone = createECDH('prime256v1');
    phone.generateKeys();
    const request = buildPushRequest(
      {
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc',
        p256dh: toBase64Url(phone.getPublicKey()),
        auth: toBase64Url(Buffer.from('0123456789abcdef')),
      },
      JSON.stringify({ title: 't' }),
      keys
    );
    const h = request.init.headers;
    expect(h.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`));
    expect(h['Content-Encoding']).toBe('aes128gcm');
    expect(h['Content-Type']).toBe('application/octet-stream');
    expect(h.TTL).toBe('86400');
    expect(h.Urgency).toBe('normal');
    expect(Buffer.isBuffer(request.init.body)).toBe(true);
  });

  it('refuses a non-https endpoint', () => {
    const keys = newVapidKeys();
    expect(() =>
      buildPushRequest({ endpoint: 'http://example.com/x', p256dh: RFC.uaPublic, auth: RFC.auth }, 'x', keys)
    ).toThrow();
  });
});

describe('readVapidKeys', () => {
  it('needs all three values and a mailto or https subject', () => {
    const keys = newVapidKeys();
    const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: keys.subject };
    expect(readVapidKeys(env)).toEqual(keys);
    expect(readVapidKeys({ ...env, VAPID_SUBJECT: '' })).toBeNull();
    expect(readVapidKeys({ ...env, VAPID_SUBJECT: 'nobody' })).toBeNull();
    expect(readVapidKeys({ ...env, VAPID_PRIVATE_KEY: 'short' })).toBeNull();
    expect(readVapidKeys({})).toBeNull();
  });
});


import { isPushServiceEndpoint } from './push-send.ts';

describe('isPushServiceEndpoint', () => {
  it('accepts the browsers push services only', () => {
    expect(isPushServiceEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc')).toBe(true);
    expect(isPushServiceEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(isPushServiceEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(isPushServiceEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushServiceEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushServiceEndpoint('not a url')).toBe(false);
  });
});
