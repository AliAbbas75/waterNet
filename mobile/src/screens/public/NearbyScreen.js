import { useEffect, useState } from "react";
import {
  Alert as RNAlert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import Badge from "../../components/Badge.js";
import Button from "../../components/Button.js";
import EmptyState from "../../components/EmptyState.js";
import Spinner from "../../components/Spinner.js";
import { useNearbyPlants } from "../../hooks/usePublic.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";

const ISLAMABAD = { lat: 33.6844, lng: 73.0479 };

export default function NearbyScreen() {
  const [coords, setCoords] = useState(ISLAMABAD);
  const [usingMyLocation, setUsingMyLocation] = useState(false);
  const navigation = useNavigation();
  const plants = useNearbyPlants({ ...coords, radius: 100 });

  useEffect(() => {
    requestLocation(true);
  }, []);

  async function requestLocation(silentOnDeny) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      if (!silentOnDeny) {
        RNAlert.alert("Location off", "We'll show Islamabad-wide results instead.");
      }
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setUsingMyLocation(true);
    } catch {
      /* ignore */
    }
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <FlatList
        data={plants.data || []}
        keyExtractor={(p) => p.plant._id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.title}>Nearby water plants</Text>
            <Text style={styles.subtitle}>
              {usingMyLocation
                ? "Plants closest to you, with live water quality status."
                : "Showing Islamabad. Allow location access to personalise."}
            </Text>
            {!usingMyLocation ? (
              <View style={{ marginTop: spacing.md, alignSelf: "flex-start" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => requestLocation(false)}
                  leftIcon={<Ionicons name="locate" size={14} color={colors.text} />}
                >
                  Use my location
                </Button>
              </View>
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={plants.isFetching && !plants.isLoading}
            onRefresh={plants.refetch}
          />
        }
        ListEmptyComponent={
          plants.isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
              <Spinner label="Finding plants…" />
            </View>
          ) : (
            <EmptyState
              icon="📍"
              title="No plants nearby"
              description="Try widening the search by enabling location, or check back later."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("PlantDetail", { id: item.plant._id })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.plantName} numberOfLines={1}>
                  {item.plant.name}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.plant.address}
                  </Text>
                </View>
              </View>
              <Badge status={item.overall === "NO_DATA" ? "INFO" : item.overall}>
                {item.overall === "NO_DATA" ? "NO DATA" : item.overall}
              </Badge>
            </View>
            <View style={styles.cardFoot}>
              <Text style={[styles.flowText, { color: item.available ? colors.safe : colors.unsafe }]}>
                {item.available ? "Water flowing" : "Currently offline"}
              </Text>
              {Number.isFinite(item.distanceKm) ? (
                <Text style={styles.metaText}>{item.distanceKm.toFixed(1)} km away</Text>
              ) : null}
              {item.plant.operatingHours ? (
                <Text style={styles.metaText}>{item.plant.operatingHours}</Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.sizes.xl, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  cardHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  plantName: { fontSize: font.sizes.md, fontWeight: "600", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { fontSize: font.sizes.xs, color: colors.textMuted },
  cardFoot: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md
  },
  flowText: { fontSize: font.sizes.xs, fontWeight: "600" }
});
