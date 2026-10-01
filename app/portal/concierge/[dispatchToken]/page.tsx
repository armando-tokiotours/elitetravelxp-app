import { VendorPortalClient } from "@/components/portal/VendorPortalClient";

export default async function ConciergeDispatchPortalPage({
  params,
}: {
  params: Promise<{ dispatchToken: string }>;
}) {
  const { dispatchToken } = await params;
  return (
    <main className="min-h-dvh bg-[#0A1017] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        <VendorPortalClient token={dispatchToken} expectedRole="CONCIERGE" />
      </div>
    </main>
  );
}
