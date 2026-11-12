import { BadRequestException, Injectable } from '@nestjs/common';
import { load } from 'cheerio';
import * as dns from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import * as ipaddr from 'ipaddr.js';

export interface SearchMetadata {
  url: string;
  title: string | null;
  iconUrl: string | null;
  fetchedAt: string;
  status: 'ok' | 'unavailable';
  message?: string;
}

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const MAX_CONCURRENT = 8;

// Explicit seams keep tests entirely offline. Native requests do not inherit proxy env vars.
export const metadataTransport = {
  lookup: (hostname: string) =>
    dns.lookup(hostname, { all: true, verbatim: true }),
  request: (
    url: URL,
    options: https.RequestOptions,
    callback: (response: http.IncomingMessage) => void,
  ): http.ClientRequest =>
    (url.protocol === 'https:' ? https : http).request(url, options, callback),
};

export function isPublicMetadataAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6') {
      const ipv6 = parsed as ipaddr.IPv6;
      // Exclude mapped addresses even when their embedded IPv4 address is public.
      if (ipv6.isIPv4MappedAddress()) return false;
      // Only global unicast, excluding protocol assignments and documentation blocks.
      if (!ipv6.match(ipaddr.IPv6.parse('2000::'), 3)) return false;
      if (ipv6.match(ipaddr.IPv6.parse('2001::'), 23)) return false;
      if (ipv6.match(ipaddr.IPv6.parse('3fff::'), 20)) return false;
    }
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

export function parseMetadataUrl(input: string): URL {
  if (typeof input !== 'string' || input.length > 2048 || !input.trim()) {
    throw new BadRequestException(
      'URL must be an HTTP(S) URL of at most 2048 characters',
    );
  }
  try {
    const url = new URL(input);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error('Invalid URL');
    }
    return url;
  } catch {
    throw new BadRequestException('URL must use HTTP(S) without credentials');
  }
}

function hostnameOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '');
}

async function publicAddresses(url: URL, signal: AbortSignal) {
  signal.throwIfAborted();
  const hostname = hostnameOf(url);
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await metadataTransport.lookup(hostname);
  signal.throwIfAborted();
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicMetadataAddress(address))
  ) {
    throw new Error('Address is not public');
  }
  return addresses;
}

function byteLimit() {
  let bytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(
        bytes > MAX_BYTES ? new Error('HTML exceeds size limit') : null,
        chunk,
      );
    },
  });
}

function decodeHtml(body: Buffer, contentType: string | undefined): string {
  const charsetFrom = (value: string) =>
    /(?:^|;)\s*charset\s*=\s*["']?\s*([^;\s"']+)/i.exec(value)?.[1];
  let charset = charsetFrom(contentType ?? '');
  if (!charset) {
    // Charset declarations are ASCII-compatible; inspect only the bounded document prefix.
    const $ = load(body.subarray(0, 4096).toString('latin1'));
    for (const meta of $('meta').toArray()) {
      charset = $(meta).attr('charset')?.trim();
      if (
        !charset &&
        $(meta).attr('http-equiv')?.toLowerCase() === 'content-type'
      ) {
        charset = charsetFrom($(meta).attr('content') ?? '');
      }
      if (charset) break;
    }
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(body);
  } catch {
    return body.toString('utf8');
  }
}

async function readHtml(
  response: http.IncomingMessage,
  signal: AbortSignal,
): Promise<string> {
  const type = response.headers['content-type']
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  if (type !== 'text/html' && type !== 'application/xhtml+xml') {
    response.destroy();
    throw new Error('Response is not HTML');
  }
  const length = Number(response.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BYTES) {
    response.destroy();
    throw new Error('HTML exceeds size limit');
  }
  const encoding = response.headers['content-encoding']?.trim().toLowerCase();
  const decoder =
    encoding === 'gzip'
      ? createGunzip()
      : encoding === 'deflate'
        ? createInflate()
        : encoding === 'br'
          ? createBrotliDecompress()
          : undefined;
  if (encoding && encoding !== 'identity' && !decoder) {
    response.destroy();
    throw new Error('Unsupported content encoding');
  }
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  if (decoder) {
    await pipeline(response, byteLimit(), decoder, byteLimit(), sink, {
      signal,
    });
  } else {
    await pipeline(response, byteLimit(), sink, { signal });
  }
  signal.throwIfAborted();
  return decodeHtml(Buffer.concat(chunks), response.headers['content-type']);
}

async function requestHtml(
  url: URL,
  signal: AbortSignal,
): Promise<http.IncomingMessage> {
  const addresses = await publicAddresses(url, signal);
  const pinned = addresses[0];
  const lookup: LookupFunction = (_hostname, options, callback) => {
    // Node can request all addresses. Never perform another DNS lookup at connection time.
    if (options.all) callback(null, [pinned]);
    else callback(null, pinned.address, pinned.family);
  };
  return new Promise((resolve, reject) => {
    const request = metadataTransport.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup,
        signal,
        maxHeaderSize: 16 * 1024,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'ManagementSearchMetadata/1.0',
        },
      },
      resolve,
    );
    request.once('error', reject);
    request.end();
  });
}

@Injectable()
export class SearchMetadataService {
  private activeRequests = 0;

  async fetch(input: string): Promise<SearchMetadata> {
    const initialUrl = parseMetadataUrl(input);
    const base = { url: initialUrl.href, title: null, iconUrl: null };
    const unavailable = (): SearchMetadata => ({
      ...base,
      fetchedAt: new Date().toISOString(),
      status: 'unavailable',
      message: '无法获取网站信息，请手动填写',
    });
    if (this.activeRequests >= MAX_CONCURRENT) return unavailable();
    this.activeRequests++;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Metadata request timed out'));
      }, TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        this.fetchWithinDeadline(initialUrl, signal),
        timeout,
      ]);
    } catch {
      return unavailable();
    } finally {
      clearTimeout(timer!);
      controller.abort();
      this.activeRequests--;
    }
  }

  private async fetchWithinDeadline(
    initialUrl: URL,
    signal: AbortSignal,
  ): Promise<SearchMetadata> {
    let url = initialUrl;
    let html: string | undefined;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await requestHtml(url, signal);
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || redirects === 3)
          throw new Error('Redirect limit exceeded');
        url = parseMetadataUrl(new URL(location, url).href);
        continue;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        throw new Error('Website returned an unsuccessful status');
      }
      html = await readHtml(response, signal);
      break;
    }
    signal.throwIfAborted();
    const $ = load(html!);
    const title =
      $('title').first().text().replace(/\s+/g, ' ').trim().slice(0, 1000) ||
      null;
    const href = $('link[rel]')
      .toArray()
      .find(
        (element) =>
          ($(element).attr('href') ?? '').trim() &&
          ($(element).attr('rel') ?? '')
            .toLowerCase()
            .split(/\s+/)
            .includes('icon'),
      );
    let iconUrl: string | null = null;
    try {
      const icon = parseMetadataUrl(
        new URL(href ? ($(href).attr('href') ?? '') : '/favicon.ico', url).href,
      );
      if (icon.protocol === 'https:') {
        await publicAddresses(icon, signal);
        iconUrl = icon.href;
      }
    } catch {
      signal.throwIfAborted();
      // A missing or unsafe icon must not discard a usable title.
    }
    signal.throwIfAborted();
    return {
      url: url.href,
      title,
      iconUrl,
      fetchedAt: new Date().toISOString(),
      status: 'ok',
    };
  }
}
