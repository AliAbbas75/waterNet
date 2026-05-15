import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Map as MapIcon, MapPin, Navigation } from "lucide-react";
import clsx from "clsx";
import { useNearbyPlants } from "../../hooks/usePublic.js";
import { Card } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PlantMap } from "../../components/map/PlantMap.jsx";
import { Button } from "../../components/ui/Button.jsx";

const ISLAMABAD_CENTER = { lat: 33.6844, lng: 73.0479 };

export default function NearbyPage() {
  const [coords, setCoords] = useState(ISLAMABAD_CENTER);
  const [usingMyLocation, setUsingMyLocation] = useState(false);
  const [view, setView] = useState("map"); // 'map' | 'list'

  // Try geolocation once on mount.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUsingMyLocation(true);
      },
      () => {
        /* fall back to Islamabad center */
      },
      { enableHighAccuracy: false, timeout: 4000 }
    );
  }, []);

  const { data: plants, isLoading } = useNearbyPlants({ ...coords, radius: 100 });

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-screen-md mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Nearby water plants</h1>
          <p className="text-sm text-slate-500 mt-1">
            {usingMyLocation
              ? "Plants closest to your location, with live water quality status."
              : "Showing Islamabad. Allow location access for personalised results."}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-white border border-slate-200 p-1 shadow-card">
          <ViewToggle active={view === "map"} onClick={() => setView("map")} icon={MapIcon} label="Map" />
          <ViewToggle active={view === "list"} onClick={() => setView("list")} icon={LayoutGrid} label="List" />
        </div>
      </div>

      {!usingMyLocation && "geolocation" in navigator ? (
        <div className="mb-4">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Navigation size={14} />}
            onClick={() =>
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setUsingMyLocation(true);
                },
                () => {}
              )
            }
          >
            Use my location
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Finding plants near you…" />
        </div>
      ) : !plants?.length ? (
        <EmptyState
          icon={MapPin}
          title="No plants nearby"
          description="No registered filter plants within range. Try expanding the search radius or contact your housing society."
        />
      ) : view === "map" ? (
        <>
          <PlantMap plants={plants} center={[coords.lat, coords.lng]} height={420} />
          <p className="text-xs text-slate-500 mt-2 text-center">
            {plants.length} plants shown. Tap a marker for details.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plants.slice(0, 6).map((p) => (
              <PlantCard key={p.plant._id} item={p} />
            ))}
          </div>
        </>
      ) : (
        <ul className="space-y-3">
          {plants.map((p) => (
            <li key={p.plant._id}>
              <PlantCard item={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewToggle({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-700"
      )}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function PlantCard({ item }) {
  const overall = item.overall || "NO_DATA";
  return (
    <Link
      to={`/app/plants/${item.plant._id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-card hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{item.plant.name}</h3>
          <p className="text-xs text-slate-500 truncate inline-flex items-center gap-1">
            <MapPin size={12} />
            {item.plant.address}
          </p>
        </div>
        <Badge variant={statusVariant(overall)} dot>
          {overall === "NO_DATA" ? "No data" : overall}
        </Badge>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span>
          {item.available ? (
            <span className="text-emerald-700 font-medium">Water flowing</span>
          ) : (
            <span className="text-red-700 font-medium">Currently offline</span>
          )}
        </span>
        {Number.isFinite(item.distanceKm) ? (
          <>
            <span>•</span>
            <span>{item.distanceKm.toFixed(1)} km away</span>
          </>
        ) : null}
        {item.plant.operatingHours ? (
          <>
            <span>•</span>
            <span>{item.plant.operatingHours}</span>
          </>
        ) : null}
      </div>
    </Link>
  );
}
