import { graphBus, type GraphEvent } from "@/lib/graph-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return new Response("missing runId", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: GraphEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller closed
        }
      };

      for (const event of graphBus.replay(runId)) send(event);
      const unsubscribe = graphBus.subscribe(runId, send);

      let closed = false;
      const teardown = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        req.signal.removeEventListener("abort", teardown);
        try {
          controller.close();
        } catch {}
      };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Controller died — tear everything down, not just the interval.
          teardown();
        }
      }, 15_000);

      req.signal.addEventListener("abort", teardown);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
