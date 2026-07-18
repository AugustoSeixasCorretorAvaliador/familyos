"use client";

import React from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
  pendingOverride?: boolean;
};

export function SubmitButton({
  label,
  pendingLabel = "Salvando...",
  className,
  pendingOverride = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isPending = pending || pendingOverride;

  return (
    <button type="submit" disabled={isPending} className={className}>
      {isPending ? pendingLabel : label}
    </button>
  );
}
