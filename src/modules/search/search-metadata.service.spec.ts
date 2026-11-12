import { BadRequestException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import * as https from 'node:https';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import {
  isPublicMetadataAddress,
  metadataTransport,
  SearchMetadataService,
} from './search-metadata.service';

const PUBLIC_IP = '93.184.216.34';
interface ResponseFixture {
  status?: number;
  headers?: http.IncomingHttpHeaders;
  body?: string | Buffer;
  stall?: boolean;
}

describe('SearchMetadataService', () => {
  let service: SearchMetadataService;
  let lookup: jest.SpiedFunction<typeof metadataTransport.lookup>;
  let request: jest.SpiedFunction<typeof metadataTransport.request>;
  let fixtures: ResponseFixture[];
  let options: https.RequestOptions[];
  let requestedUrls: string[];
  let responses: PassThrough[];

  beforeEach(() => {
    service = new SearchMetadataService();
    fixtures = [];
    options = [];
    requestedUrls = [];
    responses = [];
    lookup = jest
      .spyOn(metadataTransport, 'lookup')
      .mockResolvedValue([{ address: PUBLIC_IP, family: 4 }]);
    request = jest
      .spyOn(metadataTransport, 'request')
      .mockImplementation((url, opts, callback) => {
        options.push(opts);
        requestedUrls.push(url.href);
        const fixture = fixtures.shift() ?? {};
        const response = new PassThrough();
        responses.push(response);
        Object.assign(response, {
          statusCode: fixture.status ?? 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            ...fixture.headers,
          },
        });
        const req = new EventEmitter() as http.ClientRequest;
        req.end = jest.fn(() => {
          queueMicrotask(() => {
            callback(response as unknown as http.IncomingMessage);
            if (!fixture.stall) response.end(fixture.body ?? '');
          });
          return req;
        }) as typeof req.end;
        return req;
      });
  });

  afterEach(() => {
    for (const response of responses) response.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('decodes title entities and resolves icons against the final response URL', async () => {
    fixtures.push(
      { status: 302, headers: { location: '/docs/page' } },
      {
        body: '<title> A &amp; B \n Search </title><link rel="shortcut ICON" href="../assets/icon.png">',
      },
    );
    const result = await service.fetch('https://example.com/start');
    expect(result).toEqual({
      url: 'https://example.com/docs/page',
      title: 'A & B Search',
      iconUrl: 'https://example.com/assets/icon.png',
      status: 'ok',
      fetchedAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
    expect(requestedUrls).toEqual([
      'https://example.com/start',
      'https://example.com/docs/page',
    ]);
  });

  it.each([
    { contentType: 'text/html; charset="GBK"', prefix: '' },
    { contentType: 'text/html', prefix: '<meta charset="gbk">' },
    {
      contentType: 'text/html',
      prefix:
        '<meta http-equiv="Content-Type" content="text/html; charset=gb2312">',
    },
  ])(
    'decodes GBK Chinese titles using charset declaration %#',
    async ({ contentType, prefix }) => {
      // Raw GBK bytes for 中文; do not depend on an encoding package in tests.
      const body = Buffer.concat([
        Buffer.from(`${prefix}<title>`),
        Buffer.from([0xd6, 0xd0, 0xce, 0xc4]),
        Buffer.from('</title>'),
      ]);
      fixtures.push({ headers: { 'content-type': contentType }, body });
      expect(await service.fetch('https://example.com')).toMatchObject({
        title: '中文',
        status: 'ok',
      });
    },
  );

  it('prefers the response charset over HTML meta charset', async () => {
    fixtures.push({ body: '<meta charset="gbk"><title>中文</title>' });
    expect(await service.fetch('https://example.com')).toMatchObject({
      title: '中文',
      status: 'ok',
    });
  });

  it('falls back to UTF-8 for an unknown charset', async () => {
    fixtures.push({
      headers: { 'content-type': 'text/html; charset=unknown-encoding' },
      body: '<title>中文</title>',
    });
    expect(await service.fetch('https://example.com')).toMatchObject({
      title: '中文',
      status: 'ok',
    });
  });

  it('handles missing title and defaults to the origin favicon without downloading it', async () => {
    fixtures.push({ body: '<html><body>No title</body></html>' });
    expect(await service.fetch('https://example.com/path/page')).toMatchObject({
      title: null,
      iconUrl: 'https://example.com/favicon.ico',
      status: 'ok',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uses the default favicon when icon links have no usable href', async () => {
    fixtures.push({ body: '<link rel="icon"><link rel="icon" href="  ">' });
    expect(await service.fetch('https://example.com/path')).toMatchObject({
      iconUrl: 'https://example.com/favicon.ico',
      status: 'ok',
    });
  });

  it.each([
    '',
    'file:///etc/passwd',
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://example.com/' + 'x'.repeat(2048),
    'not a url',
  ])('rejects invalid input %s before networking', async (input) => {
    await expect(service.fetch(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    '0.0.0.0',
    '10.1.1.1',
    '100.100.100.200',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.0.1',
    '192.0.2.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:93.184.216.34',
    '2001:db8::1',
    '2001::1',
    '2002:5db8:d822::1',
    '3fff::1',
  ])('rejects non-public DNS answer %s', async (address) => {
    expect(isPublicMetadataAddress(address)).toBe(false);
    lookup.mockResolvedValue([
      { address, family: address.includes(':') ? 6 : 4 },
    ]);
    expect(await service.fetch('https://example.com')).toMatchObject({
      status: 'unavailable',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.1',
    'http://0x7f000001',
    'http://2130706433',
    'http://[::1]',
    'https://[::ffff:93.184.216.34]',
  ])('blocks private or mapped literal %s without DNS', async (url) => {
    expect(await service.fetch(url)).toMatchObject({ status: 'unavailable' });
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('accepts public IPv4 and IPv6 addresses', () => {
    expect(isPublicMetadataAddress(PUBLIC_IP)).toBe(true);
    expect(isPublicMetadataAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('rejects a mixed public/private DNS response', async () => {
    lookup.mockResolvedValue([
      { address: PUBLIC_IP, family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    expect(await service.fetch('https://example.com')).toMatchObject({
      status: 'unavailable',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('pins connection lookup to the validated address and disables connection pooling', async () => {
    await service.fetch('https://example.com');
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const callback = jest.fn();
    const pinnedLookup = options[0].lookup!;
    pinnedLookup('example.com', {}, callback);
    expect(callback).toHaveBeenLastCalledWith(null, PUBLIC_IP, 4);
    pinnedLookup('example.com', { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [
      { address: PUBLIC_IP, family: 4 },
    ]);
    expect(options[0]).toMatchObject({ agent: false, method: 'GET' });
    expect(options[0].signal?.aborted).toBe(true);
  });

  it.each([
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'https://user:pass@example.com',
    'file:///tmp/secret',
  ])('blocks unsafe redirect %s', async (location) => {
    fixtures.push({ status: 302, headers: { location } });
    expect(await service.fetch('https://example.com')).toMatchObject({
      status: 'unavailable',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('revalidates DNS on every redirect, including the same host', async () => {
    lookup
      .mockResolvedValueOnce([{ address: PUBLIC_IP, family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    fixtures.push({ status: 302, headers: { location: '/next' } });
    expect(await service.fetch('https://example.com')).toMatchObject({
      status: 'unavailable',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('allows at most three redirects', async () => {
    fixtures.push(
      ...Array.from({ length: 4 }, () => ({
        status: 302,
        headers: { location: '/next' },
      })),
    );
    expect(await service.fetch('https://example.com')).toMatchObject({
      status: 'unavailable',
    });
    expect(request).toHaveBeenCalledTimes(4);
    expect(responses.every((response) => response.destroyed)).toBe(true);
  });

  it.each([
    'http://example.com/icon.png',
    'https://127.0.0.1/icon.png',
    'https://[::ffff:93.184.216.34]/icon',
    'https://user:pass@example.com/icon',
    'data:image/png;base64,AAA',
  ])('keeps the title but drops unsafe icon %s', async (href) => {
    fixtures.push({
      body: `<title>Useful title</title><link rel="icon" href="${href}">`,
    });
    expect(await service.fetch('https://example.com')).toMatchObject({
      title: 'Useful title',
      iconUrl: null,
      status: 'ok',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('drops an icon whose DNS contains a private address', async () => {
    lookup
      .mockResolvedValueOnce([{ address: PUBLIC_IP, family: 4 }])
      .mockResolvedValueOnce([{ address: '192.168.1.1', family: 4 }]);
    fixtures.push({
      body: '<title>Safe</title><link rel="icon" href="https://icons.example.com/logo">',
    });
    expect(await service.fetch('https://example.com')).toMatchObject({
      title: 'Safe',
      iconUrl: null,
      status: 'ok',
    });
  });

  it.each([
    { headers: { 'content-type': 'image/png' }, body: 'not HTML' },
    { headers: { 'content-length': '524289' } },
    { body: Buffer.alloc(524289, 'a') },
    {
      headers: { 'content-encoding': 'gzip' },
      body: gzipSync(Buffer.alloc(524289, 'a')),
    },
    { headers: { 'content-encoding': 'gzip' }, body: 'invalid gzip' },
    { headers: { 'content-encoding': 'unknown' }, body: '<title>No</title>' },
    { status: 403 },
  ])(
    'returns unavailable for unsupported, failed or oversized response %#',
    async (fixture) => {
      fixtures.push(fixture);
      expect(await service.fetch('https://example.com')).toMatchObject({
        title: null,
        iconUrl: null,
        status: 'unavailable',
      });
      expect(responses[0].destroyed).toBe(true);
    },
  );

  it('decodes bounded gzip HTML', async () => {
    fixtures.push({
      headers: { 'content-encoding': 'gzip' },
      body: gzipSync('<title>Compressed</title>'),
    });
    expect(await service.fetch('https://example.com')).toMatchObject({
      title: 'Compressed',
      status: 'ok',
    });
  });

  it('times out DNS resolution and never requests a late answer', async () => {
    jest.useFakeTimers();
    let resolveLookup!: (value: { address: string; family: number }[]) => void;
    lookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    const result = service.fetch('https://example.com');
    await jest.advanceTimersByTimeAsync(5000);
    expect(await result).toMatchObject({ status: 'unavailable' });
    resolveLookup([{ address: PUBLIC_IP, family: 4 }]);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
  });

  it('times out stalled HTML body reads and destroys the stream', async () => {
    jest.useFakeTimers();
    fixtures.push({ stall: true });
    const result = service.fetch('https://example.com');
    await jest.advanceTimersByTimeAsync(5000);
    expect(await result).toMatchObject({ status: 'unavailable' });
    expect(responses[0].destroyed).toBe(true);
  });

  it('bounds concurrent work and recovers slots after timeout', async () => {
    jest.useFakeTimers();
    lookup.mockImplementation(() => new Promise(() => {}));
    const pending = Array.from({ length: 8 }, () =>
      service.fetch('https://example.com'),
    );
    expect(await service.fetch('https://example.com')).toMatchObject({
      status: 'unavailable',
    });
    expect(lookup).toHaveBeenCalledTimes(8);
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all(pending);
    lookup.mockResolvedValue([{ address: PUBLIC_IP, family: 4 }]);
    const next = service.fetch('https://example.com');
    await jest.advanceTimersByTimeAsync(1);
    expect(await next).toMatchObject({ status: 'ok' });
  });
});
