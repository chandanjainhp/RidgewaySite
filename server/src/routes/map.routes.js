import express from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getMapGeometry,
  getDroneRoute,
  getMapEventPins,
  getDroneState,
  simulateMission,
} from "../controllers/map.controller.js";

const router = express.Router();

router.get("/geometry", verifyJWT, asyncHandler(getMapGeometry));
router.get("/events", verifyJWT, asyncHandler(getMapEventPins));
router.get("/drones/route/:patrolId", verifyJWT, asyncHandler(getDroneRoute));
router.get("/drones/:patrolId", verifyJWT, asyncHandler(getDroneRoute));
router.get("/drones/:patrolId/state", verifyJWT, asyncHandler(getDroneState));
router.post("/drones/simulate-mission", verifyJWT, asyncHandler(simulateMission));

export default router;
