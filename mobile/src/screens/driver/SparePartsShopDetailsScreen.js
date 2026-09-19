import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "../../components/location/MapView";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { getSparePartsShopDetails } from "../../services/sparePartService";
import { colors, radii, spacing, typography } from "../../theme";

export default function SparePartsShopDetailsScreen({ route }) {
  // Store the selected shop details and loading/error state.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Load shop information and inventory using the selected location context.
  useEffect(() => {
    getSparePartsShopDetails(route.params.shopId, route.params.location || {})
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [route.params.shopId, route.params.location]);
  // Show the initial loading state while shop data is requested.
  if (loading)
    return (
      <ScreenContainer>
        <LoadingState message="Loading shop and parts..." />
      </ScreenContainer>
    );
  // Show an error state when the shop cannot be loaded.
  if (!data)
    return (
      <ScreenContainer>
        <InfoBanner tone="danger" message={error || "Shop unavailable"} />
      </ScreenContainer>
    );
  const { shop, items } = data;
  const point = shop.location;
  const valid =
    Number.isFinite(Number(point?.latitude)) &&
    Number.isFinite(Number(point?.longitude));
  // Display shop profile, location/contact actions, and inventory results.
  return (
    <ScreenContainer>
      <ScreenHeader
        eyebrow="Approved spare-parts shop"
        title={shop.businessName}
        subtitle={
          shop.distanceKm != null
            ? `${shop.distanceKm} km from you`
            : shop.address
        }
      />
      <AppCard>
        <View style={styles.row}>
          <StatusBadge status="Online" tone="success" />
          <Text style={styles.rating}>
            ★ {shop.rating || 0} ({shop.totalReviews || 0} reviews)
          </Text>
        </View>
        <Text style={styles.body}>
          {shop.description ||
            "Spare-parts inventory available for nearby drivers."}
        </Text>
        <Text style={styles.body}>{shop.address || "Address unavailable"}</Text>
        <Text style={styles.body}>
          Hours: {shop.openingHours || "Contact shop for opening hours"}
        </Text>
        {valid ? (
          <MapView
            style={styles.map}
            scrollEnabled={false}
            initialRegion={{
              latitude: Number(point.latitude),
              longitude: Number(point.longitude),
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              coordinate={{
                latitude: Number(point.latitude),
                longitude: Number(point.longitude),
              }}
              title={shop.businessName}
            />
          </MapView>
        ) : null}
        <View style={styles.actions}>
          {shop.phone ? (
            <AppButton
              title="Call Shop"
              icon="call-outline"
              onPress={() => Linking.openURL(`tel:${shop.phone}`)}
            />
          ) : null}
          {valid ? (
            <AppButton
              title="Open Location"
              icon="navigate-outline"
              variant="secondary"
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`,
                )
              }
            />
          ) : null}
        </View>
      </AppCard>
      <Text style={styles.title}>Available Parts</Text>
      {!items.length ? (
        <AppCard>
          <EmptyState
            title="No listed parts are currently in stock"
            message="Call the shop to ask about upcoming availability."
            icon="cube-outline"
          />
        </AppCard>
      ) : null}
      {items.map((item) => (
        <AppCard key={item.itemId}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.item}>{item.name}</Text>
              <Text style={styles.meta}>
                {[item.brand, item.partNumber, item.category]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <StatusBadge
              status={
                item.stockStatus === "in_stock" ? "In stock" : "Out of stock"
              }
              tone={item.stockStatus === "in_stock" ? "success" : "danger"}
            />
          </View>
          {item.compatibleVehicles?.length ? (
            <Text style={styles.body}>
              Fits: {item.compatibleVehicles.join(", ")}
            </Text>
          ) : null}
          {item.description ? (
            <Text style={styles.body}>{item.description}</Text>
          ) : null}
          {item.price != null ? (
            <Text style={styles.price}>LKR {item.price}</Text>
          ) : null}
        </AppCard>
      ))}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  rating: { ...typography.body, color: colors.textSecondary },
  body: { ...typography.body, color: colors.textSecondary },
  map: { height: 180, borderRadius: radii.md },
  actions: { gap: spacing.xs },
  title: { ...typography.sectionTitle, color: colors.primaryDark },
  item: { ...typography.sectionTitle, color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textSecondary },
  price: { ...typography.sectionTitle, color: colors.teal },
});
