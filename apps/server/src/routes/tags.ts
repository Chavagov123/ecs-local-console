import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import { addTags, removeTags } from "../services/tags.js";
import { parse } from "./validate.js";

const addSchema = z.object({
  resourceArn: z.string().min(1),
  tags: z.record(z.string()),
});

const removeSchema = z.object({
  resourceArn: z.string().min(1),
  tagKeys: z.array(z.string()).min(1),
});

export const tagRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.post("/tags", async (req, reply) => {
    const body = parse(addSchema, req.body, reply);
    if (!body) return reply;
    try {
      await addTags(app.clients, app.cache, body.resourceArn, body.tags);
      return reply.code(204).send();
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.delete("/tags", async (req, reply) => {
    const body = parse(removeSchema, req.body, reply);
    if (!body) return reply;
    try {
      await removeTags(app.clients, app.cache, body.resourceArn, body.tagKeys);
      return reply.code(204).send();
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });
};
