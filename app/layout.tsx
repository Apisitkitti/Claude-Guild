import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Guild ⚔️",
  description: "Pixel-art fantasy guild where each Claude Code session is an adventurer on a quest",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="th">
    <body>{children}</body>
  </html>
);

export default RootLayout;
