import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractNamesFromPackageJson,
  parseFileContent,
  parseNameList,
  resolveInputs,
} from './inputs.ts';

test('extracts names from every dependency section, de-duplicated in order', () => {
  const json = {
    dependencies: { express: '^4', lodash: '^4' },
    devDependencies: { typescript: '^5', lodash: '^4' },
    optionalDependencies: { fsevents: '*' },
    peerDependencies: { react: '^18' },
  };

  assert.deepEqual(extractNamesFromPackageJson(json), [
    'express',
    'lodash',
    'typescript',
    'fsevents',
    'react',
  ]);
});

test('returns no names for a manifest without dependencies', () => {
  assert.deepEqual(extractNamesFromPackageJson({ name: 'x', version: '1.0.0' }), []);
});

test('returns no names for non-object input', () => {
  assert.deepEqual(extractNamesFromPackageJson(null), []);
  assert.deepEqual(extractNamesFromPackageJson('nope'), []);
});

test('parseNameList splits lines and ignores blanks and # comments', () => {
  const text = 'express\n  react  \n\n# a comment\nlodash\n';
  assert.deepEqual(parseNameList(text), ['express', 'react', 'lodash']);
});

test('parseFileContent reads a package.json manifest', () => {
  const text = JSON.stringify({ dependencies: { express: '^4' } });
  assert.deepEqual(parseFileContent(text), ['express']);
});

test('parseFileContent reads a JSON array of names', () => {
  assert.deepEqual(parseFileContent('["express", "react"]'), ['express', 'react']);
});

test('parseFileContent falls back to a newline list for non-JSON', () => {
  assert.deepEqual(parseFileContent('express\nreact'), ['express', 'react']);
});

test('resolveInputs merges positional names with file names, de-duplicated', async () => {
  const readFile = async (path: string): Promise<string> => {
    assert.equal(path, 'pkg.json');
    return JSON.stringify({ dependencies: { lodash: '^4' } });
  };

  const names = await resolveInputs(
    { positional: ['express', 'lodash'], file: 'pkg.json' },
    readFile,
  );

  assert.deepEqual(names, ['express', 'lodash']); // lodash de-duplicated
});

test('resolveInputs works with only positional names', async () => {
  assert.deepEqual(await resolveInputs({ positional: ['express'] }), ['express']);
});
