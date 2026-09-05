const mongoose = require("mongoose");
const RequestEvent = require("../models/RequestEvent");

async function createRequestEvent(event, options = {}) {
  try {
    if (mongoose.connection.readyState !== 1 && !options.force) return null;
    const payload = {
      breakdownRequestId: event.breakdownRequestId,
      requestAssignmentId: event.requestAssignmentId || null,
      actorId: event.actorId || null,
      actorRole: event.actorRole || "system",
      eventType: event.eventType,
      fromStatus: event.fromStatus || "",
      toStatus: event.toStatus || "",
      message: String(event.message || "").slice(0, 300)
    };
    if (options.session) {
      const [created] = await RequestEvent.create([payload], { session: options.session });
      return created;
    }
    return await RequestEvent.create(payload);
  } catch (error) {
    // Lifecycle history is non-critical; core assignment/request writes remain authoritative.
    if (process.env.NODE_ENV !== "test" && !options.silent) {
      console.warn("Request event could not be recorded:", error.message);
    }
    return null;
  }
}

module.exports = { createRequestEvent };
