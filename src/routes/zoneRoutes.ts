import { Router } from "express";
import { listZones, createZone, updateZone, deleteZone } from "../controllers/zoneController.js";
import { requireAuth, requireApproved, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireApproved);

router.get("/", requireRole("ADMIN", "MANAGER"), listZones);
router.post("/", requireRole("ADMIN"), createZone);
router.patch("/:id", requireRole("ADMIN"), updateZone);
router.delete("/:id", requireRole("ADMIN"), deleteZone);

export default router;
