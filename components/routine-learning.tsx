"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Brain, Clock3, Download, Eye, Shield, UserRound } from "lucide-react";
import { Button, ConfirmAction, StatusMessage } from "@/components/ui";
import {
  LEARNING_STORAGE_KEY,
  answerPattern,
  editPattern,
  migrateLearningState,
  removePattern,
  seedLearningState,
  setCategoryPaused,
  type LearnedPattern,
  type LearningResponse,
  type LearningState,
  type LearningStatus,
} from "@/lib/learning";

const PREFERENCES_STORAGE_KEY = "rhythm.preferences.v1";

type Preferences = {
  quietStart: string;
  quietEnd: string;
  workingStart: string;
  workingEnd: string;
  timezone: string;
  browserNotifications: boolean;
  reducedMotion: boolean;
  higherContrast: boolean;
};

const defaultPreferences: Preferences = {
  quietStart: "21:00",
  quietEnd: "07:00",
  workingStart: "09:00",
  workingEnd: "18:00",
  timezone: "Asia/Manila",
  browserNotifications: false,
  reducedMotion: false,
  higherContrast: false,
};

const gridStyle: CSSProperties = { display: "grid", gap: 16 };
const cardStyle: CSSProperties = { padding: "clamp(20px, 4vw, 32px)", border: "1px solid rgba(255,255,255,.72)", borderRadius: 28, background: "rgba(250,250,246,.74)", boxShadow: "var(--shadow-sm)" };
const rowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 };
const mutedStyle: CSSProperties = { margin: "6px 0 0", color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.55 };
const inputStyle: CSSProperties = { minHeight: 42, maxWidth: "100%", padding: "0 12px", border: "1px solid var(--color-border)", borderRadius: 12, background: "rgba(255,255,255,.78)", color: "var(--color-text)" };

function safePreferences(input: unknown): Preferences {
  if (!input || typeof input !== "object" || Array.isArray(input)) return defaultPreferences;
  const value = input as Partial<Preferences>;
  return {
    quietStart: typeof value.quietStart === "string" ? value.quietStart : defaultPreferences.quietStart,
    quietEnd: typeof value.quietEnd === "string" ? value.quietEnd : defaultPreferences.quietEnd,
    workingStart: typeof value.workingStart === "string" ? value.workingStart : defaultPreferences.workingStart,
    workingEnd: typeof value.workingEnd === "string" ? value.workingEnd : defaultPreferences.workingEnd,
    timezone: typeof value.timezone === "string" ? value.timezone : defaultPreferences.timezone,
    browserNotifications: value.browserNotifications === true,
    reducedMotion: value.reducedMotion === true,
    higherContrast: value.higherContrast === true,
  };
}

function statusLabel(status: LearningStatus): string {
  if (status === "still-learning" || status === "keep-observing") return "Still learning";
  if (status === "contextual") return "Contextual";
  if (status === "rejected") return "Not used";
  return "Confirmed";
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return <label style={{ ...rowStyle, cursor: "pointer" }}>
    <span><strong style={{ fontSize: 13, fontWeight: 560 }}>{label}</strong>{description ? <span style={{ ...mutedStyle, display: "block" }}>{description}</span> : null}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>;
}

