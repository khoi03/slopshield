/**
 * A minimal, zero-dependency MCP server over the stdio transport.
 *
 * It implements exactly the surface a single-tool server needs on protocol
 * 2025-06-18: `initialize`, `notifications/initialized`, `tools/list`,
 * `tools/call`, and `ping`. Requests are echoed back by id; notifications are
 * never answered; unknown requests get method-not-found. All JSON-RPC goes to
 * the injected `write` (stdout by default); every diagnostic goes to `log`
 * (stderr) so the message channel is never corrupted.
 */

import pkg from '../../package.json' with { type: 'json' };
import {
  EXIT_OK,
  MCP_MAX_LINE_BYTES,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  MCP_TOOL_NAME,
} from '../config.ts';
import { createDefaultAnalyze, type AnalyzeNames } from '../engine.ts';
import {
  makeError,
  makeResult,
  parseMessage,
  serializeMessage,
  RPC_INTERNAL_ERROR,
  RPC_INVALID_PARAMS,
  RPC_INVALID_REQUEST,
  RPC_METHOD_NOT_FOUND,
  RPC_PARSE_ERROR,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './protocol.ts';
import { checkPackageTool, parseNamesArgument, runCheckPackage } from './tool.ts';

export interface McpServerDeps {
  /** Inbound byte/line stream (defaults to process.stdin). */
  readonly input?: AsyncIterable<string | Buffer>;
  /** Sink for one serialized JSON-RPC message (a newline is appended by default). */
  readonly write?: (line: string) => void;
  /** Diagnostic logger — MUST NOT write to stdout. Defaults to stderr. */
  readonly log?: (message: string) => void;
  readonly analyze?: AnalyzeNames;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Break a stream of arbitrary chunks into complete, newline-free lines. A single
 * line that grows past `MCP_MAX_LINE_BYTES` with no newline is dropped as
 * malformed, so a client cannot exhaust memory with an unterminated line.
 */
async function* readLines(input: AsyncIterable<string | Buffer>): AsyncGenerator<string> {
  let buffer = '';
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let index = buffer.indexOf('\n');
    while (index !== -1) {
      yield buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf('\n');
    }
    if (buffer.length > MCP_MAX_LINE_BYTES) buffer = '';
  }
  if (buffer.length > 0 && buffer.length <= MCP_MAX_LINE_BYTES) yield buffer.replace(/\r$/, '');
}

/** Negotiate the protocol version: echo the client's if we support it, else ours. */
function negotiateVersion(params: unknown): string {
  const requested =
    typeof params === 'object' && params !== null
      ? (params as Record<string, unknown>)['protocolVersion']
      : undefined;
  return typeof requested === 'string' &&
    (MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_PROTOCOL_VERSION;
}

function initializeResult(params: unknown): unknown {
  return {
    protocolVersion: negotiateVersion(params),
    capabilities: { tools: {} },
    serverInfo: { name: MCP_SERVER_NAME, version: pkg.version },
    instructions:
      'Call check_package with the npm package names you are about to install to detect slopsquatting, typosquatting, and hallucinated packages before they land.',
  };
}

async function handleToolCall(
  request: JsonRpcRequest,
  analyze: AnalyzeNames,
  log: (message: string) => void,
): Promise<JsonRpcResponse> {
  const params = (typeof request.params === 'object' && request.params !== null
    ? request.params
    : {}) as Record<string, unknown>;

  if (params['name'] !== MCP_TOOL_NAME) {
    return makeError(request.id, RPC_INVALID_PARAMS, `Unknown tool: ${String(params['name'])}`);
  }

  const names = parseNamesArgument(params['arguments']);
  if (names === null) {
    return makeError(
      request.id,
      RPC_INVALID_PARAMS,
      `${MCP_TOOL_NAME} requires a non-empty "names" array of strings.`,
    );
  }

  try {
    return makeResult(request.id, await runCheckPackage(names, analyze));
  } catch (error) {
    // A failed check is a tool-level error, reported inside a normal result so
    // the agent sees it — not a protocol error.
    const text = `check_package could not complete: ${errorMessage(error)}`;
    log(text);
    return makeResult(request.id, { content: [{ type: 'text', text }], isError: true });
  }
}

async function handleRequest(
  request: JsonRpcRequest,
  analyze: AnalyzeNames,
  log: (message: string) => void,
): Promise<JsonRpcResponse> {
  switch (request.method) {
    case 'initialize':
      return makeResult(request.id, initializeResult(request.params));
    case 'ping':
      return makeResult(request.id, {});
    case 'tools/list':
      return makeResult(request.id, { tools: [checkPackageTool] });
    case 'tools/call':
      return handleToolCall(request, analyze, log);
    default:
      return makeError(request.id, RPC_METHOD_NOT_FOUND, `Method not found: ${request.method}`);
  }
}

/** Turn one inbound line into a response, or null when none is owed (notifications). */
async function handleLine(
  line: string,
  analyze: AnalyzeNames,
  log: (message: string) => void,
): Promise<JsonRpcResponse | null> {
  const parsed = parseMessage(line);
  switch (parsed.kind) {
    case 'parse-error':
      return makeError(null, RPC_PARSE_ERROR, 'Parse error');
    case 'invalid':
      return makeError(parsed.id, RPC_INVALID_REQUEST, 'Invalid Request');
    case 'notification':
      return null; // includes notifications/initialized — never answered
    case 'request':
      return handleRequest(parsed.request, analyze, log);
  }
}

/**
 * Run the server until stdin closes. Resolves with an exit code (always OK — a
 * closed stdin is a normal shutdown, not a failure).
 */
export async function runMcpServer(deps: McpServerDeps = {}): Promise<number> {
  const write = deps.write ?? ((line) => void process.stdout.write(`${line}\n`));
  const log = deps.log ?? ((message) => void process.stderr.write(`${message}\n`));
  const analyze = deps.analyze ?? createDefaultAnalyze();
  const input = deps.input ?? process.stdin;

  for await (const line of readLines(input)) {
    if (line.trim().length === 0) continue;
    let response: JsonRpcResponse | null;
    try {
      response = await handleLine(line, analyze, log);
    } catch (error) {
      // Never let one bad message kill the loop.
      log(`Unhandled server error: ${errorMessage(error)}`);
      response = makeError(null, RPC_INTERNAL_ERROR, 'Internal error');
    }
    if (response !== null) write(serializeMessage(response));
  }
  return EXIT_OK;
}
