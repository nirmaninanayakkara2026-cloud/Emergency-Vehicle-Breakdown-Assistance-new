import { mockRequests } from "../data/mockRequests";
import { mockProviderProfile } from "../data/mockProviderProfile";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getProviderRequests() {
  await delay();
  return mockRequests;
}

export async function getProviderProfile() {
  await delay();
  return mockProviderProfile;
}

export async function getProviderRequestById(id) {
  await delay();
  return mockRequests.find((request) => request.id === id) || mockRequests[0];
}
