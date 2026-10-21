"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  className?: string;
};

/**
 * Run verification in the background, showing Cloudflare only if interaction is
 * required. Keep this mounted for the life of the form so a single-use token can be
 * read on submit and the widget can be reset in place after a server rejection.
 * Do NOT unmount on success — remounting replays the challenge and burns tokens.
 */
export const AuthTurnstileField = forwardRef<TurnstileInstance, Props>(
  function AuthTurnstileField(
    { siteKey, onSuccess, onExpire, className },
    ref,
  ) {
    return (
      <div
        data-auth-turnstile
        className={cn(
          "flex w-full shrink-0 justify-center",
          className,
        )}
      >
        <Turnstile
          ref={ref}
          siteKey={siteKey}
          onSuccess={onSuccess}
          onExpire={onExpire}
          options={{
            theme: "light",
            size: "flexible",
            appearance: "interaction-only",
          }}
        />
      </div>
    );
  },
);
