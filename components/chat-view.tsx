"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, Clock3, CornerDownRight, Pencil, Plus, RefreshCw, RotateCcw, Sparkles, WandSparkles, X } from "lucide-react";
import { Button, Dialog, StatusMessage } from "@/components/ui";
import { useRhythm } from "@/components/rhythm-provider";
import {
  applyAiActionProposals,
  buildAiContext,
  dateRangeFrom,
  formatTaskDue,
  taskTargetSummary,
  validateAiProposals,
  type AiActionProposal,
  type AiProposalReceipt,
  type AssistantAction,
  type ChatMessage,
  type ChatReply,
  type Task,
} from "@/lib/rhythm";

const CHAT_KEY = "rhythm.chat.v1";
const prompts = [
  "What should I care about right now?",
  "Give me the minimum I need to finish tonight.",
  "Move my Monday meeting prep to tomorrow morning.",
  "Create a 30-minute task to review my portfolio.",
];

function actionLabel(action: AssistantAction) {
  if (action.type === "create_task") return `Create “${action.title}”`;
  if (action.type === "complete_task") return "Mark the task complete";
  return `Move the task to ${action.dueLabel}`;
}

function calmDuration(minutes: number) {
  if (minutes < 45) return `About ${minutes} minutes`;
  const hours = Math.round(minutes / 30) / 2;
  return `About ${hours === 1 ? "an hour" : `${hours} hours`}`;
}

function ProposalEditor({ proposal, workItems, onClose, onSave }: { proposal: AiActionProposal; workItems: Task[]; onClose: () => void; onSave: (proposal: AiActionProposal) => void }) {
  const action = proposal.action;
  const initialTarget = action.taskId ? workItems.find((task) => task.id === action.taskId) : undefined;
  const [targetId, setTargetId] = useState(action.taskId ?? "");
  const [title, setTitle] = useState(action.type === "create_task" ? action.title : "");
  const [project, setProject] = useState(action.type === "create_task" ? action.project : "Personal");
  const [dueLabel, setDueLabel] = useState(action.type === "reschedule_task" ? action.dueLabel : action.type === "create_task" ? action.dueLabel : "");
  const [dueDate, setDueDate] = useState(action.type === "reschedule_task" ? action.dueDate ?? initialTarget?.dueDate ?? "" : action.type === "create_task" ? action.dueDate ?? "" : "");
  const [dueTime, setDueTime] = useState(action.type === "reschedule_task" ? action.dueTime ?? initialTarget?.dueTime ?? "" : action.type === "create_task" ? action.dueTime ?? "" : "");
  const [estimateMinutes, setEstimateMinutes] = useState(String(action.type === "create_task" ? action.estimateMinutes : initialTarget?.estimateMinutes ?? 25));
  const targets = workItems.filter((task) => task.status === "pending");

  function save() {
    if (action.type === "create_task") {
      if (!title.trim() || (!dueLabel.trim() && !dueDate)) return;
      onSave({ ...proposal, status: "edited", action: { ...action, title: title.trim(), project: project.trim() || "Personal", dueLabel: dueDate ? formatTaskDue(dueDate, dueTime) : dueLabel.trim(), dueDate: dueDate || undefined, dueTime: dueTime || undefined, estimateMinutes: Math.min(Math.max(Number(estimateMinutes) || 25, 5), 480) }, targetSummary: `New task “${title.trim()}” · ${project.trim() || "Personal"} · ${dueDate ? formatTaskDue(dueDate, dueTime) : dueLabel.trim()}`, resolution: undefined });
      return;
    }
    const target = targets.find((task) => task.id === targetId);
    if (!target || (action.type === "reschedule_task" && !dueLabel.trim() && !dueDate)) return;
    const nextAction: AssistantAction = action.type === "complete_task"
      ? { type: "complete_task", taskId: target.id, title: null, project: null, dueLabel: null, estimateMinutes: null }
      : { type: "reschedule_task", taskId: target.id, title: null, project: null, dueLabel: dueDate ? formatTaskDue(dueDate, dueTime) : dueLabel.trim(), estimateMinutes: null, dueDate: dueDate || undefined, dueTime: dueTime || undefined };
    onSave({ ...proposal, status: "edited", action: nextAction, targetSummary: taskTargetSummary(target), resolution: undefined });
  }

  return (
    <Dialog open onClose={onClose} title="Edit Rhythm proposal">
      <p className="ui-dialog__description">Correct the details before anything changes. Rhythm will check the current workspace again when you approve.</p>
      {action.type !== "create_task" ? (
        <label className="proposal-edit-field">Exact target
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            <option value="">Choose a current pending task</option>
            {targets.map((task) => <option key={task.id} value={task.id}>{taskTargetSummary(task)}</option>)}
          </select>
        </label>
      ) : null}
      {action.type === "create_task" ? <>
        <label className="proposal-edit-field">Task title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} /></label>
        <label className="proposal-edit-field">Project<input value={project} onChange={(event) => setProject(event.target.value)} maxLength={120} /></label>
      </> : null}
      {action.type !== "complete_task" ? <>
        <label className="proposal-edit-field">Day or time<input value={dueLabel} onChange={(event) => setDueLabel(event.target.value)} placeholder="Tomorrow morning" maxLength={120} /></label>
        <div className="proposal-edit-grid"><label className="proposal-edit-field">Exact date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="proposal-edit-field">Time<input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></label></div>
      </> : null}
      {action.type === "create_task" ? <label className="proposal-edit-field">Minutes<input type="number" min={5} max={480} value={estimateMinutes} onChange={(event) => setEstimateMinutes(event.target.value)} /></label> : null}
      <div className="ui-dialog__actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="button" variant="primary" onClick={save}>Save edit</Button></div>
    </Dialog>
  );
}

