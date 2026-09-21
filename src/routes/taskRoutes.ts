import { Router } from "express";
import {
  listTasks, createTask, updateTaskStatus, updateTask, deleteTask,
} from "../controllers/taskController.js";
import { requireAuth, requireApproved, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireApproved);

router.get("/", listTasks);
router.post("/", requireRole("ADMIN", "MANAGER"), createTask);
router.patch("/:id/status", updateTaskStatus); // worker can mark own task done/not done
router.patch("/:id", requireRole("ADMIN", "MANAGER"), updateTask);
router.delete("/:id", requireRole("ADMIN", "MANAGER"), deleteTask);

export default router;
