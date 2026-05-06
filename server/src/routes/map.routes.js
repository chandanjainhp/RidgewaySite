import express from "express";
import { authenticateRequest, requireRole, scopeToOrg } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getMapGeometry,
  getDroneRoute,
  getMapEventPins,
  getDroneState,
  simulateMission,
} from "../controllers/map.controller.js";

const router = express.Router();

router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));
router.use(scopeToOrg);

router.get("/geometry", asyncHandler(getMapGeometry));
router.get("/events", asyncHandler(getMapEventPins));
router.get("/drones/route/:patrolId", asyncHandler(getDroneRoute));
router.get("/drones/:patrolId", asyncHandler(getDroneRoute));
router.get("/drones/:patrolId/state", asyncHandler(getDroneState));
router.post("/drones/simulate-mission", asyncHandler(simulateMission));

export default router;
