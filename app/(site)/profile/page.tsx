import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PasswordForm, ProfileForm } from "@/components/forms/profile-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Profile" };

const ROLE_LABEL = { STUDENT: "Student", STAFF: "Canteen staff", ADMIN: "Administrator" } as const;

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="Manage your contact details and password." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  const user = await requireUser(undefined, "/profile");
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, srn: true, phone: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Identity details are managed by the canteen administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 font-medium break-all">{record.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="mt-0.5 font-medium">
                {ROLE_LABEL[user.role]}
                {user.stallName ? ` · ${user.stallName}` : null}
              </dd>
            </div>
            {record.srn ? (
              <div>
                <dt className="text-muted-foreground">SRN</dt>
                <dd className="mt-0.5 font-mono font-medium">{record.srn}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm name={record.name} phone={record.phone ?? ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
