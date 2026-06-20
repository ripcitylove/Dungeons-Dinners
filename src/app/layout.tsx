import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel, Cinzel_Decorative } from "next/font/google";
import "./globals.css";
import { MusicPlayer } from "../components/MusicPlayer";
import { FontScaleApplier } from "../components/FontScaleApplier";
import { TooltipSizeControl } from "../components/TooltipSizeControl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["700", "900"],
});

// Ornate display face for the epic title header — more fantastical than Cinzel.
const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel-decorative",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "Dungeons & Dinner Legends",
  description: "A premium AI-driven D&D campaign platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${cinzelDecorative.variable}`}>
        <FontScaleApplier />
        <TooltipSizeControl />
        {children}
        <MusicPlayer />
      </body>
    </html>
  );
}
