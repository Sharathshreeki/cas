// Development seed: demo accounts, stalls, menus and ~6 weeks of SYNTHETIC
// order history so dashboards, reports and the forecast baseline have data.
// Every generated order has is_synthetic = true (SRS §8.2) so ML evaluation
// can exclude it. This script WIPES application tables — never run in production.

import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../lib/generated/prisma/client";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "../lib/generated/prisma/enums";
import { addDays, campusDateKey, campusMidnight } from "../lib/time";
import { slotsForDay, SLOT_MINUTES } from "../lib/domain/slots";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Deterministic PRNG so every seed produces the same history.
let state = 20261102;
function random() {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
}
const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

type SeedItem = [name: string, category: string, price: number, prep: number, veg: boolean, description: string];

const STALLS: {
  name: string;
  description: string;
  location: string;
  opensAt: number;
  closesAt: number;
  slotCapacity: number;
  staffEmail: string;
  staffName: string;
  items: SeedItem[];
}[] = [
  {
    name: "Main Canteen",
    description: "South Indian breakfast, lunch meals and all-day tiffin.",
    location: "Ground floor, B Block",
    opensAt: 7 * 60 + 30,
    closesAt: 19 * 60,
    slotCapacity: 12,
    staffEmail: "staff.main@canteen.pes.edu",
    staffName: "Ravi Kumar",
    items: [
      ["Masala Dosa", "Tiffin", 60, 10, true, "Crisp dosa with potato palya, chutney and sambar."],
      ["Idli Vada", "Tiffin", 45, 5, true, "Two idlis and a medu vada with sambar."],
      ["Set Dosa", "Tiffin", 55, 10, true, "Three soft dosas with sagu."],
      ["South Indian Meals", "Meals", 90, 5, true, "Rice, sambar, rasam, palya, curd and pickle."],
      ["Curd Rice", "Meals", 50, 3, true, "Tempered curd rice with pomegranate."],
      ["Bisi Bele Bath", "Meals", 65, 5, true, "Spiced rice and lentils with boondi."],
      ["Filter Coffee", "Beverages", 20, 3, true, "Strong decoction coffee."],
      ["Masala Chai", "Beverages", 15, 3, true, "Ginger and cardamom tea."],
    ],
  },
  {
    name: "Food Court Express",
    description: "North Indian thalis, rice bowls and rolls.",
    location: "Food court, MRD Block",
    opensAt: 11 * 60,
    closesAt: 20 * 60,
    slotCapacity: 10,
    staffEmail: "staff.express@canteen.pes.edu",
    staffName: "Anita Sharma",
    items: [
      ["Veg Thali", "Meals", 120, 8, true, "Two rotis, dal, paneer curry, rice and salad."],
      ["Chole Bhature", "Meals", 90, 10, true, "Spiced chickpeas with two bhature."],
      ["Paneer Butter Masala Bowl", "Rice Bowls", 110, 10, true, "Jeera rice with paneer butter masala."],
      ["Chicken Biryani", "Rice Bowls", 140, 12, false, "Hyderabadi dum biryani with raita."],
      ["Egg Fried Rice", "Rice Bowls", 95, 10, false, "Wok-tossed rice with egg and vegetables."],
      ["Paneer Kathi Roll", "Rolls", 80, 8, true, "Paneer tikka wrapped in a flaky paratha."],
      ["Chicken Kathi Roll", "Rolls", 95, 8, false, "Chicken tikka roll with mint mayo."],
    ],
  },
  {
    name: "Juice Junction",
    description: "Fresh juices, shakes and fruit bowls.",
    location: "Near the main gate",
    opensAt: 9 * 60,
    closesAt: 18 * 60,
    slotCapacity: 15,
    staffEmail: "staff.juice@canteen.pes.edu",
    staffName: "Mohammed Irfan",
    items: [
      ["Watermelon Juice", "Juices", 40, 4, true, "Fresh, no added sugar."],
      ["Sweet Lime Juice", "Juices", 45, 4, true, "Freshly squeezed mosambi."],
      ["Mango Milkshake", "Shakes", 70, 5, true, "Alphonso mango with chilled milk."],
      ["Cold Coffee", "Shakes", 65, 5, true, "Blended coffee with ice cream."],
      ["Fruit Bowl", "Bowls", 60, 5, true, "Seasonal cut fruits with chaat masala."],
      ["Oreo Shake", "Shakes", 80, 5, true, "Cookies and cream shake."],
    ],
  },
  {
    name: "Snack Shack",
    description: "Chaat, sandwiches and evening snacks.",
    location: "Open-air seating, F Block",
    opensAt: 10 * 60,
    closesAt: 19 * 60 + 30,
    slotCapacity: 10,
    staffEmail: "staff.snacks@canteen.pes.edu",
    staffName: "Priya Nair",
    items: [
      ["Pani Puri", "Chaat", 40, 5, true, "Six puris with spicy and sweet water."],
      ["Masala Puri", "Chaat", 45, 6, true, "Bangalore-style masala puri."],
      ["Veg Grilled Sandwich", "Sandwiches", 60, 8, true, "Grilled with cheese and green chutney."],
      ["Samosa (2 pcs)", "Snacks", 30, 3, true, "Potato samosas with tamarind chutney."],
      ["Veg Puff", "Snacks", 25, 3, true, "Flaky bakery puff."],
      ["Egg Puff", "Snacks", 30, 3, false, "Flaky puff with masala egg."],
      ["French Fries", "Snacks", 70, 8, true, "Salted fries with ketchup."],
    ],
  },
];

