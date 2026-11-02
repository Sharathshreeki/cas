import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StallGrid, StallGridSkeleton } from "@/components/site/stall-grid";

export const metadata: Metadata = { title: "Stalls" };

export default function StallsPage() {
  return (
    <>
      <PageHeader title="Stalls" description="Choose a stall to see its menu and book a pickup slot." />
      <Suspense fallback={<StallGridSkeleton count={6} />}>
        <StallGrid />
      </Suspense>
    </>
  );
}
