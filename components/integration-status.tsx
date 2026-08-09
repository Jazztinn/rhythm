"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button, ConfirmAction, StatusMessage } from "@/components/ui";
import { integrationFetch, providerLabel } from "@/lib/integrations/client";
import { providerMessages, type IntegrationProvider, type IntegrationResponse } from "@/lib/integrations/contracts";
import { SlackReview } from "@/components/slack-review";
import { useRhythm } from "@/components/rhythm-provider";

type Connection = { status: IntegrationResponse<null>["status"]; connected: boolean };
type StatusData = { google: Connection; slack: Connection };

export function IntegrationStatusBadge({ status }: { status: Connection["status"] }) {
  const labels: Record<Connection["status"], string> = { connected: "Connected", not_configured: "Not configured", not_connected: "Not connected", permission_denied: "Permission needed", token_expired: "Reconnect needed", rate_limited: "Rate limited", offline: "Offline", provider_unavailable: "Unavailable", invalid_request: "Check details" };
  return <span className={`integration-status integration-status--${status}`}>{labels[status]}</span>;
}

export function IntegrationStatusCard({ provider, connection, onChanged }: { provider: IntegrationProvider; connection: Connection; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = providerLabel(provider);
  async function disconnect() {
    setBusy(true);
    await integrationFetch(`/api/integrations/${provider}/disconnect`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }
  return <article className="integration-card">
    <div className="integration-card__heading"><div><span className="section-kicker">Provider connection</span><h2>{label}</h2></div><IntegrationStatusBadge status={connection.status} /></div>
    <p>{connection.status === "connected" ? `Rhythm can read ${provider === "google" ? "calendar events" : "public Slack channels"}. Remote changes stay explicit.` : providerMessages[connection.status as keyof typeof providerMessages]}</p>
    <div className="integration-card__actions">
      {connection.status === "not_configured" ? <Button disabled title="Ask the workspace owner to configure this provider">Not configured</Button> : connection.status === "connected" ? <ConfirmAction label={busy ? "Disconnecting…" : "Disconnect"} title={`Disconnect ${label}?`} description={`This removes Rhythm's encrypted ${label} session from this browser. It does not delete provider data or local tasks.`} confirmLabel="Disconnect" tone="danger" onConfirm={disconnect} /> : <Button variant="primary" onClick={() => router.push(`/api/integrations/${provider}/connect`)}>{connection.status === "token_expired" || connection.status === "permission_denied" ? "Reconnect" : "Connect"}</Button>}
    </div>
  </article>;
}

export function ConnectionsView() {
  return <div className="workspace-view settings-workspace">
    <header className="workspace-header"><div><p className="eyebrow">Private connections</p><h1>Connections</h1><p className="page-subtitle">Connect only the sources Rhythm needs. Local tasks and Rhythms stay usable offline.</p></div></header>
    <ConnectionsSection />
  </div>;
}

export function ConnectionsSection() {
  const { createTask } = useRhythm();
  const [status, setStatus] = useState<IntegrationResponse<StatusData> | null>(null);
  const [offline, setOffline] = useState(false);
  const refresh = async () => setStatus(await integrationFetch<StatusData>("/api/integrations/status"));
  // Status is request-backed and intentionally refreshed after the client mounts.
  useEffect(() => { const timer = window.setTimeout(() => { setOffline(!navigator.onLine); void refresh(); }, 0); const on = () => setOffline(false); const off = () => setOffline(true); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.clearTimeout(timer); window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  return <div>
    <div style={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={() => void refresh()} disabled={offline || !status?.data}><RefreshCw size={15} /> Refresh status</Button></div>
    {offline ? <StatusMessage tone="notice"><WifiOff size={15} /> Offline. Local work is still available; provider controls are paused.</StatusMessage> : null}
    {status?.error ? <StatusMessage tone="error">{status.error.message} <Button onClick={() => void refresh()}>Try again</Button></StatusMessage> : null}
    <section className="integration-grid">
      {status?.data ? <><IntegrationStatusCard provider="google" connection={status.data.google} onChanged={() => void refresh()} /><IntegrationStatusCard provider="slack" connection={status.data.slack} onChanged={() => void refresh()} /></> : <div className="loading-panel"><p>Checking provider configuration…</p></div>}
    </section>
    {status?.data?.slack.status === "connected" ? <SlackReview onCreateTask={createTask} /> : null}
    <section className="settings-note"><span className="section-kicker">What stays local</span><p>Selected calendar and Slack channel IDs are kept in this browser only. Access tokens never enter client JavaScript, localStorage, Chat, or task content.</p></section>
  </div>;
}
