import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../utils/prisma.js";
import { fail } from "../utils/apiResponse.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: string;
    approvalStatus: string;
    isActive: boolean;
  };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return fail(res, "You must be logged in.", 401);

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) return fail(res, "Account no longer exists.", 401);
    if (user.tokenVersion !== payload.tokenVersion) {
      return fail(res, "Session expired, please log in again.", 401);
    }
    if (!user.isActive) return fail(res, "Your account has been deactivated.", 403);

    req.user = {
      id: user.id,
      role: user.role,
      approvalStatus: user.approvalStatus,
      isActive: user.isActive,
    };
    next();
  } catch {
    return fail(res, "Invalid or expired session.", 401);
  }
}

/** Blocks users whose registration hasn't been approved by an admin yet. */
export function requireApproved(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.approvalStatus !== "APPROVED") {
    return fail(res, "Your account is awaiting admin approval.", 403);
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, "You don't have permission to do that.", 403);
    }
    next();
  };
}
