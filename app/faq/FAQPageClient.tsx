"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import { ExplainerTriggerButton } from "@/components/builder/ExplainerTriggerButton";

/** Static FAQ topics — extend here (no PocketBase). */
const faqData = [
  {
    category: "Purchasing & Validation",
    items: [
      {
        q: "How do I know whether I need a JR railpass?",
        a: "Go to a website with a railpass calculator. Input all the train travel you will do in Japan with JR East trains and the calculator will tell you whether it is more economical to get individual tickets or whether you should purchase the rail pass. The rail pass only makes sense if you travel in Japan extensively so if you are mainly going to stay in one or perhaps two cities, the railpass does not make sense.",
      },
      {
        q: "Can I buy a JR Rail Pass while I am already in Japan?",
        a: "No. You must book the JR Rail Pass from your home country before you travel. Once purchased, a physical voucher will be sent to your home address.",
      },
      {
        q: "Where and how do I validate the JR Rail Pass?",
        a: "The voucher you receive at home must be exchanged for the actual rail pass once you arrive in Japan at a JR EAST railway station.",
      },
      {
        q: "Can I validate my pass at a non-JR East rail station or a metro station?",
        a: "No, validation must occur at an official JR EAST railway station.",
      },
      {
        q: "Can I change the validation date after it has been set?",
        a: "No. Once the pass is validated with a start date, it cannot be changed.",
      },
      {
        q: "Should I validate the JR Pass as soon as I arrive in Japan?",
        a: "Usually, no. The pass is high-value and best used for long-distance travel outside the Tokyo prefecture. Activating it just for cheap local transport within Tokyo does not provide good value for money.",
      },
    ],
  },
  {
    category: "Suica, Pasmo & IC Cards",
    items: [
      {
        q: "What is an IC Card (Suica, Pasmo, Icoca) and is there a difference?",
        a: "It is a rechargeable card used for small purchases in shops and for trains, metro, bus, and most public transport. There is no real difference between Suica, Pasmo, or Icoca—they are issued by different companies but cost the same and work exactly the same way.",
      },
      {
        q: "Where and how do I get a Suica card? Is it free?",
        a: "If you have an Apple iPhone, you can add a digital Suica to your Wallet for free (choose +, Transit Card, Suica, and charge money). If you do not have an iPhone, you can buy a physical card at JR East railway stations for 500 yen. There is also a free physical 'Welcome to Japan' card available at airports, but it is only valid for 28 days.",
      },
      {
        q: "How do I top up or charge my card?",
        a: "For a digital card, you add Yen directly inside your Apple Wallet. For a physical card, go to a train or metro station and use a vending machine that says 'Charge'. You cannot top up these cards at a convenience store (this is a known scam); only use official station machines or your Apple Wallet.",
      },
      {
        q: "Can I see my balance, and what happens if I don't have enough funds?",
        a: "Each time you pass the station gates, a small screen on the gate shows your remaining balance. You can also check it at charging stations or inside your Apple Wallet. If your card is empty or lacks funds, an alarm will go off at the gate, and you must add money at a nearby charging machine before passing.",
      },
      {
        q: "Can I get a refund for my remaining balance or transfer it to my bank?",
        a: "No. You cannot transfer the balance back to your bank, credit card, or Apple Pay. You must spend it, keep the card indefinitely for a future trip, or lose it (if using a 28-day 'Welcome to Japan' card).",
      },
      {
        q: "Can I use my IC card to ride the bullet train (Shinkansen) or Green Cars?",
        a: "No. You cannot use Suica, Pasmo, or Icoca to ride bullet trains; you need a JR Pass or special bullet train ticket. You also cannot use it to ride Green Cars (first class) without buying an additional Green Car ticket at the station or inside the train.",
      },
      {
        q: "What happens if I lose my physical Suica/Pasmo card?",
        a: "If you assigned your name to the card at the vending machine when buying it, you can report it missing at a koban (police box) and it might be returned. If your name is not assigned to the card, you will likely never see it again.",
      },
      {
        q: "Can I share my card with a friend, and do they expire?",
        a: "You can give your card to a friend if you no longer need it. Normal and digital cards do not expire. However, the 'Welcome to Japan' tourist card expires strictly after 28 days and its validity cannot be extended. You also cannot add money to an expired card.",
      },
    ],
  },
  {
    category: "Usage & Restrictions",
    items: [
      {
        q: "Which trains can I use the JR Rail Pass on?",
        a: "The pass allows unlimited travel on JR EAST trains. It is not valid for non-JR lines, subways, metro systems, the Odakyu Line, or JR WEST lines.",
      },
      {
        q: "Can I use the Nozomi Bullet Train with my JR Pass?",
        a: "No. The JR Rail Pass is not valid for the fast Nozomi Shinkansen trains.",
      },
      {
        q: "How do I physically use the pass at the train gates?",
        a: "For normal JR trains, insert the pass into the ticket gate slot and take it out on the other side. For bullet trains, insert your JR Rail Pass TOGETHER with your seat reservation ticket. The machine will keep the seat ticket at the end of your journey, but your JR Pass will always come out—do not forget to take it.",
      },
      {
        q: "Do I need to reserve seats for local JR trains in Tokyo?",
        a: "No. For JR lines within Tokyo (which usually start with a 'J'), you do not need to reserve seats in advance.",
      },
      {
        q: "Do I need to reserve seats for the bullet train (Shinkansen)?",
        a: "While some bullet trains have non-reserved cars (first-come, first-served), they get very busy. If there are no seats available, you might not be able to board. We highly recommend booking ALL your seats in advance to guarantee your travel.",
      },
      {
        q: "I am in Japan now, but my JR pass is validated for next week. Can I use it early?",
        a: "No. The pass can only be used during its specific, active time frame.",
      },
    ],
  },
  {
    category: "Luggage & Security Policies",
    items: [
      {
        q: "Can I bring a large suitcase on the bullet train?",
        a: "If the combined dimensions (width + height + length) of your luggage are 1.60m (160cm) or more, you MUST make a special oversized luggage reservation. If you do not have this reservation, you cannot board the train with that luggage.",
      },
      {
        q: "Can I share or give my JR Rail Pass to a friend?",
        a: "No. The pass is strictly linked to your passport. You must input your passport details when reserving seats, and you cannot share it.",
      },
      {
        q: "What happens if my JR Rail Pass is lost, stolen, or damaged?",
        a: "The rail pass is issued only once. If it is lost, stolen, or damaged, it is no longer valid and cannot be replaced.",
      },
      {
        q: "If a travel agent planned my trip, do I still need help?",
        a: "Generally, agents pre-book your hotels and JR Rail Pass. However, you might still want our help arranging specific daily tours, airport pick-ups, or an airport meet & greet.",
      },
    ],
  },
];

