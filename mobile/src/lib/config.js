import Constants from "expo-constants";
import { Platform } from "react-native";

// Resolve the backend URL.
//   1. EXPO_PUBLIC_BACKEND_URL env var wins if set.
//   2. Otherwise: localhost for iOS sim + web, 10.0.2.2 for Android emulator,
//      and the Metro host LAN IP for physical devices opening Expo Go.
function detectBackendUrl() {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) return process.env.EXPO_PUBLIC_BACKEND_URL;

  // Metro reports its host (LAN IP or localhost) in expoConfig.hostUri.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;
  const host = hostUri ? String(hostUri).split(":")[0] : null;

  if (Platform.OS === "android" && (!host || host === "127.0.0.1" || host === "localhost")) {
    return "http://10.0.2.2:4000";
  }
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:4000`;
  }
  return "http://localhost:4000";
}

export const BACKEND_URL = detectBackendUrl().replace(/\/$/, "");
