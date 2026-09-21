import { Router } from "express";
import {
  myTodayAttendance, myAttendanceHistory, listAttendance, checkIn, checkOut,
} from "../controllers/attendanceController.js";
import { requireAuth, requireApproved, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireApproved);

router.get("/me/today", myTodayAttendance);
router.get("/me/history", myAttendanceHistory);
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/", requireRole("ADMIN", "MANAGER"), listAttendance);

export default router;
