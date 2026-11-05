"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BookingDetails } from "./BookingDetails";
import { BookingForm } from "./BookingForm";
import type { Barber, BookingWithRelations, Service, Shop } from "@/lib/types";

interface CreateOpts {
  date?: string;
  time?: string;
  barberId?: string;
}
interface BoardCtx {
  open: (b: BookingWithRelations) => void;
  create: (date?: string, opts?: Omit<CreateOpts, "date">) => void;
}
const Ctx = createContext<BoardCtx | null>(null);
export const useBoard = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBoard outside BookingsBoard");
  return c;
};

/** Hosts the booking details + form modals for any list/calendar inside it. */
export function BookingsBoard({
  shop,
  services,
  barbers,
  autoCreate,
  children,
}: {
  shop: Pick<Shop, "name" | "timezone">;
  services: Service[];
  barbers: Barber[];
  /** Opens the new-booking form on mount (used by the mobile "+" button). */
  autoCreate?: boolean;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<BookingWithRelations | null>(null);
  const [editing, setEditing] = useState<BookingWithRelations | null>(null);
  const [creating, setCreating] = useState<CreateOpts | null>(null);

  useEffect(() => {
    if (!autoCreate) return;
    setCreating({});
    // drop ?new=1 so a refresh does not reopen the form
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
  }, [autoCreate]);

  return (
    <Ctx.Provider value={{ open: setSelected, create: (date, opts) => setCreating({ date, ...opts }) }}>
      {children}
      <BookingDetails
        booking={selected}
        shop={shop}
        onClose={() => setSelected(null)}
        onEdit={(b) => {
          setSelected(null);
          setEditing(b);
        }}
      />
      {editing && <BookingForm key={editing.id} open booking={editing} onClose={() => setEditing(null)} services={services} barbers={barbers} tz={shop.timezone} />}
      {creating && (
        <BookingForm
          open
          onClose={() => setCreating(null)}
          services={services}
          barbers={barbers}
          tz={shop.timezone}
          defaultDate={creating.date}
          defaultTime={creating.time}
          defaultBarberId={creating.barberId}
        />
      )}
    </Ctx.Provider>
  );
}

export function NewBookingButton({ date, label = "حجز جديد" }: { date?: string; label?: string }) {
  const { create } = useBoard();
  return (
    <Button size="sm" onClick={() => create(date)}>
      <Plus className="size-4" /> {label}
    </Button>
  );
}
