import { API_BASE_URL } from "../services/api";

export const getErrorMessage = (error) => {
  if (error.message === "Network Error") {
    return `Network Error: cannot reach backend at ${API_BASE_URL}. Make sure the backend is running, your phone is on the same Wi-Fi, and Windows Firewall allows port 5050.`;
  }

  if (error.code === "ECONNABORTED") {
    return `Request timed out while connecting to ${API_BASE_URL}.`;
  }

  return error.response?.data?.message || error.message || "Something went wrong";
};
