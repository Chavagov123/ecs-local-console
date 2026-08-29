import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const updateSchema = z.object({
  endpoint: z.string().url().optional(),
  region: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d$/, "Expected a region like us-east-1")
    .optional(),
  profile: z.string().min(1).nullable().optional(),
  accessKeyId: z.string().min(1).optional(),
  secretAccessKey: z.string().min(1).optional(),
});

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async () => app.configStore.describe());

  app.put("/config", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "BAD_REQUEST",
          message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
          retryable: false,
        },
      });
    }
    app.configStore.update(parsed.data);
    return app.configStore.describe();
  });
};
