import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProPlan Moves OS",
  description: "Operational workflow core for ProPlan Moves"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
