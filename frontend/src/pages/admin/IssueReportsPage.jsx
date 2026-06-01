import { useMemo, useState } from "react";
import { MessagesSquare, Search } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input, Select, Field, Textarea } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { useAdminReports, useUpdateReport } from "../../hooks/usePublic.js";
import { relTime, fmtDate } from "../../lib/format.js";

export default function IssueReportsPage() {
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({ status, category }), [status, category]);
  const reports = useAdminReports(filters);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    if (!reports.data) return [];
    if (!search) return reports.data;
    const q = search.toLowerCase();
    return reports.data.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.plantId?.name?.toLowerCase().includes(q) ||
        r.submittedByUserId?.email?.toLowerCase().includes(q)
    );
  }, [reports.data, search]);

  const columns = [
    {
      key: "category",
      header: "Type",
      render: (r) => <Badge variant="info">{r.category}</Badge>
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm text-slate-800 truncate">{r.description}</p>
          <p className="text-xs text-slate-500 truncate">
            {r.plantId?.name || r.locationText || "—"}
          </p>
        </div>
      )
    },
    {
      key: "submitter",
      header: "Submitted by",
      render: (r) => (
        <span className="text-sm text-slate-700">
          {r.submittedByUserId?.display_name || r.submittedByUserId?.email || "Anonymous"}
        </span>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={statusVariant(r.status)} dot>
          {r.status.replace("_", " ")}
        </Badge>
      )
    },
    {
      key: "when",
      header: "Submitted",
      render: (r) => <span className="text-sm text-slate-500">{relTime(r.createdAt)}</span>
    },
    {
      key: "actions",
      header: "",
      cellClassName: "text-right",
      render: (r) => (
        <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
          Review
        </Button>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Citizen Reports"
        description="Issue reports submitted by the public — quality complaints, availability, device issues."
        action={<MessagesSquare size={20} className="text-slate-400" />}
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="CLOSED">Closed</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="QUALITY">Quality</option>
            <option value="AVAILABILITY">Availability</option>
            <option value="DEVICE">Device</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>
      </Card>

      {reports.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading reports…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          empty={<EmptyState icon={MessagesSquare} title="No reports yet" />}
        />
      )}

      <ReviewModal report={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function ReviewModal({ report, onClose }) {
  const update = useUpdateReport();
  const [status, setStatus] = useState(report?.status || "OPEN");
  const [note, setNote] = useState(report?.resolutionNote || "");
  useMemo(() => {
    if (report) {
      setStatus(report.status);
      setNote(report.resolutionNote || "");
    }
  }, [report]);
  if (!report) return null;
  return (
    <Modal
      open={!!report}
      onClose={onClose}
      title="Review report"
      subtitle={`${report.category} • ${fmtDate(report.createdAt, "PP HH:mm")}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await update.mutateAsync({ id: report._id, status, resolutionNote: note || null });
              onClose();
            }}
            loading={update.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.description}</p>
          <p className="text-xs text-slate-500 mt-2">
            {report.plantId?.name ? `Plant: ${report.plantId.name}` : null}
            {report.locationText ? ` Location: ${report.locationText}` : null}
            {report.contact ? ` • Contact: ${report.contact}` : null}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Submitted by {report.submittedByUserId?.display_name || report.submittedByUserId?.email || "anonymous"}
          </p>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </Field>
        <Field label="Resolution note">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done about this report?"
          />
        </Field>
      </div>
    </Modal>
  );
}
