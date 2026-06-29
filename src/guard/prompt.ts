import { createInterface } from 'node:readline';

/** Asks a question and resolves with the raw answer. Injectable for tests. */
export type AskFn = (question: string) => Promise<string>;

const AFFIRMATIVE = new Set(['y', 'yes']);

/** Default interactive prompt; reads a line from stdin (prompt goes to stderr). */
export function defaultAsk(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Yes/no confirmation; defaults to "no" for anything that isn't an explicit yes. */
export async function confirm(question: string, ask: AskFn = defaultAsk): Promise<boolean> {
  const answer = (await ask(`${question} [y/N] `)).trim().toLowerCase();
  return AFFIRMATIVE.has(answer);
}
