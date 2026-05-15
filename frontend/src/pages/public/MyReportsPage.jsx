import { Link } from "react-router-dom";
import { FileText, MessageSquarePlus } from "lucide-react";
import { Card } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { useMyReports } from "../../hooks/usePublic.js";
import { fmtDate, relTime } from "../../lib/format.js";

const CATEGORY_LABEL = {
  QUALITY: "Quality",
  AVAILABILITY: "Availability",
  DEVICE: "Device",
  OTHER: "Other"
};

export default function MyReportsPage() {
  const reports = useMyReports();

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-screen-md mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">My reports</h1>
          <p className="text-sm text-slate-500 mt-1">Issues you've submitted to the operations team.</p>
        </div>
        <Link to="/app/report">
          <Button leftIcon={<MessageSquarePlus size={16} />}>New report</Button>
        </Link>
      </div>

      {reports.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner />
        </div>
      ) : !reports.data?.length ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="When you submit an issue, it'll appear here so you can track progress."
          action={
            <Link to="/app/report">
              <Button leftIcon={<MessageSquarePlus size={16} />}>Submit a report</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {reports.data.map((r) => (
            <li key={r._id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="info">{CATEGORY_LABEL[r.category] || r.category}</Badge>
                      <Badge variant={statusVariant(r.status)} dot>
                        {r.status.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-slate-500">{relTime(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{r.description}</p>
                    {r.plantId?.name ? (
                      <p className="text-xs text-slate-500 mt-1">Plant: {r.plantId.name}</p>
                    ) : null}
                  </div>
                </div>
                {r.resolutionNote ? (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
                      Response from operations
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.resolutionNote}</p>
                    {r.reviewedAt ? (
                      <p className="text-xs text-slate-400 mt-1">
                        Reviewed {fmtDate(r.reviewedAt, "PP HH:mm")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
