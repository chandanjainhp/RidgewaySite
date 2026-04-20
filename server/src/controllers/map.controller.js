import { ApiResponse } from "../utils/api-response.js";
import Event from "../models/event.model.js";
import { SITE_LOCATIONS } from "../db/graph.js";
import {
  getSiteMapData,
  getEventPins,
} from "../tools/map.tool.js";
import {
  getDroneStateAtTime,
  simulateFollowUpMission,
} from "../tools/droneSimulator.tool.js";

const SEEDED_PATROL = {
  patrolId: "D-Night-04",
  waypoints: [
    {
      location: "Gate 3",
      lat: 51.5065,
      lng: -0.0890,
      time: "03:12",
      observation: "Loose wire on fence sensor. No physical breach.",
    },
    {
      location: "Block C",
      lat: 51.5055,
      lng: -0.0870,
      time: "03:28",
      observation: "One untagged vehicle near loading bay. Plate unreadable.",
    },
    {
      location: "Storage Yard B",
      lat: 51.5045,
      lng: -0.0910,
      time: "03:45",
      observation: "No anomaly detected at time of flyover.",
    },
    {
      location: "Access Point 7",
      lat: 51.5035,
      lng: -0.0925,
      time: "04:05",
      observation: "Badge reader functioning normally. No persons present.",
    },
  ],
};

const toHHMM = (dateValue, offsetMinutes = 0) => {
  const d = new Date(dateValue);
  d.setMinutes(d.getMinutes() + offsetMinutes);
  return d.toISOString().substring(11, 16);
};

export const getMapGeometry = async (req, res) => {
  const data = await getSiteMapData();
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

  let data = SEEDED_PATROL;

  if (patrolEvent) {
    const observations = Array.isArray(patrolEvent.rawData?.observations)
      ? patrolEvent.rawData.observations
      : [];

    const waypoints = observations
      .map((obs, idx) => {
        const locationName = obs.location || patrolEvent.location?.name;
        const siteLocation = SITE_LOCATIONS.find(
          (loc) => loc.name.toLowerCase() === String(locationName || "").toLowerCase()
        );

        return {
          location: locationName || "Unknown",
          lat: siteLocation?.coordinates?.lat ?? patrolEvent.location?.coordinates?.lat ?? null,
          lng: siteLocation?.coordinates?.lng ?? patrolEvent.location?.coordinates?.lng ?? null,
          time:
            typeof obs.time === "string" && obs.time.includes(":")
              ? obs.time
              : toHHMM(patrolEvent.timestamp, idx * 16),
          observation: obs.finding || obs.observation || "Drone observation",
        };
      })
      .filter((wp) => wp.lat !== null && wp.lng !== null);

    if (waypoints.length > 0) {
      data = {
        patrolId,
        waypoints,
      };
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