function ProposalCard({ proposal, batch, onApprove, onEdit, onCancel }: { proposal: AiActionProposal; batch: boolean; onApprove: () => void; onEdit: () => void; onCancel: () => void }) {
  if (proposal.status === "cancelled") return <div className="ai-proposal ai-proposal--muted"><X size={15} /> Proposal cancelled. Nothing changed.</div>;
  if (proposal.status === "approved") return <div className="ai-proposal ai-proposal--approved"><Check size={15} /> Approved: {actionLabel(proposal.action)}</div>;
  if (proposal.status === "blocked") return <div className="ai-proposal ai-proposal--blocked"><X size={15} /> No change made. {proposal.resolution ?? "This proposal could not be validated against the current workspace."}</div>;
  return <div className="ai-proposal">
    <div className="ai-proposal__heading"><span className="section-kicker"><Sparkles size={13} /> Suggested change</span></div>
    <strong>{actionLabel(proposal.action)}</strong>
    <p className="ai-proposal__target">Target: {proposal.targetSummary}</p>
    <p className="ai-proposal__reason">Why this appeared: {proposal.reason}</p>
    <div className="ai-proposal__actions"><Button type="button" variant="primary" onClick={onApprove}>Approve</Button><Button type="button" onClick={onEdit}><Pencil size={14} /> Edit</Button><Button type="button" variant="ghost" onClick={onCancel}>{batch ? "Exclude" : "Cancel"}</Button></div>
  </div>;
}

