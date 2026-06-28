import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistryClient, type FetchLike, type ResponseLike } from './client.ts';

/** Build a canned response. */
function response(status: number, body: unknown): ResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** A fetch spy that returns a fixed response and records the URLs it was called with. */
function spyFetch(res: ResponseLike): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    return res;
  };
  return { fetch, calls };
}

test('getPackageMetadata returns exists:true with createdAt on 200', async () => {
  const { fetch } = spyFetch(
    response(200, { name: 'express', time: { created: '2010-01-01T00:00:00.000Z' } }),
  );
  const client = createRegistryClient({ fetch });

  const meta = await client.getPackageMetadata('express');

  assert.deepEqual(meta, {
    name: 'express',
    exists: true,
    createdAt: '2010-01-01T00:00:00.000Z',
  });
});

test('getPackageMetadata returns exists:false on 404 (confident: not registered)', async () => {
  const { fetch } = spyFetch(response(404, {}));
  const client = createRegistryClient({ fetch });

  const meta = await client.getPackageMetadata('zxcv-totally-not-real-pkg');

  assert.deepEqual(meta, {
    name: 'zxcv-totally-not-real-pkg',
    exists: false,
    createdAt: null,
  });
});

test('getPackageMetadata returns null (unknown) on a 5xx error — fail-open', async () => {
  const { fetch } = spyFetch(response(503, {}));
  const client = createRegistryClient({ fetch });

  assert.equal(await client.getPackageMetadata('express'), null);
});

test('getPackageMetadata returns null (unknown) when fetch throws — fail-open', async () => {
  const fetch: FetchLike = async () => {
    throw new Error('network down');
  };
  const client = createRegistryClient({ fetch });

  assert.equal(await client.getPackageMetadata('express'), null);
});

test('getPackageMetadata returns null (unknown) when the request times out', async () => {
  // Fetch never resolves on its own; it only rejects when the abort signal fires.
  const fetch: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const client = createRegistryClient({ fetch, timeoutMs: 10 });

  assert.equal(await client.getPackageMetadata('express'), null);
});

test('getPackageMetadata caches results (one fetch for repeated lookups)', async () => {
  const { fetch, calls } = spyFetch(
    response(200, { time: { created: '2010-01-01T00:00:00.000Z' } }),
  );
  const client = createRegistryClient({ fetch });

  await client.getPackageMetadata('express');
  await client.getPackageMetadata('express');

  assert.equal(calls.length, 1);
});

test('getPackageMetadata URL-encodes the slash in scoped names', async () => {
  const { fetch, calls } = spyFetch(response(200, { time: { created: '2020-01-01T00:00:00.000Z' } }));
  const client = createRegistryClient({ fetch });

  await client.getPackageMetadata('@types/node');

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.includes('@types%2Fnode'), `expected encoded scope in URL, got ${calls[0]}`);
  assert.ok(!calls[0]!.includes('@types/node'), 'raw slash must not appear in the request URL');
});

test('getWeeklyDownloads returns the count on 200', async () => {
  const { fetch } = spyFetch(response(200, { downloads: 12345, package: 'express' }));
  const client = createRegistryClient({ fetch });

  assert.equal(await client.getWeeklyDownloads('express'), 12345);
});

test('getWeeklyDownloads returns null on 404 (treated as unavailable)', async () => {
  const { fetch } = spyFetch(response(404, { error: 'not found' }));
  const client = createRegistryClient({ fetch });

  assert.equal(await client.getWeeklyDownloads('brand-new-pkg'), null);
});

test('getWeeklyDownloads returns null on malformed payload', async () => {
  const { fetch } = spyFetch(response(200, { unexpected: true }));
  const client = createRegistryClient({ fetch });

  assert.equal(await client.getWeeklyDownloads('express'), null);
});

test('getWeeklyDownloads returns null (unknown) when fetch throws', async () => {
  const fetch: FetchLike = async () => {
    throw new Error('network down');
  };
  const client = createRegistryClient({ fetch });

  assert.equal(await client.getWeeklyDownloads('express'), null);
});
