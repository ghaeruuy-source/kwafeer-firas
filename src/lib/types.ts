export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface Shop {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  maps_url: string | null;
  timezone: string;
  slot_interval_minutes: number;
  booking_window_days: number;
  min_notice_minutes: number;
  max_active_per_customer: number;
  auto_confirm: boolean;
  sequential_slots: boolean;
  /** Loyalty card: reward after this many completed visits (0 = off). Missing until the loyalty SQL is run. */
  loyalty_every?: number;
  loyalty_reward?: string;
}

export interface Service {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price_iqd: number;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
}

export interface Barber {
  id: string;
  shop_id: string;
  name: string;
  title: string | null;
  photo_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface WorkingHours {
  id: string;
  shop_id: string;
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface BlockedTime {
  id: string;
  shop_id: string;
  barber_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  notes: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  shop_id: string;
  customer_id: string;
  service_id: string;
  barber_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_iqd: number;
  code: string;
  customer_note: string | null;
  admin_note: string | null;
  source: "online" | "admin";
  created_at: string;
}

/** Booking row joined with its relations, as the admin screens use it. */
export interface BookingWithRelations extends Booking {
  customer: Pick<Customer, "id" | "name" | "phone" | "notes"> | null;
  service: Pick<Service, "id" | "name" | "duration_minutes"> | null;
  barber: Pick<Barber, "id" | "name"> | null;
}

export const BOOKING_SELECT =
  "*, customer:customers(id,name,phone,notes), service:services(id,name,duration_minutes), barber:barbers(id,name)";

export interface PublicBooking {
  code: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  price_iqd: number;
  customer_name: string;
  service_name: string;
  barber_name: string;
  customer_note: string | null;
  can_cancel: boolean;
}

export interface Slot {
  slot_start: string;
  barber_ids: string[];
  /** false = already taken; shown greyed out and not selectable */
  available: boolean;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
