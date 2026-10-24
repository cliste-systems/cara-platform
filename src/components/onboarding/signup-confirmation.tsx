import Image from "next/image";
import styles from "./signup-confirmation.module.css";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock3, CloudCheck } from "lucide-react";
import { signupBody, signupDisplay } from "@/components/onboarding/brand-fonts";

export function SignupConfirmation({ continueHref = "/dashboard?welcome=1" }: { continueHref?: string }) {

  return (
    <main className={`${signupBody.className} min-h-dvh bg-white text-[#292929] antialiased`}>
      <div className="mx-auto flex min-h-dvh w-[calc(100%-32px)] max-w-[840px] flex-col justify-center py-6 sm:w-[calc(100%-64px)] sm:py-10">
        <section aria-labelledby="confirmation-title" className="px-5 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto flex max-w-[460px] flex-col items-center text-center">
            <div className={`${styles.graphic} relative mb-5 h-[220px] w-[240px] sm:h-[260px] sm:w-[280px]`} style={{ maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)" }}>
              <Image src="/cara-confirmation-v1.png" alt="Cara welcomes you to HelloCara" fill priority sizes="(min-width: 640px) 280px, 240px" className="object-contain" />
            </div>
            <p className={`${styles.confirmed} flex items-center gap-2 text-[13px] text-[#626262]`}><CircleCheck className={styles.check} size={20} strokeWidth={1.5} aria-hidden />Billing confirmed</p>
            <h1 id="confirmation-title" className={`${signupDisplay.className} ${styles.heading} mt-5 text-[29px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[36px]`}>Let’s get Cara ready for your business.</h1>
            <p className={`${styles.description} mt-3 max-w-[320px] text-sm leading-6 text-[#626262]`}>Set up Cara and verify your business to unlock your dashboard.</p>
            <Link href={continueHref} prefetch={false} className={`${styles.action} mt-5 flex min-h-12 w-full max-w-[360px] items-center justify-center gap-3 rounded-full bg-[#292929] px-6 text-sm font-medium text-white transition-colors hover:bg-[#151515] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#292929]`}>Set up Cara <ArrowRight size={17} aria-hidden /></Link>
            <div className={`${styles.description} mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] leading-5 text-[#626262]`}>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={14} strokeWidth={1.5} aria-hidden />About 5–10 minutes</span>
              <span className="inline-flex items-center gap-1.5"><CloudCheck size={15} strokeWidth={1.5} aria-hidden />Saves automatically</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
