import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="dark min-h-svh bg-zinc-950 text-foreground">
      <Navbar />
      {children}
    </div>
  );
}
