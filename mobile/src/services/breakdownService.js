import api from "./api";

export const createBreakdownRequest = async (payload) => (
  (await api.post("/breakdown-requests", payload)).data.data
);
export const getMyRequests = async () => (
  (await api.get("/breakdown-requests/my")).data.data.breakdownRequests
);
export const getAssignedRequests = async () => (
  (await api.get("/breakdown-requests/assigned")).data.data.breakdownRequests
);
export const getRequest = async (requestId) => (
  (await api.get(`/breakdown-requests/${requestId}`)).data.data.breakdownRequest
);
export const getRecommendations = async (requestId) => (
  (await api.get(`/breakdown-requests/${requestId}/recommendations`)).data.data
);
export const selectProvider = async (requestId, providerId, providerType) => (
  (await api.patch(`/breakdown-requests/${requestId}/select-provider`, {
    providerId,
    providerType,
  })).data.data.breakdownRequest
);
export const respondToRequest = async (requestId, response) => (
  (await api.patch(`/breakdown-requests/${requestId}/provider-response`, { response }))
    .data.data.breakdownRequest
);
export const updateRequestStatus = async (requestId, status) => (
  (await api.patch(`/breakdown-requests/${requestId}/status`, { status }))
    .data.data.breakdownRequest
);
