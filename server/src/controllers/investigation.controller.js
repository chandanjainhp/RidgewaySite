import Investigation from "../models/investigation.model.js";
import { getAgentEvents } from "../db/redis.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { emitToStream, registerStream, unregisterStream } from "../lib/streamRegistry.js";
import {
  startNightInvestigation,
  getInvestigationWithEvidence,
} from "../services/investigation.service.js";

const normalizeProgressEvent = (event, investigation) => {
  const payload = event.data ?? event.payload ?? {};

  if (event.type === "classification" && payload.classification) {
    return {
      ...event,
      payload: {
        incidentId: investigation.incidentId.toString(),
        ...payload.classification,
        summary: payload.summary,
      },
    };
  }

  return {
    ...event,
    payload,
  };
};

export const startInvestigation = async (req, res) => {
  const nightDate =
    req.body?.nightDate || new Date().toISOString().split("T")[0];
  const result = await startNightInvestigation(nightDate);

  res
    .status(202)
    .json(new ApiResponse(202, result, "Investigation queued successfully"));
};

export const getInvestigation = async (req, res) => {
  const investigation = await getInvestigationWithEvidence(req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, investigation, "Investigation fetched successfully"));
};

export const streamInvestigationProgress = async (req, res) => {
  const { jobId } = req.params;
  const investigation = await Investigation.findOne({ jobId }).lean();

  if (!investigation) {
    throw new ApiError(404, "Investigation stream not found");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const write = (event) => {
    if (!res.writableEnded) {
      const normalized = normalizeProgressEvent(event, investigation);
      res.write(`data: ${JSON.stringify(normalized)}\n\n`);
    }
  };

  // Replay any previously emitted events for reconnect support.
  try {
    const history = await getAgentEvents(jobId);
    history.forEach((event) => write(event));
  } catch (error) {
    write({ type: "failed", jobId, data: { message: error.message } });
  }

  registerStream(jobId, write);
  write({ type: "connected", jobId, data: { jobId } });

  const testEmitTimeout = setTimeout(() => {
    emitToStream(jobId, {
      type: "test",
      jobId: jobId,
      timestamp: new Date().toISOString(),
      data: { summary: "SSE test event" },
    });
  }, 2000);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }
  }, 15000);

  req.on("close", () => {
    unregisterStream(jobId);
    clearTimeout(testEmitTimeout);
    clearInterval(heartbeat);
  });
};
