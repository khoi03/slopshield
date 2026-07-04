import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractInstallSpecifiers } from './command-parse.ts';

/** Convenience: the checkable registry names an npm command would install. */
function checkableNames(command: string): string[] {
  return extractInstallSpecifiers(command)
    .filter((s) => s.checkable)
    .map((s) => s.name);
}

const cases: ReadonlyArray<readonly [string, string[]]> = [
  ['npm install express', ['express']],
  ['npm i express lodash', ['express', 'lodash']],
  ['npm add left-pad', ['left-pad']],
  ['npm install', []],
  ['npm install --save-dev typescript', ['typescript']],
  ['npm install express@^4.18.0', ['express']],
  ['npm i @babel/core', ['@babel/core']],
  ['npm install "express"', ['express']],
  ['cd app && npm install reqeust', ['reqeust']],
  ['FOO=bar npm i foo', ['foo']],
  ['sudo npm i -g nodemon', ['nodemon']],
  ['echo hello', []],
  ['npm run build', []],
  ['npm ci', []],
  ['git clone x && cd x', []],
  // Shell noise must never become a "package" (fail-open, no false blocks):
  ['npm install foo > out.txt', ['foo']],
  ['npm i foo 2>&1', ['foo']],
  ['npm install foo < in.txt', ['foo']],
  ['npm i lodash &', ['lodash']],
  ['npm i $PKG', []],
  // Detection-bypass hardening (security review): these must NOT slip through.
  ['npm install express@npm:evil-pkg', ['evil-pkg']], // alias target is resolved & checked
  ['/usr/local/bin/npm install foo', ['foo']], // npm invoked by absolute path
  ['NPM install foo', ['foo']], // case-insensitive program match
  ['npm install "lodash@>=4.0.0"', ['lodash']], // quoted semver range, not a redirect
  ['npm install "evil""-pkg"', ['evil-pkg']], // adjacent quoted runs are one word
  ['npm install evil\\-pkg', ['evil-pkg']], // backslash escape is resolved
  // Over-eager detection must NOT fire on text that merely mentions an install:
  ['echo npm install foo', []],
  ['# npm install foo', []],
  // Runtime indirection stays fail-open (documented limitation):
  ['npm install $(echo evil)', []],
  ['npm install `echo evil`', []],
];

for (const [command, expected] of cases) {
  test(`extractInstallSpecifiers: "${command}" -> [${expected.join(', ')}]`, () => {
    assert.deepEqual(checkableNames(command), expected);
  });
}

test('extractInstallSpecifiers: non-registry specifiers are returned but not checkable', () => {
  const specs = extractInstallSpecifiers('npm install git+https://github.com/a/b.git');
  assert.equal(specs.length, 1);
  assert.equal(specs[0]?.checkable, false);
});

test('extractInstallSpecifiers: a second piped npm install is also captured', () => {
  assert.deepEqual(checkableNames('npm i a ; npm i b'), ['a', 'b']);
});
