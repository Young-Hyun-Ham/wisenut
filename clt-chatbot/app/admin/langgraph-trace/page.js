"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const MAX_ROWS = 2000;
const PAGE_SIZE = 50;
const TOP_N = 10;
const TERMINAL_STATUS = new Set(["completed", "failed", "cancelled"]);
const ALLOWED_NEXT = {
  started: new Set(["running", "completed", "failed", "cancelled"]),
  running: new Set(["completed", "failed", "cancelled", "running"]),
  completed: new Set([]),
  failed: new Set([]),
  cancelled: new Set([]),
};

const RANGE_OPTIONS = [
  { value: "5m", label: "Last 5m" },
  { value: "15m", label: "Last 15m" },
  { value: "1h", label: "Last 1h" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS = ["all", "started", "running", "completed", "failed", "cancelled"];
const LEVEL_OPTIONS = ["all", "info", "warn", "error"];

function toMs(iso) {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx] || 0;
}

function timeRangeStart(range, customStart) {
  const now = Date.now();
  if (range === "5m") return now - 5 * 60 * 1000;
  if (range === "15m") return now - 15 * 60 * 1000;
  if (range === "1h") return now - 60 * 60 * 1000;
  if (range === "custom" && customStart) return new Date(customStart).getTime();
  return now - 5 * 60 * 1000;
}

function fitsRange(ts, range, customStart, customEnd) {
  const value = toMs(ts);
  const start = timeRangeStart(range, customStart);
  const end = range === "custom" && customEnd ? new Date(customEnd).getTime() : Date.now();
  return value >= start && value <= end;
}

function RowText({ children }) {
  return <span className={styles.ellipsis}>{children}</span>;
}

function isRunCompleted(entry) {
  return entry?.event_type === "run_end" || entry?.status === "completed";
}

function detectStatus(entry) {
  if (!entry) return "running";
  if (isRunCompleted(entry)) return "completed";
  if (entry.status === "failed" || entry.event_type === "error") return "failed";
  if (entry.status === "cancelled" || entry.event_type === "cancelled") return "cancelled";
  if (entry.status === "started") return "started";
  return "running";
}

function aggregateNodeExecutions(events) {
  const map = new Map();
  for (const ev of events) {
    if (!ev.run_id) continue;
    const nodeName = ev.node || "(no-node)";
    const nodeType = ev.node_type || "unknown";
    const key = `${ev.run_id}::${nodeName}::${nodeType}`;
    if (!map.has(key)) {
      map.set(key, {
        run_id: ev.run_id,
        node_name: nodeName,
        node_type: nodeType,
        execution_count: 0,
        error_count: 0,
        first_ts: ev.ts,
        last_ts: ev.ts,
      });
    }
    const agg = map.get(key);
    agg.execution_count += 1;
    if (ev.level === "error" || ev.event_type === "error") agg.error_count += 1;
    if (toMs(ev.ts) < toMs(agg.first_ts)) agg.first_ts = ev.ts;
    if (toMs(ev.ts) > toMs(agg.last_ts)) agg.last_ts = ev.ts;
  }
  return Array.from(map.values());
}

function deriveRunSnapshots(traceRecords, eventRecords) {
  const grouped = new Map();

  for (const t of traceRecords) {
    if (!grouped.has(t.run_id)) grouped.set(t.run_id, []);
    grouped.get(t.run_id).push({
      ...t,
      source: "trace",
      event_type: t.event_type || "trace_status",
      node_type: t.node_type || "unknown",
    });
  }
  for (const e of eventRecords) {
    if (!grouped.has(e.run_id)) grouped.set(e.run_id, []);
    grouped.get(e.run_id).push({
      ...e,
      source: "event",
    });
  }

  const snapshots = [];
  for (const [runId, entries] of grouped.entries()) {
    const sorted = [...entries].sort((a, b) => toMs(a.ts) - toMs(b.ts));
    const firstTs = sorted[0]?.ts || new Date().toISOString();
    let status = "started";
    let lastTs = firstTs;
    let lastNode = null;
    let lastNodeType = "unknown";
    let durationMs = null;
    let error = null;
    let model = null;

    for (const entry of sorted) {
      const ts = toMs(entry.ts);
      if (ts < toMs(lastTs)) continue;

      const candidate = detectStatus(entry);
      const canMove = ALLOWED_NEXT[status]?.has(candidate) || status === candidate;
      if (canMove && !TERMINAL_STATUS.has(status)) {
        status = candidate;
      }

      lastTs = entry.ts;
      lastNode = entry.node || lastNode;
      lastNodeType = entry.node_type || lastNodeType;
      if (typeof entry.duration_ms === "number") durationMs = entry.duration_ms;
      if (entry.error) error = entry.error;
      if (entry.model) model = entry.model;
    }

    snapshots.push({
      run_id: runId,
      ts: lastTs,
      first_ts: firstTs,
      status,
      duration_ms: durationMs,
      node: lastNode,
      node_type: lastNodeType || "unknown",
      model,
      error,
    });
  }

  return snapshots.sort((a, b) => toMs(b.ts) - toMs(a.ts));
}

export default function LangGraphTracePage() {
  const [traceRecords, setTraceRecords] = useState([]);
  const [eventRecords, setEventRecords] = useState([]);
  const [parseErrors, setParseErrors] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("trace");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [queuedUpdates, setQueuedUpdates] = useState({ traces: [], events: [] });
  const [newBadgeCount, setNewBadgeCount] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [range, setRange] = useState("5m");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("all");
  const [runIdSearch, setRunIdSearch] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [tracePage, setTracePage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const queuedRef = useRef({ traces: [], events: [] });
  const autoRefreshRef = useRef(true);

  useEffect(() => {
    autoRefreshRef.current = autoRefresh;
  }, [autoRefresh]);

  useEffect(() => {
    const es = new EventSource("/api/langgraph/trace/stream");

    const applyPayload = (payload) => {
      setParseErrors(payload.parseErrors || 0);
      if (Array.isArray(payload.warnings) && payload.warnings.length > 0) {
        setWarnings(payload.warnings);
      }

      const traces = payload.traceRecords || [];
      const events = payload.eventRecords || [];

      if (!autoRefreshRef.current) {
        queuedRef.current = {
          traces: [...queuedRef.current.traces, ...traces],
          events: [...queuedRef.current.events, ...events],
        };
        setQueuedUpdates(queuedRef.current);
        setNewBadgeCount(queuedRef.current.traces.length + queuedRef.current.events.length);
        return;
      }

      if (traces.length > 0) setTraceRecords((prev) => [...prev, ...traces].slice(-MAX_ROWS));
      if (events.length > 0) setEventRecords((prev) => [...prev, ...events].slice(-MAX_ROWS));
    };

    es.addEventListener("ready", () => setConnected(true));
    es.addEventListener("snapshot", (evt) => {
      setConnected(true);
      const payload = JSON.parse(evt.data);
      setTraceRecords((payload.traceRecords || []).slice(-MAX_ROWS));
      setEventRecords((payload.eventRecords || []).slice(-MAX_ROWS));
      setParseErrors(payload.parseErrors || 0);
      setWarnings(payload.warnings || []);
    });
    es.addEventListener("delta", (evt) => applyPayload(JSON.parse(evt.data)));
    es.addEventListener("warning", (evt) => {
      const payload = JSON.parse(evt.data);
      setWarnings((prev) => [payload.message, ...prev].slice(0, 5));
    });
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  useEffect(() => {
    if (autoRefresh && (queuedUpdates.traces.length > 0 || queuedUpdates.events.length > 0)) {
      setTraceRecords((prev) => [...prev, ...queuedUpdates.traces].slice(-MAX_ROWS));
      setEventRecords((prev) => [...prev, ...queuedUpdates.events].slice(-MAX_ROWS));
      queuedRef.current = { traces: [], events: [] };
      setQueuedUpdates({ traces: [], events: [] });
      setNewBadgeCount(0);
    }
  }, [autoRefresh, queuedUpdates]);

  const runSnapshots = useMemo(
    () => deriveRunSnapshots(traceRecords, eventRecords),
    [traceRecords, eventRecords]
  );

  const eventTypeOptions = useMemo(() => {
    const types = new Set(eventRecords.map((e) => e.event_type).filter(Boolean));
    return ["all", ...Array.from(types)];
  }, [eventRecords]);

  const nodeTypeOptions = useMemo(() => {
    const types = new Set(eventRecords.map((e) => e.node_type || "unknown"));
    return ["all", ...Array.from(types)];
  }, [eventRecords]);

  const filteredTraces = useMemo(() => {
    return runSnapshots
      .filter((t) => fitsRange(t.ts, range, customStart, customEnd))
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => (runIdSearch ? t.run_id.includes(runIdSearch) : true))
      .filter((t) => (nodeTypeFilter === "all" ? true : t.node_type === nodeTypeFilter))
      .filter((t) => (errorsOnly ? t.status === "failed" || !!t.error : true))
      .sort((a, b) => toMs(b.ts) - toMs(a.ts));
  }, [runSnapshots, range, customStart, customEnd, statusFilter, runIdSearch, errorsOnly, nodeTypeFilter]);

  const filteredEvents = useMemo(() => {
    return eventRecords
      .filter((e) => fitsRange(e.ts, range, customStart, customEnd))
      .filter((e) => (eventTypeFilter === "all" ? true : e.event_type === eventTypeFilter))
      .filter((e) => (levelFilter === "all" ? true : e.level === levelFilter))
      .filter((e) => (nodeTypeFilter === "all" ? true : (e.node_type || "unknown") === nodeTypeFilter))
      .filter((e) => (runIdSearch ? e.run_id.includes(runIdSearch) : true))
      .filter((e) => (errorsOnly ? e.level === "error" || e.event_type === "error" : true))
      .sort((a, b) => toMs(b.ts) - toMs(a.ts));
  }, [eventRecords, range, customStart, customEnd, eventTypeFilter, levelFilter, runIdSearch, errorsOnly, nodeTypeFilter]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const last5m = runSnapshots.filter((t) => toMs(t.ts) >= now - 5 * 60 * 1000);
    const running = last5m.filter((t) => t.status === "running").length;
    const failures = last5m.filter((t) => t.status === "failed").length;
    const failureRate = last5m.length ? (failures / last5m.length) * 100 : 0;
    const durations = last5m.map((t) => t.duration_ms).filter((v) => typeof v === "number");
    const avg = durations.length ? durations.reduce((acc, v) => acc + v, 0) / durations.length : 0;
    const p95 = percentile(durations, 95);
    const eventsPerMin = eventRecords.filter((e) => toMs(e.ts) >= now - 60 * 1000).length;
    return { runs5m: last5m.length, running, failures, failureRate, avg, p95, eventsPerMin };
  }, [runSnapshots, eventRecords]);

  const trendBars = useMemo(() => {
    const now = Date.now();
    const points = [];
    for (let i = 9; i >= 0; i -= 1) {
      const start = now - i * 60 * 1000;
      const end = start + 60 * 1000;
      const count = eventRecords.filter((e) => {
        const ts = toMs(e.ts);
        return ts >= start && ts < end;
      }).length;
      points.push({ label: `${new Date(start).getMinutes()}m`, count });
    }
    const max = Math.max(1, ...points.map((p) => p.count));
    return points.map((p) => ({ ...p, height: Math.max(6, (p.count / max) * 48) }));
  }, [eventRecords]);

  const runIds = useMemo(() => {
    const ids = new Set([...runSnapshots.map((t) => t.run_id), ...eventRecords.map((e) => e.run_id)]);
    return Array.from(ids);
  }, [runSnapshots, eventRecords]);

  useEffect(() => {
    if (!selectedRunId && runIds.length > 0) setSelectedRunId(runIds[0]);
  }, [runIds, selectedRunId]);

  const selectedTrace = useMemo(
    () => runSnapshots.find((t) => t.run_id === selectedRunId) || null,
    [runSnapshots, selectedRunId]
  );

  const selectedTimeline = useMemo(
    () =>
      eventRecords
        .filter((e) => e.run_id === selectedRunId)
        .sort((a, b) => toMs(a.ts) - toMs(b.ts)),
    [eventRecords, selectedRunId]
  );

  const overallNodeAgg = useMemo(() => {
    const rows = aggregateNodeExecutions(filteredEvents);
    return rows
      .sort((a, b) => b.execution_count - a.execution_count)
      .slice(0, TOP_N);
  }, [filteredEvents]);

  const selectedRunNodeAgg = useMemo(() => {
    const rows = aggregateNodeExecutions(selectedTimeline);
    return rows
      .sort((a, b) => b.execution_count - a.execution_count)
      .slice(0, TOP_N);
  }, [selectedTimeline]);

  const selectedRunNodeHistory = useMemo(() => {
    return aggregateNodeExecutions(selectedTimeline).sort((a, b) => toMs(a.first_ts) - toMs(b.first_ts));
  }, [selectedTimeline]);

  const tracePageRows = useMemo(() => {
    const start = (tracePage - 1) * PAGE_SIZE;
    return filteredTraces.slice(start, start + PAGE_SIZE);
  }, [filteredTraces, tracePage]);

  const eventPageRows = useMemo(() => {
    const start = (eventPage - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, eventPage]);

  const traceTotalPages = Math.max(1, Math.ceil(filteredTraces.length / PAGE_SIZE));
  const eventTotalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>LangGraph Trace/Events Dashboard</h1>
          <p>Realtime run status and node execution visibility</p>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.badge} ${connected ? styles.ok : styles.disconnected}`}>
            {connected ? "connected" : "disconnected"}
          </span>
          <label className={styles.switchLabel}>
            Auto-refresh
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          </label>
          <button type="button" className={styles.flushBtn} onClick={() => setAutoRefresh(true)} disabled={newBadgeCount === 0}>
            new {newBadgeCount}
          </button>
          <Link href="/" className={styles.backLink}>Home</Link>
        </div>
      </header>

      {warnings.length > 0 && (
        <div className={styles.warningBox}>
          {warnings.map((w, i) => (
            <p key={`${w}-${i}`}>{w}</p>
          ))}
        </div>
      )}

      <section className={styles.kpiGrid}>
        <article><h3>Runs (5m)</h3><strong>{kpis.runs5m}</strong></article>
        <article><h3>Running</h3><strong>{kpis.running}</strong></article>
        <article><h3>Failures/Rate</h3><strong>{kpis.failures} / {kpis.failureRate.toFixed(1)}%</strong></article>
        <article><h3>Avg/95p (ms)</h3><strong>{Math.round(kpis.avg)} / {Math.round(kpis.p95)}</strong></article>
        <article><h3>Events/min</h3><strong>{kpis.eventsPerMin}</strong></article>
        <article><h3>Parse Errors</h3><strong>{parseErrors}</strong></article>
      </section>

      <section className={styles.trendCard}>
        <h3>Events Trend (10m)</h3>
        <div className={styles.bars}>
          {trendBars.map((b) => (
            <div className={styles.barItem} key={b.label}>
              <div className={styles.bar} style={{ height: `${b.height}px` }} title={`${b.count}`} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.filters}>
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {range === "custom" && (
          <>
            <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
          {eventTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          {LEVEL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={nodeTypeFilter} onChange={(e) => setNodeTypeFilter(e.target.value)}>
          {nodeTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="run_id search" value={runIdSearch} onChange={(e) => setRunIdSearch(e.target.value)} />
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
          errors only
        </label>
      </section>

      <section className={styles.mainGrid}>
        <div className={styles.left}>
          <div className={styles.tabs}>
            <button className={activeTab === "trace" ? styles.active : ""} onClick={() => setActiveTab("trace")}>Run Trace</button>
            <button className={activeTab === "event" ? styles.active : ""} onClick={() => setActiveTab("event")}>Events</button>
          </div>

          {activeTab === "trace" ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th>last_ts</th><th>run_id</th><th>status</th><th>duration_ms</th><th>node</th><th>node_type</th><th>error</th></tr>
                </thead>
                <tbody>
                  {tracePageRows.map((row, idx) => (
                    <tr key={`${row.run_id}-${row.ts}-${idx}`}>
                      <td><RowText>{row.ts}</RowText></td>
                      <td><button className={styles.linkBtn} onClick={() => setSelectedRunId(row.run_id)}>{row.run_id}</button></td>
                      <td>{row.status}</td>
                      <td>{row.duration_ms ?? "-"}</td>
                      <td><RowText>{row.node || "-"}</RowText></td>
                      <td>{row.node_type || "unknown"}</td>
                      <td><RowText>{row.error || "-"}</RowText></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.pagination}>
                <button onClick={() => setTracePage((p) => Math.max(1, p - 1))}>Prev</button>
                <span>{tracePage} / {traceTotalPages}</span>
                <button onClick={() => setTracePage((p) => Math.min(traceTotalPages, p + 1))}>Next</button>
              </div>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th>ts</th><th>run_id</th><th>event_type</th><th>node</th><th>node_type</th><th>status</th><th>latency_ms</th><th>level</th></tr>
                </thead>
                <tbody>
                  {eventPageRows.map((row, idx) => (
                    <tr key={`${row.run_id}-${row.ts}-${idx}`}>
                      <td><RowText>{row.ts}</RowText></td>
                      <td><button className={styles.linkBtn} onClick={() => setSelectedRunId(row.run_id)}>{row.run_id}</button></td>
                      <td>{row.event_type}</td>
                      <td><RowText>{row.node || "-"}</RowText></td>
                      <td>{row.node_type || "unknown"}</td>
                      <td>{row.status || "-"}</td>
                      <td>{row.latency_ms ?? "-"}</td>
                      <td>{row.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.pagination}>
                <button onClick={() => setEventPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span>{eventPage} / {eventTotalPages}</span>
                <button onClick={() => setEventPage((p) => Math.min(eventTotalPages, p + 1))}>Next</button>
              </div>
            </div>
          )}

          <div className={styles.aggSection}>
            <h3>Node Execution Count (Current Filter, Top {TOP_N})</h3>
            <table>
              <thead>
                <tr><th>node_name</th><th>node_type</th><th>execution_count</th><th>error_count</th></tr>
              </thead>
              <tbody>
                {overallNodeAgg.map((row, idx) => (
                  <tr key={`${row.run_id}-${row.node_name}-${idx}`}>
                    <td><RowText>{row.node_name}</RowText></td>
                    <td>{row.node_type || "unknown"}</td>
                    <td>{row.execution_count}</td>
                    <td>{row.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className={styles.right}>
          <h3>Run Timeline</h3>
          <p className={styles.runId}>{selectedRunId || "-"}</p>
          {selectedTrace ? (
            <div className={styles.summary}>
              <p>first_ts: {selectedTrace.first_ts}</p>
              <p>last_ts: {selectedTrace.ts}</p>
              <p>status: {selectedTrace.status}</p>
              <p>duration: {selectedTrace.duration_ms ?? "-"} ms</p>
              <p>last node: {selectedTrace.node || "-"}</p>
              <p>last node_type: {selectedTrace.node_type || "unknown"}</p>
              <p>error: {selectedTrace.error || "-"}</p>
            </div>
          ) : (
            <p className={styles.empty}>No selected run snapshot</p>
          )}

          <div className={styles.aggSection}>
            <h4>Selected Run Node Count (Top {TOP_N})</h4>
            <table>
              <thead>
                <tr><th>node_name</th><th>node_type</th><th>execution_count</th><th>error_count</th></tr>
              </thead>
              <tbody>
                {selectedRunNodeAgg.map((row, idx) => (
                  <tr key={`${row.node_name}-${idx}`}>
                    <td><RowText>{row.node_name}</RowText></td>
                    <td>{row.node_type || "unknown"}</td>
                    <td>{row.execution_count}</td>
                    <td>{row.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.aggSection}>
            <h4>Node Execution History</h4>
            <table>
              <thead>
                <tr><th>node_type</th><th>node_name</th><th>run_id</th><th>first_ts</th><th>last_ts</th></tr>
              </thead>
              <tbody>
                {selectedRunNodeHistory.map((row, idx) => (
                  <tr key={`${row.node_name}-${row.first_ts}-${idx}`}>
                    <td>{row.node_type || "unknown"}</td>
                    <td><RowText>{row.node_name}</RowText></td>
                    <td><RowText>{row.run_id}</RowText></td>
                    <td><RowText>{row.first_ts}</RowText></td>
                    <td><RowText>{row.last_ts}</RowText></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.timeline}>
            {selectedTimeline.map((ev, idx) => (
              <div key={`${ev.ts}-${idx}`} className={`${styles.timelineItem} ${ev.level === "error" ? styles.errorItem : ""}`}>
                <p><strong>{ev.ts}</strong></p>
                <p>{ev.event_type} {ev.node ? `@ ${ev.node}` : ""}</p>
                <p>node_type: {ev.node_type || "unknown"}</p>
                <p>status: {ev.status || "running"}</p>
                <p>latency: {ev.latency_ms ?? "-"} ms</p>
                {ev.payload && (
                  <details>
                    <summary>payload</summary>
                    <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

