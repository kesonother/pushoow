"use client";

export function DoorList({
  title,
  guests,
}: {
  title: string;
  guests: Array<{
    displayName: string;
    ticketTypeName: string | null;
    ticketCode: string | null;
    qrImage: string | null;
    quantity: number;
    status?: string;
  }>;
}) {
  return (
    <div className="print:p-0">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-zinc-600">{guests.length} guests · A–Z</p>
        </div>
        <button type="button" className="text-sm underline print:hidden" onClick={() => window.print()}>
          Print
        </button>
      </header>
      <ol className="grid gap-4">
        {guests.map((guest, index) => (
          <li
            key={`${guest.displayName}-${guest.ticketCode ?? index}`}
            className="flex items-center justify-between gap-4 break-inside-avoid border-b border-[#E8E8E8] pb-3"
          >
            <div>
              <p className="text-lg font-medium">{guest.displayName}</p>
              <p className="text-sm text-zinc-600">
                {guest.ticketTypeName ?? "Ticket"}
                {guest.ticketCode ? ` · ${guest.ticketCode}` : ""}
                {guest.quantity > 1 ? ` · ×${guest.quantity}` : ""}
                {guest.status === "revoked" ? " · revoked" : ""}
              </p>
            </div>
            {guest.qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={guest.qrImage} alt="" width={96} height={96} />
            ) : (
              <div className="flex size-24 items-center justify-center bg-zinc-100 text-xs text-zinc-600">—</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
