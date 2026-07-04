/**
 * Minimal, dependency-free JSON-RPC 2.0 framing for the MCP stdio transport.
 *
 * MCP over stdio is newline-delimited JSON-RPC 2.0 (one single-line object per
 * line, UTF-8, no Content-Length headers, no batching). This module handles the
 * envelope only — parsing an inbound line into a typed shape and building
 * responses. It is pure and never touches I/O; the server owns stdin/stdout.
 */

/** A JSON-RPC id is a string or a number (never null for a real request). */
export type JsonRpcId = string | number;

/** A request expects a response and always carries an id. */
export interface JsonRpcRequest {
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params: unknown;
}

/** A notification never carries an id and MUST NOT be responded to. */
export interface JsonRpcNotification {
  readonly method: string;
  readonly params: unknown;
}

/**
 * The outcome of parsing one inbound line. `invalid` covers valid JSON that is
 * not a usable request/notification (e.g. a batch array or a message with no
 * method); its `id` is echoed back when present so the client can correlate.
 */
export type ParsedMessage =
  | { readonly kind: 'request'; readonly request: JsonRpcRequest }
  | { readonly kind: 'notification'; readonly notification: JsonRpcNotification }
  | { readonly kind: 'parse-error' }
  | { readonly kind: 'invalid'; readonly id: JsonRpcId | null };

/** JSON-RPC error payload. */
export interface JsonRpcErrorShape {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcSuccessResponse {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId | null;
  readonly result: unknown;
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId | null;
  readonly error: JsonRpcErrorShape;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/** Standard JSON-RPC error codes used by the server. */
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Parse a single line into a typed message. Lenient on read (we do not reject on
 * a missing/oddly-cased `jsonrpc` field) and strict on write; never throws.
 */
export function parseMessage(line: string): ParsedMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { kind: 'parse-error' };
  }

  // Arrays are JSON-RPC batches, which MCP 2025-06-18 removed; non-objects are
  // never valid messages. Neither carries a usable id.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', id: null };
  }

  const obj = parsed as Record<string, unknown>;
  const id = isJsonRpcId(obj['id']) ? obj['id'] : null;

  if (typeof obj['method'] !== 'string') {
    return { kind: 'invalid', id };
  }

  const message = { method: obj['method'], params: obj['params'] };
  return id === null
    ? { kind: 'notification', notification: message }
    : { kind: 'request', request: { id, ...message } };
}

/** Build a JSON-RPC success response. */
export function makeResult(id: JsonRpcId | null, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: '2.0', id, result };
}

/** Build a JSON-RPC error response, omitting `data` when not provided. */
export function makeError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  const error: JsonRpcErrorShape = data === undefined ? { code, message } : { code, message, data };
  return { jsonrpc: '2.0', id, error };
}

/**
 * Serialize a response to a single line. `JSON.stringify` escapes any embedded
 * newlines, so the result is always safe for the newline-delimited transport.
 */
export function serializeMessage(message: JsonRpcResponse): string {
  return JSON.stringify(message);
}
