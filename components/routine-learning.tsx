"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Brain, Clock3, Download, Eye, Shield, UserRound } from "lucide-react";
import { Button, ConfirmAction, StatusMessage } from "@/components/ui";
import {
  LEARNING_STORAGE_KEY,
  addInference,
  answerPattern,
  editPattern,
  inferBehaviorPatterns,
  migrateLearningState,
  removePattern,
  seedLearningState,
  setCategoryPaused,
  type LearnedPattern,
  type LearningResponse,
  type LearningState,
  type LearningStatus,
} from "@/lib/learning";
import { useRhythm } from "@/components/rhythm-provider";

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
  return <label className="settings-toggle">
    <span className="settings-toggle__copy"><strong>{label}</strong>{description ? <span>{description}</span> : null}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="settings-toggle__control" aria-hidden="true"><i /></span>
  </label>;
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="settings-time-field"><span>{label}</span><div><Clock3 size={15} aria-hidden="true" /><input type="time" value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

function PatternCard({ pattern, onAnswer, onEdit, onRemove }: { pattern: LearnedPattern; onAnswer: (response: LearningResponse) => void; onEdit: (value: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pattern.value);
  const prompt = pattern.pendingChange?.question ?? pattern.question;
  const proposedValue = pattern.pendingChange?.value;
  const evidence = pattern.pendingChange?.evidence ?? pattern.evidence;
  const asksForConfirmation = pattern.status !== "confirmed" || Boolean(pattern.pendingChange);

  return <article className="learning-pattern">
    <div className="learning-pattern__heading">
      <div><span className="section-kicker">{pattern.category}</span><h3>{pattern.subject}</h3></div>
      <span className={`integration-status ${pattern.status === "confirmed" ? "integration-status--connected" : ""}`}>{statusLabel(pattern.status)}</span>
    </div>

    {editing ? <form className="learning-pattern__edit" onSubmit={(event) => { event.preventDefault(); onEdit(draft); setEditing(false); }}>
      <label>Pattern<input aria-label={`Edit ${pattern.subject} pattern`} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus /></label>
      <div><Button type="submit" variant="primary">Save</Button><Button type="button" onClick={() => { setDraft(pattern.value); setEditing(false); }}>Cancel</Button></div>
    </form> : <p className="learning-pattern__value">{proposedValue ? <><span>Current: {pattern.value}</span><br />Possible change: {proposedValue}</> : pattern.value}</p>}

    {asksForConfirmation ? <div className="learning-pattern__question">
      <p>{prompt}</p>
      <div>
        <Button type="button" variant="primary" onClick={() => onAnswer("yes")}>Yes</Button><Button type="button" onClick={() => onAnswer("sometimes")}>Sometimes</Button><Button type="button" onClick={() => onAnswer("no")}>No</Button><Button type="button" variant="ghost" onClick={() => onAnswer("keep-observing")}>Keep observing</Button>
      </div>
    </div> : null}

    <p className="learning-pattern__evidence">{evidence.summary} Sources: {evidence.sources.join(", ")}.</p>
    <div className="learning-pattern__actions">
      <Button type="button" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
      <ConfirmAction label="Remove" title={`Remove ${pattern.subject}?`} description="Rhythm will stop using this pattern. New observations may be offered later if enough evidence appears." confirmLabel="Remove pattern" tone="danger" onConfirm={onRemove} />
    </div>
  </article>;
}

function SettingsSection({ icon, title, description, children, wide = false }: { icon: ReactNode; title: string; description: string; children: ReactNode; wide?: boolean }) {
  return <section className={`settings-section ${wide ? "settings-section--wide" : ""}`}>
    <div className="settings-section__heading"><span aria-hidden="true">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>
    <div className="settings-section__body">{children}</div>
  </section>;
}

export function RoutineLearningSettings({ connections }: { connections: ReactNode }) {
  const { tasks, rhythms, rhythmCompletions, hydrated: workspaceHydrated } = useRhythm();
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
    document.documentElement.dataset.reduceMotion = String(preferences.reducedMotion);
    document.documentElement.dataset.higherContrast = String(preferences.higherContrast);
    try {
      window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(learning));
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      window.setTimeout(() => setStorageNotice("Changes are available for this visit, but this browser blocked local saving."), 0);
    }
  }, [hydrated, learning, preferences]);

  useEffect(() => {
    if (!hydrated || !workspaceHydrated) return;
    const observations = inferBehaviorPatterns({ tasks, rhythms, rhythmCompletions });
    if (!observations.length) return;
    const timer = window.setTimeout(() => setLearning((current) => observations.reduce(addInference, current)), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, rhythmCompletions, rhythms, tasks, workspaceHydrated]);

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
    <div className="settings-layout">
      <SettingsSection icon={<UserRound size={18} />} title="Account" description="Your local profile for this workspace."><div className="settings-account"><div><strong>Personal workspace</strong><p>Your responsibilities, without the noise.</p></div><span className="integration-status">Local</span></div></SettingsSection>

      <section className="settings-connections settings-section--wide" aria-labelledby="connections-heading"><div className="settings-connections__heading"><h2 id="connections-heading">Connections</h2><p>Calendar helps Rhythm understand time. Slack offers possible commitments for your approval.</p></div>{connections}</section>

      <SettingsSection wide icon={<Brain size={18} />} title="Routine learning" description="Observe → infer → ask → confirm → use. Unconfirmed patterns never shape plans or reminders.">
        <Toggle checked={learning.enabled} onChange={(enabled) => setLearning((current) => ({ ...current, enabled }))} label="Learn from my routine" description="Turn this off to stop new observations and prevent learned patterns from being used." />
        {categories.length ? <fieldset className="settings-categories"><legend>Categories being learned</legend><div>{categories.map((category) => <Toggle key={category} checked={!learning.pausedCategories.includes(category)} onChange={(active) => setLearning((current) => setCategoryPaused(current, category, !active))} label={category} description={learning.pausedCategories.includes(category) ? "Paused" : "Observing quietly"} />)}</div></fieldset> : null}
        <div className="learning-review"><p className="eyebrow">What Rhythm has learned</p><p>{visiblePatterns.length ? "Review, correct, or remove anything here. Only Confirmed patterns may shape suggestions." : "Rhythm is still learning how you work."}</p><div className="learning-patterns">{visiblePatterns.map((pattern) => <PatternCard key={pattern.id} pattern={pattern} onAnswer={(response) => setLearning((current) => answerPattern(current, pattern.id, response))} onEdit={(value) => setLearning((current) => editPattern(current, pattern.id, value))} onRemove={() => setLearning((current) => removePattern(current, pattern.id))} />)}</div></div>
      </SettingsSection>

      <SettingsSection icon={<Bell size={18} />} title="Notifications" description="Keep reminders useful and quiet.">
        <Toggle checked={preferences.browserNotifications} onChange={(value) => updatePreference("browserNotifications", value)} label="Browser reminders" description="Reminder timing can use confirmed patterns only." />
        <div className="settings-fields settings-fields--compact"><TimeField label="Quiet from" value={preferences.quietStart} onChange={(value) => updatePreference("quietStart", value)} /><TimeField label="Until" value={preferences.quietEnd} onChange={(value) => updatePreference("quietEnd", value)} /></div>
      </SettingsSection>

      <SettingsSection icon={<Clock3 size={18} />} title="Working preferences" description="Explicit preferences are used as stated; observed changes still require confirmation."><div className="settings-fields"><TimeField label="Start" value={preferences.workingStart} onChange={(value) => updatePreference("workingStart", value)} /><TimeField label="Finish" value={preferences.workingEnd} onChange={(value) => updatePreference("workingEnd", value)} /><label className="settings-field--wide">Timezone<select value={preferences.timezone} onChange={(event) => updatePreference("timezone", event.target.value)}><option>Asia/Manila</option><option>UTC</option><option>America/New_York</option><option>Europe/London</option></select></label></div></SettingsSection>

      <SettingsSection icon={<Shield size={18} />} title="Privacy" description="Export or remove locally saved learning preferences. Connection permissions stay with each provider."><div className="settings-actions"><Button type="button" onClick={exportData}><Download size={15} /> Export learning data</Button><ConfirmAction label="Delete local preferences" title="Delete local preferences?" description="This removes learned patterns, quiet hours, working preferences, and accessibility choices saved in this browser. Tasks, Rhythms, Calendar events, and provider data stay untouched." confirmLabel="Delete preferences" tone="danger" onConfirm={deleteLocalSettings} /></div></SettingsSection>

      <SettingsSection icon={<Eye size={18} />} title="Accessibility" description="Keep state changes clear and comfortable."><Toggle checked={preferences.reducedMotion} onChange={(value) => updatePreference("reducedMotion", value)} label="Reduce motion" description="Minimizes transitions in Rhythm where supported." /><Toggle checked={preferences.higherContrast} onChange={(value) => updatePreference("higherContrast", value)} label="Higher contrast" description="Strengthens text and control boundaries where supported." /></SettingsSection>
    </div>
  </div>;
}
