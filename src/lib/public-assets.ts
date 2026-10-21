/**
 * Opaque public asset paths — avoid descriptive filenames in the browser network tab.
 * When adding or replacing files in `public/`, update this map and rename on disk.
 */
export const PUBLIC_ASSETS = {
  logo: "/m8x4p2n7.png",
  /** Dashboard main-pane background (cara05, 3840×2400). */
  dashboard: {
    background: { jpg: "/j6m3t9w2.jpg", webp: "/j6m3t9w2.webp" },
    homeHero: { png: "/p3n7k2w8.png" },
    /** Home footer banner (cara33, 2800×300). */
    homeFooter: { png: "/w9c4r3a3.png" },
  },
  signupScenes: {
    setup: {jpg:"/cara-setup-help.jpg",webp:"/cara-setup-help.webp",smallWebp:"/cara-setup-help-960.webp",blend:true},
    signup: {jpg:"/v6q2a9s8.jpg",webp:"/v6q2a9s8.webp",smallWebp:"/v6q2a9s8-960.webp",blend:true},
    voice: {jpg:"/v6q2a9s5.jpg",webp:"/v6q2a9s5.webp",smallWebp:"/v6q2a9s5-960.webp",blend:true},
    plans: {jpg:"/v6q2a9s6.jpg",webp:"/v6q2a9s6.webp",smallWebp:"/v6q2a9s6-960.webp",blend:true},
    billing: {jpg:"/cara-payment-v2.jpg",webp:"/cara-payment-v2.webp",smallWebp:"/cara-payment-v2-960.webp",blend:true},
  },
  onboarding: {
    default2x: { jpg: "/k3w9r1t5.jpg", webp: "/k3w9r1t5.webp" },
    source: "/s1c8e5t0.jpg",
    heroProfile: { jpg: "/h2n6v4k8.jpg", webp: "/h2n6v4k8.webp" },
    heroVoice: { jpg: "/j5q8w3r1.jpg", webp: "/j5q8w3r1.webp" },
    heroKnowledge: { jpg: "/x7k3m9p2.jpg", webp: "/x7k3m9p2.webp" },
    heroActionsOnward: { jpg: "/n6p2x9w4.jpg", webp: "/n6p2x9w4.webp" },
    heroPlan: { jpg: "/k8m3n7p2.jpg", webp: "/k8m3n7p2.webp" },
    authSignup: { jpg: "/cara-signin-v1.jpg", webp: "/cara-signin-v1.webp", ruled: true },
  },
} as const;
