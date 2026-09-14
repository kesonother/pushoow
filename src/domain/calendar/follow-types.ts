export type NotificationPreferences = {
  email: boolean;
  push: boolean;
  sms: boolean;
};

export type CalendarFollower = {
  id: string;
  organizationId: string;
  calendarId: string;
  userId: string;
  preferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
};

export type CalendarSubscription = {
  id: string;
  organizationId: string;
  calendarId: string;
  userId: string | null;
  email: string;
  status: "active" | "unsubscribed";
  createdAt: Date;
  updatedAt: Date;
};

export type CalendarFollowerRepository = {
  create: (follower: CalendarFollower) => Promise<CalendarFollower>;
  findByUserAndCalendar: (
    userId: string,
    calendarId: string,
  ) => Promise<CalendarFollower | null>;
  listByCalendar: (calendarId: string) => Promise<CalendarFollower[]>;
  listByUser?: (userId: string) => Promise<CalendarFollower[]>;
  countByCalendar: (calendarId: string) => Promise<number>;
  save: (follower: CalendarFollower) => Promise<CalendarFollower>;
  delete: (id: string) => Promise<void>;
};

export type CalendarSubscriptionRepository = {
  create: (subscription: CalendarSubscription) => Promise<CalendarSubscription>;
  findByEmailAndCalendar: (
    email: string,
    calendarId: string,
  ) => Promise<CalendarSubscription | null>;
  listByCalendar: (calendarId: string) => Promise<CalendarSubscription[]>;
  save: (subscription: CalendarSubscription) => Promise<CalendarSubscription>;
};
