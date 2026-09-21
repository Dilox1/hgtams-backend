import type { Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { signToken } from "../utils/jwt.js";
import { ok, fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.js";

const PALETTE = ["#4338CA", "#0EA5E9", "#059669", "#D97706", "#DB2777", "#7C3AED"];
function pickColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function publicUser(u: {
  id: string; name: string; email: string; phone: string | null; role: string;
  approvalStatus: string; isActive: boolean; avatarColor: string; createdAt: Date;
  rejectionReason: string | null;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    approvalStatus: u.approvalStatus,
    isActive: u.isActive,
    avatarColor: u.avatarColor,
    createdAt: u.createdAt,
    rejectionReason: u.rejectionReason,
  };
}

export const register = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, email, phone, password, role } = req.body ?? {};

  if (!name || !email || !password) {
    return fail(res, "Name, email and password are required.", 422);
  }
  if (String(password).length < 6) {
    return fail(res, "Password must be at least 6 characters.", 422);
  }

  const requestedRole = role === "MANAGER" ? "MANAGER" : "WORKER";

  const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (existing) return fail(res, "An account with that email already exists.", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email: String(email).toLowerCase(),
      phone: phone || null,
      passwordHash,
      role: requestedRole,
      approvalStatus: "PENDING",
      avatarColor: pickColor(),
    },
  });

  const token = signToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
  return ok(res, { token, user: publicUser(user) }, 201);
});

export const login = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return fail(res, "Email and password are required.", 422);

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) return fail(res, "Invalid email or password.", 401);

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) return fail(res, "Invalid email or password.", 401);

  if (!user.isActive) return fail(res, "Your account has been deactivated. Contact your admin.", 403);
  if (user.approvalStatus === "REJECTED") {
    return fail(res, "Your registration was rejected.", 403, {
      approvalStatus: "REJECTED",
      rejectionReason: user.rejectionReason,
    });
  }

  const token = signToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
  return ok(res, { token, user: publicUser(user) });
});

export const me = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return fail(res, "Account not found.", 404);
  return ok(res, publicUser(user));
});

export const updateProfile = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, phone } = req.body ?? {};
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      name: name ?? undefined,
      phone: phone ?? undefined,
    },
  });
  return ok(res, publicUser(user));
});

export const changePassword = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return fail(res, "Current and new password are required.", 422);
  }
  if (String(newPassword).length < 6) {
    return fail(res, "New password must be at least 6 characters.", 422);
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return fail(res, "Account not found.", 404);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return fail(res, "Current password is incorrect.", 401);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  // Password changed -> old tokens invalid -> issue a fresh one for this session.
  const token = signToken({ sub: updated.id, role: updated.role, tokenVersion: updated.tokenVersion });
  return ok(res, { token, user: publicUser(updated) });
});
