import AsyncStorage from "@react-native-async-storage/async-storage";

// Wrapper so token store and any other persistence use one surface.
// Same shape as the web app's lib/storage.js for portability.
export const storage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    if (value === null || value === undefined) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  }
};
