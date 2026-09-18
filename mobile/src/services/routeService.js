import axios from "axios";
import { buildRoadRouteUrl, parseRoadRoute } from "../utils/providerTracking";

export async function getRoadRoute(origin, destination, signal) {
  const url = buildRoadRouteUrl(origin, destination);
  if (!url) throw new Error("Both locations are needed to show a route.");
  // Use a separate client so app authentication is never sent to the routing service.
  const response = await axios.get(url, { timeout: 12000, signal });
  const route = parseRoadRoute(response.data);
  if (!route) throw new Error("No driving route is available between these locations.");
  return route;
}
