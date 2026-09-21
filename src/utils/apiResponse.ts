import type { Response } from "express";

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res: Response, message: string, status = 400, extra?: Record<string, unknown>) {
  return res.status(status).json({ success: false, message, ...extra });
}
