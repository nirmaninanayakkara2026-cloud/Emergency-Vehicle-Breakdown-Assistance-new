import { mockSparePartsShops } from "../data/mockSparePartsShops";
import api from "./api";

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || "Something went wrong";
}

export async function createBreakdownRequest(payload) {
  try {
    const requestPayload = {
      vehicleType: payload.vehicleType,
      vehicleModel: payload.vehicleModel,
      breakdownType: payload.breakdownType,
      urgencyLevel: payload.urgencyLevel,
      problemDescription: payload.problemDescription,
      location: payload.location,
      diagnosticInputText: payload.diagnosticInputText,
      predictedFault: payload.predictedFault,
      requiredService: payload.requiredService
    };

    if (payload.troubleshootingSessionId) {
      requestPayload.troubleshootingSessionId = payload.troubleshootingSessionId;
    }

    // Guided capture is optional; omit it entirely for the normal request flow.
    if (payload.symptomCapture) requestPayload.symptomCapture = payload.symptomCapture;

    const response = await api.post("/breakdown-requests", requestPayload);
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getMyRequests() {
  try {
    const response = await api.get("/breakdown-requests/my");
    return response.data.data.requests;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getRequestById(id) {
  try {
    const response = await api.get(`/breakdown-requests/${id}`);
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getRequestRecommendations(requestId) {
  try {
    const response = await api.get("/providers/recommendations", { params: { requestId } });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getClarificationQuestions(requestId) {
  try {
    const response = await api.post(`/breakdown-requests/${requestId}/clarification`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function submitClarificationAnswers(requestId, answers) {
  try {
    const response = await api.post(
      `/breakdown-requests/${requestId}/clarification-answer`,
      { answers }
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function selectProvider(requestId, providerId) {
  try {
    const response = await api.post(`/breakdown-requests/${requestId}/select-provider`, { providerId });
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function cancelRequest(requestId, reason = "") {
  try {
    const response = await api.post(`/breakdown-requests/${requestId}/cancel`, { reason });
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateRequestStatus(requestId, status, finalCost) {
  try {
    const response = await api.patch(`/breakdown-requests/${requestId}/status`, { status, finalCost });
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function acceptRequest(requestId, estimatedArrivalMinutes) {
  try {
    const response = await api.post(`/breakdown-requests/${requestId}/accept`, { estimatedArrivalMinutes });
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function rejectRequest(requestId, reason = "") {
  try {
    const response = await api.post(`/breakdown-requests/${requestId}/reject`, { reason });
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function submitRequestReview(requestId, rating, comment) {
  try {
    const response = await api.post(`/breakdown-requests/${requestId}/review`, { rating, comment });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAssignedRequests() {
  try {
    const response = await api.get("/breakdown-requests/provider/assigned");
    return response.data.data.requests;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function findSpareParts(query, vehicleType) {
  const keyword = (query || "").toLowerCase();

  return mockSparePartsShops.filter((shop) => {
    const partMatch =
      !keyword || shop.availableParts.some((part) => part.toLowerCase().includes(keyword));
    const vehicleMatch =
      !vehicleType ||
      vehicleType !== "bike" ||
      shop.availableParts.some((part) => part.toLowerCase().includes("bike"));

    return partMatch && vehicleMatch;
  });
}
