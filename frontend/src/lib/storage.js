// Thin async storage abstraction. On web we wrap localStorage; the same
// surface translates 1:1 to React Native's AsyncStorage so screens that
// import from here can be ported without changes.

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const storage = {
  async getItem(key) {
    if (!isBrowser) return null;
    return window.localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (!isBrowser) return;
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (!isBrowser) return;
    window.localStorage.removeItem(key);
  }
};

// Synchronous variants for places where async would be awkward (auth bootstrap).
export const syncStorage = {
  getItem(key) {
    return isBrowser ? window.localStorage.getItem(key) : null;
  },
  setItem(key, value) {
    if (!isBrowser) return;
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (!isBrowser) return;
    window.localStorage.removeItem(key);
  }
};
