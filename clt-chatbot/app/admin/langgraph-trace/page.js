"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const MAX_ROWS = 2000;
const PAGE_SIZE = 50;

const RANGE_OPTIONS = [
  { value: "5m", label: "최근 5분" },
  { value: "15m", label: "최근 15분" },
  { value: "1h", label: "최근 1시간" },
  { value: "custom", label: "사용자 지정" },
];

const statusOptions = ["all", "started", "running", "completed", "failed", "cancelled"];
const levelOptions = ["all", "info", "warn", "error"];

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

      if (traces.length > 0) {
        setTraceRecords((prev) => [...prev, ...traces].slice(-MAX_ROWS));
      }
      if (events.length > 0) {
        setEventRecords((prev) => [...prev, ...events].slice(-MAX_ROWS));
      }
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

  const eventTypeOptions = useMemo(() => {
    const types = new Set(eventRecords.map((e) => e.event_type).filter(Boolean));
    return ["all", ...Array.from(types)];
  }, [eventRecords]);

  const filteredTraces = useMemo(() => {
    return traceRecords
      .filter((t) => fitsRange(t.ts, range, customStart, customEnd))
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => (runIdSearch ? t.run_id.includes(runIdSearch) : true))
      .filter((t) => (errorsOnly ? t.status === "failed" || !!t.error : true))
      .sort((a, b) => toMs(b.ts) - toMs(a.ts));
  }, [traceRecords, range, customStart, customEnd, statusFilter, runIdSearch, errorsOnly]);

  const filteredEvents = useMemo(() => {
    return eventRecords
      .filter((e) => fitsRange(e.ts, range, customStart, customEnd))
      .filter((e) => (eventTypeFilter === "all" ? true : e.event_type === eventTypeFilter))
      .filter((e) => (levelFilter === "all" ? true : e.level === levelFilter))
      .filter((e) => (runIdSearch ? e.run_id.includes(runIdSearch) : true))
      .filter((e) => (errorsOnly ? e.level === "error" || e.event_type === "error" : true))
      .sort((a, b) => toMs(b.ts) - toMs(a.ts));
  }, [eventRecords, range, customStart, customEnd, eventTypeFilter, levelFilter, runIdSearch, errorsOnly]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const last5m = traceRecords.filter((t) => toMs(t.ts) >= now - 5 * 60 * 1000);
    const running = traceRecords.filter((t) => t.status === "running").length;
    const failures = last5m.filter((t) => t.status === "failed").length;
    const failureRate = last5m.length ? (failures / last5m.length) * 100 : 0;
    const durations = last5m.map((t) => t.duration_ms).filter((v) => typeof v === "number");
    const avg = durations.length
      ? durations.reduce((acc, v) => acc + v, 0) / durations.length
      : 0;
    const p95 = percentile(durations, 95);
    const eventsPerMin = eventRecords.filter((e) => toMs(e.ts) >= now - 60 * 1000).length;

    return {
      runs5m: last5m.length,
      running,
      failures,
      failureRate,
      avg,
      p95,
      eventsPerMin,
    };
  }, [traceRecords, eventRecords]);

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
    const ids = new Set([...traceRecords.map((t) => t.run_id), ...eventRecords.map((e) => e.run_id)]);
    return Array.from(ids);
  }, [traceRecords, eventRecords]);

  useEffect(() => {
    if (!selectedRunId && runIds.length > 0) {
      setSelectedRunId(runIds[0]);
    }
  }, [runIds, selectedRunId]);

  const selectedTrace = useMemo(
    () => filteredTraces.find((t) => t.run_id === selectedRunId) || null,
    [filteredTraces, selectedRunId]
  );
  const selectedTimeline = useMemo(
    () => eventRecords.filter((e) => e.run_id === selectedRunId).sort((a, b) => toMs(a.ts) - toMs(b.ts)),
    [eventRecords, selectedRunId]
  );

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
          <p>실시간 실행 추적, 지연/실패 관측</p>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.badge} ${connected ? styles.ok : styles.disconnected}`}>
            {connected ? "connected" : "disconnected"}
          </span>
          <label className={styles.switchLabel}>
            Auto-refresh
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
          </label>
          <button
            type="button"
            className={styles.flushBtn}
            onClick={() => setAutoRefresh(true)}
            disabled={newBadgeCount === 0}
          >
            new {newBadgeCount}
          </button>
          <Link href="/" className={styles.backLink}>메인으로</Link>
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
        <article><h3>최근 5분 run</h3><strong>{kpis.runs5m}</strong></article>
        <article><h3>진행 중</h3><strong>{kpis.running}</strong></article>
        <article><h3>실패/실패율</h3><strong>{kpis.failures} / {kpis.failureRate.toFixed(1)}%</strong></article>
        <article><h3>평균/95p(ms)</h3><strong>{Math.round(kpis.avg)} / {Math.round(kpis.p95)}</strong></article>
        <article><h3>events/min</h3><strong>{kpis.eventsPerMin}</strong></article>
        <article><h3>파싱 에러</h3><strong>{parseErrors}</strong></article>
      </section>

      <section className={styles.trendCard}>
        <h3>최근 10분 이벤트 추세</h3>
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
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {range === "custom" && (
          <>
            <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
          {eventTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          {levelOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="run_id 검색"
          value={runIdSearch}
          onChange={(e) => setRunIdSearch(e.target.value)}
        />
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
          errors only
        </label>
      </section>

      <section className={styles.mainGrid}>
        <div className={styles.left}>
          <div className={styles.tabs}>
            <button className={activeTab === "trace" ? styles.active : ""} onClick={() => setActiveTab("trace")}>Trace</button>
            <button className={activeTab === "event" ? styles.active : ""} onClick={() => setActiveTab("event")}>Events</button>
          </div>

          {activeTab === "trace" ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th>ts</th><th>run_id</th><th>status</th><th>duration_ms</th><th>node</th><th>model</th><th>error</th></tr>
                </thead>
                <tbody>
                  {tracePageRows.map((row, idx) => (
                    <tr key={`${row.run_id}-${row.ts}-${idx}`}>
                      <td><RowText>{row.ts}</RowText></td>
                      <td>
                        <button className={styles.linkBtn} onClick={() => setSelectedRunId(row.run_id)}>{row.run_id}</button>
                      </td>
                      <td>{row.status}</td>
                      <td>{row.duration_ms ?? "-"}</td>
                      <td><RowText>{row.node || "-"}</RowText></td>
                      <td><RowText>{row.model || "-"}</RowText></td>
                      <td><RowText>{row.error || "-"}</RowText></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.pagination}>
                <button onClick={() => setTracePage((p) => Math.max(1, p - 1))}>이전</button>
                <span>{tracePage} / {traceTotalPages}</span>
                <button onClick={() => setTracePage((p) => Math.min(traceTotalPages, p + 1))}>다음</button>
              </div>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th>ts</th><th>run_id</th><th>event_type</th><th>node</th><th>latency_ms</th><th>level</th></tr>
                </thead>
                <tbody>
                  {eventPageRows.map((row, idx) => (
                    <tr key={`${row.run_id}-${row.ts}-${idx}`}>
                      <td><RowText>{row.ts}</RowText></td>
                      <td>
                        <button className={styles.linkBtn} onClick={() => setSelectedRunId(row.run_id)}>{row.run_id}</button>
                      </td>
                      <td>{row.event_type}</td>
                      <td><RowText>{row.node || "-"}</RowText></td>
                      <td>{row.latency_ms ?? "-"}</td>
                      <td>{row.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.pagination}>
                <button onClick={() => setEventPage((p) => Math.max(1, p - 1))}>이전</button>
                <span>{eventPage} / {eventTotalPages}</span>
                <button onClick={() => setEventPage((p) => Math.min(eventTotalPages, p + 1))}>다음</button>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.right}>
          <h3>Run Timeline</h3>
          <p className={styles.runId}>{selectedRunId || "-"}</p>
          {selectedTrace ? (
            <div className={styles.summary}>
              <p>시작 시각: {selectedTrace.ts}</p>
              <p>상태: {selectedTrace.status}</p>
              <p>duration: {selectedTrace.duration_ms ?? "-"} ms</p>
              <p>마지막 노드: {selectedTrace.node || "-"}</p>
              <p>에러: {selectedTrace.error || "-"}</p>
            </div>
          ) : (
            <p className={styles.empty}>선택된 run 정보가 없습니다.</p>
          )}

          <div className={styles.timeline}>
            {selectedTimeline.map((ev, idx) => (
              <div key={`${ev.ts}-${idx}`} className={`${styles.timelineItem} ${ev.level === "error" ? styles.errorItem : ""}`}>
                <p><strong>{ev.ts}</strong></p>
                <p>{ev.event_type} {ev.node ? `@ ${ev.node}` : ""}</p>
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
