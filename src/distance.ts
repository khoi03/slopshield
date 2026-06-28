/**
 * Optimal String Alignment (restricted Damerau-Levenshtein) edit distance.
 *
 * Counts insertions, deletions, substitutions, and *adjacent* transpositions
 * each as a single edit. The transposition term is what catches the common
 * typosquat pattern of swapped neighbouring characters (e.g. "reqeust" →
 * "request"), which plain Levenshtein would score as two edits.
 *
 * Implemented in-house (no dependency) to keep the supply-chain attack surface
 * of this security tool as small as possible. Runs in O(m·n) time and space.
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const width = n + 1;
  const d = new Array<number>((m + 1) * width).fill(0);
  const at = (i: number, j: number): number => d[i * width + j]!;

  for (let i = 0; i <= m; i++) d[i * width] = i;
  for (let j = 0; j <= n; j++) d[j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        at(i - 1, j) + 1, // deletion
        at(i, j - 1) + 1, // insertion
        at(i - 1, j - 1) + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1); // adjacent transposition
      }
      d[i * width + j] = best;
    }
  }

  return at(m, n);
}
