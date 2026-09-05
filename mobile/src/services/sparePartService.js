import api from "./api";

function message(error) { return error.response?.data?.message || error.message || "Something went wrong"; }
async function request(method, url, data, params) {
  try { const response = await api.request({ method, url, data, params }); return response.data.data; }
  catch (error) { throw new Error(message(error)); }
}

export const getMySpareParts = () => request("get", "/spare-parts/my-items");
export const createSparePart = (payload) => request("post", "/spare-parts", payload);
export const getSparePart = (itemId) => request("get", `/spare-parts/${itemId}`);
export const updateSparePart = (itemId, payload) => request("patch", `/spare-parts/${itemId}`, payload);
export const deleteSparePart = (itemId) => request("delete", `/spare-parts/${itemId}`);
export const updateSparePartQuantity = (itemId, quantity) => request("patch", `/spare-parts/${itemId}/quantity`, { quantity });
export const getNearbySparePartShops = (params) => request("get", "/spare-parts/shops/nearby", undefined, params);
export const searchNearbySpareParts = (params) => request("get", "/spare-parts/search", undefined, params);
export const getSparePartsShopDetails = (shopId, params = {}) => request("get", `/spare-parts/shops/${shopId}`, undefined, params);
