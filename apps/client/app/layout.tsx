import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tong Hackathon Mock UI",
  description: "Mobile-first mock demo with captions, game flow, and media personalization"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
