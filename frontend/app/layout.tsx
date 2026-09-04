import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AERIS Drone Command",
  description: "AERIS environmental surveillance dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}