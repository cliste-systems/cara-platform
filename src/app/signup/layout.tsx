import type {ReactNode} from 'react';
import {SignupJourneyLayout} from '@/components/onboarding/signup-journey-layout';
export default function SignupLayout({children}:{children:ReactNode}) {
 return <SignupJourneyLayout>{children}</SignupJourneyLayout>;
}
