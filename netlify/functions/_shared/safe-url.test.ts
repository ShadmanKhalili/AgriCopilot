import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  createPinnedLookup,
  readTextWithLimit,
  safeFetch,
  validateOutboundUrl,
  type HostResolver,
  type PinnedTransport,
} from './safe-url.ts';

const PUBLIC_IP = '93.184.216.34';

interface Reply {
  status?: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
  /** Extra chunks, for size tests. */
  chunks?: Buffer[];
}

/**
 * A stand-in for node:https that behaves like the real one where it matters:
 * it asks `options.lookup` for the address to connect to (twice, the way the
 * socket layer can), records what it was given, then answers from a script.
 */
const fakeTransport = (script: (call: { host: string; connectedTo: string[]; path: string }) => Reply) => {
  const calls: Array<{ protocol: string; options: any; connectedTo: string[] }> = [];
  const transport: PinnedTransport = (protocol, options, onResponse) => {
    const record = { protocol, options, connectedTo: [] as string[] };
    calls.push(record);
    const listeners: Record<string, (...args: any[]) => void> = {};
    const req = {
      on(event: string, listener: (...args: any[]) => void) {
        listeners[event] = listener;
        return req;
      },
      destroy() {},
      end() {
        setImmediate(() => {
          const ask = (cb: (err: Error | null) => void) =>
            (options.lookup as any)(options.hostname, { all: true }, (err: Error | null, addrs: any[]) => {
              if (err) return cb(err);
              record.connectedTo.push(...addrs.map((a) => a.address));
              cb(null);
            });
          ask((err) => {
            if (err) return listeners.error?.(err);
            // A second lookup, as happens on a retry across address families.
            ask((err2) => {
              if (err2) return listeners.error?.(err2);
              const spec = script({ host: options.hostname, connectedTo: record.connectedTo, path: options.path });
              const parts = spec.chunks ?? [Buffer.from(spec.body ?? '')];
              const res: any = Readable.from(parts);
              res.statusCode = spec.status ?? 200;
              res.headers = { 'content-type': 'text/html', ...(spec.headers ?? {}) };
              onResponse(res);
            });
          });
        });
      },
    };
    return req;
  };
  return { transport, calls };
};

const resolverOf = (map: Record<string, string[] | Error>): HostResolver =>
  vi.fn(async (hostname: string) => {
    const entry = map[hostname];
    if (!entry || entry instanceof Error) throw entry ?? new Error('ENOTFOUND');
    return entry.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  });

describe('safeFetch: DNS rebinding', () => {
  it('connects to the address it validated, even when DNS later answers with a private one', async () => {
    // Public for the check, loopback for every later question.
    let asked = 0;
    const resolver: HostResolver = vi.fn(async () => {
      asked += 1;
      return [{ address: asked === 1 ? PUBLIC_IP : '127.0.0.1', family: 4 }];
    });
    const { transport, calls } = fakeTransport(() => ({ body: 'hello' }));

    const response = await safeFetch('https://rebind.example/page', {}, { resolver, transport });

    expect(await response.text()).toBe('hello');
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    // Every lookup the socket layer made got the validated address.
    expect(calls[0].connectedTo).toEqual([PUBLIC_IP, PUBLIC_IP]);
    expect(calls[0].connectedTo).not.toContain('127.0.0.1');
    // The original hostname stays for Host / SNI.
    expect(calls[0].options.hostname).toBe('rebind.example');
    expect(calls[0].options.servername).toBe('rebind.example');
    expect(calls[0].options.agent).toBe(false);
  });

  it('never connects when the first answer is already private', async () => {
    const { transport, calls } = fakeTransport(() => ({ body: 'x' }));
    await expect(
      safeFetch('https://evil.example/', {}, { resolver: resolverOf({ 'evil.example': ['127.0.0.1'] }), transport })
    ).rejects.toThrow(/private/i);
    expect(calls).toHaveLength(0);
  });

  it('rejects a mixed answer that includes a private address', async () => {
    const { transport, calls } = fakeTransport(() => ({ body: 'x' }));
    await expect(
      safeFetch('https://mixed.example/', {}, { resolver: resolverOf({ 'mixed.example': [PUBLIC_IP, '10.0.0.5'] }), transport })
    ).rejects.toThrow(/private/i);
    expect(calls).toHaveLength(0);
  });

  it('re-resolves on a redirect hop and rejects it when the name now points inside', async () => {
    let asked = 0;
    const resolver: HostResolver = vi.fn(async () => {
      asked += 1;
      return [{ address: asked === 1 ? PUBLIC_IP : '192.168.1.10', family: 4 }];
    });
    const { transport, calls } = fakeTransport(() => ({ status: 302, headers: { location: 'https://rebind.example/next' } }));
    await expect(safeFetch('https://rebind.example/', {}, { resolver, transport })).rejects.toThrow(/private/i);
    expect(calls).toHaveLength(1);
  });
});

