# LangGraph Trace Dashboard

## Overview
- Admin dashboard route: `/admin/langgraph-trace`
- Stream API route: `/api/langgraph/trace/stream`
- Transport: SSE (`text/event-stream`)
- Refresh cycle: 1 second delta read

## Environment Variables
- `LANGGRAPH_TRACE_PATH`: path to `run_trace.jsonl`
- `LANGGRAPH_EVENTS_PATH`: path to `run_events.jsonl`

If not set, defaults:
- `../data/run_trace.jsonl`
- `../data/run_events.jsonl`

## Run
1. Set env vars if custom log path is required.
2. Start app:
```bash
npm run dev
```
3. Open:
```text
http://localhost:3000/admin/langgraph-trace
```

## Notes
- Initial load is capped to latest 2,000 lines per file.
- Malformed JSON lines are skipped and counted in `parse errors`.
- Missing/unreadable files are shown as warning banners (app keeps running).
