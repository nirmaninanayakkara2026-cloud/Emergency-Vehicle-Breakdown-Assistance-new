import React, { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { buildMapHtml, parseMapMessage } from "../../utils/openStreetMap";
import { normalizeLocation } from "../../utils/locationPicker";

export default function OpenStreetMapView({ location, onSelect, onReady, onError }) {
  const webRef = useRef(null);
  const readyRef = useRef(false);
  // Keep the page stable while the driver moves the pin or edits the address.
  const [source] = useState(() => ({ html: buildMapHtml(location) }));
  const selected = normalizeLocation(location);
  const latestLocation = useRef(selected);
  latestLocation.current = selected;

  function updatePin(point) {
    webRef.current?.injectJavaScript(
      `window.setSelectedLocation && window.setSelectedLocation(${JSON.stringify(point)},true);true;`
    );
  }

  useEffect(() => {
    if (readyRef.current) updatePin(selected);
  }, [selected?.latitude, selected?.longitude]);

  function handleMessage(event) {
    const message = parseMapMessage(event.nativeEvent.data);
    if (message?.type === "ready") {
      if (!readyRef.current) {
        readyRef.current = true;
        updatePin(latestLocation.current);
      }
      onReady();
    } else if (message?.type === "select") {
      onSelect(message.location);
    } else if (message?.type === "error") {
      onError();
    }
  }

  return (
    <WebView
      ref={webRef}
      source={source}
      style={styles.map}
      originWhitelist={["*"]}
      applicationNameForUserAgent="RoadCare/1.0"
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      scrollEnabled={false}
      bounces={false}
      onMessage={handleMessage}
      onError={onError}
      onHttpError={onError}
      onContentProcessDidTerminate={onError}
      onRenderProcessGone={onError}
      onShouldStartLoadWithRequest={({ url }) => {
        if (url === "about:blank" || url.startsWith("about:blank#")) return true;
        if (url === "https://www.openstreetmap.org/copyright") {
          Linking.openURL(url).catch(() => {});
        }
        return false;
      }}
      accessibilityLabel="OpenStreetMap service location map"
    />
  );
}

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: "transparent" } });
