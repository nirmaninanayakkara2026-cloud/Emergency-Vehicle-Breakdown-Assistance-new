import { mockProviders } from "../data/mockProviders";
import { mockRequests } from "../data/mockRequests";
import { mockSparePartsShops } from "../data/mockSparePartsShops";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createBreakdownRequest(payload) {
  await delay();
  return {
    id: `R-${Date.now().toString().slice(-4)}`,
    status: "Searching",
    providerName: null,
    eta: null,
    ...payload
  };
}

export async function getCurrentRequest() {
  await delay();
  return mockRequests[0];
}

export async function getRecommendedProviders() {
  await delay();
  return mockProviders;
}

export async function findSpareParts(query, vehicleType) {
  await delay();
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
