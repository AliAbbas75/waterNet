import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, MessageSquarePlus, Send } from "lucide-react";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Field, Input, Select, Textarea } from "../../components/ui/Input.jsx";
import { usePlants } from "../../hooks/usePlants.js";
import { useSubmitReport } from "../../hooks/usePublic.js";

export default function ReportFormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmitReport();
  const plants = usePlants();
  const [form, setForm] = useState({
    plantId: location.state?.plantId || "",
    category: "QUALITY",
    description: "",
    locationText: "",
    contact: ""
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    try {
      await submit.mutateAsync({
        plantId: form.plantId || undefined,
        category: form.category,
        description: form.description.trim(),
        locationText: form.locationText.trim() || undefined,
        contact: form.contact.trim() || undefined
      });
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to submit report.");
    }
  }

  if (done) {
    return (
      <div className="px-4 sm:px-6 pt-6 max-w-screen-md mx-auto">
        <Card>
          <div className="text-center py-6">
            <div className="mx-auto mb-3 grid place-items-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Thanks — your report is in</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              The operations team will review it. You can check status under "My reports".
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="secondary" onClick={() => navigate("/app/my-reports")}>
                View my reports
              </Button>
              <Button onClick={() => navigate("/app")}>Back to map</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-screen-md mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 inline-flex items-center gap-2">
          <MessageSquarePlus size={22} className="text-brand-600" />
          Report an issue
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tell us about water quality, availability or device problems. Reports go to the operations team.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Issue category" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="QUALITY">Water quality (taste, smell, colour)</option>
              <option value="AVAILABILITY">Availability (no water, low pressure)</option>
              <option value="DEVICE">Device / display problem</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>

          <Field label="Plant" hint="(optional — pick from the map if you know which one)">
            <Select value={form.plantId} onChange={(e) => setForm({ ...form, plantId: e.target.value })}>
              <option value="">Not specified</option>
              {(plants.data || []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Location description" hint="(if no plant selected)">
            <Input
              value={form.locationText}
              onChange={(e) => setForm({ ...form, locationText: e.target.value })}
              placeholder="e.g. corner of street 12, F-7/3"
            />
          </Field>

          <Field label="What's happening?" required>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what you noticed — when it started, how often, etc."
              rows={4}
            />
          </Field>

          <Field label="Your contact" hint="(optional)">
            <Input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Phone or email — for follow-up"
            />
          </Field>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end pt-2">
            <Button type="submit" leftIcon={<Send size={16} />} loading={submit.isPending}>
              Submit report
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
