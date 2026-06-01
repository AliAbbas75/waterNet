// Shared design tokens — mirrors the web app's tailwind theme so visuals stay consistent.

export const colors = {
  brand50: "#ecfeff",
  brand100: "#cffafe",
  brand200: "#a5f3fc",
  brand500: "#06b6d4",
  brand600: "#0891b2",
  brand700: "#0e7490",
  brand800: "#155e75",
  brand900: "#164e63",

  bg: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  safe: "#16a34a",
  safeBg: "#dcfce7",
  warn: "#d97706",
  warnBg: "#fef3c7",
  unsafe: "#dc2626",
  unsafeBg: "#fee2e2",
  info: "#0284c7",
  infoBg: "#e0f2fe",
  mutedDot: "#94a3b8",
  mutedBg: "#f1f5f9"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999
};

export const font = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
    xxl: 28
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700"
  }
};

export function statusColor(status) {
  switch (String(status || "").toUpperCase()) {
    case "SAFE":
    case "OPERATIONAL":
    case "RESOLVED":
    case "AVAILABLE":
    case "CLOSED":
      return { fg: colors.safe, bg: colors.safeBg };
    case "WARNING":
    case "WARN":
    case "MAINTENANCE":
    case "IN_PROGRESS":
    case "IN_REVIEW":
    case "ACK":
      return { fg: colors.warn, bg: colors.warnBg };
    case "UNSAFE":
    case "CRITICAL":
    case "OFFLINE":
    case "FAULTY":
    case "UNAVAILABLE":
    case "OPEN":
      return { fg: colors.unsafe, bg: colors.unsafeBg };
    case "INFO":
      return { fg: colors.info, bg: colors.infoBg };
    case "ASSIGNED":
      return { fg: colors.brand700, bg: colors.brand50 };
    default:
      return { fg: colors.textMuted, bg: colors.mutedBg };
  }
}
