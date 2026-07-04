/**
 * Parse the JSON payload a Claude Code `PreToolUse` hook receives on stdin.
 *
 * Boundary validation for untrusted input: everything is narrowed from
 * `unknown` and any malformed shape yields `null` (the hook then defers to the
 * normal permission flow — fail-open). No schema library, to keep zero deps.
 */

/** The fields of a PreToolUse payload the guard cares about. */
export interface PreToolUsePayload {
  readonly toolName: string;
  /** The Bash command string, or null when the tool has none. */
  readonly command: string | null;
  /** The working directory Claude reported, or null when absent. */
  readonly cwd: string | null;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function parsePreToolUsePayload(stdin: string): PreToolUsePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const toolName = record['tool_name'];
  if (typeof toolName !== 'string') return null;

  const toolInput = record['tool_input'];
  const command =
    typeof toolInput === 'object' && toolInput !== null
      ? stringField(toolInput as Record<string, unknown>, 'command')
      : null;

  return { toolName, command, cwd: stringField(record, 'cwd') };
}
