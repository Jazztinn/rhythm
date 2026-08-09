"use client";

import { useEffect, useState } from "react";
import { Check, MessageSquareText, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { Button, StatusMessage } from "@/components/ui";
import { useRhythm } from "@/components/rhythm-provider";
import { integrationFetch } from "@/lib/integrations/client";
import { identifySlackCommitment } from "@/lib/integrations/slack-commitments";
import type { SlackChannel, SlackMessage } from "@/lib/integrations/slack";
import type { IntegrationResponse } from "@/lib/integrations/contracts";
import type { TaskDraft } from "@/lib/rhythm";

export type SlackProposal = TaskDraft & { sourceMessageId: string };

export function SlackReview({ onCreateTask }: { onCreateTask?: (draft: TaskDraft) => void }) {
  const { undo, canUndo } = useRhythm();
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [review, setReview] = useState<SlackProposal | null>(null);
  const [result, setResult] = useState<IntegrationResponse<{ messages: SlackMessage[] }> | null>(null);
  const [offline, setOffline] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  async function loadChannels() { const response = await integrationFetch<{ channels: SlackChannel[] }>("/api/integrations/slack/channels"); if (response.data) setChannels(response.data.channels); setOffline(response.status === "offline"); }
  async function loadMessages() { if (!channelId) return; const response = await integrationFetch<{ messages: SlackMessage[] }>(`/api/integrations/slack/messages?channel=${encodeURIComponent(channelId)}`); setResult(response); if (response.data) setMessages(response.data.messages); setOffline(response.status === "offline"); }
  // Initial channel discovery is an external request.
  useEffect(() => { const timer = window.setTimeout(() => { try { setChannelId(localStorage.getItem("rhythm.selectedSlackChannel") ?? ""); } catch { /* ignore malformed local selection */ } void loadChannels(); }, 0); return () => window.clearTimeout(timer); }, []);
  function propose(message: SlackMessage) {
    const commitment = identifySlackCommitment(message);
    if (!commitment) return;
    setReview({ title: commitment.title, project: "Slack", dueDate: "", dueTime: "", estimateMinutes: 30, priority: "medium", later: true, note: `Possible commitment from Slack message ${message.id}. Confirmed manually.`, sourceMessageId: message.id });
  }
  function approveProposal() {
    if (!review || !review.title.trim()) return;
    onCreateTask?.({ ...review, title: review.title.trim() });
    setReceipt(`Created “${review.title.trim()}” after your approval.`);
    setReview(null);
  }
  return <section className="slack-review" aria-labelledby="slack-review-heading"><div className="section-heading compact"><div><span className="section-kicker"><MessageSquareText size={14} /> Slack context</span><h2 id="slack-review-heading">Possible commitments</h2></div><Button onClick={() => void loadChannels()}><RefreshCw size={14} /> Refresh channels</Button></div>
    {offline ? <StatusMessage><WifiOff size={15} /> Offline. Review is paused; local tasks remain available.</StatusMessage> : null}
    <div className="slack-toolbar"><select value={channelId} onChange={(event) => { setChannelId(event.target.value); try { localStorage.setItem("rhythm.selectedSlackChannel", event.target.value); } catch { /* ignore unavailable local storage */ } }} aria-label="Public Slack channel"><option value="">Choose a public channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select><Button onClick={() => void loadMessages()} disabled={!channelId || offline}>Load messages</Button></div>
    {result?.error ? <StatusMessage tone="error">{result.error.message}</StatusMessage> : null}
    {receipt ? <StatusMessage><Check size={15} /> {receipt} {canUndo ? <Button onClick={() => { undo(); setReceipt(null); }}><RotateCcw size={14} /> Undo</Button> : null}</StatusMessage> : null}
    <div className="slack-message-list">{messages.map((message) => { const commitment = identifySlackCommitment(message); return <article key={message.id}><div><small>{new Date(Number(message.timestamp) * 1000).toLocaleString()}</small><p>{message.text}</p>{commitment ? <small>Possible commitment · {commitment.reason}</small> : <small>No clear action detected.</small>}</div>{commitment ? <Button onClick={() => propose(message)}>Review task</Button> : null}</article>; })}</div>
    {messages.length > 0 && !messages.some(identifySlackCommitment) ? <p className="provider-empty">No clear commitments found. Nothing was created.</p> : null}
    {review ? <div className="slack-proposal" role="dialog" aria-modal="false" aria-label="Review task proposal"><span className="section-kicker">Proposed task</span><label className="integration-field">Task title<input value={review.title} maxLength={240} onChange={(event) => setReview({ ...review, title: event.target.value })} /></label><p>Slack suggested this from a request or deadline. Nothing is created until you approve.</p><div><Button onClick={() => setReview(null)}>Cancel</Button><Button variant="primary" disabled={!review.title.trim()} onClick={approveProposal}>Approve and create</Button></div></div> : null}
  </section>;
}
