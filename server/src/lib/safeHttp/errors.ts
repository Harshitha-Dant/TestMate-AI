import type { ApiErrorKind } from "@testmate/shared";

/** A request failure with a user-facing message. Messages never include header values or bodies. */
export class SafeHttpError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SafeHttpError";
  }
}

const TLS_CODES = /^(ERR_TLS|CERT_|UNABLE_TO_|DEPTH_ZERO|SELF_SIGNED|ERR_SSL|HOSTNAME_MISMATCH)/;

/** Maps Node network errors to clear, actionable messages. */
export function classifyNetworkError(err: unknown, target: { host: string; port: string }): SafeHttpError {
  if (err instanceof SafeHttpError) return err;
  const code = (err as { code?: string }).code ?? "";
  const where = `${target.host}${target.port ? `:${target.port}` : ""}`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_NODATA" || code === "EAI_NONAME") {
    return new SafeHttpError("dns", `DNS lookup failed: couldn't resolve "${target.host}". Check the hostname and your internet connection.`);
  }
  if (code === "ECONNREFUSED") {
    return new SafeHttpError("refused", `Connection refused by ${where}. Nothing is accepting connections there. Is the server running?`);
  }
  if (code === "ECONNRESET" || code === "EPIPE") {
    return new SafeHttpError("reset", `The connection to ${where} was closed unexpectedly before a full response arrived.`);
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
    return new SafeHttpError("timeout", `Connecting to ${where} timed out.`);
  }
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return new SafeHttpError("network", `${where} is unreachable from this machine (${code}).`);
  }
  if (TLS_CODES.test(code)) {
    return new SafeHttpError("tls", `TLS/certificate error talking to ${where}: ${code}. The server's HTTPS certificate isn't trusted.`);
  }
  return new SafeHttpError("network", `Request to ${where} failed${code ? ` (${code})` : ""}.`);
}
