import type { Response } from "express";
import { prisma } from "../utils/prisma.js";
import { ok, fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.js";

const SELECT = {
  id: true, name: true, email: true, phone: true, role: true,
  approvalStatus: true, isActive: true, avatarColor: true,
  createdAt: true, approvedAt: true, rejectionReason: true,
} as const;

/** Admin/manager: list users, optionally filtered by role/status. */
export const listUsers = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { role, approvalStatus, search } = req.query as Record<string, string | undefined>;

  const users = await prisma.user.findMany({
    where: {
      role: role || undefined,
      approvalStatus: approvalStatus || undefined,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    select: SELECT,
    orderBy: { createdAt: "desc" },
  });

  return ok(res, users);
});

/** Admin only: users still waiting for approval. */
export const listPendingUsers = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { approvalStatus: "PENDING" },
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
  return ok(res, users);
});

export const approveUser = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.update({
    where: { id },
    data: {
      approvalStatus: "APPROVED",
      approvedById: req.user!.id,
      approvedAt: new Date(),
      rejectionReason: null,
    },
    select: SELECT,
  });
  return ok(res, user);
});

export const rejectUser = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body ?? {};
  const user = await prisma.user.update({
    where: { id },
    data: {
      approvalStatus: "REJECTED",
      approvedById: req.user!.id,
      approvedAt: new Date(),
      rejectionReason: reason || "No reason provided.",
    },
    select: SELECT,
  });
  return ok(res, user);
});

/** Admin only: promote/demote between WORKER and MANAGER. */
export const updateUserRole = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body ?? {};
  if (!["ADMIN", "MANAGER", "WORKER"].includes(role)) {
    return fail(res, "Role must be ADMIN, MANAGER or WORKER.", 422);
  }
  if (id === req.user!.id) return fail(res, "You can't change your own role.", 400);

  const user = await prisma.user.update({ where: { id }, data: { role }, select: SELECT });
  return ok(res, user);
});

export const setUserActive = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body ?? {};
  if (id === req.user!.id) return fail(res, "You can't deactivate your own account.", 400);

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: Boolean(isActive), tokenVersion: { increment: 1 } },
    select: SELECT,
  });
  return ok(res, user);
});

/** Everyone with permission: light list of approved+active workers/managers, for task assignment. */
export const listAssignableUsers = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { approvalStatus: "APPROVED", isActive: true, role: { in: ["WORKER", "MANAGER"] } },
    select: { id: true, name: true, role: true, avatarColor: true },
    orderBy: { name: "asc" },
  });
  return ok(res, users);
});