function PatternCard({ pattern, onAnswer, onEdit, onRemove }: { pattern: LearnedPattern; onAnswer: (response: LearningResponse) => void; onEdit: (value: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pattern.value);
  const prompt = pattern.pendingChange?.question ?? pattern.question;
  const proposedValue = pattern.pendingChange?.value;
  const evidence = pattern.pendingChange?.evidence ?? pattern.evidence;
  const asksForConfirmation = pattern.status !== "confirmed" || Boolean(pattern.pendingChange);

  return <article style={{ padding: 18, border: "1px solid var(--color-border)", borderRadius: 20, background: "rgba(255,255,255,.46)" }}>
    <div style={rowStyle}>
      <div><span className="section-kicker">{pattern.category}</span><h3 style={{ margin: "5px 0 0", fontSize: 17, fontWeight: 540, letterSpacing: "-.03em" }}>{pattern.subject}</h3></div>
      <span className={`integration-status ${pattern.status === "confirmed" ? "integration-status--connected" : ""}`}>{statusLabel(pattern.status)}</span>
    </div>

    {editing ? <form style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }} onSubmit={(event) => { event.preventDefault(); onEdit(draft); setEditing(false); }}>
      <label style={{ flex: "1 1 220px", fontSize: 11, color: "var(--color-text-muted)" }}>Pattern<input aria-label={`Edit ${pattern.subject} pattern`} value={draft} onChange={(event) => setDraft(event.target.value)} style={{ ...inputStyle, display: "block", width: "100%", marginTop: 6 }} autoFocus /></label>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}><Button type="submit" variant="primary">Save</Button><Button type="button" onClick={() => { setDraft(pattern.value); setEditing(false); }}>Cancel</Button></div>
    </form> : <p style={{ margin: "14px 0 0", fontSize: 14 }}>{proposedValue ? <><span style={{ color: "var(--color-text-muted)" }}>Current: {pattern.value}</span><br />Possible change: {proposedValue}</> : pattern.value}</p>}

    {asksForConfirmation ? <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: "rgba(236,232,250,.52)" }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>{prompt}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
        <Button type="button" variant="primary" onClick={() => onAnswer("yes")}>Yes</Button><Button type="button" onClick={() => onAnswer("sometimes")}>Sometimes</Button><Button type="button" onClick={() => onAnswer("no")}>No</Button><Button type="button" variant="ghost" onClick={() => onAnswer("keep-observing")}>Keep observing</Button>
      </div>
    </div> : null}

    <p style={mutedStyle}>{evidence.summary} Sources: {evidence.sources.join(", ")}.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
      <Button type="button" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
      <ConfirmAction label="Remove" title={`Remove ${pattern.subject}?`} description="Rhythm will stop using this pattern. New observations may be offered later if enough evidence appears." confirmLabel="Remove pattern" tone="danger" onConfirm={onRemove} />
    </div>
  </article>;
}

function SettingsSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <section style={cardStyle}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><span aria-hidden="true" style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 12, background: "rgba(221,226,215,.7)" }}>{icon}</span><div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 450, letterSpacing: "-.04em" }}>{title}</h2><p style={mutedStyle}>{description}</p></div></div>
    <div style={{ ...gridStyle, marginTop: 20 }}>{children}</div>
  </section>;
}

