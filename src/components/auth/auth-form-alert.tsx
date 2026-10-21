"use client";

import { FormFeedback } from "@/components/ui/form-feedback";

export function AuthFormAlert({ message, title, className }: {
  message: string | null | undefined;
  title?: string;
  className?: string;
}) {
  return <FormFeedback message={message} title={title} className={className}/>;
}
