import api from "./api";

function messageFor(error) {
  return error.response?.data?.message || "Self-troubleshooting is temporarily unavailable.";
}

async function request(call) {
  try {
    const response = await call();
    return response.data;
  } catch (error) {
    if (error.response?.data?.status === "troubleshooting_unavailable") {
      return error.response.data;
    }
    throw new Error(messageFor(error));
  }
}

export function startSelfAssistant(data) {
  return request(() => api.post("/self-assistant/start", data));
}

export function confirmSafety(sessionId) {
  return request(() => api.post(`/self-assistant/${sessionId}/safety-confirm`));
}

export function confirmTroubleshootingAction(sessionId, stepId) {
  return request(() => api.post(`/self-assistant/${sessionId}/action-confirm`, { stepId }));
}

export function submitTroubleshootingStep(sessionId, stepId, selectedResult) {
  return request(() => api.post(`/self-assistant/${sessionId}/step`, { stepId, selectedResult }));
}

export function triggerStopCondition(sessionId, condition) {
  return request(() => api.post(`/self-assistant/${sessionId}/stop`, { condition }));
}

export function setSessionResult(sessionId, resolved) {
  return request(() => api.post(`/self-assistant/${sessionId}/result`, { resolved }));
}

export function cancelSession(sessionId) {
  return request(() => api.post(`/self-assistant/${sessionId}/cancel`));
}

export function getSession(sessionId) {
  return request(() => api.get(`/self-assistant/${sessionId}`));
}

export function getTroubleshootingHistory() {
  return request(() => api.get("/self-assistant/history"));
}
