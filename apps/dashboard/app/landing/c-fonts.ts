import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";

/** Shared C-direction faces so the landing and room pages render the same system. */
export const cSans = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--fx-sans",
});

export const cMono = Martian_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--fx-mono",
});
