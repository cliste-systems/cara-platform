"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, MoveHorizontal } from "lucide-react";

import {
  buildEmailFrameDocument,
  emailContentHeight,
  emailHasExternalImages,
} from "@/lib/email-message-rendering";
import { cn } from "@/lib/utils";

function EmailHtmlFrame({
  html,
  stripOpenTrackingPixel,
  allowExternalImages,
}: {
  html: string;
  stripOpenTrackingPixel: boolean;
  allowExternalImages: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [height, setHeight] = useState(200);
  const [wide, setWide] = useState(false);
  const srcDoc = useMemo(
    () =>
      buildEmailFrameDocument(html, {
        stripOpenTrackingPixel,
        allowExternalImages,
      }),
    [html, stripOpenTrackingPixel, allowExternalImages],
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  const handleLoad = useCallback(() => {
    cleanupRef.current?.();
    const frame = frameRef.current;
    const container = containerRef.current;
    const documentNode = frame?.contentDocument;
    if (!frame || !container || !documentNode?.body) return;

    let animationFrame = 0;
    let disposed = false;
    const measure = () => {
      animationFrame = 0;
      if (disposed || !container.clientWidth) return;
      const availableWidth = container.clientWidth;
      // Reflow email layouts at the available width first. Truly fixed-width
      // content gets a horizontal scroll area without shrinking its text.
      frame.style.width = `${availableWidth}px`;
      const contentWidth = Math.max(
        availableWidth,
        documentNode.body.scrollWidth,
      );
      frame.style.width = `${contentWidth}px`;
      setWide(contentWidth > availableWidth + 4);
      setHeight(emailContentHeight(documentNode.body));
    };
    const scheduleMeasure = () => {
      if (!disposed && !animationFrame) {
        animationFrame = window.requestAnimationFrame(measure);
      }
    };

    for (const link of documentNode.querySelectorAll("a")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(documentNode.body);
    observer.observe(container);
    documentNode.addEventListener("load", scheduleMeasure, true);
    documentNode.addEventListener("error", scheduleMeasure, true);
    void documentNode.fonts.ready.then(scheduleMeasure);
    scheduleMeasure();

    cleanupRef.current = () => {
      disposed = true;
      observer.disconnect();
      documentNode.removeEventListener("load", scheduleMeasure, true);
      documentNode.removeEventListener("error", scheduleMeasure, true);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      {wide ? (
        <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
          <MoveHorizontal className="size-3.5 shrink-0" aria-hidden />
          This email has a wide layout. Scroll sideways to see all of it.
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="max-w-full overflow-x-auto overscroll-x-contain"
      >
        <iframe
          ref={frameRef}
          title="Email message"
          srcDoc={srcDoc}
          onLoad={handleLoad}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          scrolling="no"
          className="block w-full border-0 bg-white"
          style={{ height }}
        />
      </div>
    </>
  );
}

export function EmailMessageBody({
  html,
  text,
  stripOpenTrackingPixel = false,
}: {
  html: string | null;
  text: string;
  stripOpenTrackingPixel?: boolean;
}) {
  const [view, setView] = useState<"formatted" | "plain">("formatted");
  const [allowExternalImages, setAllowExternalImages] = useState(false);
  const hasHtml = Boolean(html?.trim());
  const showHtml = hasHtml && view === "formatted";
  const hasRemoteImages = useMemo(
    () => (html ? emailHasExternalImages(html) : false),
    [html],
  );

  return (
    <section aria-label="Message content" className="min-w-0">
      {hasHtml ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/60 p-1"
            aria-label="Message display"
          >
            {(
              [
                ["formatted", "Original"],
                ["plain", "Plain text"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500",
                  view === value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {showHtml && hasRemoteImages && !allowExternalImages ? (
            <button
              type="button"
              onClick={() => setAllowExternalImages(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              title="Images are hidden until you choose to load them. Loading images may let the sender know you opened this email."
            >
              <ImageIcon className="size-3.5" aria-hidden />
              Show images
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {showHtml && html ? (
          <div className="p-4 sm:p-5">
            <EmailHtmlFrame
              key={allowExternalImages ? "images-visible" : "images-hidden"}
              html={html}
              stripOpenTrackingPixel={stripOpenTrackingPixel}
              allowExternalImages={allowExternalImages}
            />
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words p-5 text-[15px] leading-[1.8] text-slate-800 sm:p-7 [overflow-wrap:anywhere]">
            {text.trim() ||
              (hasHtml
                ? "This email has no plain-text content. Switch to Original to view the message."
                : "This email has no message body.")}
          </div>
        )}
      </div>
    </section>
  );
}
