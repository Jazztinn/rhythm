"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, RefreshCw, WifiOff } from "lucide-react";
import { Button, StatusMessage } from "@/components/ui";
import { integrationFetch } from "@/lib/integrations/client";
import type { SlackChannel, SlackMessage } from "@/lib/integrations/slack";
import type { IntegrationResponse } from "@/lib/integrations/contracts";
import type { TaskDraft } from "@/lib/rhythm";

export type SlackProposal = TaskDraft & { sourceMessageId: string };

export function SlackReview({ onCreateTask }: { onCreateTask?: (draft: TaskDraft) => void }) {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [review, setReview] = useState<SlackProposal | null>(null);
  const [result, setResult] = useState<IntegrationResponse<{ messages: SlackMessage[] }> | null>(null);
  const [offline, setOffline] = useState(false);
  async function loadChannels() { const response = await integrationFetch<{ channels: SlackChannel[] }>("/api/integrations/slack/channels"); if (response.data) setChannels(response.data.channels); setOffline(response.status === "offline"); }
  async function loadMessages() { if (!channelId) return; const response = await integrationFetch<{ messages: SlackMessage[] }>(`/api/integrations/slack/messages?channel=${encodeURIComponent(channelId)}`); setResult(response); if (response.data) setMessages(response.data.messages); setOffline(response.status === "offline"); }
  // Initial channel discovery is an external request.
  useEffect(() => { const timer = window.setTimeout(() => { try { setChannelId(localStorage.getItem("rhythm.selectedSlackChannel") ?? ""); } catch { /* ignore malformed local selection */ } void loadChannels(); }, 0); return () => window.clearTimeout(timer); }, []);
  function propose(message: SlackMessage) { setReview({ title: message.text.slice(0, 80).trim() || "Follow up from Slack", project: "Slack", dueDate: "", dueTime: "", estimateMinutes: 30, priority: "medium", later: true, note: `From Slack message ${message.id}`, sourceMessageId: message.id }); }
  return <section className="slack-review" aria-labelledby="slack-review-heading"><div className="section-heading compact"><div><span className="section-kicker"><MessageSquareText size={14} /> Slack review</span><h2 id="slack-review-heading">Turn a message into a task</h2></div><Button onClick={() => void loadChannels()}><RefreshCw size={14} /> Refresh channels</Button></div>
    {offline ? <StatusMessage><WifiOff size={15} /> Offline. Review is paused; local tasks remain available.</StatusMessage> : null}
    <div className="slack-toolbar"><select value={channelId} onChange={(event) => { setChannelId(event.target.value); try { localStorage.setItem("rhythm.selectedSlackChannel", event.target.value); } catch { /* ignore unavailable local storage */ } }} aria-label="Public Slack channel"><option value="">Choose a public channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select><Button onClick={() => void loadMessages()} disabled={!channelId || offline}>Load messages</Button></div>
    {result?.error ? <StatusMessage tone="error">{result.error.message}</StatusMessage> : null}
    <div className="slack-message-list">{messages.map((message) => <article key={message.id}><div><small>{new Date(Number(message.timestamp) * 1000).toLocaleString()}</small><p>{message.text}</p></div><Button onClick={() => propose(message)}>Review</Button></article>)}</div>
    {review ? <div className="slack-proposal" role="dialog" aria-label="Review task proposal"><span className="section-kicker">Manual review</span><h3>{review.title}</h3><p>Nothing is created until you approve this local task proposal. Slack content is displayed as plain text.</p><div><Button onClick={() => setReview(null)}>Dismiss</Button><Button variant="primary" onClick={() => { onCreateTask?.(review); setReview(null); }}>Create task</Button></div></div> : null}
  </section>;
}
