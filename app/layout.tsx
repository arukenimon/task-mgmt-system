import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Hub | Internal workflow",
  description: "Role-aware internal task management for client delivery teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