export function ChatView() {
  const root = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { tasks, getWorkItems, commitTransaction, undo, canUndo } = useRhythm();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState(prompts.slice(0, 3));
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<{ messageId: string; proposal: AiActionProposal } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(CHAT_KEY);
        if (saved) setMessages(JSON.parse(saved));
        const prompt = new URLSearchParams(window.location.search).get("prompt");
        if (prompt) setInput(prompt.slice(0, 800));
      } catch {
        window.localStorage.removeItem(CHAT_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [hydrated, messages, isThinking]);

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status === "pending" && !task.later), [tasks]);
  const workItems = useMemo(() => {
    const relevant = getWorkItems(dateRangeFrom(new Date(), 30, 90));
    return [...new Map([...tasks, ...relevant].map((task) => [task.id, task])).values()];
  }, [getWorkItems, tasks]);
  const aiContextSource = useMemo(() => [
    ...tasks,
    ...getWorkItems(dateRangeFrom(new Date(), 30, 90)).filter((task) => task.generated),
  ], [getWorkItems, tasks]);
  const aiContext = useMemo(() => buildAiContext(aiContextSource, new Date(), 120), [aiContextSource]);

  function updateProposal(messageId: string, proposalId: string, update: (proposal: AiActionProposal) => AiActionProposal) {
    setMessages((current) => current.map((message) => message.id !== messageId ? message : { ...message, proposals: message.proposals?.map((proposal) => proposal.id === proposalId ? update(proposal) : proposal) }));
  }

  function approve(messageId: string, proposalIds?: string[]) {
    const message = messages.find((item) => item.id === messageId);
    const proposals = message?.proposals?.filter((proposal) => (proposal.status === "pending" || proposal.status === "edited") && (!proposalIds || proposalIds.includes(proposal.id))) ?? [];
    if (!proposals.length) return;
    const validation = validateAiProposals(proposals, getWorkItems(dateRangeFrom(new Date(), 365, 365)));
    if (!validation.valid.length || !validation.ok) {
      setMessages((current) => current.map((item) => item.id !== messageId ? item : { ...item, proposals: item.proposals?.map((proposal) => proposals.some((candidate) => candidate.id === proposal.id) ? { ...proposal, status: "blocked", resolution: validation.issues[0] ?? "The current target no longer matches this proposal." } : proposal) }));
      return;
    }
    const label = proposals.length > 1 ? "Approved Rhythm proposal batch" : "Approved Rhythm proposal";
    commitTransaction(label, (current) => applyAiActionProposals(current, validation.valid));
    const receipt: AiProposalReceipt = { changed: validation.valid.map((proposal) => actionLabel(proposal.action)), unchanged: ["No other tasks, rhythms, providers, or settings were changed."], undoAvailable: true };
    setMessages((current) => current.map((item) => item.id !== messageId ? item : { ...item, proposals: item.proposals?.map((proposal) => validation.valid.some((candidate) => candidate.id === proposal.id) ? { ...proposal, status: "approved", resolution: undefined } : proposal), receipt }));
  }

  function cancel(messageId: string, proposalId: string) {
    updateProposal(messageId, proposalId, (proposal) => ({ ...proposal, status: "cancelled", resolution: undefined }));
  }

  function edit(messageId: string, proposal: AiActionProposal) {
    setEditing({ messageId, proposal });
  }

  function saveEdit(proposal: AiActionProposal) {
    if (!editing) return;
    updateProposal(editing.messageId, proposal.id, () => ({ ...proposal, resolution: undefined }));
    setEditing(null);
  }

  async function submitMessage(text: string) {
    const clean = text.trim().slice(0, 1200);
    if (!clean || isThinking) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: clean };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages); setInput(""); setError(null); setIsThinking(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages.slice(-20).map(({ role, content }) => ({ role, content })), tasks: aiContext, date: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      const payload = (await response.json()) as ChatReply & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rhythm could not respond.");
      setSuggestions(payload.suggestions?.length ? payload.suggestions : prompts.slice(0, 3));
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: payload.message, proposals: payload.proposals ?? [], clarifications: payload.clarifications }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rhythm could not respond.");
    } finally { setIsThinking(false); }
  }

  function handleSubmit(event: FormEvent) { event.preventDefault(); void submitMessage(input); }
  function clearChat() { setMessages([]); setSuggestions(prompts.slice(0, 3)); setError(null); window.localStorage.removeItem(CHAT_KEY); }

  return <div className="chat-view" ref={root}>
    <header className="chat-header" data-chat-reveal><div><span className="section-kicker"><Sparkles size={15} /> Personal chief of staff</span><h1>Ask Rhythm</h1></div><div className="chat-header-actions">{canUndo ? <button className="soft-button" onClick={undo}><RotateCcw size={15} /> Undo last change</button> : null}<button className="soft-button" onClick={clearChat}><Plus size={16} /> New chat</button></div></header>
    <div className="chat-layout"><section className="chat-panel" data-chat-reveal><div className="chat-orb" aria-hidden="true" /><div className="chat-thread" aria-live="polite">
      {messages.length === 0 ? <div className="chat-empty"><span className="assistant-mark"><WandSparkles size={22} /></span><p>Hello Jazz</p><h2>What can I <strong>help you</strong> with?</h2><div className="prompt-grid">{prompts.slice(0, 2).map((prompt) => <button key={prompt} onClick={() => void submitMessage(prompt)}>{prompt}<ArrowUp size={15} /></button>)}</div></div> : <div className="messages">{messages.map((message) => { const batch = (message.proposals?.length ?? 0) > 1; return <article className={`message ${message.role}`} key={message.id}>{message.role === "assistant" ? <span className="message-avatar">R</span> : null}<div><p>{message.content}</p>{message.clarifications?.map((clarification) => <StatusMessage key={clarification}>{clarification}</StatusMessage>)}{message.proposals?.length ? <div className="ai-proposals">{batch && message.proposals.some((proposal) => proposal.status === "pending" || proposal.status === "edited") ? <div className="ai-proposals__batch"><span>Review each change. Exclude any you do not want.</span><Button type="button" variant="primary" onClick={() => approve(message.id)}>Approve selected</Button></div> : null}{message.proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} batch={batch} onApprove={() => approve(message.id, [proposal.id])} onEdit={() => edit(message.id, proposal)} onCancel={() => cancel(message.id, proposal.id)} />)}</div> : null}{message.receipt ? <div className="ai-receipt"><Check size={14} /><div><strong>Receipt</strong>{message.receipt.changed.map((item) => <span key={item}>Changed: {item}</span>)}{message.receipt.unchanged.map((item) => <span key={item}>Unchanged: {item}</span>)}{message.receipt.undoAvailable && canUndo ? <Button type="button" onClick={undo}><RotateCcw size={14} /> Undo this change</Button> : null}</div></div> : null}</div></article>; })}{isThinking ? <article className="message assistant is-thinking"><span className="message-avatar">R</span><div><i /><i /><i /></div></article> : null}{error ? <div className="chat-error"><span>{error}</span><button onClick={() => void submitMessage(messages.at(-1)?.content ?? "")}>Retry <RefreshCw size={13} /></button></div> : null}<div ref={endRef} /></div>}
    </div><div className="chat-composer-wrap">{messages.length > 0 ? <div className="suggestion-row">{suggestions.slice(0, 3).map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div> : null}<form className="chat-composer" onSubmit={handleSubmit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Rhythm, or change a task…" aria-label="Message Rhythm" disabled={isThinking} maxLength={1200} /><button type="submit" aria-label="Send message" disabled={!input.trim() || isThinking}><ArrowUp size={19} /></button></form><p className="composer-note">Rhythm suggests proposals first. Nothing changes until you approve.</p></div></section>
      <aside className="context-panel" data-chat-reveal><div className="context-top"><span className="section-kicker">Today&apos;s context</span><strong>{pendingTasks.length} things left</strong></div><div className="context-task-list">{pendingTasks.slice(0, 4).map((task) => <article key={task.id}><i /><div><strong>{task.title}</strong><span>{task.project}</span></div><small>{task.dueLabel}</small></article>)}</div><div className="context-window"><Clock3 size={17} /><div><span>Based on your task list</span><strong>{calmDuration(pendingTasks.reduce((sum, task) => sum + task.estimateMinutes, 0))}</strong></div></div><div className="context-note"><CornerDownRight size={16} /><p>Ask Rhythm can suggest local changes. You stay in control.</p></div></aside>
    </div>{editing ? <ProposalEditor proposal={editing.proposal} workItems={workItems} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}
  </div>;
}
