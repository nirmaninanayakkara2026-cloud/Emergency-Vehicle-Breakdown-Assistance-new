import api from "./api";

function message(error) {
  return error.response?.data?.message || error.message || "Something went wrong";
}

async function request(method, url, data, params) {
  try {
    const response = await api.request({ method, url, data, params });
    return response.data.data;
  } catch (error) {
    throw new Error(message(error));
  }
}

export const getAdminDashboard = () => request("get", "/admin/dashboard");
export const getAdminProviders = (params = {}) => request("get", "/admin/providers", undefined, params);
export const getAdminProvider = (providerId) => request("get", `/admin/providers/${providerId}`);
export const approveAdminProvider = (providerId) => request("post", `/admin/providers/${providerId}/approve`);
export const rejectAdminProvider = (providerId, reason) => request("post", `/admin/providers/${providerId}/reject`, { reason });
export const suspendAdminProvider = (providerId, reason) => request("post", `/admin/providers/${providerId}/suspend`, { reason });
export const reactivateAdminProvider = (providerId) => request("post", `/admin/providers/${providerId}/reactivate`);
export const getAdminDrivers = (params = {}) => request("get", "/admin/drivers", undefined, params);
export const deactivateAdminUser = (userId, reason = "") => request("post", `/admin/users/${userId}/deactivate`, { reason });
export const activateAdminUser = (userId) => request("post", `/admin/users/${userId}/activate`);
export const getAdminRequests = (params = {}) => request("get", "/admin/breakdown-requests", undefined, params);
export const getAdminRequest = (id) => request("get", `/admin/breakdown-requests/${id}`);
export const getAdminReviews = (params = {}) => request("get", "/admin/reviews", undefined, params);
