"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./confirm-dialog";

/** Keep page and dialog drafts intact when following dashboard links. */
export function UnsavedDraftGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname &&
          url.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  return (
    <ConfirmDialog
      open={Boolean(destination)}
      onOpenChange={(open) => {
        if (!open) setDestination(null);
      }}
      title="Leave these edits?"
      description="Your changes haven’t been saved. Stay here to finish editing, or leave without saving."
      confirmLabel="Leave without saving"
      cancelLabel="Keep editing"
      onConfirm={() => {
        const href = destination;
        setDestination(null);
        if (href) router.push(href);
      }}
    />
  );
}
