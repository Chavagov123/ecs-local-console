import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import { listSecurityGroups, listSubnets, listVpcs } from "../services/networking.js";
import { listRoles } from "../services/iam.js";
import { parse } from "./validate.js";

const vpcQuery = z.object({ vpcId: z.string().optional() });
const rolesQuery = z.object({
  kind: z.enum(["task", "execution"]).optional(),
  pathPrefix: z.string().optional(),
});

export const networkingRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;
  const guard = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  };

  app.get("/networking/vpcs", async () => guard(() => listVpcs(app.clients, app.cache)));

  app.get("/networking/subnets", async (req, reply) => {
    const q = parse(vpcQuery, req.query, reply);
    if (!q) return reply;
    return guard(() => listSubnets(app.clients, app.cache, q.vpcId));
  });

  app.get("/networking/security-groups", async (req, reply) => {
    const q = parse(vpcQuery, req.query, reply);
    if (!q) return reply;
    return guard(() => listSecurityGroups(app.clients, app.cache, q.vpcId));
  });

  app.get("/iam/roles", async (req, reply) => {
    const q = parse(rolesQuery, req.query, reply);
    if (!q) return reply;
    return guard(() => listRoles(app.clients, app.cache, q.kind, q.pathPrefix));
  });
};
