import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetingEconomy",
  description: "Meeting cost analytics, waste detection, and MOM generation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
