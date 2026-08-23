import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Laptop, AlertCircle, Send } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { Card, CardHeader } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Badge } from "../components/ui/Badge.jsx";
import {
  useNotificationConfig,
  useNotificationDevices,
  useSendTestNotification,
  useUpdateNotificationPreferences
} from "../hooks/useNotifications.js";
import {
  currentSubscription,
  disablePush,
  enablePush,
  permissionState,
  pushSupported
} from "../lib/push.js";
import { relTime } from "../lib/format.js";

function browserLabel(userAgent) {
  if (!userAgent) return "Unknown device";
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Browser";
}

export default function NotificationsPage() {
  const config = useNotificationConfig();
  const devices = useNotificationDevices();
  const savePrefs = useUpdateNotificationPreferences();
  const sendTest = useSendTestNotification();

  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supported = pushSupported();
  const permission = permissionState();

  useEffect(() => {
    let cancelled = false;
    currentSubscription()
      .then((sub) => {
        if (!cancelled) setSubscribed(!!sub);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleDevice() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        setNotice("This device will no longer receive push notifications.");
      } else {
        await enablePush(config.data?.vapidPublicKey);
        setSubscribed(true);
        setNotice("This device is registered for push notifications.");
      }
      devices.refetch();
    } catch (err) {
      setError(err.message || "Could not change push registration.");
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setError("");
    setNotice("");
    try {
      await sendTest.mutateAsync();
      setNotice("Test notification sent — it should appear shortly.");
    } catch (err) {
      setError(err.message || "Could not send a test notification.");
    }
  }

  function toggle(categoryKey, channel, value) {
    setError("");
    savePrefs.mutate(
      { [categoryKey]: { [channel]: value } },
      { onError: (err) => setError(err.message || "Could not save that preference.") }
    );
  }

  if (config.isLoading) {
    return (
      <div className="py-12 grid place-items-center">
        <Spinner label="Loading notification settings…" />
      </div>
    );
  }

  if (config.isError) {
    return <EmptyState icon={AlertCircle} title="Could not load notification settings." />;
  }

  const { categories = [], preferences = {}, pushEnabled } = config.data || {};

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Choose what WaterNet tells you, and where it reaches you."
        action={<Bell size={20} className="text-slate-400" />}
      />

      <Card className="mb-4">
        <CardHeader
          title="This device"
          subtitle={
            !supported
              ? "This browser cannot receive push notifications."
              : subscribed
              ? "Registered for push notifications."
              : "Not registered yet."
          }
          action={
            subscribed ? (
              <Badge variant="safe" dot>
                On
              </Badge>
            ) : (
              <Badge variant="muted" dot>
                Off
              </Badge>
            )
          }
        />

        {!pushEnabled ? (
          <p className="text-sm text-amber-700 mb-3">
            Push is not configured on the server, so only email can be delivered. Preferences
            below are still saved.
          </p>
        ) : null}

        {permission === "denied" ? (
          <p className="text-sm text-red-600 mb-3">
            Notifications are blocked for this site in your browser. Allow them in the site
            settings before turning this on.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={toggleDevice}
            loading={busy}
            disabled={busy || !supported || !pushEnabled || permission === "denied"}
            variant={subscribed ? "secondary" : "primary"}
            leftIcon={subscribed ? <BellOff size={15} /> : <Bell size={15} />}
          >
            {subscribed ? "Turn off on this device" : "Turn on for this device"}
          </Button>
          {subscribed ? (
            <Button
              variant="secondary"
              onClick={onTest}
              loading={sendTest.isPending}
              disabled={sendTest.isPending}
              leftIcon={<Send size={15} />}
            >
              Send test
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs text-red-600 mt-3 flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-xs text-emerald-700 mt-3 flex items-center gap-1.5">
            <Check size={13} /> {notice}
          </p>
        ) : null}
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="What you receive"
          subtitle="Only the categories your role can be told about are listed."
        />

        {!categories.length ? (
          <EmptyState title="Nothing to configure for this role." />
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem] gap-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span>Category</span>
              <span className="text-center">Push</span>
              <span className="text-center">Email</span>
            </div>
            {categories.map((cat) => {
              const pref = preferences[cat.key] || cat.defaults;
              return (
                <div
                  key={cat.key}
                  className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{cat.label}</p>
                    <p className="text-xs text-slate-500">{cat.description}</p>
                  </div>
                  {["push", "email"].map((channel) => (
                    <label key={channel} className="grid place-items-center">
                      <input
                        type="checkbox"
                        checked={Boolean(pref[channel])}
                        disabled={savePrefs.isPending}
                        onChange={(e) => toggle(cat.key, channel, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                        aria-label={`${cat.label} via ${channel}`}
                      />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Push reaches every device you have registered. Turning a category off stops it
          everywhere.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Registered devices"
          subtitle={devices.data ? `${devices.data.length} registered` : "Loading…"}
        />
        {devices.isLoading ? (
          <Spinner />
        ) : !devices.data?.length ? (
          <EmptyState icon={Laptop} title="No devices registered yet." />
        ) : (
          <ul className="space-y-2">
            {devices.data.map((d) => (
              <li
                key={d.endpoint}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{browserLabel(d.userAgent)}</p>
                  <p className="text-xs text-slate-500">
                    Added {relTime(d.createdAt)}
                    {d.lastUsedAt ? ` · last used ${relTime(d.lastUsedAt)}` : " · not used yet"}
                  </p>
                </div>
                <Laptop size={16} className="text-slate-400 shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
