"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LabelsProvider } from "@/contexts/labels-context";
import { AreasProvider } from "@/contexts/areas-context";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dataVersion, setDataVersion] = useState(0);
  const financeAllowed = user?.role === "ADMIN" || user?.permissions?.financeiro === "view" || user?.permissions?.financeiro === "edit";

  useEffect(() => {
    const refreshPage = () => setDataVersion((version) => version + 1);
    window.addEventListener("hadar:assistant-updated", refreshPage);
    return () => window.removeEventListener("hadar:assistant-updated", refreshPage);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && user && pathname.startsWith("/financeiro") && !financeAllowed) {
      router.replace("/dashboard");
    }
  }, [financeAllowed, isLoading, pathname, router, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f5f5f4]">
        <div className="w-8 h-8 border-2 border-accent-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  if (pathname.startsWith("/financeiro") && !financeAllowed) return null;

  return (
    <LabelsProvider>
      <AreasProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-60 px-8 pb-8">
          <header className="sticky top-0 z-40 -mx-8 mb-6 px-8 py-3 flex items-center justify-end bg-[#f5f5f4]/85 backdrop-blur border-b border-gray-200/70">
            <NotificationBell />
          </header>
          <div key={dataVersion}>{children}</div>
        </main>
        <AssistantPanel />
      </div>
      </AreasProvider>
    </LabelsProvider>
  );
}
