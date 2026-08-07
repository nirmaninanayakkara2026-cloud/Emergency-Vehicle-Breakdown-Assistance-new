import { mockSparePartsShops } from "../data/mockSparePartsShops";
import api from "./api";

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || "Something went wrong";
}

export async function createBreakdownRequest(payload) {
  try {
    const response = await api.post("/breakdown-requests", payload);
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
    const response = await api.get(`/breakdown-requests/${requestId}/recommendations`);
    return response.data.data.recommendations;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function selectProvider(requestId, providerId) {
  try {
    const response = await api.patch(`/breakdown-requests/${requestId}/select-provider`, { providerId });
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function cancelRequest(requestId) {
  try {
    const response = await api.patch(`/breakdown-requests/${requestId}/cancel`);
    return response.data.data.request;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateRequestStatus(requestId, status) {
  try {
    const response = await api.patch(`/breakdown-requests/${requestId}/status`, { status });
    return response.data.data.request;
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