const FIRST_NAMES = ["Aarav", "Diya", "Ishaan", "Ananya", "Rohan", "Sneha", "Karthik", "Meera", "Aditya", "Kavya", "Nikhil", "Pooja", "Varun", "Shreya", "Arjun", "Nandini", "Siddharth", "Tanvi", "Rahul", "Lakshmi"];
const LAST_NAMES = ["Rao", "Iyer", "Gowda", "Reddy", "Shetty", "Menon", "Patil", "Hegde", "Kulkarni", "Bhat"];

const HISTORY_DAYS = 42;

async function main() {
  console.log("Clearing application tables…");
  await db.$transaction([
    db.recommendationEvent.deleteMany(),
    db.forecastResult.deleteMany(),
    db.notification.deleteMany(),
    db.orderStatusHistory.deleteMany(),
    db.payment.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.pickupSlot.deleteMany(),
    db.auditLog.deleteMany(),
    db.user.deleteMany(),
    db.menuItem.deleteMany(),
    db.stall.deleteMany(),
    db.systemSetting.deleteMany(),
  ]);

  const [adminHash, staffHash, studentHash] = await Promise.all([
    bcrypt.hash("Admin@1234", 12),
    bcrypt.hash("Staff@1234", 12),
    bcrypt.hash("Student@1234", 12),
  ]);

  await db.user.create({
    data: { name: "Canteen Administrator", email: "admin@canteen.pes.edu", passwordHash: adminHash, role: "ADMIN" },
  });

  const historyStart = campusMidnight(addDays(campusDateKey(), -HISTORY_DAYS));
  const stalls: (Prisma.StallGetPayload<{ include: { menuItems: true } }> & { seed: (typeof STALLS)[number] })[] = [];
  for (const s of STALLS) {
    const stall = await db.stall.create({
      data: {
        name: s.name,
        description: s.description,
        location: s.location,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        slotCapacity: s.slotCapacity,
        createdAt: historyStart,
        menuItems: {
          create: s.items.map(([name, category, price, prepTimeMinutes, isVeg, description]) => ({
            name,
            category,
            price,
            prepTimeMinutes,
            isVeg,
            description,
            createdAt: historyStart,
          })),
        },
        staff: { create: { name: s.staffName, email: s.staffEmail, passwordHash: staffHash, role: "STAFF" } },
      },
      include: { menuItems: true },
    });
    stalls.push({ ...stall, seed: s });
  }

  const students = [];
  students.push(
    await db.user.create({
      data: {
        name: "Demo Student",
        email: "student@pesu.pes.edu",
        srn: "PES1UG23CA001",
        phone: "9876543210",
        passwordHash: studentHash,
      },
    }),
  );
  for (let i = 0; i < 40; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    students.push(
      await db.user.create({
        data: {
          name: `${first} ${last}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@pesu.pes.edu`,
          srn: `PES${1 + (i % 2)}UG${21 + (i % 4)}CS${String(100 + i).padStart(3, "0")}`,
          passwordHash: studentHash,
        },
      }),
    );
  }

  console.log("Generating synthetic order history…");
  const slotRows: Prisma.PickupSlotCreateManyInput[] = [];
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const historyRows: Prisma.OrderStatusHistoryCreateManyInput[] = [];
  const usedCodes = new Set<string>();
  const now = new Date();
  const today = campusDateKey(now);

  const newCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    do code = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
    while (usedCodes.has(code));
    usedCodes.add(code);
    return code;
  };

  // Favourite items per student make personalised recommendations meaningful.
  const favourites = new Map(students.map((st) => [st.id, stalls.map((s) => pick(s.menuItems).id)]));

  for (let dayOffset = -HISTORY_DAYS; dayOffset <= 0; dayOffset++) {
    const date = addDays(today, dayOffset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0) continue; // campus closed on Sundays
    const dayFactor = weekday === 6 ? 0.45 : weekday === 5 ? 0.85 : 1;

    for (const stall of stalls) {
      const windows = slotsForDay(date, stall);
      const booked = new Map<number, { id: string; count: number }>();
      const target = Math.round(between(18, 32) * dayFactor);

      for (let n = 0; n < target; n++) {
        // Bias pickup times towards the lunch rush.
        const lunch = windows.filter((w) => {
          const m = (w.startsAt.getTime() - campusMidnight(date).getTime()) / 60000;
          return m >= 12 * 60 && m < 14 * 60 + 30;
        });
        const window = random() < 0.55 && lunch.length ? pick(lunch) : pick(windows);
        const key = window.startsAt.getTime();
        const slot = booked.get(key) ?? { id: randomUUID(), count: 0 };
        if (slot.count >= stall.slotCapacity) continue;

        const isToday = dayOffset === 0;
        const upcoming = window.startsAt > now;
        if (isToday && !upcoming && random() < 0.3) continue;

        let status: OrderStatus;
        if (isToday && upcoming) status = pick<OrderStatus>(["PLACED", "PLACED", "ACCEPTED", "PREPARING"]);
        else if (isToday && window.startsAt.getTime() > now.getTime() - 20 * 60000) status = "READY";
        else status = random() < 0.06 ? "CANCELLED" : random() < 0.02 ? "REJECTED" : "COMPLETED";

        slot.count++;
        booked.set(key, slot);

        const student = pick(students);
        const lineCount = between(1, 3);
        const chosen = new Map<string, number>();
        for (let l = 0; l < lineCount; l++) {
          const fav = favourites.get(student.id)![stalls.indexOf(stall)];
          const item = random() < 0.4 ? stall.menuItems.find((m) => m.id === fav)! : pick(stall.menuItems);
          chosen.set(item.id, (chosen.get(item.id) ?? 0) + (random() < 0.15 ? 2 : 1));
        }

        const orderId = randomUUID();
        let total = 0;
        for (const [menuItemId, quantity] of chosen) {
          const item = stall.menuItems.find((m) => m.id === menuItemId)!;
          total += Number(item.price) * quantity;
          itemRows.push({ id: randomUUID(), orderId, menuItemId, itemName: item.name, unitPrice: item.price, quantity });
        }

        const method: PaymentMethod = random() < 0.6 ? "SIMULATED_ONLINE" : "CASH_ON_PICKUP";
        let paymentStatus: PaymentStatus = "PENDING";
        if (status === "COMPLETED") paymentStatus = "PAID";
        else if (method === "SIMULATED_ONLINE" && status !== "PLACED") paymentStatus = "PAID";
        if ((status === "CANCELLED" || status === "REJECTED") && method === "SIMULATED_ONLINE") paymentStatus = "REFUNDED";

        const placedAt = new Date(Math.min(window.startsAt.getTime() - between(20, 180) * 60000, now.getTime() - 60000));
        const step = (minutes: number) => new Date(placedAt.getTime() + minutes * 60000);
        const reached = (s: OrderStatus) =>
          ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"].indexOf(status) >=
          ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"].indexOf(s);
        const code = newCode();

        orderRows.push({
          id: orderId,
          code,
          studentId: student.id,
          stallId: stall.id,
          slotId: slot.id,
          status,
          totalAmount: total,
          paymentMethod: method,
          paymentStatus,
          isSynthetic: true,
          placedAt,
          acceptedAt: reached("ACCEPTED") ? step(2) : null,
          preparingAt: reached("PREPARING") ? step(5) : null,
          readyAt: reached("READY") ? new Date(window.startsAt.getTime() - 3 * 60000) : null,
          completedAt: status === "COMPLETED" ? new Date(window.startsAt.getTime() + between(0, 14) * 60000) : null,
          cancelledAt: status === "CANCELLED" || status === "REJECTED" ? step(3) : null,
          cancelReason: status === "REJECTED" ? "Item ran out" : null,
          updatedAt: status === "COMPLETED" ? new Date(window.startsAt.getTime() + 10 * 60000) : step(5),
        });
        paymentRows.push({
          id: randomUUID(),
          orderId,
          amount: total,
          method,
          status: paymentStatus,
          transactionRef:
            paymentStatus === "PAID" || paymentStatus === "REFUNDED"
              ? `${method === "CASH_ON_PICKUP" ? "CASH" : "SIM"}-${code}`
              : null,
          createdAt: placedAt,
        });
        historyRows.push({ id: randomUUID(), orderId, toStatus: "PLACED", actorId: student.id, createdAt: placedAt });
        let previous: OrderStatus = "PLACED";
        for (const s of ["ACCEPTED", "PREPARING", "READY", "COMPLETED"] as OrderStatus[]) {
          if (!reached(s)) break;
          historyRows.push({ id: randomUUID(), orderId, fromStatus: previous, toStatus: s, actorId: null, createdAt: step(2) });
          previous = s;
        }
        if (status === "CANCELLED" || status === "REJECTED") {
          historyRows.push({ id: randomUUID(), orderId, fromStatus: "PLACED", toStatus: status, actorId: null, createdAt: step(3) });
        }
      }

      for (const [start, slot] of booked) {
        const active = orderRows.filter(
          (o) => o.slotId === slot.id && o.status !== "CANCELLED" && o.status !== "REJECTED",
        ).length;
        slotRows.push({
          id: slot.id,
          stallId: stall.id,
          startsAt: new Date(start),
          endsAt: new Date(start + SLOT_MINUTES * 60000),
          capacity: stall.slotCapacity,
          bookedCount: active,
        });
      }
    }
  }

  await db.pickupSlot.createMany({ data: slotRows });
  for (let i = 0; i < orderRows.length; i += 1000) await db.order.createMany({ data: orderRows.slice(i, i + 1000) });
  for (let i = 0; i < itemRows.length; i += 2000) await db.orderItem.createMany({ data: itemRows.slice(i, i + 2000) });
  for (let i = 0; i < paymentRows.length; i += 2000) await db.payment.createMany({ data: paymentRows.slice(i, i + 2000) });
  for (let i = 0; i < historyRows.length; i += 2000) {
    await db.orderStatusHistory.createMany({ data: historyRows.slice(i, i + 2000) });
  }

  console.log(
    `Seeded ${stalls.length} stalls, ${students.length} students, ${orderRows.length} synthetic orders, ${slotRows.length} slots.`,
  );
  console.log("Accounts (password):");
  console.log("  admin@canteen.pes.edu (Admin@1234)");
  for (const s of STALLS) console.log(`  ${s.staffEmail} (Staff@1234) — ${s.name}`);
  console.log("  student@pesu.pes.edu (Student@1234)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
