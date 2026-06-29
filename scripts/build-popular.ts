/**
 * Regenerate `src/data/popular-packages.json` from a public, downloads-ranked
 * source of npm package names.
 *
 * This is a maintainer tool, not part of the runtime. It requires network
 * access. The committed snapshot is a hand-curated seed of the most common
 * packages; run this periodically to refresh and expand it.
 *
 *   npm run build:data
 *
 * Source can be overridden with the SLOPSHIELD_POPULAR_SOURCE env var. The
 * source must return either a JSON array of name strings, or a JSON array of
 * objects each having a `name` (string) field.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Default public source: the "all-the-package-names" popularity-ordered export. */
const DEFAULT_SOURCE =
  'https://raw.githubusercontent.com/nice-registry/all-the-package-names/master/names.json';

/** How many names to keep in the snapshot (downloads-ranked sources list the most popular first). */
const SNAPSHOT_SIZE = 5000;

const OUTPUT_PATH = fileURLToPath(new URL('../src/data/popular-packages.json', import.meta.url));

function extractNames(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    throw new Error('Source payload is not a JSON array.');
  }
  const names: string[] = [];
  for (const entry of payload) {
    if (typeof entry === 'string') {
      names.push(entry);
    } else if (typeof entry === 'object' && entry !== null) {
      const name = (entry as { name?: unknown }).name;
      if (typeof name === 'string') names.push(name);
    }
  }
  return names;
}

async function main(): Promise<void> {
  const source = process.env['SLOPSHIELD_POPULAR_SOURCE'] ?? DEFAULT_SOURCE;
  console.log(`Fetching popular package names from: ${source}`);

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Source returned HTTP ${response.status}`);
  }

  const names = extractNames(await response.json());
  const unique = [...new Set(names)].slice(0, SNAPSHOT_SIZE);
  if (unique.length === 0) {
    throw new Error('No names extracted from source.');
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(unique, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${unique.length} names to ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`build-popular failed: ${message}`);
  process.exit(1);
});
