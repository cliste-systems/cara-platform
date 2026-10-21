import type { Metadata } from "next";



export const metadata: Metadata = {
  title: "Legal — HelloCara",
  description:
    "Privacy, terms, sub-processors and cookie information for the Cliste AI voice platform.",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
