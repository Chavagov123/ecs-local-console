import type { ApiErrorBody, ApiErrorCode } from "@ecs-local-console/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly hint?: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toBody(): ApiErrorBody {
    return {
      error: { code: this.code, message: this.message, hint: this.hint, retryable: this.retryable },
    };
  }
}

function hasCode(err: unknown, ...codes: string[]): boolean {
  const c =
    (err as { code?: string; Code?: string; name?: string })?.code ??
    (err as { Code?: string })?.Code ??
    (err as { name?: string })?.name;
  return typeof c === "string" && codes.includes(c);
}

/**
 * Map an arbitrary error (usually from the AWS SDK, sometimes a socket error or a
 * LocalStack "not implemented" response) onto a stable {@link ApiError}.
 */
export function normalizeAwsError(err: unknown, endpoint: string): ApiError {
  if (err instanceof ApiError) return err;

  const anyErr = err as {
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
    cause?: unknown;
  };
  const name = anyErr?.name ?? "";
  const message = anyErr?.message ?? String(err);
  const httpStatus = anyErr?.$metadata?.httpStatusCode;

  // --- Connectivity: emulator not running ---
  if (
    hasCode(err, "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EPIPE") ||
    hasCode(anyErr?.cause, "ECONNREFUSED", "ENOTFOUND", "ECONNRESET") ||
    name === "TimeoutError" ||
    /fetch failed|socket hang up|timeout/i.test(message)
  ) {
    return new ApiError(
      503,
      "LOCALSTACK_UNREACHABLE",
      `Could not reach the AWS endpoint at ${endpoint}.`,
      "Is LocalStack (or MiniStack) running? Start it with `pnpm dev:stack`, then retry.",
      true,
    );
  }

  // --- Auth / signature ---
  if (
    name === "UnrecognizedClientException" ||
    name === "InvalidClientTokenId" ||
    name === "AccessDeniedException" ||
    name === "AuthFailure" ||
    /security token|signature|credential/i.test(message)
  ) {
    return new ApiError(
      502,
      "AUTH",
      message,
      "LocalStack and MiniStack expect the dummy credentials AWS_ACCESS_KEY_ID=test / AWS_SECRET_ACCESS_KEY=test.",
    );
  }

  // --- Not found ---
  if (/NotFoundException$/.test(name) || /ClusterNotFound|ServiceNotFound/.test(name)) {
    return new ApiError(404, "NOT_FOUND", message);
  }

  // --- Client validation errors ---
  if (
    name === "InvalidParameterException" ||
    name === "ClientException" ||
    name === "InvalidParameterValueException" ||
    name === "MissingParameterException"
  ) {
    return new ApiError(400, "INVALID_PARAMETER", message);
  }

  if (name === "ServiceAlreadyExistsException" || /already exists|in use/i.test(message)) {
    return new ApiError(409, "CONFLICT", message);
  }

  // --- Not implemented by the emulator ---
  if (
    name === "NotImplementedError" ||
    /not.{0,3}implemented|not.{0,3}supported|InternalFailure|501/i.test(message) ||
    httpStatus === 501 ||
    httpStatus === 500
  ) {
    return new ApiError(
      501,
      "NOT_IMPLEMENTED",
      "This ECS operation isn't implemented by the emulator you're connected to.",
      "It may work against real AWS, a newer LocalStack, or MiniStack. The raw message: " + message,
    );
  }

  return new ApiError(502, "UPSTREAM_ERROR", message);
}
