import fs from "fs/promises";
import path from "path";

const DEFAULT_RECENT_LINES = 2000;
const CHUNK_SIZE = 64 * 1024;

function safeIso(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getTraceFilePath() {
  return (
    process.env.LANGGRAPH_TRACE_PATH ||
    path.resolve(
      process.cwd(),
      "..",
      "scenario-chatbot-with-langgraph",
      "data",
      "run_trace.jsonl"
    )
  );
}

export function getEventsFilePath() {
  return (
    process.env.LANGGRAPH_EVENTS_PATH ||
    path.resolve(
      process.cwd(),
      "..",
      "scenario-chatbot-with-langgraph",
      "data",
      "run_events.jsonl"
    )
  );
}

export function normalizeTraceRecord(raw = {}) {
  return {
    ts: safeIso(raw.ts || raw.timestamp || raw.created_at),
    run_id: String(raw.run_id || raw.runId || raw.id || "unknown"),
    thread_id: raw.thread_id || raw.threadId || null,
    status: String(raw.status || "running"),
    duration_ms: toNumberOrNull(raw.duration_ms ?? raw.durationMs),
    node: raw.node || raw.current_node || raw.last_node || null,
    input_tokens: toNumberOrNull(raw.input_tokens ?? raw.inputTokens),
    output_tokens: toNumberOrNull(raw.output_tokens ?? raw.outputTokens),
    model: raw.model || null,
    error: raw.error ? String(raw.error) : null,
  };
}

export function normalizeEventRecord(raw = {}) {
  const payload =
    raw.payload && typeof raw.payload === "object" ? raw.payload : null;
  return {
    ts: safeIso(raw.ts || raw.timestamp || raw.created_at),
    run_id: String(raw.run_id || raw.runId || raw.id || "unknown"),
    event_type: String(raw.event_type || raw.type || "unknown"),
    node: raw.node || raw.current_node || null,
    payload,
    latency_ms: toNumberOrNull(raw.latency_ms ?? raw.latencyMs),
    level: String(raw.level || (raw.error ? "error" : "info")),
  };
}

async function readFileSlice(filePath, start, end) {
  const length = Math.max(0, end - start);
  if (length === 0) return "";

  const file = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await file.read(buffer, 0, length, start);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await file.close();
  }
}

async function tailFileLines(filePath, maxLines = DEFAULT_RECENT_LINES) {
  const stat = await fs.stat(filePath);
  if (stat.size === 0) {
    return { content: "", size: 0 };
  }

  let position = stat.size;
  let collected = "";
  let lineCount = 0;

  while (position > 0 && lineCount <= maxLines) {
    const chunkStart = Math.max(0, position - CHUNK_SIZE);
    const chunk = await readFileSlice(filePath, chunkStart, position);
    collected = chunk + collected;
    lineCount = collected.split(/\r?\n/).length - 1;
    position = chunkStart;
  }

  const lines = collected.split(/\r?\n/).filter(Boolean);
  const sliced = lines.slice(-maxLines);
  return { content: sliced.join("\n"), size: stat.size };
}

export function parseJsonlText(content, normalizer) {
  const lines = content ? content.split(/\r?\n/) : [];
  const records = [];
  let parseErrors = 0;

  for (const line of lines) {
    if (!line || !line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      records.push(normalizer(parsed));
    } catch {
      parseErrors += 1;
    }
  }

  return { records, parseErrors };
}

export async function loadInitialSnapshot(maxLines = DEFAULT_RECENT_LINES) {
  const tracePath = getTraceFilePath();
  const eventsPath = getEventsFilePath();
  const warnings = [];

  let traceOffset = 0;
  let eventsOffset = 0;
  let traceRecords = [];
  let eventRecords = [];
  let parseErrors = 0;

  try {
    const tailed = await tailFileLines(tracePath, maxLines);
    const parsed = parseJsonlText(tailed.content, normalizeTraceRecord);
    traceRecords = parsed.records;
    parseErrors += parsed.parseErrors;
    traceOffset = tailed.size;
  } catch {
    warnings.push(`Trace file is missing or unreadable: ${tracePath}`);
  }

  try {
    const tailed = await tailFileLines(eventsPath, maxLines);
    const parsed = parseJsonlText(tailed.content, normalizeEventRecord);
    eventRecords = parsed.records;
    parseErrors += parsed.parseErrors;
    eventsOffset = tailed.size;
  } catch {
    warnings.push(`Events file is missing or unreadable: ${eventsPath}`);
  }

  return {
    traceRecords,
    eventRecords,
    parseErrors,
    traceOffset,
    eventsOffset,
    warnings,
  };
}

async function readDeltaFromOffset(filePath, offset) {
  const stat = await fs.stat(filePath);
  let start = offset;
  if (stat.size < start) {
    start = 0;
  }
  if (stat.size === start) {
    return { content: "", nextOffset: stat.size };
  }
  const content = await readFileSlice(filePath, start, stat.size);
  return { content, nextOffset: stat.size };
}

export async function loadDelta({ traceOffset, eventsOffset }) {
  const tracePath = getTraceFilePath();
  const eventsPath = getEventsFilePath();
  const warnings = [];

  let nextTraceOffset = traceOffset ?? 0;
  let nextEventsOffset = eventsOffset ?? 0;
  let traceRecords = [];
  let eventRecords = [];
  let parseErrors = 0;

  try {
    const delta = await readDeltaFromOffset(tracePath, nextTraceOffset);
    const parsed = parseJsonlText(delta.content, normalizeTraceRecord);
    traceRecords = parsed.records;
    parseErrors += parsed.parseErrors;
    nextTraceOffset = delta.nextOffset;
  } catch {
    warnings.push(`Trace file is missing or unreadable: ${tracePath}`);
  }

  try {
    const delta = await readDeltaFromOffset(eventsPath, nextEventsOffset);
    const parsed = parseJsonlText(delta.content, normalizeEventRecord);
    eventRecords = parsed.records;
    parseErrors += parsed.parseErrors;
    nextEventsOffset = delta.nextOffset;
  } catch {
    warnings.push(`Events file is missing or unreadable: ${eventsPath}`);
  }

  return {
    traceRecords,
    eventRecords,
    parseErrors,
    traceOffset: nextTraceOffset,
    eventsOffset: nextEventsOffset,
    warnings,
  };
}