export function RoutineLearningSettings({ connections }: { connections: ReactNode }) {
  const [learning, setLearning] = useState<LearningState>(seedLearningState);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const learningRaw = window.localStorage.getItem(LEARNING_STORAGE_KEY);
        const preferenceRaw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
        const migrated = migrateLearningState(learningRaw ? JSON.parse(learningRaw) : null);
        setLearning(migrated.state);
        if (preferenceRaw) setPreferences(safePreferences(JSON.parse(preferenceRaw)));
        if (migrated.status === "recovered") setStorageNotice("Saved learning data could not be read, so Rhythm restored safe starter observations. None are confirmed.");
      } catch {
        setLearning(seedLearningState);
        setStorageNotice("Saved learning data could not be read, so Rhythm restored safe starter observations. None are confirmed.");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(learning));
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      setStorageNotice("Changes are available for this visit, but this browser blocked local saving.");
    }
  }, [hydrated, learning, preferences]);

  const categories = useMemo(() => [...new Set(learning.patterns.filter((pattern) => pattern.status !== "rejected").map((pattern) => pattern.category))], [learning.patterns]);
  const visiblePatterns = learning.patterns.filter((pattern) => pattern.status !== "rejected");
  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((current) => ({ ...current, [key]: value }));
  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), learning, preferences };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rhythm-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const deleteLocalSettings = () => {
    window.localStorage.removeItem(LEARNING_STORAGE_KEY);
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    setLearning(seedLearningState);
    setPreferences(defaultPreferences);
    setStorageNotice("Local preferences removed. Starter observations remain unconfirmed.");
  };

  return <div className="workspace-view settings-workspace">
    <header className="workspace-header"><div><p className="eyebrow">Quiet assistance, under your control</p><h1>Settings</h1><p className="page-subtitle">Choose what Rhythm can use, and inspect every pattern it has noticed.</p></div></header>
    {storageNotice ? <StatusMessage tone="notice">{storageNotice}</StatusMessage> : null}
    <div style={{ ...gridStyle, marginTop: 24 }}>
      <SettingsSection icon={<UserRound size={17} />} title="Account" description="Your local profile for this workspace."><div style={rowStyle}><div><strong style={{ fontSize: 13 }}>Personal workspace</strong><p style={mutedStyle}>Your responsibilities, without the noise.</p></div><span className="integration-status">Local</span></div></SettingsSection>

      <section aria-labelledby="connections-heading"><div style={{ marginBottom: 12 }}><h2 id="connections-heading" style={{ margin: 0, fontSize: 22, fontWeight: 450 }}>Connections</h2><p style={mutedStyle}>Calendar helps Rhythm understand time. Slack offers possible commitments for your approval.</p></div>{connections}</section>

      <SettingsSection icon={<Brain size={17} />} title="Routine learning" description="Observe → infer → ask → confirm → use. Unconfirmed patterns never shape plans or reminders.">
        <Toggle checked={learning.enabled} onChange={(enabled) => setLearning((current) => ({ ...current, enabled }))} label="Learn from my routine" description="Turn this off to stop new observations and prevent learned patterns from being used." />
        {categories.length ? <fieldset style={{ margin: 0, padding: 0, border: 0 }}><legend style={{ marginBottom: 10, fontSize: 12, fontWeight: 600 }}>Categories being learned</legend><div style={gridStyle}>{categories.map((category) => <Toggle key={category} checked={!learning.pausedCategories.includes(category)} onChange={(active) => setLearning((current) => setCategoryPaused(current, category, !active))} label={category} description={learning.pausedCategories.includes(category) ? "Paused" : "Observing quietly"} />)}</div></fieldset> : null}
        <div style={{ paddingTop: 18, borderTop: "1px solid var(--color-border)" }}><p className="eyebrow">What Rhythm has learned</p><p style={mutedStyle}>{visiblePatterns.length ? "Review, correct, or remove anything here. Only Confirmed patterns may shape suggestions." : "Rhythm is still learning how you work."}</p><div style={{ ...gridStyle, marginTop: 16 }}>{visiblePatterns.map((pattern) => <PatternCard key={pattern.id} pattern={pattern} onAnswer={(response) => setLearning((current) => answerPattern(current, pattern.id, response))} onEdit={(value) => setLearning((current) => editPattern(current, pattern.id, value))} onRemove={() => setLearning((current) => removePattern(current, pattern.id))} />)}</div></div>
      </SettingsSection>

      <SettingsSection icon={<Bell size={17} />} title="Notifications" description="Keep reminders useful and quiet.">
        <Toggle checked={preferences.browserNotifications} onChange={(value) => updatePreference("browserNotifications", value)} label="Browser reminders" description="Reminder timing can use confirmed patterns only." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}><label style={{ fontSize: 11 }}>Quiet from<input type="time" value={preferences.quietStart} onChange={(event) => updatePreference("quietStart", event.target.value)} style={{ ...inputStyle, display: "block", marginTop: 6 }} /></label><label style={{ fontSize: 11 }}>Until<input type="time" value={preferences.quietEnd} onChange={(event) => updatePreference("quietEnd", event.target.value)} style={{ ...inputStyle, display: "block", marginTop: 6 }} /></label></div>
      </SettingsSection>

      <SettingsSection icon={<Clock3 size={17} />} title="Working preferences" description="Explicit preferences are used as stated; observed changes still require confirmation."><div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}><label style={{ fontSize: 11 }}>Start<input type="time" value={preferences.workingStart} onChange={(event) => updatePreference("workingStart", event.target.value)} style={{ ...inputStyle, display: "block", marginTop: 6 }} /></label><label style={{ fontSize: 11 }}>Finish<input type="time" value={preferences.workingEnd} onChange={(event) => updatePreference("workingEnd", event.target.value)} style={{ ...inputStyle, display: "block", marginTop: 6 }} /></label><label style={{ flex: "1 1 220px", fontSize: 11 }}>Timezone<select value={preferences.timezone} onChange={(event) => updatePreference("timezone", event.target.value)} style={{ ...inputStyle, display: "block", width: "100%", marginTop: 6 }}><option>Asia/Manila</option><option>UTC</option><option>America/New_York</option><option>Europe/London</option></select></label></div></SettingsSection>

      <SettingsSection icon={<Shield size={17} />} title="Privacy" description="Export or remove locally saved learning preferences. Connection permissions stay with each provider."><div style={rowStyle}><Button type="button" onClick={exportData}><Download size={15} /> Export learning data</Button><ConfirmAction label="Delete local preferences" title="Delete local preferences?" description="This removes learned patterns, quiet hours, working preferences, and accessibility choices saved in this browser. Tasks, Rhythms, Calendar events, and provider data stay untouched." confirmLabel="Delete preferences" tone="danger" onConfirm={deleteLocalSettings} /></div></SettingsSection>

      <SettingsSection icon={<Eye size={17} />} title="Accessibility" description="Keep state changes clear and comfortable."><Toggle checked={preferences.reducedMotion} onChange={(value) => updatePreference("reducedMotion", value)} label="Reduce motion" description="Minimizes transitions in Rhythm where supported." /><Toggle checked={preferences.higherContrast} onChange={(value) => updatePreference("higherContrast", value)} label="Higher contrast" description="Strengthens text and control boundaries where supported." /></SettingsSection>
    </div>
  </div>;
}
