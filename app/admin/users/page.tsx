import type { Metadata } from "next";
import { Suspense } from "react";
import { UserManager } from "@/components/admin/user-manager";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 100;

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <PageHeader title="Users" description="Manage roles, account status and staff stall assignments." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const admin = await requireUser(["ADMIN"], "/admin/users");
  const { q, role } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const where: Prisma.UserWhereInput = {
    ...(role === "STUDENT" || role === "STAFF" || role === "ADMIN" ? { role } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { srn: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [users, total, stalls] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { name: "asc" }],
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, srn: true, role: true, status: true, stallId: true },
    }),
    db.user.count({ where }),
    db.stall.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <UserManager users={users} stalls={stalls} currentUserId={admin.id} total={total} />;
}
