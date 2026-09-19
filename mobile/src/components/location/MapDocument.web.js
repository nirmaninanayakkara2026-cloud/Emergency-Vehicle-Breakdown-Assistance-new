import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { buildWebMapDocument } from "../../utils/webMapDocument";

export default forwardRef(function MapDocument({ source, style, onMessage, onError, accessibilityLabel }, ref) {
  const frameRef = useRef(null);
  const sourceDocument = useMemo(() => buildWebMapDocument(source.html), [source.html]);
  useEffect(() => {
    function receive(event) {
      if (event.source !== frameRef.current?.contentWindow || event.data?.channel !== "roadcare-map") return;
      if (typeof event.data.data === "string") onMessage?.({ nativeEvent: { data: event.data.data } });
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onMessage]);
  useImperativeHandle(ref, () => {
    function send(method, value) {
      frameRef.current?.contentWindow?.postMessage({ channel: "roadcare-map-command", method, value }, "*");
    }
    return {
      setSelectedLocation: (location) => send("setSelectedLocation", location),
      setRoadRoute: (coordinates) => send("setRoadRoute", coordinates)
    };
  }, []);
  return (
    <View style={style}>
      <iframe ref={frameRef} title={accessibilityLabel || "Map"} srcDoc={sourceDocument}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        onError={onError} style={{ width: "100%", height: "100%", border: 0, display: "block", flex: 1 }} />
    </View>
  );
});