describe('createPinnedLookup', () => {
  it('answers only for its own host and only with its pinned address', () => {
    const lookup = createPinnedLookup('example.com', { address: PUBLIC_IP, family: 4 });
    const all = vi.fn();
    lookup('example.com', { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: PUBLIC_IP, family: 4 }]);

    const single = vi.fn();
    lookup('EXAMPLE.com.', {}, single);
    expect(single).toHaveBeenCalledWith(null, PUBLIC_IP, 4);

    const other = vi.fn();
    lookup('internal.example', { all: true }, other);
    expect(other.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('refuses to hand out a private address', () => {
    const lookup = createPinnedLookup('example.com', { address: '127.0.0.1', family: 4 });
    const cb = vi.fn();
    lookup('example.com', { all: true }, cb);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe('safeFetch: redirects', () => {
  const redirectTo = (location: string) => fakeTransport(() => ({ status: 302, headers: { location } }));

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:8080/admin',
    'http://localhost/',
    'http://[::1]/',
    'http://metadata.google.internal/',
    'http://10.1.2.3/',
    'file:///etc/passwd',
    'http://internal.example/',
  ])('blocks a redirect to %s', async (target) => {
    const { transport, calls } = redirectTo(target);
    const resolver = resolverOf({ 'start.example': [PUBLIC_IP], 'internal.example': ['10.9.9.9'] });
    await expect(safeFetch('https://start.example/', {}, { resolver, transport })).rejects.toThrow();
    // Only the first, public hop was ever requested.
    expect(calls).toHaveLength(1);
  });

  it('follows a redirect between public hosts, validating each hop', async () => {
    const { transport, calls } = fakeTransport(({ host }) =>
      host === 'a.example' ? { status: 301, headers: { location: 'https://b.example/final' } } : { body: 'done' }
    );
    const resolver = resolverOf({ 'a.example': [PUBLIC_IP], 'b.example': ['93.184.216.35'] });
    const response = await safeFetch('https://a.example/', {}, { resolver, transport });
    expect(await response.text()).toBe('done');
    expect(calls.map((c) => c.options.hostname)).toEqual(['a.example', 'b.example']);
    expect(calls[1].connectedTo[0]).toBe('93.184.216.35');
  });

  it('gives up after three redirects', async () => {
    const { transport, calls } = fakeTransport(({ host }) => ({ status: 302, headers: { location: `https://${host}/again` } }));
    await expect(
      safeFetch('https://loop.example/', {}, { resolver: resolverOf({ 'loop.example': [PUBLIC_IP] }), transport })
    ).rejects.toThrow(/Too many redirects/);
    expect(calls).toHaveLength(4);
  });
});

describe('safeFetch: limits and method', () => {
  const resolver = resolverOf({ 'big.example': [PUBLIC_IP] });

  it('stops reading a body that grows past the cap', async () => {
    const chunk = Buffer.alloc(64 * 1024, 97);
    const { transport } = fakeTransport(() => ({ chunks: Array.from({ length: 20 }, () => chunk) }));
    const response = await safeFetch('https://big.example/', {}, { resolver, transport, maxBytes: 256 * 1024 });
    await expect(readTextWithLimit(response, 256 * 1024)).rejects.toThrow(/too large/i);
  });

  it('refuses up front when the declared length is over the cap', async () => {
    const { transport } = fakeTransport(() => ({ headers: { 'content-length': String(10 * 1024 * 1024) }, body: 'x' }));
    await expect(safeFetch('https://big.example/', {}, { resolver, transport, maxBytes: 512 * 1024 })).rejects.toThrow(
      /too large/i
    );
  });

  it('applies the cap after decompression, so a gzip bomb cannot expand past it', async () => {
    const bomb = zlib.gzipSync(Buffer.alloc(5 * 1024 * 1024, 0));
    expect(bomb.length).toBeLessThan(64 * 1024);
    const { transport } = fakeTransport(() => ({ headers: { 'content-encoding': 'gzip' }, body: bomb }));
    const response = await safeFetch('https://big.example/', {}, { resolver, transport, maxBytes: 128 * 1024 });
    await expect(response.text()).rejects.toThrow();
  });

  it('decompresses a normal gzip body within the cap', async () => {
    const { transport } = fakeTransport(() => ({ headers: { 'content-encoding': 'gzip' }, body: zlib.gzipSync('<html>ok</html>') }));
    const response = await safeFetch('https://big.example/', {}, { resolver, transport });
    expect(await response.text()).toBe('<html>ok</html>');
    expect(response.headers.get('content-encoding')).toBeNull();
  });

  it('rejects an encoding it cannot decode', async () => {
    const { transport } = fakeTransport(() => ({ headers: { 'content-encoding': 'compress' }, body: 'x' }));
    await expect(safeFetch('https://big.example/', {}, { resolver, transport })).rejects.toThrow(/encoding/i);
  });

  it('only sends GET or HEAD', async () => {
    const { transport, calls } = fakeTransport(() => ({ body: 'x' }));
    await expect(safeFetch('https://big.example/', { method: 'POST' }, { resolver, transport })).rejects.toThrow(/GET/);
    expect(calls).toHaveLength(0);
  });

  it('asks for an uncompressed body by default', async () => {
    const { transport, calls } = fakeTransport(() => ({ body: 'x' }));
    await safeFetch('https://big.example/', { headers: { Accept: 'text/html' } }, { resolver, transport });
    expect(calls[0].options.headers['accept-encoding']).toBe('identity');
    expect(calls[0].options.headers.accept).toBe('text/html');
  });
});

describe('safeFetch with the real network stack', () => {
  it('never opens a connection to a loopback server, by literal address or by name', async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits += 1;
      res.end('secret');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(/prohibited/i);
      await expect(safeFetch(`http://localhost:${port}/`)).rejects.toThrow();
      // A name that resolves to loopback.
      const resolver = resolverOf({ 'looks-public.example': ['127.0.0.1'] });
      await expect(safeFetch(`http://looks-public.example:${port}/`, {}, { resolver })).rejects.toThrow(/private/i);
      expect(hits).toBe(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('validateOutboundUrl', () => {
  it('returns the validated addresses and accepts an injected resolver', async () => {
    const result = await validateOutboundUrl('https://ok.example/x', resolverOf({ 'ok.example': [PUBLIC_IP] }));
    expect(result.safe).toBe(true);
    expect(result.addresses).toEqual([{ address: PUBLIC_IP, family: 4 }]);
  });

  it('reports an unresolvable host', async () => {
    const result = await validateOutboundUrl('https://gone.example/', resolverOf({}));
    expect(result).toMatchObject({ safe: false, error: 'Host could not be resolved' });
  });
});
