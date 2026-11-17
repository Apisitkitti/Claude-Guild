import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Guild ⚔️",
  description: "Pixel-art fantasy guild where each Claude Code session is an adventurer on a quest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
