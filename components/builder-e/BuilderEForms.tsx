"use client";

import { useBuilderEStore } from "@/store/useBuilderEStore";

const fieldClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600";
const labelClass = "block text-xs text-zinc-400";

export function BuilderECategoryForms() {
  const category = useBuilderEStore((s) => s.category);
  const driver = useBuilderEStore((s) => s.driver);
  const experience = useBuilderEStore((s) => s.experience);
  const transit = useBuilderEStore((s) => s.transit);
  const patchDriver = useBuilderEStore((s) => s.patchDriver);
  const patchExperience = useBuilderEStore((s) => s.patchExperience);
  const patchTransit = useBuilderEStore((s) => s.patchTransit);

  if (category === "DRIVER") {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4">
        <label className={labelClass}>
          Pickup location (airport / hotel)
          <input
            className={fieldClass}
            value={driver.pickupLocation}
            onChange={(e) => patchDriver({ pickupLocation: e.target.value })}
            placeholder="Narita T1 / Hotel Okura Tokyo"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Pickup time
            <input
              type="time"
              className={fieldClass}
              value={driver.pickupTime}
              onChange={(e) => patchDriver({ pickupTime: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Flight number (optional)
            <input
              className={fieldClass}
              value={driver.flightNumber}
              onChange={(e) => patchDriver({ flightNumber: e.target.value })}
              placeholder="NH 211"
            />
          </label>
        </div>
        <label className={labelClass}>
          Drop-off location / hotel address
          <input
            className={fieldClass}
            value={driver.dropoffLocation}
            onChange={(e) => patchDriver({ dropoffLocation: e.target.value })}
            placeholder="Hotel name or address"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className={labelClass}>
            Adults
            <input
              type="number"
              min={1}
              className={fieldClass}
              value={driver.adults}
              onChange={(e) =>
                patchDriver({ adults: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
          <label className={labelClass}>
            Children
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={driver.children}
              onChange={(e) =>
                patchDriver({
                  children: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label className={labelClass}>
            Luggage
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={driver.luggageCount}
              onChange={(e) =>
                patchDriver({
                  luggageCount: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
        </div>
        <label className={labelClass}>
          Notes
          <textarea
            className={fieldClass}
            rows={3}
            value={driver.notes}
            onChange={(e) => patchDriver({ notes: e.target.value })}
            placeholder="Child seats, meet & greet, etc."
          />
        </label>
      </div>
    );
  }

  if (category === "EXPERIENCE") {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4">
        <label className={labelClass}>
          Activity
          <input
            className={fieldClass}
            value={experience.activityTitle}
            onChange={(e) =>
              patchExperience({ activityTitle: e.target.value })
            }
            placeholder="teamLab Planets / Tokyo DisneySea / Shibuya Sky"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Target date
            <input
              type="date"
              className={fieldClass}
              value={experience.targetDate}
              onChange={(e) =>
                patchExperience({ targetDate: e.target.value })
              }
            />
          </label>
          <label className={labelClass}>
            Preferred time slot
            <select
              className={fieldClass}
              value={experience.timeSlot}
              onChange={(e) =>
                patchExperience({
                  timeSlot: e.target.value as
                    | "morning"
                    | "afternoon"
                    | "evening"
                    | "",
                })
              }
            >
              <option value="">Select…</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </label>
        </div>
        <label className={labelClass}>
          Passport full names (one per line)
          <textarea
            className={fieldClass}
            rows={3}
            value={experience.guestNames}
            onChange={(e) => patchExperience({ guestNames: e.target.value })}
            placeholder="Exactly as on passport"
          />
        </label>
        <label className={labelClass}>
          Ages (matching order)
          <input
            className={fieldClass}
            value={experience.guestAges}
            onChange={(e) => patchExperience({ guestAges: e.target.value })}
            placeholder="34, 32, 8"
          />
        </label>
        <label className={labelClass}>
          Guide language (if guided)
          <input
            className={fieldClass}
            value={experience.guideLanguage}
            onChange={(e) =>
              patchExperience({ guideLanguage: e.target.value })
            }
            placeholder="EN / JA / ES…"
          />
        </label>
        <label className={labelClass}>
          Notes
          <textarea
            className={fieldClass}
            rows={2}
            value={experience.notes}
            onChange={(e) => patchExperience({ notes: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (category === "TRANSIT") {
    const isSuica =
      transit.passType === "suica_physical" ||
      transit.passType === "suica_digital";
    const isRail =
      transit.passType === "shinkansen" || transit.passType === "jr_pass";
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4">
        <label className={labelClass}>
          Pass type
          <select
            className={fieldClass}
            value={transit.passType}
            onChange={(e) =>
              patchTransit({
                passType: e.target.value as typeof transit.passType,
              })
            }
          >
            <option value="">Select…</option>
            <option value="suica_physical">Suica (physical)</option>
            <option value="suica_digital">Digital Suica assistance</option>
            <option value="shinkansen">Shinkansen reserved seats</option>
            <option value="jr_pass">JR Pass</option>
          </select>
        </label>
        {isRail || !transit.passType ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                From
                <input
                  className={fieldClass}
                  value={transit.routeFrom}
                  onChange={(e) => patchTransit({ routeFrom: e.target.value })}
                  placeholder="Tokyo"
                />
              </label>
              <label className={labelClass}>
                To
                <input
                  className={fieldClass}
                  value={transit.routeTo}
                  onChange={(e) => patchTransit({ routeTo: e.target.value })}
                  placeholder="Kyoto"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Travel date
                <input
                  type="date"
                  className={fieldClass}
                  value={transit.travelDate}
                  onChange={(e) => patchTransit({ travelDate: e.target.value })}
                />
              </label>
              <label className={labelClass}>
                Preferred departure time
                <input
                  type="time"
                  className={fieldClass}
                  value={transit.preferredTime}
                  onChange={(e) =>
                    patchTransit({ preferredTime: e.target.value })
                  }
                />
              </label>
            </div>
          </>
        ) : null}
        {isSuica ? (
          <label className={labelClass}>
            Quantity / notes for IC cards
            <input
              className={fieldClass}
              value={transit.notes}
              onChange={(e) => patchTransit({ notes: e.target.value })}
              placeholder="e.g. 2× Suica, ¥2,000 top-up each"
            />
          </label>
        ) : null}
        <label className={labelClass}>
          Delivery / pickup
          <select
            className={fieldClass}
            value={transit.delivery}
            onChange={(e) =>
              patchTransit({
                delivery: e.target.value as typeof transit.delivery,
              })
            }
          >
            <option value="">Select…</option>
            <option value="hotel_delivery">Hotel delivery</option>
            <option value="airport_counter">
              Airport Pocket Wi-Fi counter
            </option>
            <option value="digital_qr">Digital QR</option>
          </select>
        </label>
        {!isSuica ? (
          <label className={labelClass}>
            Notes
            <textarea
              className={fieldClass}
              rows={2}
              value={transit.notes}
              onChange={(e) => patchTransit({ notes: e.target.value })}
            />
          </label>
        ) : null}
      </div>
    );
  }

  return null;
}
