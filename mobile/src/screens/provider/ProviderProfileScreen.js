import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import LocationPicker from "../../components/location/LocationPicker";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import {
  createProviderProfile,
  getMyProviderProfile,
  resubmitProviderProfile,
  updateAvailability,
  updateProviderProfile
} from "../../services/providerService";
import {
  COLORS,
  PROVIDER_ROLES,
  PROVIDER_SPECIALIZATIONS,
  VEHICLE_TYPES
} from "../../utils/constants";
import { colors, radii, spacing, typography } from "../../theme";
import { isValidLocation, normalizeLocation } from "../../utils/locationPicker";

const providerTypeOptions = PROVIDER_ROLES.map((role) => ({
  label: role.replaceAll("_", " "),
  value: role
}));

const availabilityOptions = [
  { label: "Online", value: "online" },
  { label: "Busy", value: "busy" },
  { label: "Offline", value: "offline" }
];
const shopAvailabilityOptions = [
  { label: "Online", value: "online" },
  { label: "Busy", value: "busy" },
  { label: "Offline", value: "offline" }
];

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function ProviderProfileScreen({ navigation, route }) {
  const { user } = useAuth();
  const shopOwner = user?.role === "spare_parts_shop";
  const [profileId, setProfileId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [providerType, setProviderType] = useState(user?.role || "mechanic");
  const [phone, setPhone] = useState(user?.phone || "");
  const [specializations, setSpecializations] = useState([]);
  const [supportedVehicleTypes, setSupportedVehicleTypes] = useState(["car"]);
  const [address, setAddress] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [serviceRadiusKm, setServiceRadiusKm] = useState("");
  const [averageResponseTimeMinutes, setAverageResponseTimeMinutes] = useState("");
  const [minimumEstimatedPrice, setMinimumEstimatedPrice] = useState("");
  const [maximumEstimatedPrice, setMaximumEstimatedPrice] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [description, setDescription] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("offline");
  const [approvalStatus, setApprovalStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const profile = await getMyProviderProfile();
      setProfileId(profile._id);
      setBusinessName(profile.businessName || "");
      setProviderType(profile.providerType || user?.role || "mechanic");
      setPhone(profile.phone || user?.phone || "");
      setSpecializations(profile.specializations || []);
      setSupportedVehicleTypes(profile.supportedVehicleTypes || []);
      setAddress(profile.location?.address || "");
      setSelectedLocation(normalizeLocation(profile.location));
      setServiceRadiusKm(profile.serviceRadiusKm?.toString() || "");
      setAverageResponseTimeMinutes(profile.averageResponseTimeMinutes?.toString() || "");
      setMinimumEstimatedPrice(profile.estimatedPriceRange?.minimum?.toString() || "");
      setMaximumEstimatedPrice(profile.estimatedPriceRange?.maximum?.toString() || "");
      setOpeningHours(profile.openingHours || "");
      setDescription(profile.description || "");
      setAvailabilityStatus(profile.availabilityStatus || "offline");
      setApprovalStatus(profile.approvalStatus || "pending");
    } catch (profileError) {
      if (!profileError.message.toLowerCase().includes("not found")) {
        setError(profileError.message);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function buildPayload() {
    return {
      providerType,
      businessName: businessName.trim(),
      phone: phone.trim(),
      specializations: shopOwner ? [] : specializations,
      serviceCategories: shopOwner ? [] : specializations,
      supportedVehicleTypes: shopOwner ? [] : supportedVehicleTypes,
      location: {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: address.trim()
      },
      availabilityStatus,
      ...(shopOwner ? {} : { serviceRadiusKm: Number(serviceRadiusKm) }),
      averageResponseTimeMinutes: averageResponseTimeMinutes ? Number(averageResponseTimeMinutes) : undefined,
      estimatedPriceRange: {
        minimum: minimumEstimatedPrice ? Number(minimumEstimatedPrice) : undefined,
        maximum: maximumEstimatedPrice ? Number(maximumEstimatedPrice) : undefined
      },
      openingHours: openingHours.trim() || undefined,
      description: description.trim()
    };
  }

  function validateForm() {
    if (!businessName.trim() || !phone.trim() || !address.trim()) return "Business name, phone, and address are required.";
    if (!isValidLocation(selectedLocation)) {
      return "Please select your service location on the map or use your current location.";
    }
    if (!shopOwner && (!serviceRadiusKm || Number.isNaN(Number(serviceRadiusKm)))) return "Service radius must be a valid number.";
    if (!shopOwner && supportedVehicleTypes.length === 0) return "Select at least one supported vehicle type.";
    return "";
  }

  async function handleSave() {
    setError("");
    setMessage("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (profileId) {
        await updateProviderProfile(payload);
        if (route.params?.resubmit && approvalStatus === "rejected") {
          await resubmitProviderProfile();
          setApprovalStatus("pending");
          setMessage("Provider profile updated and resubmitted for approval.");
        } else {
          setMessage("Provider profile updated successfully.");
        }
      } else {
        const createdProfile = await createProviderProfile(payload);
        setProfileId(createdProfile._id);
        setMessage("Provider profile created successfully.");
      }
      navigation.replace(shopOwner ? "SparePartsShopDashboard" : "ProviderDashboard");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvailabilityChange(nextStatus) {
    setAvailabilityStatus(nextStatus);
    if (!profileId) return;

    try {
      await updateAvailability(nextStatus);
    } catch (availabilityError) {
      setError(availabilityError.message);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading provider profile..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer removeClippedSubviews={false}>
      <ScreenHeader eyebrow={shopOwner ? "Spare parts shop" : "Service provider"} title={shopOwner ? profileId ? "Spare Parts Shop Profile" : "Create Spare Parts Shop Profile" : profileId ? "Provider Profile" : "Create Provider Profile"} subtitle={shopOwner ? "Add the shop details drivers use to find your inventory." : "Keep service details accurate so drivers can choose with confidence."} />
      <View style={styles.profileHero}><View style={styles.profileIcon}><Ionicons name="business" size={32} color={colors.primary} /></View><Text style={styles.heroText}>{businessName || "Your service business"}</Text></View>

      <AppCard>
        <SectionHeader title="Business details" subtitle="Shown to drivers in recommendations." />
        <AppInput label="Business name" value={businessName} onChangeText={setBusinessName} />
        {!shopOwner ? <AppSelect label="Provider type" options={providerTypeOptions} value={providerType} onChange={setProviderType} /> : null}
        <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        {shopOwner ? <AppInput label="Shop description (optional)" value={description} onChangeText={setDescription} multiline /> : null}

        {!shopOwner ? <><Text style={styles.label}>Specializations</Text>
        <View style={styles.chipGrid}>
          {PROVIDER_SPECIALIZATIONS.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSpecializations((current) => toggleValue(current, item.value))}
              style={[styles.chip, specializations.includes(item.value) && styles.selectedChip]}
            >
              <Text style={[styles.chipText, specializations.includes(item.value) && styles.selectedChipText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View></> : null}

        {!shopOwner ? <><Text style={styles.label}>Supported vehicle types</Text>
        <View style={styles.chipGrid}>
          {VEHICLE_TYPES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSupportedVehicleTypes((current) => toggleValue(current, item.value))}
              style={[styles.chip, supportedVehicleTypes.includes(item.value) && styles.selectedChip]}
            >
              <Text style={[styles.chipText, supportedVehicleTypes.includes(item.value) && styles.selectedChipText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View></> : null}
      </AppCard>

      <AppCard>
        <SectionHeader title="Service Location" subtitle="Set the static location drivers use to find your service." />
        <LocationPicker
          initialLocation={selectedLocation}
          address={address}
          onLocationChange={setSelectedLocation}
          onAddressChange={setAddress}
        />
      </AppCard>

      <AppCard>
        <SectionHeader title="Service details" subtitle="Set your coverage, pricing, and availability." />
        {!shopOwner ? <AppInput label="Service radius (km)" value={serviceRadiusKm} onChangeText={setServiceRadiusKm} keyboardType="numeric" /> : null}
        {!shopOwner ? <><AppInput label="Average response time (minutes)" value={averageResponseTimeMinutes} onChangeText={setAverageResponseTimeMinutes} keyboardType="numeric" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppInput label="Min price" value={minimumEstimatedPrice} onChangeText={setMinimumEstimatedPrice} keyboardType="numeric" />
          </View>
          <View style={styles.flex}>
            <AppInput label="Max price" value={maximumEstimatedPrice} onChangeText={setMaximumEstimatedPrice} keyboardType="numeric" />
          </View>
        </View></> : null}
        <AppInput label="Opening hours (optional)" value={openingHours} onChangeText={setOpeningHours} />
        <AppSelect label="Availability" options={shopOwner ? shopAvailabilityOptions : availabilityOptions} value={availabilityStatus} onChange={handleAvailabilityChange} disabled={approvalStatus !== "approved"} />

        {message ? <InfoBanner tone="success" message={message} /> : null}
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        <AppButton title={route.params?.resubmit && approvalStatus === "rejected" ? "Save & Resubmit" : profileId ? "Save Profile" : "Create Profile"} onPress={handleSave} loading={saving} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileHero: { alignItems: "center", gap: spacing.sm }, profileIcon: { width: 72, height: 72, borderRadius: radii.lg, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" }, heroText: { ...typography.sectionTitle, color: colors.primaryDark, textAlign: "center" },
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  label: {
    color: COLORS.text,
    fontWeight: "700"
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  selectedChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  chipText: {
    color: COLORS.text
  },
  selectedChipText: {
    color: COLORS.surface,
    fontWeight: "800"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  flex: {
    flex: 1
  },
  success: {
    color: COLORS.success,
    fontWeight: "700"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
