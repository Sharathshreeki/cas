import { z } from "zod";

// Shared input validation (NFR-10, NFR-24). Used by Server Actions and Route Handlers.

const name = z.string().trim().min(2, { error: "Name must be at least 2 characters." }).max(100);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }))
  .pipe(z.string().max(150));
const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, { error: "Enter a 10-digit Indian mobile number." });
const password = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." })
  .max(72, { error: "Password must be at most 72 characters." })
  .regex(/[A-Za-z]/, { error: "Password must contain a letter." })
  .regex(/\d/, { error: "Password must contain a number." });

// PES SRNs look like PES1UG21CS123 / PES2PG23CA045.
export const srnSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^PES[1-9](UG|PG)\d{2}[A-Z]{2}\d{3}$/, { error: "Enter a valid SRN, e.g. PES1UG21CS123." });

export const registerSchema = z
  .object({
    name,
    email,
    srn: srnSchema,
    phone,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }).max(72),
});

export const profileSchema = z.object({
  name,
  phone: phone.or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Enter your current password." }),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const MAX_QTY_PER_ITEM = 10;

export const placeOrderSchema = z.object({
  stallId: z.string().min(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z
          .number()
          .int({ error: "Quantities must be whole numbers." })
          .min(1, { error: "Quantities must be at least 1." })
          .max(MAX_QTY_PER_ITEM, { error: `At most ${MAX_QTY_PER_ITEM} of an item per order.` }),
        /** Price the student saw; the server rejects the order if it changed (FR-24). */
        expectedPrice: z.number().nonnegative(),
      }),
    )
    .min(1, { error: "Your cart is empty." })
    .max(30),
  slotStart: z.iso.datetime({ error: "Choose a pickup slot." }),
  paymentMethod: z.enum(["CASH_ON_PICKUP", "SIMULATED_ONLINE"]),
  note: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().min(8).max(64),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }).max(100),
  description: z.string().trim().max(300).optional().default(""),
  category: z.string().trim().min(2, { error: "Category is required." }).max(40),
  price: z.coerce
    .number({ error: "Enter a price." })
    .positive({ error: "Price must be greater than 0." })
    .max(10000, { error: "Price looks too high." })
    .multipleOf(0.01, { error: "Use at most 2 decimal places." }),
  prepTimeMinutes: z.coerce
    .number({ error: "Enter a preparation time." })
    .int({ error: "Use whole minutes." })
    .min(1, { error: "At least 1 minute." })
    .max(120, { error: "At most 120 minutes." }),
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Use HH:MM (24-hour)." });

export const stallSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }).max(100),
    description: z.string().trim().max(500).optional().default(""),
    location: z.string().trim().max(120).optional().default(""),
    opensAt: hhmm,
    closesAt: hhmm,
    slotCapacity: z.coerce
      .number()
      .int()
      .min(1, { error: "Capacity must be at least 1 order." })
      .max(200),
    isOpen: z.boolean(),
  })
  .refine((v) => v.opensAt < v.closesAt, { error: "Closing time must be after opening time.", path: ["closesAt"] });

export const slotCapacitySchema = z.object({
  slotCapacity: z.coerce
    .number({ error: "Enter a capacity." })
    .int({ error: "Use a whole number." })
    .min(1, { error: "Capacity must be at least 1 order." })
    .max(200, { error: "Capacity must be at most 200 orders." }),
});

export const createAccountSchema = z.object({
  name,
  email,
  phone: phone.or(z.literal("")),
  role: z.enum(["STAFF", "ADMIN"]),
  stallId: z.string().optional().default(""),
  password,
});

export const settingsSchema = z.object({
  orderingEnabled: z.boolean(),
  minLeadMinutes: z.coerce.number().int().min(0).max(240),
  bookingDays: z.coerce.number().int().min(1).max(7),
  geofenceEnabled: z.boolean(),
  geofenceLat: z.coerce.number().min(-90).max(90),
  geofenceLng: z.coerce.number().min(-180).max(180),
  geofenceRadiusMeters: z.coerce.number().int().min(50).max(20000),
});

/** Flattens Zod issues into `{ field: [messages] }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
