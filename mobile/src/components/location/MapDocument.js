import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { WebView } from "react-native-webview";

export default forwardRef(function MapDocument(props, ref) {
  const webRef = useRef(null);
  useImperativeHandle(ref, () => ({
    setSelectedLocation(location) {
      webRef.current?.injectJavaScript(`window.setSelectedLocation && window.setSelectedLocation(${JSON.stringify(location)},true);true;`);
    },
    setRoadRoute(coordinates) {
      webRef.current?.injectJavaScript(`window.setRoadRoute && window.setRoadRoute(${JSON.stringify(coordinates)});true;`);
    }
  }), []);
  return <WebView {...props} ref={webRef} />;
});
