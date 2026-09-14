export const TICKET_VISIBILITIES = ["public", "unlisted", "members"] as const;
export type TicketVisibility = (typeof TICKET_VISIBILITIES)[number];

export type TicketType = {
  id: string;
  organizationId: string;
  eventId: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  capacity: number | null;
  salesStart: Date | null;
  salesEnd: Date | null;
  visibility: TicketVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type Coupon = {
  id: string;
  organizationId: string;
  eventId: string | null;
  code: string;
  kind: "percentage" | "fixed";
  amount: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AddOn = {
  id: string;
  organizationId: string;
  eventId: string;
  name: string;
  priceCents: number;
  currency: string;
  capacity: number | null;
  inventory: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "cancelled",
  "refund_pending",
  "refunded",
  "partially_refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type EventOrder = {
  id: string;
  organizationId: string;
  eventId: string;
  buyerEmail: string;
  buyerUserId: string | null;
  status: OrderStatus;
  subtotalCents: number;
  ticketSubtotalCents: number;
  addOnSubtotalCents: number;
  discountCents: number;
  taxCents: number;
  platformFeeCents: number;
  totalCents: number;
  currency: string;
  couponId: string | null;
  paymentExternalId: string | null;
  idempotencyKey: string | null;
  connectedAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventOrderItem = {
  id: string;
  organizationId: string;
  orderId: string;
  ticketTypeId: string | null;
  addOnId: string | null;
  quantity: number;
  unitPriceCents: number;
};

export type TicketTypeRepository = {
  create: (ticket: TicketType) => Promise<TicketType>;
  findById: (id: string) => Promise<TicketType | null>;
  listByEvent: (eventId: string) => Promise<TicketType[]>;
  listAll?: () => Promise<TicketType[]>;
  save: (ticket: TicketType) => Promise<TicketType>;
};

export type CouponRepository = {
  create: (coupon: Coupon) => Promise<Coupon>;
  findByCode: (code: string) => Promise<Coupon | null>;
  findById: (id: string) => Promise<Coupon | null>;
  listByEvent: (eventId: string) => Promise<Coupon[]>;
  save: (coupon: Coupon) => Promise<Coupon>;
};

export type AddOnRepository = {
  create: (addOn: AddOn) => Promise<AddOn>;
  findById: (id: string) => Promise<AddOn | null>;
  listByEvent: (eventId: string) => Promise<AddOn[]>;
  save: (addOn: AddOn) => Promise<AddOn>;
};

export type OrderRepository = {
  create: (order: EventOrder, items: EventOrderItem[]) => Promise<EventOrder>;
  findById: (id: string) => Promise<EventOrder | null>;
  findByIdempotencyKey: (key: string) => Promise<EventOrder | null>;
  listByEvent: (eventId: string) => Promise<EventOrder[]>;
  listByOrganization?: (organizationId: string) => Promise<EventOrder[]>;
  listItems: (orderId: string) => Promise<EventOrderItem[]>;
  save: (order: EventOrder) => Promise<EventOrder>;
};

export const REGISTRATION_STATUSES = [
  "pending",
  "confirmed",
  "waitlisted",
  "offered",
  "cancelled",
  "checked_in",
  "expired",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export type EventRegistration = {
  id: string;
  organizationId: string;
  calendarId: string;
  eventId: string;
  userId: string | null;
  email: string;
  status: RegistrationStatus;
  occurrenceStartsAt: Date | null;
  orderId: string | null;
  ticketTypeId: string | null;
  quantity: number;
  offeredUntil: Date | null;
  waitlistPosition: number | null;
  anonymous: boolean;
  appearOnRoster: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EventRegistrationRepository = {
  create: (registration: EventRegistration) => Promise<EventRegistration>;
  createIfCapacity: (
    registration: EventRegistration,
    capacity: number | null,
    quantity: number,
    ticketLimits?: Array<{ ticketTypeId: string; capacity: number | null; quantity: number }>,
  ) => Promise<{ ok: true; registration: EventRegistration } | { ok: false; taken: number }>;
  findById: (id: string) => Promise<EventRegistration | null>;
  findByEventAndUser: (eventId: string, userId: string) => Promise<EventRegistration | null>;
  findByEventAndEmail: (
    eventId: string,
    email: string,
  ) => Promise<EventRegistration | null>;
  listByEvent: (eventId: string) => Promise<EventRegistration[]>;
  listByOrganization?: (organizationId: string) => Promise<EventRegistration[]>;
  listByUser?: (userId: string) => Promise<EventRegistration[]>;
  listAll?: () => Promise<EventRegistration[]>;
  countActive: (eventId: string) => Promise<number>;
  save: (registration: EventRegistration) => Promise<EventRegistration>;
};

export type EventContent = {
  id: string;
  organizationId: string;
  eventId: string;
  kind: "speaker" | "agenda" | "faq";
  title: string;
  body: string | null;
  startsAt: Date | null;
  sortOrder: number;
};

export type EventContentRepository = {
  create: (item: EventContent) => Promise<EventContent>;
  listByEvent: (eventId: string) => Promise<EventContent[]>;
  delete: (id: string) => Promise<void>;
};
