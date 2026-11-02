import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="System-wide ordering and pickup-slot policies." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireUser(["ADMIN"], "/admin/settings");
  return <SettingsForm settings={await getSettings()} />;
}
