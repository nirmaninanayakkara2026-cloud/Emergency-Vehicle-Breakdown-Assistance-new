import { Picker } from "@react-native-picker/picker";
import { StyleSheet, Text, View } from "react-native";

import { defaultColors } from "../utils/colors";

export default function FormPicker({ label, options, colors = defaultColors, ...props }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.wrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Picker
          dropdownIconColor={colors.primary}
          itemStyle={[styles.item, { color: colors.text }]}
          mode="dropdown"
          style={[styles.picker, { color: colors.text }]}
          {...props}
        >
          {options.map((option) => (
            <Picker.Item
              color={colors.text}
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  item: { fontSize: 16 },
  picker: { height: 52, width: "100%" },
  wrapper: { borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 52 },
});
