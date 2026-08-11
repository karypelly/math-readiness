import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math Readiness Assessment",
  description: "Math readiness assessment from Infinite Solutions Tutoring",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
