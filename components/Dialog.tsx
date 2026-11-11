"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** red confirm button for destructive actions */
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  message?: ReactNode;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
};

type Request = { id: number } & (
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOptions)
);

type DialogApi = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

/** Promise-based replacements for window.confirm/prompt: `if (await dialog.confirm({...}))`. */
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used inside <DialogProvider>");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const nextId = useRef(0);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setReq({ id: ++nextId.current, kind: "confirm", resolve, ...o })),
    [],
  );
  const prompt = useCallback(
    (o: PromptOptions) => new Promise<string | null>((resolve) => setReq({ id: ++nextId.current, kind: "prompt", resolve, ...o })),
    [],
  );

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {req && <Modal key={req.id} req={req} onClose={() => setReq(null)} />}
    </DialogContext.Provider>
  );
}

function Modal({ req, onClose }: { req: Request; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(req.kind === "prompt" ? (req.defaultValue ?? "") : "");
  const [closing, setClosing] = useState(false);
  const settled = useRef(false);

  // native <dialog>: traps focus, closes on Esc, and sits above everything
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    if (req.kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (!req.danger) {
      confirmRef.current?.focus();
    }
  }, [req]);

  function finish(ok: boolean) {
    if (settled.current) return;
    settled.current = true;
    if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok && value.trim() ? value.trim() : null);
    setClosing(true);
    setTimeout(() => {
      ref.current?.close();
      onClose();
    }, 140);
  }

  const danger = req.kind === "confirm" && req.danger;
  const confirmLabel = req.confirmLabel ?? (req.kind === "prompt" ? "Save" : "OK");

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      onClick={(e) => {
        // click on the backdrop closes it
        if (e.target === ref.current) finish(false);
      }}
      aria-labelledby="dialog-title"
      className={`m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px] ${
        closing ? "animate-[dialogOut_140ms_ease-in_both]" : "animate-[dialogIn_180ms_ease-out_both]"
      }`}
    >
      <form
        method="dialog"
        className="p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <div className="flex items-start gap-3">
          {danger && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="font-serif text-2xl leading-tight">
              {req.title}
            </h2>
            {req.message && <div className="mt-1.5 text-sm text-muted">{req.message}</div>}
          </div>
        </div>

        {req.kind === "prompt" && (
          <label className="mt-4 block text-sm">
            {req.label && <span className="font-medium">{req.label}</span>}
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={req.placeholder}
              maxLength={req.maxLength ?? 200}
              className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-gold"
            />
          </label>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm hover:bg-cream"
          >
            {req.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            disabled={req.kind === "prompt" && !value.trim()}
            className={`rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 ${
              danger ? "bg-red-700 hover:bg-red-800" : "bg-ink hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
