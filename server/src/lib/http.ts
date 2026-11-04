import type { Request, Response } from "express";
import type { ApiSuccess } from "@testmate/shared";
import type { Db } from "../db/connection";

export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { ok: true, data };
  res.status(status).json(body);
}

export function getDb(req: Request): Db {
  return req.app.locals.db as Db;
}
