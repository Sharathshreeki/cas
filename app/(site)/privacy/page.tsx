import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Privacy notice" };

// NFR-46…NFR-51. Keep in sync with security/policy.md.
const SECTIONS = [
  {
    title: "What we collect",
    body: [
      "Account details: your name, university email, SRN and mobile number, used to identify you and contact you about orders.",
      "Orders: items, quantities, prices, pickup slot, payment method and status, and status-change times.",
      "Passwords are stored only as secure one-way hashes and are never visible to staff or administrators.",
    ],
  },
  {
    title: "Location",
    body: [
      "If the canteen enables campus-only ordering, your browser is asked for your location once when you place an order.",
      "The location is used only to check that you are within the campus boundary. It is not stored or shared.",
    ],
  },
  {
    title: "Who can see your data",
    body: [
      "You can see only your own orders. Other students cannot see your order history.",
      "Staff see orders placed with their own stall (your name, items, pickup time and notes) so they can prepare them.",
      "Administrators can manage accounts and see aggregated reports.",
    ],
  },
  {
    title: "Demand forecasting and recommendations",
    body: [
      "Order history is used in aggregate to estimate future demand and to suggest popular items.",
      "Personal suggestions use only your own completed orders. Model training uses only the fields needed for the task.",
      "Forecasts and suggestions are estimates — they are never guarantees.",
    ],
  },
  {
    title: "Retention",
    body: [
      "Order and payment records are kept for operational reporting and are retained when menu items change or accounts are deactivated.",
      "To have your account deactivated, contact the canteen administrator.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <PageHeader title="Privacy notice" description="How the PES Canteen system uses your information." />
      <div className="space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 font-semibold">{s.title}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {s.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
