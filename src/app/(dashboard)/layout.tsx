import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Navbar />
      {children}
    </div>
  );
}
