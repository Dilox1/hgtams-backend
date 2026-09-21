import type { Response } from "express";
import { prisma } from "../utils/prisma.js";
import { ok, fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.js";

const INCLUDE = {
  createdBy: { select: { id: true, name: true, avatarColor: true } },
  assignedTo: { select: { id: true, name: true, avatarColor: true, role: true } },
} as const;

/** Admin/manager see everything (optionally filtered); workers see only their own. */
export const listTasks = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { status, assignedToId } = req.query as Record<string, string | undefined>;
  const isStaff = req.user!.role === "ADMIN" || req.user!.role === "MANAGER";

  const tasks = await prisma.task.findMany({
    where: {
      status: status || undefined,
      assignedToId: isStaff ? (assignedToId || undefined) : req.user!.id,
    },
    include: INCLUDE,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return ok(res, tasks);
});

export const createTask = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { title, description, assignedToId, dueDate, priority } = req.body ?? {};
  if (!title || !assignedToId) return fail(res, "Title and an assignee are required.", 422);

  const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!assignee || assignee.approvalStatus !== "APPROVED" || !assignee.isActive) {
    return fail(res, "That person isn't an active, approved team member.", 422);
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      assignedToId,
      createdById: req.user!.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: ["LOW", "NORMAL", "HIGH"].includes(priority) ? priority : "NORMAL",
    },
    include: INCLUDE,
  });

  return ok(res, task, 201);
});

export const updateTaskStatus = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body ?? {};
  if (!["PENDING", "IN_PROGRESS", "DONE"].includes(status)) {
    return fail(res, "Status must be PENDING, IN_PROGRESS or DONE.", 422);
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return fail(res, "Task not found.", 404);

  const isStaff = req.user!.role === "ADMIN" || req.user!.role === "MANAGER";
  if (!isStaff && existing.assignedToId !== req.user!.id) {
    return fail(res, "You can only update your own tasks.", 403);
  }

  const task = await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
    include: INCLUDE,
  });

  return ok(res, task);
});

export const updateTask = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { title, description, dueDate, priority, assignedToId } = req.body ?? {};

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: title ?? undefined,
      description: description ?? undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority: priority ?? undefined,
      assignedToId: assignedToId ?? undefined,
    },
    include: INCLUDE,
  });

  return ok(res, task);
});

export const deleteTask = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  await prisma.task.delete({ where: { id } });
  return ok(res, { id });
});
