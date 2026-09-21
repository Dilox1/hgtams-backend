import type { Response } from "express";
import { prisma } from "../utils/prisma.js";
import { ok, fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const listZones = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const zones = await prisma.attendanceZone.findMany({ orderBy: { createdAt: "asc" } });
  return ok(res, zones);
});

export const createZone = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, latitude, longitude, radiusMeters } = req.body ?? {};
  if (!name || latitude === undefined || longitude === undefined) {
    return fail(res, "Name, latitude and longitude are required.", 422);
  }

  const zone = await prisma.attendanceZone.create({
    data: {
      name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusMeters: radiusMeters ? Number(radiusMeters) : 100,
    },
  });
  return ok(res, zone, 201);
});

export const updateZone = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { name, latitude, longitude, radiusMeters, isActive } = req.body ?? {};

  const zone = await prisma.attendanceZone.update({
    where: { id },
    data: {
      name: name ?? undefined,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      radiusMeters: radiusMeters !== undefined ? Number(radiusMeters) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    },
  });
  return ok(res, zone);
});

export const deleteZone = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  await prisma.attendanceZone.delete({ where: { id } });
  return ok(res, { id });
});
