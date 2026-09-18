import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// Refresh immediately on focus/resume and every ten seconds while visible.
export default function useRequestPolling(loadRequest, enabled) {
  useFocusEffect(useCallback(() => {
    let active = true;
    let timer;
    let running = false;
    async function refresh() {
      clearTimeout(timer);
      if (!active || running || (AppState.currentState && AppState.currentState !== "active")) return;
      running = true;
      try { await loadRequest(() => active); }
      finally {
        running = false;
        if (active && enabled) timer = setTimeout(refresh, 10000);
      }
    }
    refresh();
    const listener = AppState.addEventListener("change", (state) => {
      clearTimeout(timer);
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      listener.remove();
    };
  }, [loadRequest, enabled]));
}
