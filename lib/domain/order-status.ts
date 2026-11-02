// Order lifecycle rules (SRS §3.4, BR-08, NFR-19).
// See decisions/0005-order-lifecycle-and-cancellation.md.

export const ORDER_STATUSES = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
export type ActorRole = "STUDENT" | "STAFF" | "ADMIN";

/** Transitions staff (and admins) may perform. */
const STAFF_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  PLACED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

/** Students may only cancel before the stall has accepted the order. */
const STUDENT_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  PLACED: ["CANCELLED"],
  ACCEPTED: [],
  PREPARING: [],
  READY: [],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function allowedTransitions(from: OrderStatusValue, role: ActorRole): OrderStatusValue[] {
  return role === "STUDENT" ? STUDENT_TRANSITIONS[from] : STAFF_TRANSITIONS[from];
}

export function canTransition(from: OrderStatusValue, to: OrderStatusValue, role: ActorRole): boolean {
  return allowedTransitions(from, role).includes(to);
}

export function isTerminal(status: OrderStatusValue): boolean {
  return status === "COMPLETED" || status === "CANCELLED" || status === "REJECTED";
}

/** Statuses that release the reserved pickup-slot capacity (FR-45, BR-15). */
export function releasesSlot(status: OrderStatusValue): boolean {
  return status === "CANCELLED" || status === "REJECTED";
}

/** Timestamp column recorded when an order enters a status (FR-35). */
export const STATUS_TIMESTAMP_FIELD = {
  PLACED: "placedAt",
  ACCEPTED: "acceptedAt",
  PREPARING: "preparingAt",
  READY: "readyAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
  REJECTED: "cancelledAt",
} as const satisfies Record<OrderStatusValue, string>;

export const STATUS_LABEL: Record<OrderStatusValue, string> = {
  PLACED: "Placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/** Verb shown on the staff button that performs a transition. */
export const TRANSITION_ACTION_LABEL: Partial<Record<OrderStatusValue, string>> = {
  ACCEPTED: "Accept",
  PREPARING: "Start preparing",
  READY: "Mark ready",
  COMPLETED: "Hand over",
  REJECTED: "Reject",
  CANCELLED: "Cancel",
};

/** The happy-path steps, used for the student progress tracker. */
export const PROGRESS_STEPS: OrderStatusValue[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

export function statusNotification(code: string, status: OrderStatusValue): string {
  switch (status) {
    case "ACCEPTED":
      return `Order ${code} was accepted by the stall.`;
    case "PREPARING":
      return `Order ${code} is being prepared.`;
    case "READY":
      return `Order ${code} is ready for pickup.`;
    case "COMPLETED":
      return `Order ${code} was handed over. Enjoy your meal!`;
    case "CANCELLED":
      return `Order ${code} was cancelled.`;
    case "REJECTED":
      return `Order ${code} was rejected by the stall.`;
    default:
      return `Order ${code} was placed.`;
  }
}
