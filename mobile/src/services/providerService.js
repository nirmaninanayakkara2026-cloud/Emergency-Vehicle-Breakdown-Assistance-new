import api from "./api";

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || "Something went wrong";
}

export async function createProviderProfile(payload) {
  try {
    const response = await api.post("/providers/profile", payload);
    return response.data.data.profile;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getMyProviderProfile() {
  try {
    const response = await api.get("/providers/profile/me");
    return response.data.data.profile;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateProviderProfile(payload) {
  try {
    const response = await api.patch("/providers/profile/me", payload);
    return response.data.data.profile;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateAvailability(availabilityStatus) {
  try {
    const response = await api.patch("/providers/availability", { availabilityStatus });
    return response.data.data.profile;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getProviders(params = {}) {
  try {
    const response = await api.get("/providers", { params });
    return response.data.data.providers;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getProviderById(id) {
  try {
    const response = await api.get(`/providers/${id}`);
    return response.data.data.provider;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
