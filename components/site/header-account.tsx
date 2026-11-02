import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/site/account-menu";
import { getCurrentUser } from "@/lib/auth/dal";
import { unreadCount } from "@/lib/services/notifications";

export async function HeaderAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button asChild size="sm" className="ml-1">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  const unread = user.role === "ADMIN" ? 0 : await unreadCount(user);
  return <AccountMenu user={{ name: user.name, email: user.email, role: user.role }} unread={unread} />;
}
