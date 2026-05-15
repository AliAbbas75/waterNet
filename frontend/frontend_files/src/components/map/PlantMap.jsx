import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

// Fix the default marker icons (Vite-bundled Leaflet doesn't know the asset paths).
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

function icon(color) {
  const html = `
    <span style="display:block;height:30px;width:30px;border-radius:9999px;background:white;border:2px solid ${color};box-shadow:0 4px 12px rgba(15,23,42,0.25);position:relative;">
      <span style="position:absolute;inset:5px;border-radius:9999px;background:${color};"></span>
    </span>`;
  return L.divIcon({
    html,
    className: "waternet-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -12]
  });
}

const COLORS = {
  SAFE: "#10b981",
  WARNING: "#f59e0b",
  UNSAFE: "#ef4444",
  NO_DATA: "#64748b"
};

export function PlantMap({ plants, center = [33.6844, 73.0479], zoom = 11, onSelect, height = 360 }) {
  const items = useMemo(
    () =>
      (plants || []).map((p) => ({
        ...p,
        color: COLORS[p.overall || "NO_DATA"] || COLORS.NO_DATA
      })),
    [plants]
  );

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-card" style={{ height }}>
      <MapContainer center={center} zoom={zoom} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds plants={items} fallbackCenter={center} fallbackZoom={zoom} />
        {items.map((p) => (
          <Marker
            key={p.plant?._id || p._id}
            position={[p.plant?.geo?.lat ?? p.geo?.lat, p.plant?.geo?.lng ?? p.geo?.lng]}
            icon={icon(p.color)}
            eventHandlers={onSelect ? { click: () => onSelect(p) } : undefined}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">{p.plant?.name || p.name}</div>
                <div className="text-slate-500">{p.plant?.address || p.address}</div>
                <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: p.color }}>
                  {p.overall || "NO DATA"}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function FitBounds({ plants, fallbackCenter, fallbackZoom }) {
  const map = useMap();
  useEffect(() => {
    if (!plants.length) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }
    const bounds = L.latLngBounds(
      plants.map((p) => [p.plant?.geo?.lat ?? p.geo?.lat, p.plant?.geo?.lng ?? p.geo?.lng])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [plants, map, fallbackCenter, fallbackZoom]);
  return null;
}
