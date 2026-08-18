import type { FastifyInstance } from "fastify";

export const WORK_QUEUE_SOURCE_VERSION_SET_REF = "appts-restore-service-dep001/work-queue/v1" as const;

export function registerWorkQueueRoute(app: FastifyInstance): void {
  app.get("/api/v1/ui/work-queue", async (_request, reply) => {
    return reply.header("Cache-Control", "no-store").send({
      view_id: "UX-RS-01",
      source_version_set_ref: WORK_QUEUE_SOURCE_VERSION_SET_REF,
      generated_at: new Date().toISOString(),
      currentness_ref: "CURRENT",
      data: { items: [] },
    });
  });
}
