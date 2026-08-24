const appJson = require("./app.json");

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const expo = appJson.expo;

  return {
    ...expo,
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
