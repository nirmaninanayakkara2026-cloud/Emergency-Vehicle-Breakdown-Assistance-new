module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const expo = config;

  return {
    ...expo,
    plugins: [
      ...(expo.plugins || []),
      ["react-native-maps", googleMapsApiKey ? { androidGoogleMapsApiKey: googleMapsApiKey } : {}]
    ],
    android: {
      ...expo.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...(expo.android?.config || {}),
              googleMaps: { apiKey: googleMapsApiKey }
            }
          }
        : {})
    }
  };
};
