import type { Response } from "express";
import { prisma } from "../utils/prisma.js";
import { ok, fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { distanceMeters, todayISO } from "../utils/geo.js";

const INCLUDE = {
  user: { select: { id: true, name: true, avatarColor: true, role: true } },
  zone: { select: { id: true, name: true } },
} as const;

/** Worker/manager: today's attendance status for the logged-in user. */
export const myTodayAttendance = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user!.id, date: todayISO() } },
    include: INCLUDE,
  });
  return ok(res, record);
});

/** Worker/manager: attendance history for the logged-in user. */
export const myAttendanceHistory = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const records = await prisma.attendance.findMany({
    where: { userId: req.user!.id },
    include: INCLUDE,
    orderBy: { date: "desc" },
    take: 60,
  });
  return ok(res, records);
});

/** Admin/manager: everyone's attendance, optionally filtered by date. */
export const listAttendance = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { date } = req.query as Record<string, string | undefined>;
  const records = await prisma.attendance.findMany({
    where: { date: date || todayISO() },
    include: INCLUDE,
    orderBy: { checkInAt: "desc" },
  });
  return ok(res, records);
});

/**
 * Check in: compares the device's reported latitude/longitude against every
 * active AttendanceZone. If inside at least one zone's radius, attendance is
 * recorded as PRESENT there. Otherwise the check-in is rejected and the
 * closest zone + distance is returned so the UI can tell the person exactly
 * why ("You're not at Huska Lab").
 */
export const checkIn = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { latitude, longitude } = req.body ?? {};
  if (latitude === undefined || longitude === undefined) {
    return fail(res, "Location is required to check in.", 422);
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return fail(res, "Invalid location data.", 422);
  }

  const date = todayISO();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user!.id, date } },
  });
  if (existing) return fail(res, "You've already checked in today.", 409);

  const zones = await prisma.attendanceZone.findMany({ where: { isActive: true } });
  if (zones.length === 0) {
    return fail(res, "No attendance zone has been configured yet. Contact your admin.", 422);
  }

  let closest = zones[0];
  let closestDistance = Infinity;
  let matchedZone: typeof zones[number] | null = null;

  for (const zone of zones) {
    const d = distanceMeters(lat, lng, zone.latitude, zone.longitude);
    if (d < closestDistance) {
      closestDistance = d;
      closest = zone;
    }
    if (d <= zone.radiusMeters) {
      matchedZone = zone;
      break;
    }
  }

  if (!matchedZone) {
    return fail(
      res,
      `You're not at ${closest.name}, so you can't check in from here.`,
      422,
      {
        outsideZone: true,
        nearestZone: closest.name,
        distanceMeters: Math.round(closestDistance),
        allowedRadiusMeters: closest.radiusMeters,
      }
    );
  }

  const record = await prisma.attendance.create({
    data: {
      userId: req.user!.id,
      date,
      latitude: lat,
      longitude: lng,
      distanceMeters: closestDistance,
      status: "PRESENT",
      zoneId: matchedZone.id,
    },
    include: INCLUDE,
  });

  return ok(res, record, 201);
});

export const checkOut = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const date = todayISO();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user!.id, date } },
  });
  if (!existing) return fail(res, "You haven't checked in today.", 404);
  if (existing.checkOutAt) return fail(res, "You've already checked out today.", 409);

  const record = await prisma.attendance.update({
    where: { id: existing.id },
    data: { checkOutAt: new Date() },
    include: INCLUDE,
  });
  return ok(res, record);
});
