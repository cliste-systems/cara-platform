import { OnboardingCanvasBackground } from "./onboarding-canvas-background";
import { OnboardingMotionShell } from "./onboarding-motion-shell";
export function SignupOnboardingShell({children}: {children: React.ReactNode}) {
  return <main className="fixed inset-0 flex h-dvh flex-col overflow-hidden text-slate-900"><OnboardingCanvasBackground /><div className="relative z-[1] flex min-h-0 flex-1 flex-col"><OnboardingMotionShell>{children}</OnboardingMotionShell></div></main>;
}
