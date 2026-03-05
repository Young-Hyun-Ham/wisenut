import { loadDelta, loadInitialSnapshot } from "../../../../lib/langgraphTraceServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toSseEvent(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let intervalId = null;

  const stream = new ReadableStream({
    async start(controller) {
      let traceOffset = 0;
      let eventsOffset = 0;
      let totalParseErrors = 0;

      const closeStream = () => {
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // no-op
        }
      };

      try {
        const initial = await loadInitialSnapshot(2000);
        traceOffset = initial.traceOffset;
        eventsOffset = initial.eventsOffset;
        totalParseErrors += initial.parseErrors;

        controller.enqueue(
          encoder.encode(
            toSseEvent("snapshot", {
              traceRecords: initial.traceRecords,
              eventRecords: initial.eventRecords,
              parseErrors: totalParseErrors,
              warnings: initial.warnings,
              serverTs: new Date().toISOString(),
            })
          )
        );
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            toSseEvent("warning", {
              message: error?.message || "Failed to load initial snapshot",
              serverTs: new Date().toISOString(),
            })
          )
        );
      }

      intervalId = setInterval(async () => {
        try {
          const delta = await loadDelta({ traceOffset, eventsOffset });
          traceOffset = delta.traceOffset;
          eventsOffset = delta.eventsOffset;
          totalParseErrors += delta.parseErrors;

          const hasData = delta.traceRecords.length > 0 || delta.eventRecords.length > 0;
          const hasWarnings = delta.warnings.length > 0;

          if (!hasData && !hasWarnings) {
            controller.enqueue(
              encoder.encode(`: keepalive ${Date.now()}\n\n`)
            );
            return;
          }

          controller.enqueue(
            encoder.encode(
              toSseEvent("delta", {
                traceRecords: delta.traceRecords,
                eventRecords: delta.eventRecords,
                parseErrors: totalParseErrors,
                warnings: delta.warnings,
                serverTs: new Date().toISOString(),
              })
            )
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              toSseEvent("warning", {
                message: error?.message || "Delta poll failed",
                serverTs: new Date().toISOString(),
              })
            )
          );
        }
      }, 1000);

      setTimeout(() => {
        closeStream();
      }, 1000 * 60 * 10);

      controller.enqueue(
        encoder.encode(
          toSseEvent("ready", {
            message: "langgraph trace stream connected",
            serverTs: new Date().toISOString(),
          })
        )
      );

    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
