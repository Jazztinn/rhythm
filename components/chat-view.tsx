"use client";

import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  ArrowUp,
  Check,
  Clock3,
  CornerDownRight,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import type { AssistantAction, ChatMessage, ChatReply } from "@/lib/rhythm";

const CHAT_KEY = "rhythm.chat.v1";
const prompts = [
  "What should I care about right now?",
  "Give me the minimum I need to finish tonight.",
  "Move my Monday meeting prep to tomorrow morning.",
  "Create a 30-minute task to review my portfolio.",
];

function actionLabel(action: AssistantAction) {
  if (action.type === "create_task") return `Created ${action.title}`;
  if (action.type === "complete_task") return "Marked task complete";
  return `Moved task to ${action.dueLabel}`;
}

export function ChatView() {
  const root = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { tasks, applyActions, undo, canUndo } = useRhythm();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState(prompts.slice(0, 3));
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("[data-chat-reveal]", {
        opacity: 0,
        y: 18,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.to(".chat-orb", {
        scale: 1.12,
        xPercent: 7,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, root);
    return () => context.revert();
  }, []);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending" && !task.later),
    [tasks],
  );

  async function submitMessage(text: string) {
    const clean = text.trim().slice(0, 1200);
    if (!clean || isThinking) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: clean,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-20).map(({ role, content }) => ({ role, content })),
          tasks,
          date: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const payload = (await response.json()) as ChatReply & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rhythm could not respond.");

      if (payload.actions.length) applyActions(payload.actions);
      setSuggestions(payload.suggestions.length ? payload.suggestions : prompts.slice(0, 3));
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.message,
          actions: payload.actions,
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rhythm could not respond.");
    } finally {
      setIsThinking(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(input);
  }

  function clearChat() {
    setMessages([]);
    setSuggestions(prompts.slice(0, 3));
    setError(null);
    window.localStorage.removeItem(CHAT_KEY);
  }

  return (
    <div className="chat-view" ref={root}>
      <header className="chat-header" data-chat-reveal>
        <div>
          <span className="section-kicker"><Sparkles size={15} /> Personal chief of staff</span>
          <h1>Chat</h1>
        </div>
        <div className="chat-header-actions">
          {canUndo ? (
            <button className="soft-button" onClick={undo}><RotateCcw size={15} /> Undo task change</button>
          ) : null}
          <button className="soft-button" onClick={clearChat}><Plus size={16} /> New chat</button>
        </div>
      </header>

      <div className="chat-layout">
        <section className="chat-panel" data-chat-reveal>
          <div className="chat-orb" aria-hidden="true" />
          <div className="chat-thread" aria-live="polite">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span className="assistant-mark"><WandSparkles size={22} /></span>
                <p>Hello Alex</p>
                <h2>What can I <strong>help you</strong> with?</h2>
                <div className="prompt-grid">
                  {prompts.slice(0, 2).map((prompt) => (
                    <button key={prompt} onClick={() => void submitMessage(prompt)}>
                      {prompt}<ArrowUp size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages">
                {messages.map((message) => (
                  <article className={`message ${message.role}`} key={message.id}>
                    {message.role === "assistant" ? <span className="message-avatar">R</span> : null}
                    <div>
                      <p>{message.content}</p>
                      {message.actions?.length ? (
                        <div className="action-receipts">
                          {message.actions.map((action, index) => (
                            <span key={`${action.type}-${index}`}><Check size={13} />{actionLabel(action)}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
                {isThinking ? (
                  <article className="message assistant is-thinking">
                    <span className="message-avatar">R</span>
                    <div><i /><i /><i /></div>
                  </article>
                ) : null}
                {error ? (
                  <div className="chat-error">
                    <span>{error}</span>
                    <button onClick={() => void submitMessage(messages.at(-1)?.content ?? "")}>Retry <RefreshCw size={13} /></button>
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="chat-composer-wrap">
            {messages.length > 0 ? (
              <div className="suggestion-row">
                {suggestions.slice(0, 3).map((suggestion) => (
                  <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>
                ))}
              </div>
            ) : null}
            <form className="chat-composer" onSubmit={handleSubmit}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask Rhythm, or change a task…"
                aria-label="Message Rhythm"
                disabled={isThinking}
                maxLength={1200}
              />
              <button type="submit" aria-label="Send message" disabled={!input.trim() || isThinking}>
                <ArrowUp size={19} />
              </button>
            </form>
            <p className="composer-note">Rhythm can create, complete, and reschedule local tasks.</p>
          </div>
        </section>

        <aside className="context-panel" data-chat-reveal>
          <div className="context-top">
            <span className="section-kicker">Today&apos;s context</span>
            <strong>{pendingTasks.length} things left</strong>
          </div>
          <div className="context-task-list">
            {pendingTasks.slice(0, 4).map((task) => (
              <article key={task.id}>
                <i />
                <div><strong>{task.title}</strong><span>{task.project}</span></div>
                <small>{task.dueLabel}</small>
              </article>
            ))}
          </div>
          <div className="context-window">
            <Clock3 size={17} />
            <div><span>Free before NEXT sync</span><strong>52 minutes</strong></div>
          </div>
          <div className="context-note">
            <CornerDownRight size={16} />
            <p>Task changes happen on this device and can be undone.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
