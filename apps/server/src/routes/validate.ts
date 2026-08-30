import type { FastifyReply } from "fastify";
import type { z } from "zod";

/**
 * Validate a request part against a zod schema. On failure, sends a
 * `400 INVALID_PARAMETER` in the standard error envelope and returns `undefined`
 * — the handler should `return` immediately. On success returns the parsed value.
 */
export function parse<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  void reply.code(400).send({
    error: {
      code: "INVALID_PARAMETER",
      message: result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
      retryable: false,
    },
  });
  return undefined;
}
