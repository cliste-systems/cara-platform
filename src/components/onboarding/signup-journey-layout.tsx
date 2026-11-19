"use client";

import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import styles from './signup-journey-layout.module.css';

/** The rules belong to the journey, so changing a page only animates its contents. */
export function SignupJourneyLayout({children}:{children:ReactNode}) {
 const path=usePathname();
 const confirmation=path==='/signup/complete';
 return <div className={styles.journey}>
  {!confirmation&&<div aria-hidden="true" className={`${styles.rules} ${path==='/signup/plan'?styles.wide:''}`}><div/><span/></div>}
  {children}
 </div>;
}
