"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { canAccessAgency } from "@/lib/staffRoles";
import { generateConfirmedPNR } from "@/utils/pnr";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";

type AgencyOrder = {
  id: string;
  booking_ref: string;
  agency_name?: string;
  status?: string;
  primary_city?: string;
  tour_date?: string;
  contact_email?: string;
  notes?: string;
};

type AgencyRow = {
  id: string;
  name: string;
  code?: string;
  vat_number?: string;
  phone?: string;
  address?: string;
  country?: string;
  website?: string;
  bank_info?: string;
  payment_terms?: string;
  contact_email?: string;
  ops_contact_name?: string;
  ops_contact_email?: string;
  ops_contact_phone?: string;
  billing_contact_name?: string;
  billing_contact_email?: string;
  billing_contact_phone?: string;
  preferred_currency?: string;
  payment_method?: string;
  commission_rate_percentage?: number;
  account_status?: string;
};

export function AgencyApp() {
  return (
    <StaffPortalShell title="Agency portal" allow={canAccessAgency}>
      <AgencyInner />
    </StaffPortalShell>
  );
}

function AgencyInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const agencyId = useTeamAuth((s) => s.agencyId);
  const email = useTeamAuth((s) => s.email);

  const [orders, setOrders] = useState<AgencyOrder[]>([]);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [agencyName, setAgencyName] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState(agencyId || "");
  const [contactEmail, setContactEmail] = useState(email || "");
  const [primaryCity, setPrimaryCity] = useState("Tokyo");
  const [tourDate, setTourDate] = useState("");
  const [adults, setAdults] = useState("2");
  const [kids, setKids] = useState("0");
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      let filter = "";
      if (role === "agency" && agencyId) {
        filter = `agency_id="${agencyId}"`;
      }
      const list = await pb.collection("agency_orders").getFullList<AgencyOrder>({
        sort: "-created",
        filter: filter || undefined,
        requestKey: null,
      });
      setOrders(list);
      try {
        const ag = await pb.collection("agencies").getFullList<AgencyRow>({
          sort: "name",
          requestKey: null,
        });
        setAgencies(ag);
      } catch {
        setAgencies([]);
      }
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient, role, agencyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (agencyId) setSelectedAgencyId(agencyId);
  }, [agencyId]);

  const submitInquire = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const pnr = generateConfirmedPNR();
      const agency =
        agencies.find((a) => a.id === selectedAgencyId) ||
        null;
      const name =
        agency?.name ||
        agencyName.trim() ||
        "Agency partner";
      const guests = {
        adults: Number(adults) || 0,
        kids: Number(kids) || 0,
      };
      const created = await pb.collection("agency_orders").create(
        {
          booking_ref: pnr,
          agency_id: selectedAgencyId || agencyId || "",
          agency_name: name,
          contact_email: contactEmail.trim().toLowerCase(),
          status: "incoming",
          primary_city: primaryCity.trim() || "Tokyo",
          tour_date: tourDate || undefined,
          guests,
          notes: notes.trim(),
          request_payload: {
            source: "agency_inquire",
            submitted_at: new Date().toISOString(),
          },
        },
        { requestKey: null }
      );

      try {
        await pb.collection("ops_hub").create(
          {
            pnr,
            source: "agency",
            detail_collection: "agency_orders",
            detail_id: created.id,
            status: "incoming",
            primary_city: primaryCity.trim() || "Tokyo",
            tour_date: tourDate || undefined,
            guest_summary: [
              guests.adults ? `${guests.adults} adults` : "",
              guests.kids ? `${guests.kids} kids` : "",
            ]
              .filter(Boolean)
              .join(", "),
          },
          { requestKey: null }
        );
        const { ensureDispatchRow } = await import("@/lib/opsDispatch");
        const { ensureMoneyRow } = await import("@/lib/opsMoney");
        const { ensureTicketsRow } = await import("@/lib/opsTickets");
        await Promise.all([
          ensureDispatchRow(pb, pnr),
          ensureMoneyRow(pb, pnr),
          ensureTicketsRow(pb, pnr),
        ]);
      } catch {
        /* hub + pockets register non-blocking */
      }

      setMsg(`Inquiry submitted — PNR ${pnr}`);
      setNotes("");
      await reload();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {(role === "agency" && agencyId) || role === "owner" || role === "ops" ? (
        <AgencyCompanyCard
          getClient={getClient}
          agencyId={selectedAgencyId || agencyId || ""}
          agencies={agencies}
          onSaved={() => void reload()}
        />
      ) : null}
      <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="font-display text-xl text-white">Inquire / Reserve</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Creates an <code className="text-zinc-300">agency_orders</code> row
          and registers the PNR on ops hub. Does not touch Silo 1 builder
          bookings.
        </p>
        <div className="mt-4 space-y-3">
          {role !== "agency" || !agencyId ? (
            <>
              {agencies.length > 0 ? (
                <label className="block text-xs uppercase tracking-wider text-zinc-500">
                  Agency
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={selectedAgencyId}
                    onChange={(e) => setSelectedAgencyId(e.target.value)}
                  >
                    <option value="">— select —</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-xs uppercase tracking-wider text-zinc-500">
                Agency name
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="If not in list"
                />
              </label>
            </>
          ) : null}
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Contact email
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Primary city
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={primaryCity}
              onChange={(e) => setPrimaryCity(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Tour date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={tourDate}
              onChange={(e) => setTourDate(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs uppercase tracking-wider text-zinc-500">
              Adults
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
              />
            </label>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">
              Kids
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={kids}
                onChange={(e) => setKids(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Notes
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {msg ? <p className="text-sm text-[#075473]">{msg}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void submitInquire()}
            className="w-full rounded-full bg-accent-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Submitting…" : "Submit inquiry"}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-white">Your orders</h2>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {orders.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                No agency orders yet.
              </li>
            ) : (
              orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                >
                  <p className="font-mono text-sm text-white">
                    {o.booking_ref}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {o.agency_name || "—"} · {o.primary_city || "—"} ·{" "}
                    {o.status || "incoming"}
                  </p>
                  {o.notes ? (
                    <p className="mt-2 text-xs text-zinc-500">{o.notes}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
}

function AgencyCompanyCard({
  getClient,
  agencyId,
  agencies,
  onSaved,
}: {
  getClient: () => import("pocketbase").default;
  agencyId: string;
  agencies: AgencyRow[];
  onSaved: () => void;
}) {
  const [id, setId] = useState(agencyId);
  const [name, setName] = useState("");
  const [vat, setVat] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [bank, setBank] = useState("");
  const [terms, setTerms] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [opsName, setOpsName] = useState("");
  const [opsEmail, setOpsEmail] = useState("");
  const [opsPhone, setOpsPhone] = useState("");
  const [billName, setBillName] = useState("");
  const [billEmail, setBillEmail] = useState("");
  const [billPhone, setBillPhone] = useState("");
  const [prefCurrency, setPrefCurrency] = useState("EUR");
  const [payMethod, setPayMethod] = useState("");
  const [commission, setCommission] = useState("");
  const [accountStatus, setAccountStatus] = useState("Active");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const a = agencies.find((x) => x.id === (agencyId || id));
    if (!a) return;
    setId(a.id);
    setName(a.name || "");
    setVat(a.vat_number || "");
    setPhone(a.phone || "");
    setAddress(a.address || "");
    setCountry(a.country || "");
    setWebsite(a.website || "");
    setBank(a.bank_info || "");
    setTerms(a.payment_terms || "");
    setContactEmail(a.contact_email || "");
    setOpsName(a.ops_contact_name || "");
    setOpsEmail(a.ops_contact_email || "");
    setOpsPhone(a.ops_contact_phone || "");
    setBillName(a.billing_contact_name || "");
    setBillEmail(a.billing_contact_email || "");
    setBillPhone(a.billing_contact_phone || "");
    setPrefCurrency(a.preferred_currency || "EUR");
    setPayMethod(a.payment_method || "");
    setCommission(
      a.commission_rate_percentage != null
        ? String(a.commission_rate_percentage)
        : ""
    );
    setAccountStatus(a.account_status || "Active");
  }, [agencies, agencyId, id]);

  if (!id && agencies.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <h2 className="font-display text-xl text-white">Company profile</h2>
      <p className="mt-1 text-sm text-zinc-400">
        VAT, bank, address — agency pocket, not booking data.
      </p>
      {!agencyId && agencies.length > 0 ? (
        <select
          className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">— select agency —</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      ) : null}
      {id ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            VAT / tax ID
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Phone
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Contact email
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Address
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Country
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Website
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Bank info
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              rows={2}
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Payment terms
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </label>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Operations contact
          </p>
          {(
            [
              ["Name", opsName, setOpsName],
              ["Email", opsEmail, setOpsEmail],
              ["Phone", opsPhone, setOpsPhone],
            ] as const
          ).map(([label, value, set]) => (
            <label
              key={`ops-${label}`}
              className="block text-xs uppercase tracking-wider text-zinc-500"
            >
              Ops {label}
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </label>
          ))}
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Billing contact
          </p>
          {(
            [
              ["Name", billName, setBillName],
              ["Email", billEmail, setBillEmail],
              ["Phone", billPhone, setBillPhone],
            ] as const
          ).map(([label, value, set]) => (
            <label
              key={`bill-${label}`}
              className="block text-xs uppercase tracking-wider text-zinc-500"
            >
              Billing {label}
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </label>
          ))}
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Preferred currency
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={prefCurrency}
              onChange={(e) => setPrefCurrency(e.target.value)}
            >
              <option value="EUR">EUR</option>
              <option value="JPY">JPY</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Payment method
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="">—</option>
              <option value="Bank Transfer / SEPA">Bank Transfer / SEPA</option>
              <option value="Credit Card">Credit Card</option>
              <option value="WISE">WISE</option>
              <option value="Invoice Net 30">Invoice Net 30</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Commission %
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Account status
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Suspended">Suspended</option>
            </select>
          </label>
          {error ? <p className="text-sm text-red-400 sm:col-span-2">{error}</p> : null}
          {msg ? <p className="text-sm text-[#075473] sm:col-span-2">{msg}</p> : null}
          <button
            type="button"
            disabled={saving}
            className="rounded-lg bg-[#075473] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            onClick={async () => {
              setSaving(true);
              setMsg(null);
              setError(null);
              try {
                await getClient().collection("agencies").update(
                  id,
                  {
                    name: name.trim(),
                    vat_number: vat.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    country: country.trim(),
                    website: website.trim(),
                    bank_info: bank.trim(),
                    payment_terms: terms.trim(),
                    contact_email: contactEmail.trim(),
                    ops_contact_name: opsName.trim(),
                    ops_contact_email: opsEmail.trim(),
                    ops_contact_phone: opsPhone.trim(),
                    billing_contact_name: billName.trim(),
                    billing_contact_email: billEmail.trim(),
                    billing_contact_phone: billPhone.trim(),
                    preferred_currency: prefCurrency,
                    payment_method: payMethod,
                    commission_rate_percentage: Number(commission) || 0,
                    account_status: accountStatus,
                  },
                  { requestKey: null }
                );
                setMsg("Company profile saved.");
                onSaved();
              } catch (e) {
                setError(formatPbError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save company profile"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