export function FAQPageClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const filteredData = faqData
    .map((section) => {
      const q = searchQuery.toLowerCase();
      const filteredItems = section.items.filter(
        (item) =>
          item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      );
      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  return (
    <AppShell dark title="FAQ" subtitle="TOKIOTOURS">
      <div className="min-h-[calc(100dvh-4rem)] bg-[#0A1017] px-4 pb-16 pt-8 text-white sm:px-6 sm:pt-10">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-godiva text-3xl text-[#F6A724]">
            Frequently Asked Questions
          </h1>
          <p className="mb-8 mt-2 text-zinc-400">
            Find answers to common questions about your Japan travel.
          </p>

          <div className="relative mb-10">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-zinc-500" aria-hidden />
            </div>
            <input
              type="search"
              placeholder="Search for keywords (e.g., 'luggage', 'calculator', 'bullet train')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search FAQ"
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] py-4 pl-12 pr-4 text-white placeholder-zinc-500 transition-colors focus:border-[#075473] focus:outline-none"
            />
          </div>

          <div className="mb-10">
            <ExplainerTriggerButton
              featureKey="daily_transport_explainer"
              title="Watch: Why you need private daily transport"
            />
          </div>

          <div className="space-y-8">
            {filteredData.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">
                No results found for &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              filteredData.map((section, sectionIdx) => (
                <div
                  key={section.category}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-6 backdrop-blur-md"
                >
                  <BoxGradingGlow />
                  <div className="relative z-10">
                    <h2 className="mb-4 text-lg font-semibold uppercase tracking-wider text-[#075473]">
                      {section.category}
                    </h2>
                    <div className="space-y-2">
                      {section.items.map((item, itemIdx) => {
                        const id = `${sectionIdx}-${itemIdx}`;
                        const isOpen = openIndex === id;

                        return (
                          <div
                            key={item.q}
                            className="overflow-hidden rounded-lg border border-white/5 bg-black/40"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenIndex(isOpen ? null : id)
                              }
                              aria-expanded={isOpen}
                              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                            >
                              <span className="text-sm font-medium md:text-base">
                                {item.q}
                              </span>
                              <span
                                className="ml-4 text-xl text-[#F6A724]"
                                aria-hidden
                              >
                                {isOpen ? "−" : "+"}
                              </span>
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen ? (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: "easeOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-white/10 px-5 pb-4 pt-2 text-sm leading-relaxed text-zinc-300">
                                    {item.a}
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="mt-10 text-center text-sm text-zinc-500">
            Looking for cancellation or refund rules?{" "}
            <Link
              href="/policies"
              className="font-semibold text-[#F6A724] underline-offset-2 hover:underline"
            >
              View Terms &amp; Policies
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
