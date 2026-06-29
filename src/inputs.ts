import { readFile as fsReadFile } from 'node:fs/promises';

/** The dependency sections of a package.json we collect names from. */
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

/** A function that reads a file's text content (injectable for tests). */
export type ReadFile = (path: string) => Promise<string>;

/** Default reader: UTF-8 text (so callers get a string, not a Buffer). */
export const defaultReadFile: ReadFile = (path) => fsReadFile(path, 'utf8');

/** Collect dependency names from a parsed package.json, de-duplicated in order. */
export function extractNamesFromPackageJson(json: unknown): string[] {
  if (typeof json !== 'object' || json === null) return [];

  const record = json as Record<string, unknown>;
  const names = new Set<string>();
  for (const field of DEPENDENCY_FIELDS) {
    const section = record[field];
    if (typeof section === 'object' && section !== null) {
      for (const name of Object.keys(section)) names.add(name);
    }
  }
  return [...names];
}

/** Parse a newline-delimited list of names, ignoring blank lines and `#` comments. */
export function parseNameList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/** Resolve names from file content: package.json manifest, JSON array, or newline list. */
export function parseFileContent(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return parseNameList(text);
  }

  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is string => typeof x === 'string');
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return extractNamesFromPackageJson(parsed);
  }
  return parseNameList(text);
}

/** Read and parse names from a file path. */
export async function readFileNames(path: string, readFile: ReadFile = defaultReadFile): Promise<string[]> {
  return parseFileContent(await readFile(path));
}

export interface InputOptions {
  readonly positional: readonly string[];
  readonly file?: string;
}

/** Merge positional names with any file-derived names, de-duplicated in order. */
export async function resolveInputs(
  options: InputOptions,
  readFile: ReadFile = defaultReadFile,
): Promise<string[]> {
  const names = new Set<string>(options.positional);
  if (options.file !== undefined) {
    for (const name of await readFileNames(options.file, readFile)) names.add(name);
  }
  return [...names];
}
