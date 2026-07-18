"use client";

import React, {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type FormOutcome = "success" | "error" | null;

type ExpandableCreateFormProps = {
  id: string;
  title: string;
  buttonLabel: string;
  submitAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  formClassName?: string;
  encType?: "application/x-www-form-urlencoded" | "multipart/form-data";
  outcome?: FormOutcome;
  onSubmitCapture?: (event: FormEvent<HTMLFormElement>) => void;
};

const pendingDrafts = new Map<string, FormData>();

function restoreDraft(form: HTMLFormElement, draft: FormData) {
  const handledNames = new Set<string>();

  for (const element of Array.from(form.elements)) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      continue;
    }
    if (!element.name || handledNames.has(element.name)) continue;

    handledNames.add(element.name);
    const values = draft.getAll(element.name);
    if (values.length === 0) continue;

    if (element instanceof HTMLInputElement && element.type === "file") {
      const files = values.filter((value): value is File => value instanceof File);
      if (files.length > 0 && typeof DataTransfer !== "undefined") {
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        element.files = transfer.files;
      }
      continue;
    }

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      const matchingElements = form.elements.namedItem(element.name);
      const controls =
        matchingElements instanceof RadioNodeList
          ? Array.from(matchingElements)
          : [matchingElements];
      controls.forEach((control) => {
        if (control instanceof HTMLInputElement) {
          control.checked = values.some((value) => String(value) === control.value);
        }
      });
      continue;
    }

    if (element instanceof HTMLSelectElement && element.multiple) {
      const selectedValues = new Set(values.map(String));
      Array.from(element.options).forEach((option) => {
        option.selected = selectedValues.has(option.value);
      });
      continue;
    }

    element.value = String(values[0]);
  }
}

export function ExpandableCreateForm({
  id,
  title,
  buttonLabel,
  submitAction,
  children,
  formClassName = "",
  encType,
  outcome = null,
  onSubmitCapture,
}: ExpandableCreateFormProps) {
  const generatedId = useId();
  const regionId = `${id}-${generatedId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (outcome === "success") {
      pendingDrafts.delete(id);
      formRef.current?.reset();
      setOpen(false);
      return;
    }

    if (outcome === "error") {
      const draft = pendingDrafts.get(id);
      if (draft && formRef.current) {
        restoreDraft(formRef.current, draft);
        setOpen(true);
      }
    }
  }, [id, outcome]);

  useEffect(() => {
    if (!open) return;
    const firstField = formRef.current?.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:not([type='hidden']), select, textarea");
    firstField?.focus();
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    pendingDrafts.set(id, new FormData(event.currentTarget));
    onSubmitCapture?.(event);
  }

  function handleCancel() {
    pendingDrafts.delete(id);
    formRef.current?.reset();
    setOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto"
        >
          {open ? "FECHAR" : buttonLabel}
        </button>
      </div>

      <div
        id={regionId}
        role="region"
        aria-label={title}
        aria-hidden={!open}
        className={`grid min-w-0 transition-[grid-template-rows,opacity,visibility] duration-200 ease-out ${
          open
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-w-0 overflow-hidden">
          <form
            ref={formRef}
            action={submitAction}
            encType={encType}
            onSubmitCapture={handleSubmit}
            className={`min-w-0 pt-4 [&>input]:min-w-0 [&>input]:w-full [&>select]:min-w-0 [&>select]:w-full [&>textarea]:min-w-0 [&>textarea]:w-full ${formClassName}`}
          >
            {children}
            <div className="col-span-full">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 sm:w-auto"
              >
                CANCELAR
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
