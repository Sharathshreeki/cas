import { StoreIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function UnassignedPage() {
  return (
    <EmptyState
      icon={StoreIcon}
      title="No stall assigned"
      description="Your staff account isn't linked to a stall yet. Ask the canteen administrator to assign you to one."
      className="mt-10"
    />
  );
}
