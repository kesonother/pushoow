export const CHECK_IN_STATUSES = [
  "checked_in",
  "already_checked_in",
  "not_on_list",
  "wrong_event",
  "invalid",
  "revoked",
] as const;
export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number];

export const CHECK_IN_SOURCES = ["scan", "search", "bulk", "walk_in", "sync"] as const;
export type CheckInSource = (typeof CHECK_IN_SOURCES)[number];

export const CAPACITY_ALERT_THRESHOLDS = [50, 80, 100] as const;
export type CapacityAlertThreshold = (typeof CAPACITY_ALERT_THRESHOLDS)[number];

export const CHECK_IN_ELIGIBLE = new Set(["confirmed", "checked_in", "offered"]);

export type CheckInPass = {
  id: string;
  organizationId: string;
  eventId: string;
  registrationId: string;
  issuedTicketId: string | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export type CheckInRecord = {
  id: string;
  organizationId: string;
  eventId: string;
  registrationId: string;
  issuedTicketId: string | null;
  actorUserId: string | null;
  source: CheckInSource;
  deviceId: string | null;
  clientOpId: string;
  checkedInAt: Date;
  createdAt: Date;
};

export type CapacityAlertRecord = {
  id: string;
  organizationId: string;
  eventId: string;
  threshold: CapacityAlertThreshold;
  createdAt: Date;
};

export type CheckInPassRepository = {
  create: (pass: CheckInPass) => Promise<CheckInPass>;
  findById: (id: string) => Promise<CheckInPass | null>;
  findByRegistration: (registrationId: string) => Promise<CheckInPass | null>;
  listByEvent: (eventId: string) => Promise<CheckInPass[]>;
  save: (pass: CheckInPass) => Promise<CheckInPass>;
};

export type CheckInRecordRepository = {
  create: (item: CheckInRecord) => Promise<CheckInRecord>;
  findByClientOpId: (clientOpId: string) => Promise<CheckInRecord | null>;
  findByRegistration: (eventId: string, registrationId: string) => Promise<CheckInRecord | null>;
  listByEvent: (eventId: string) => Promise<CheckInRecord[]>;
  countByEvent: (eventId: string) => Promise<number>;
};

export type CapacityAlertRepository = {
  find: (eventId: string, threshold: CapacityAlertThreshold) => Promise<CapacityAlertRecord | null>;
  create: (item: CapacityAlertRecord) => Promise<CapacityAlertRecord>;
};

export type GuestManifestEntry = {
  registrationId: string;
  displayName: string;
  email: string;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  ticketCode: string | null;
  issuedTicketId: string | null;
  qrToken: string;
  status: string;
  checkedInAt: string | null;
  quantity: number;
};

export type CheckInManifest = {
  eventId: string;
  organizationId: string;
  title: string;
  capacity: number | null;
  generatedAt: string;
  checkedIn: number;
  guests: GuestManifestEntry[];
  ticketTypes: Array<{ id: string; name: string; priceCents: number }>;
};

export type CheckInResult = {
  status: CheckInStatus;
  registrationId: string | null;
  displayName: string | null;
  checkedInAt: string | null;
  clientOpId: string | null;
};

export type CheckInNotifier = {
  notifyCapacity: (input: {
    eventId: string;
    title: string;
    threshold: CapacityAlertThreshold;
    checkedIn: number;
    capacity: number;
    emails: string[];
  }) => Promise<void>;
};
