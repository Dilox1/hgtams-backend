import { Router } from "express";
import {
  listUsers, listPendingUsers, approveUser, rejectUser,
  updateUserRole, setUserActive, listAssignableUsers,
} from "../controllers/userController.js";
import { requireAuth, requireApproved, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireApproved);

// Admin + manager can browse the team; only admin approves/rejects/role-changes.
router.get("/", requireRole("ADMIN", "MANAGER"), listUsers);
router.get("/assignable", requireRole("ADMIN", "MANAGER"), listAssignableUsers);
router.get("/pending", requireRole("ADMIN"), listPendingUsers);
router.post("/:id/approve", requireRole("ADMIN"), approveUser);
router.post("/:id/reject", requireRole("ADMIN"), rejectUser);
router.patch("/:id/role", requireRole("ADMIN"), updateUserRole);
router.patch("/:id/active", requireRole("ADMIN"), setUserActive);

export default router;
