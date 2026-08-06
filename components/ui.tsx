"use client";

import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, LoaderCircle, X } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost" | "danger";
  iconOnly?: boolean;
};

export function Button({ variant = "soft", iconOnly = false, className = "", ...props }: ButtonProps) {
  return <button {...props} className={`ui-button ui-button--${variant}${iconOnly ? " ui-button--icon" : ""} ${className}`.trim()} />;
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
  className?: string;
};

export function Dialog({ open, onClose, title, children, labelledBy, className = "" }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const closeDialog = useCallback(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
    if (lastFocused.current && document.contains(lastFocused.current)) lastFocused.current.focus();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      lastFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      requestAnimationFrame(() => {
        const first = dialog.querySelector<HTMLElement>("[autofocus], input, select, textarea, button, [tabindex]:not([tabindex='-1'])");
        first?.focus();
      });
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogElement = dialog;
    function handleCancel(event: Event) {
      event.preventDefault();
      closeDialog();
    }
    function handleClose() {
      if (lastFocused.current && document.contains(lastFocused.current)) lastFocused.current.focus();
    }
    function containFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = [...dialogElement.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")].filter((item) => !item.hasAttribute("disabled") && item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("keydown", containFocus);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("keydown", containFocus);
    };
  }, [closeDialog]);

  return (
    <dialog ref={dialogRef} className={`ui-dialog ${className}`.trim()} aria-labelledby={labelledBy ?? titleId} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <div className="ui-dialog__surface">
        <div className="ui-dialog__heading">
          <h2 id={labelledBy ?? titleId}>{title}</h2>
          <Button type="button" variant="ghost" iconOnly aria-label={`Close ${title}`} onClick={closeDialog}><X size={17} aria-hidden="true" /></Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Sheet(props: DialogProps) {
  return <Dialog {...props} className={`ui-sheet ${props.className ?? ""}`} />;
}

export function Toast({ label, onUndo, onDismiss }: { label: string; onUndo?: () => void; onDismiss?: () => void }) {
  return <div className="ui-toast" role="status" aria-live="polite">
    <Check size={16} aria-hidden="true" />
    <span>{label}</span>
    {onUndo ? <Button variant="ghost" onClick={onUndo}>Undo</Button> : null}
    {onDismiss ? <Button variant="ghost" iconOnly aria-label="Dismiss notification" onClick={onDismiss}><X size={15} aria-hidden="true" /></Button> : null}
  </div>;
}

export function StatusMessage({ children, tone = "notice" }: { children: ReactNode; tone?: "notice" | "error" }) {
  return <div className={`status-message status-message--${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state__mark" aria-hidden="true"><Check size={18} /></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label}><LoaderCircle size={18} aria-hidden="true" /></span>;
}

type ConfirmActionProps = {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "danger" | "neutral";
};

export function ConfirmAction({ label, title, description, confirmLabel, onConfirm, tone = "neutral" }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant={tone === "danger" ? "danger" : "soft"} onClick={() => setOpen(true)}>{label}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title={title}>
      <p className="ui-dialog__description">{description}</p>
      <div className="ui-dialog__actions">
        <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" variant={tone === "danger" ? "danger" : "primary"} onClick={() => { onConfirm(); setOpen(false); }}>{confirmLabel}</Button>
      </div>
    </Dialog>
  </>;
}
