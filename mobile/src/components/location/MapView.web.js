import React from "react";
import { View } from "react-native";
import OpenStreetMapView from "./OpenStreetMapView";

// The detail screens use a single, fixed location marker.
export function Marker() { return null; }
export const PROVIDER_GOOGLE = undefined;

export default function MapView({ children, initialRegion, style, accessibilityLabel }) {
  const marker = React.Children.toArray(children).find((child) => child.type === Marker);
  return (
    <View style={[style, { overflow: "hidden" }]} accessibilityLabel={accessibilityLabel}>
      <OpenStreetMapView location={marker?.props.coordinate || initialRegion} readOnly />
    </View>
  );
}
