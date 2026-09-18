const express = require("express");
const {
  cancelSession,
  confirmSafety,
  confirmStepAction,
  getHistory,
  getSession,
  setResult,
  startSelfAssistant,
  stopSession,
  submitStep,
  sendMessage,
  guidanceAction,
  askForHelp
} = require("../controllers/selfAssistantController");
const { authorizeRoles, protect } = require("../middleware/authMiddleware");

const router = express.Router();
// Define the routes for the self-assistant
router.use(protect, authorizeRoles("driver"));
router.post("/start", startSelfAssistant);
router.get("/history", getHistory);
router.post("/:sessionId/safety-confirm", confirmSafety);
router.post("/:sessionId/action-confirm", confirmStepAction);
router.post("/:sessionId/step", submitStep);
router.post("/:sessionId/message", sendMessage);
router.post("/:sessionId/guidance-action", guidanceAction);
router.post("/:sessionId/help", askForHelp);
router.post("/:sessionId/stop", stopSession);
router.post("/:sessionId/result", setResult);
router.post("/:sessionId/cancel", cancelSession);
router.get("/:sessionId", getSession);

module.exports = router;
