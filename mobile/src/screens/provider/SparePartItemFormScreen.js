import React, { useEffect, useState } from "react";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { createSparePart, getSparePart, updateSparePart } from "../../services/sparePartService";
import { SPARE_PART_CATEGORIES } from "../../utils/constants";

export default function SparePartItemFormScreen({ navigation, route }) {
  const itemId = route.params?.itemId; const [loading, setLoading] = useState(Boolean(itemId)); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", category: "Battery", brand: "", partNumber: "", compatibleVehicles: "", price: "", quantity: "0", description: "", isAvailable: true });
  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  useEffect(() => { if (!itemId) return; getSparePart(itemId).then(({ item }) => setForm({ name: item.name || "", category: item.category || "Other", brand: item.brand || "", partNumber: item.partNumber || "", compatibleVehicles: (item.compatibleVehicles || []).join(", "), price: item.price?.toString() || "", quantity: item.quantity?.toString() || "0", description: item.description || "", isAvailable: item.isAvailable !== false })).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [itemId]);
  async function save() { setError(""); if (!form.name.trim()) return setError("Part name is required."); const quantity = Number(form.quantity); if (!Number.isInteger(quantity) || quantity < 0) return setError("Quantity must be a non-negative whole number."); const price = form.price === "" ? null : Number(form.price); if (price !== null && (!Number.isFinite(price) || price < 0)) return setError("Price must be a non-negative number."); setSaving(true); try { const payload = { ...form, name: form.name.trim(), brand: form.brand.trim(), partNumber: form.partNumber.trim(), compatibleVehicles: form.compatibleVehicles.split(",").map((value) => value.trim()).filter(Boolean), price, quantity, description: form.description.trim() }; if (itemId) await updateSparePart(itemId, payload); else await createSparePart(payload); navigation.goBack(); } catch (e) { setError(e.message); } finally { setSaving(false); } }
  if (loading) return <ScreenContainer><LoadingState message="Loading spare part..." /></ScreenContainer>;
  return <ScreenContainer keyboard><ScreenHeader eyebrow="Inventory item" title={itemId ? "Edit Spare Part" : "Add Spare Part"} subtitle="Use accurate details so drivers can find the correct part." /><AppCard>
    <AppInput label="Part name" value={form.name} onChangeText={(v) => change("name", v)} placeholder="Example: 12V car battery" />
    <AppSelect label="Category" options={SPARE_PART_CATEGORIES} value={form.category} onChange={(v) => change("category", v)} />
    <AppInput label="Brand (optional)" value={form.brand} onChangeText={(v) => change("brand", v)} />
    <AppInput label="Part number (optional)" value={form.partNumber} onChangeText={(v) => change("partNumber", v)} />
    <AppInput label="Compatible vehicles (comma separated)" value={form.compatibleVehicles} onChangeText={(v) => change("compatibleVehicles", v)} placeholder="Toyota Aqua, Honda Fit" />
    <AppInput label="Price (optional)" value={form.price} onChangeText={(v) => change("price", v)} keyboardType="decimal-pad" />
    <AppInput label="Quantity" value={form.quantity} onChangeText={(v) => change("quantity", v)} keyboardType="number-pad" />
    <AppInput label="Description (optional)" value={form.description} onChangeText={(v) => change("description", v)} multiline />
    <AppSelect label="Listing status" options={[{ label: "Available", value: true }, { label: "Hidden", value: false }]} value={form.isAvailable} onChange={(v) => change("isAvailable", v)} />
    {error ? <InfoBanner tone="danger" message={error} /> : null}<AppButton title={itemId ? "Save Changes" : "Add Spare Part"} loading={saving} onPress={save} />
  </AppCard></ScreenContainer>;
}
