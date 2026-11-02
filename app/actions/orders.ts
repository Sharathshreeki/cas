"use server";

import { refresh } from "next/cache";
import { AuthError, authorizeAction } from "@/lib/auth/dal";
import { OrderError, placeOrder as placeOrderService, simulateOnlinePayment, transitionOrder } from "@/lib/services/orders";
import { fieldErrors, placeOrderSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

function failure(error: unknown): ActionResult<never> {
  if (error instanceof OrderError) return { ok: false, error: error.message, code: error.code, details: error.details };
  if (error instanceof AuthError) return { ok: false, error: error.message, code: "UNAUTHORIZED" };
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

// UC-01: FR-27…FR-30, FR-37, FR-39…FR-42
export async function placeOrder(input: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await authorizeAction(["STUDENT"]);
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Some order details are invalid.", fieldErrors: fieldErrors(parsed.error) };
    }
    const order = await placeOrderService(user.id, parsed.data);
    return { ok: true, data: { code: order.code } };
  } catch (error) {
    return failure(error);
  }
}

// FR-36: students may cancel only while the order is still PLACED.
export async function cancelMyOrder(orderId: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await authorizeAction(["STUDENT"]);
    await transitionOrder({ id: user.id, role: "STUDENT", stallId: null }, orderId, "CANCELLED", reason?.slice(0, 200));
    refresh();
    return { ok: true, message: "Order cancelled." };
  } catch (error) {
    return failure(error);
  }
}

// FR-34, BR-07, BR-08
export async function updateOrderStatus(orderId: string, to: OrderStatus, note?: string): Promise<ActionResult> {
  try {
    const user = await authorizeAction(["STAFF"]);
    const result = await transitionOrder({ id: user.id, role: "STAFF", stallId: user.stallId }, orderId, to, note?.slice(0, 200));
    refresh();
    return { ok: true, message: `Order ${result.code} updated.` };
  } catch (error) {
    return failure(error);
  }
}

// FR-49…FR-51 (simulated gateway — see decisions/0004-payments.md)
export async function payOrderOnline(orderId: string, outcome: "SUCCESS" | "FAILURE"): Promise<ActionResult> {
  try {
    const user = await authorizeAction(["STUDENT"]);
    const status = await simulateOnlinePayment(user.id, orderId, outcome === "SUCCESS" ? "SUCCESS" : "FAILURE");
    refresh();
    return status === "PAID"
      ? { ok: true, message: "Payment successful." }
      : { ok: false, error: "Payment failed. You have not been charged — try again or pay in cash at pickup." };
  } catch (error) {
    return failure(error);
  }
}
