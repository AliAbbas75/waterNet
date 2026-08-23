import { useMemo, useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  BellRing,
  ClipboardList,
  Cpu,
  Building2,
  Server,
  Search,
  ScrollText
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { useAuditLogs, useAuditSummary } from "../../hooks/useAudit.js";
import { fmtDate, relTime } from "../../lib/format.js";

// Each category gets its own icon and accent so a section is recognisable
// before its heading is read.
const CATEGORY_META = {
  auth: { icon: KeyRound, tone: "text-sky-600 bg-sky-50 ring-sky-100" },
  access: { icon: ShieldCheck, tone: "text-violet-600 bg-violet-50 ring-violet-100" },
  alerts: { icon: BellRing, tone: "text-amber-600 bg-amber-50 ring-amber-100" },
  tickets: { icon: ClipboardList, tone: "text-brand-600 bg-brand-50 ring-brand-100" },
  devices: { icon: Cpu, tone: "text-teal-600 bg-teal-50 ring-teal-100" },
  plants: { icon: Building2, tone: "text-emerald-600 bg-emerald-50 ring-emerald-100" },
  system: { icon: Server, tone: "text-slate-600 bg-slate-100 ring-slate-200" }
};

// Plain-English names. The raw event key stays visible on the card so the log
// is still greppable against the code that writes it.
const EVENT_LABEL = {
  "auth.otp.sent": "Login code sent",
  "auth.otp.verified": "Login code verified",
  "auth.challenge.issued": "Wallet challenge issued",
  "auth.login.success": "Signed in",
  "auth.register": "Account registered",
  "admin.user.register": "User created by an admin",
  "admin.user.role_updated": "Role changed",
  "admin.user.active_updated": "Account activated or suspended",
  "admin.invite.create": "Invite sent",
  "admin.invite.accept": "Invite accepted",
  "alert.raised": "Alert raised by the system",
  "alert.acknowledged": "Alert acknowledged — work order opened",
  "alert.dispatched": "Alert assigned to a person",
  "alert.resolved_by_ticket": "Alert resolved — work order completed",
  "alert.resolved": "Alert closed by hand, without dispatch",
  "alert.auto_resolved": "Alert auto-cleared — condition stopped",
  "alert.cleared_pending_review": "Condition cleared — awaiting review",
  "alert.reopened": "Alert reopened — condition returned",
  "ticket.opened": "Work order opened",
  "ticket.triaged": "Work order assigned",
  "ticket.reassigned": "Work order reassigned",
  "ticket.cancelled": "Work order cancelled",
  "ticket.started": "Work started",
  "ticket.blocked": "Work held up",
  "ticket.unblocked": "Work resumed",
  "ticket.checklist_item_completed": "Checklist step completed",
  "ticket.checklist_item_reopened": "Checklist step reopened",
  "device.flagged_faulty": "Device flagged faulty",
  "device.stability_restored": "Device stability restored",
  "plant.status_changed": "Plant status changed",
  "plant.closed_by_ticket": "Plant closed by work order",
  "plant.advisory_raised": "Water advisory raised",
  "plant.advisory_lifted": "Water advisory lifted"
};

// Fields worth reading at a glance; anything else stays in the raw details.
const META_LABEL = {
  note: "Note",
  reason: "Reason",
  from: "From",
  to: "To",
  severity: "Severity",
  type: "Type",
  deviceId: "Device",
  plantName: "Plant",
  label: "Step",
  role: "Role",
  assignedTo: "Assigned to",
  ownerRole: "Owned by",
  waitedMinutes: "Waited (min)",
  flips: "Flips",
  previousStatus: "Was"
};

export default function AuditLogPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const summary = useAuditSummary();
  const logs = useAuditLogs(useMemo(() => ({ category, limit: 200 }), [category]));

  const filtered = useMemo(() => {
    const rows = logs.data || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((l) => {
      const actor = l.actorUserId?.display_name || l.actorUserId?.email || "system";
      const label = EVENT_LABEL[l.event] || l.event;
      return (
        label.toLowerCase().includes(q) ||
        l.event.toLowerCase().includes(q) ||
        actor.toLowerCase().includes(q) ||
        JSON.stringify(l.meta || {}).toLowerCase().includes(q)
      );
    });
  }, [logs.data, search]);

  // Group into day headings — an audit log is read as "what happened when".
  const byDay = useMemo(() => {
    const groups = new Map();
    for (const l of filtered) {
      const key = fmtDate(l.createdAt, "PP");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l);
    }
    return [...groups.entries()];
  }, [filtered]);

  const tabs = [
    { key: "all", label: "Everything", count: summary.data?.total ?? null },
    ...(summary.data?.categories || [])
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="A read-only record of everything the system and its people have done. Entries cannot be edited or deleted."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {tabs.map((t) => {
            const active = category === t.key;
            const Icon = CATEGORY_META[t.key]?.icon || ScrollText;
            return (
              <button
                key={t.key}
                onClick={() => setCategory(t.key)}
                aria-pressed={active}
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors " +
                  (active
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")
                }
              >
                <Icon size={14} />
                {t.label}
                {t.count != null ? (
                  <span className={active ? "text-brand-100" : "text-slate-400"}>{t.count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <Input
          placeholder="Search by action, person, device, plant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
        />
      </Card>

      {logs.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading audit log…" />
        </div>
      ) : !filtered.length ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded here yet"
            description={
              search
                ? "No entries match that search."
                : "Actions in this category will appear as they happen."
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, entries]) => (
            <section key={day}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-semibold text-slate-900">{day}</h2>
                <span className="text-xs text-slate-500">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {entries.map((l) => (
                  <LogCard key={l._id} log={l} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function LogCard({ log }) {
  const meta = CATEGORY_META[log.category] || CATEGORY_META.system;
  const Icon = meta.icon;
  const label = EVENT_LABEL[log.event] || log.event;
  const actor = log.actorUserId;
  const actorName = actor?.display_name || actor?.email || null;

  const details = Object.entries(log.meta || {})
    .filter(([k, v]) => META_LABEL[k] && v !== null && v !== undefined && v !== "")
    .slice(0, 4);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className={`grid place-items-center h-9 w-9 rounded-lg ring-1 shrink-0 ${meta.tone}`}>
          <Icon size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">{label}</p>
            <span
              className="text-xs text-slate-400 shrink-0"
              title={fmtDate(log.createdAt, "PP HH:mm:ss")}
            >
              {relTime(log.createdAt)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {actorName ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <Avatar name={actorName} size={18} />
                {actorName}
                {actor?.role ? <span className="text-slate-400">· {actor.role}</span> : null}
              </span>
            ) : (
              <Badge variant="muted">System</Badge>
            )}
            {log.targetType ? (
              <span className="text-xs text-slate-400">on {log.targetType.toLowerCase()}</span>
            ) : null}
          </div>

          {details.length ? (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {details.map(([k, v]) => (
                <div key={k} className="min-w-0 text-xs">
                  <dt className="text-slate-400">{META_LABEL[k]}</dt>
                  <dd className="text-slate-700 break-words">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <p className="mt-2 font-mono text-[11px] text-slate-400">{log.event}</p>
        </div>
      </div>
    </div>
  );
}
