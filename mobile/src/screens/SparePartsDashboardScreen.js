import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import AppButton from "../components/AppButton";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F6F8EF", card: "#FFFFFF", primary: "#657A2E", text: "#35421C",
  muted: "#75805C", border: "#DFE5CE", danger: "#C73E3E",
};

export default function SparePartsDashboardScreen({ navigation }) {
  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Spare parts shop" subtitle="Inventory management will be expanded in a later milestone." colors={SCREEN_COLORS} />
      <AppButton title="Open nearby shop finder" onPress={() => navigation.navigate("SparePartsFinder")} colors={SCREEN_COLORS} />
      <AppButton title="My profile" variant="secondary" onPress={() => navigation.navigate("Profile")} colors={SCREEN_COLORS} />
    </Screen>
  );
}
