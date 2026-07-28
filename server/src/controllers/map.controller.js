import { ApiResponse } from "../utils/api-response.js";
import Event from "../models/event.model.js";
import { getSite } from "../models/site.model.js";
import {
  getSiteMapData,
  getEventPins,
} from "../tools/map.tool.js";
import {
  getDroneStateAtTime,
  simulateFollowUpMission,
} from "../tools/droneSimulator.tool.js";

const toHHMM = (dateValue, offsetMinutes = 0) => {
  const d = new Date(dateValue);
  d.setMinutes(d.getMinutes() + offsetMinutes);
  return d.toISOString().substring(11, 16);
};

export const getMapGeometry = async (req, res) => {
  const site = await getSite();
  const siteConfig = {
    siteName: site.name,
    timezone: site.timezone,
    coordinates: site.coordinates,
    siteGeometry: site.siteGeometry,
  };
  const data = await getSiteMapData(siteConfig);
  res.status(200).json(new ApiResponse(200, data, "Map geometry fetched successfully"));
};

export const getDroneRoute = async (req, res) => {
  const { patrolId } = req.params;

  const patrolEvent = await Event.findOne({
    type: "drone_observation",
    $or: [
      { "rawData.patrolId": patrolId },
      { "rawData.droneId": patrolId },
      { "rawData.patrol": patrolId },
    ],
  }).sort({ timestamp: 1 });

  let data = { patrolId, waypoints: [] };

  if (patrolEvent) {
    const observations = Array.isArray(patrolEvent.rawData?.observations)
      ? patrolEvent.rawData.observations
      : [];

    const waypoints = observations
      .map((obs, idx) => ({
        location: obs.location || patrolEvent.location?.name || "Unknown",
        lat: patrolEvent.location?.coordinates?.lat ?? null,
        lng: patrolEvent.location?.coordinates?.lng ?? null,
        time:
          typeof obs.time === "string" && obs.time.includes(":")
            ? obs.time
            : toHHMM(patrolEvent.timestamp, idx * 16),
        observation: obs.finding || obs.observation || "Drone observation",
      }))
      .filter((wp) => wp.lat !== null && wp.lng !== null);

    if (waypoints.length > 0) {
      data = { patrolId, waypoints };
    }
  }

  res.status(200).json(new ApiResponse(200, data, "Drone route fetched successfully"));
};

export const getMapEventPins = async (req, res) => {
  const data = await getEventPins(req.query.nightDate);
  res.status(200).json(new ApiResponse(200, data, "Event pins fetched successfully"));
};

export const getDroneState = async (req, res) => {
  const { patrolId } = req.params;
  const { time } = req.query;
  const data = await getDroneStateAtTime(patrolId, time);
  res.status(200).json(new ApiResponse(200, data, "Drone state fetched successfully"));
};

export const simulateMission = async (req, res) => {
  const data = await simulateFollowUpMission(req.body.locations || []);
  res.status(200).json(new ApiResponse(200, data, "Mission simulated successfully"));
};
