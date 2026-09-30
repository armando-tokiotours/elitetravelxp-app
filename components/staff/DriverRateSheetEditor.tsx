"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  ensureDriverProfile,
  updateDriverProfile,
  type DriverProfile,
} from "@/lib/roleProfiles";

type RateRow = {
  id: string;
  rate_type?: string;
  route_key?: string;
  route_name?: string;
  driver_cost_jpy?: number;
  extra_hour_rate_jpy?: number;
  is_active?: boolean;
};

export function DriverRateSheetEditor({
  getClient,
  staffId,
  seedName,
}: {
  getClient: () => PocketBase;
  staffId: string;
  seedName?: string;
}) {
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [driverType, setDriverType] = useState("independent");
  const [fleet, setFleet] = useState("");
  const [license, setLicense] = useState("");

  const [rateType, setRateType] = useState("transfer");
  const [routeKey, setRouteKey] = useState("");
  const [routeName, setRouteName] = useState("");
  const [cost, setCost] = useState("");
  const [extraHour, setExtraHour] = useState("");

  const reloadRates = async (driverId: string) => {
    const list = await getClient()
      .collection("driver_rate_sheet")
      .getFullList<RateRow>({
        filter: `driver="${driverId}"`,
        sort: "-updated",
        requestKey: null,
      });
    setRates(list);
  };

  useEffect(() => {
    if (!staffId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await ensureDriverProfile(getClient(), staffId, {
          full_name: seedName,
        });
        setDriver(d);
        setFullName(String(d.full_name || ""));
        setPhone(String(d.phone_number || ""));
        setDriverType(String(d.driver_type || "independent"));
        setFleet(String(d.company_fleet_name || ""));
        setLicense(String(d.operating_license_number || ""));
        await reloadRates(d.id);
      } catch (e) {
        setError(formatPbError(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getClient, staffId, seedName]);

  const saveProfile = async () => {
    if (!driver) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const updated = await updateDriverProfile(getClient(), driver.id, {
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        driver_type: driverType,
        company_fleet_name: fleet.trim(),
        operating_license_number: license.trim(),
      });
      setDriver(updated);
      setMsg("Driver profile saved.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const addRate = async () => {
    if (!driver) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await getClient().collection("driver_rate_sheet").create(
        {
          driver: driver.id,
          rate_type: rateType,
          route_key: routeKey.trim(),
          route_name: routeName.trim(),
          driver_cost_jpy: Number(cost) || 0,
          extra_hour_rate_jpy: Number(extraHour) || 0,
          is_active: true,
        },
        { requestKey: null }
      );
      setRouteKey("");
      setRouteName("");
      setCost("");
      setExtraHour("");
      setMsg("Rate row added.");
      await reloadRates(driver.id);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <p className="text-sm text-zinc-400">Loading driver sheet…</p>;
  if (error && !driver)
    return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h3 className="font-medium text-white">Driver / fleet profile</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Full name
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Phone
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Type
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={driverType}
              onChange={(e) => setDriverType(e.target.value)}
            >
              <option value="independent">Independent</option>
              <option value="fleet_coordinator">Fleet coordinator</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Fleet / company
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={fleet}
              onChange={(e) => setFleet(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
            License number
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveProfile()}
          className="mt-3 rounded-full bg-[#075473] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save profile
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h3 className="font-medium text-white">Rate sheet (net JPY)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Type
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={rateType}
              onChange={(e) => setRateType(e.target.value)}
            >
              <option value="transfer">Transfer</option>
              <option value="intercity">Intercity</option>
              <option value="hourly_chauffeur">Hourly chauffeur</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Route key
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={routeKey}
              onChange={(e) => setRouteKey(e.target.value)}
              placeholder="NRT-TOKYO"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Route name
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Driver cost JPY
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Extra hour JPY
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={extraHour}
              onChange={(e) => setExtraHour(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving || !cost}
          onClick={() => void addRate()}
          className="mt-3 rounded-full border border-zinc-600 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50"
        >
          + Add rate row
        </button>

        <ul className="mt-4 space-y-2">
          {rates.length === 0 ? (
            <li className="text-sm text-zinc-500">No rate rows yet.</li>
          ) : (
            rates.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
              >
                <span className="text-zinc-300">
                  {r.rate_type} · {r.route_name || r.route_key || "—"}
                </span>
                <span className="font-mono text-white">
                  ¥{Number(r.driver_cost_jpy || 0).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
    </div>
  );
}
