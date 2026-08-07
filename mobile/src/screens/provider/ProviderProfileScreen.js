import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import {
  createProviderProfile,
  getMyProviderProfile,
  updateAvailability,
  updateProviderProfile
} from "../../services/providerService";
import {
  COLORS,
  PROVIDER_ROLES,
  PROVIDER_SPECIALIZATIONS,
  VEHICLE_TYPES
} from "../../utils/constants";

const providerTypeOptions = PROVIDER_ROLES.map((role) => ({
  label: role.replaceAll("_", " "),
  value: role
}));

const availabilityOptions = [
  { label: "Online", value: "available" },
  { label: "Busy", value: "busy" },
  { label: "Offline", value: "offline" }
];

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function ProviderProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [providerType, setProviderType] = useState(user?.role || "mechanic");
  const [phone, setPhone] = useState(user?.phone || "");
  const [specializations, setSpecializations] = useState([]);
  const [supportedVehicleTypes, setSupportedVehicleTypes] = useState(["car"]);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [serviceRadiusKm, setServiceRadiusKm] = useState("");
  const [averageResponseTimeMinutes, setAverageResponseTimeMinutes] = useState("");
  const [minimumEstimatedPrice, setMinimumEstimatedPrice] = useState("");
  const [maximumEstimatedPrice, setMaximumEstimatedPrice] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("offline");
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
      setLatitude(profile.location?.latitude?.toString() || "");
      setLongitude(profile.location?.longitude?.toString() || "");
      setServiceRadiusKm(profile.serviceRadiusKm?.toString() || "");
      setAverageResponseTimeMinutes(profile.averageResponseTimeMinutes?.toString() || "");
      setMinimumEstimatedPrice(profile.estimatedPriceRange?.minimum?.toString() || "");
      setMaximumEstimatedPrice(profile.estimatedPriceRange?.maximum?.toString() || "");
      setOpeningHours(profile.openingHours || "");
      setAvailabilityStatus(profile.availabilityStatus || "offline");
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
      specializations,
      supportedVehicleTypes,
      location: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address.trim()
      },
      availabilityStatus,
      serviceRadiusKm: Number(serviceRadiusKm),
      averageResponseTimeMinutes: averageResponseTimeMinutes ? Number(averageResponseTimeMinutes) : undefined,
      estimatedPriceRange: {
        minimum: minimumEstimatedPrice ? Number(minimumEstimatedPrice) : undefined,
        maximum: maximumEstimatedPrice ? Number(maximumEstimatedPrice) : undefined
      },
      openingHours: openingHours.trim() || undefined
    };
  }

  function validateForm() {
    if (!businessName.trim() || !phone.trim() || !address.trim()) return "Business name, phone, and address are required.";
    if (!latitude || Number.isNaN(Number(latitude))) return "Latitude must be a valid number.";
    if (!longitude || Number.isNaN(Number(longitude))) return "Longitude must be a valid number.";
    if (!serviceRadiusKm || Number.isNaN(Number(serviceRadiusKm))) return "Service radius must be a valid number.";
    if (supportedVehicleTypes.length === 0) return "Select at least one supported vehicle type.";
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
        setMessage("Provider profile updated successfully.");
      } else {
        const createdProfile = await createProviderProfile(payload);
        setProfileId(createdProfile._id);
        setMessage("Provider profile created successfully.");
      }
      navigation.replace("ProviderDashboard");
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
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>{profileId ? "Provider Profile" : "Create Provider Profile"}</Text>

      <AppCard>
        <AppInput label="Business name" value={businessName} onChangeText={setBusinessName} />
        <AppSelect label="Provider type" options={providerTypeOptions} value={providerType} onChange={setProviderType} />
        <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>Specializations</Text>
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
        </View>

        <Text style={styles.label}>Supported vehicle types</Text>
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
        </View>

        <AppInput label="Address" value={address} onChangeText={setAddress} multiline />
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppInput label="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
          </View>
          <View style={styles.flex}>
            <AppInput label="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
          </View>
        </View>
        <AppInput label="Service radius (km)" value={serviceRadiusKm} onChangeText={setServiceRadiusKm} keyboardType="numeric" />
        <AppInput label="Average response time (minutes)" value={averageResponseTimeMinutes} onChangeText={setAverageResponseTimeMinutes} keyboardType="numeric" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppInput label="Min price" value={minimumEstimatedPrice} onChangeText={setMinimumEstimatedPrice} keyboardType="numeric" />
          </View>
          <View style={styles.flex}>
            <AppInput label="Max price" value={maximumEstimatedPrice} onChangeText={setMaximumEstimatedPrice} keyboardType="numeric" />
          </View>
        </View>
        <AppInput label="Opening hours (optional)" value={openingHours} onChangeText={setOpeningHours} />
        <AppSelect label="Availability" options={availabilityOptions} value={availabilityStatus} onChange={handleAvailabilityChange} />

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title={profileId ? "Save Profile" : "Create Profile"} onPress={handleSave} loading={saving} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
