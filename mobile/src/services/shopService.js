import api from "./api";

export const findNearbyShops = async (params) => (
  (await api.get("/spare-parts-shops/nearby", { params })).data.data.shops
);
