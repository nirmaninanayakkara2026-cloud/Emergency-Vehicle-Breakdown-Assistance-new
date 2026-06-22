import api from "./api";

const endpoints = [
  ["users", "/admin/users"],
  ["requests", "/admin/requests"],
  ["mechanics", "/admin/mechanics"],
  ["garages", "/admin/garages"],
  ["sparePartsShops", "/admin/spare-parts-shops"],
];

export const getAdminCounts = async () => {
  const responses = await Promise.all(endpoints.map(([, endpoint]) => api.get(endpoint)));
  return Object.fromEntries(endpoints.map(([key], index) => [key, responses[index].data.count]));
};
