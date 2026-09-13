import { getDb } from "@/db/client";
import {
  createDrizzleCalendarRepository,
  createDrizzleCalendarSlugChangeRepository,
} from "@/db/repositories/calendar-repo";
import {
  createDrizzleCalendarFollowerRepository,
  createDrizzleCalendarMemberRepository,
  createDrizzleCalendarSubscriptionRepository,
  createDrizzleCalendarTierRepository,
} from "@/db/repositories/calendar-engagement-repo";
import {
  createDrizzleAddOnRepository,
  createDrizzleCouponRepository,
  createDrizzleEventContentRepository,
  createDrizzleOverrideRepository,
  createDrizzleOrderRepository,
  createDrizzleRecurrenceRepository,
  createDrizzleRegistrationRepository,
  createDrizzleTicketRepository,
} from "@/db/repositories/event-commerce-repo";
import {
  createDrizzleEventChatMessageRepository,
  createDrizzleEventChatModerationRepository,
  createDrizzleEventChatReportRepository,
  createDrizzleEventChatRepository,
  createDrizzleEventChatThreadRepository,
} from "@/db/repositories/event-chat-repo";
import { createDrizzleEventRepository } from "@/db/repositories/event-repo";
import {
  createDrizzleDomainRepository,
  createDrizzleInvitationRepository,
  createDrizzleModerationRepository,
  createDrizzleProfileRepository,
  createDrizzleRefreshTokenRepository,
  createDrizzleUserDirectory,
  createSharedOrganizationLookup,
} from "@/db/repositories/identity-repo";
import {
  createDrizzleMembershipRepository,
  createDrizzleOrganizationRepository,
} from "@/db/repositories/organization-repo";
import { createHmacTokenSigner } from "@/lib/access-token";
import { getEnv } from "@/lib/env";
import { createCalendarService } from "@/domain/calendar/service";
import { createFollowService } from "@/domain/calendar/follow-service";
import { createMembershipService } from "@/domain/calendar/membership-service";
import { createPublicCalendarService } from "@/domain/calendar/public-page";
import { createCalendarFeedService } from "@/domain/calendar/feeds";
import { createCalendarNotifyService } from "@/domain/calendar/notify";
import { createDomainService } from "@/domain/enterprise/domains";
import { createEventService } from "@/domain/event/service";
import { createPublicEventService } from "@/domain/event/public-page";
import { createRegistrationService } from "@/domain/event/registration-service";
import { createChatService } from "@/domain/chat/service";
import { chatRealtimeHub } from "@/domain/chat/realtime";
import { createDiscoveryService } from "@/domain/discovery/service";
import { createNominatimGeocoder } from "@/integrations/geocoding/nominatim";
import { createMembershipService as createOrgMembershipService } from "@/domain/membership/service";
import { createModerationService } from "@/domain/moderation/service";
import { createOrganizationService } from "@/domain/organization/service";
import { createProfileService } from "@/domain/profile/service";
import { createTokenService } from "@/domain/session/service";
import { sendAuthEmail } from "@/auth/mailer";
import { unconfiguredBrandChecker } from "@/integrations/brand/unconfigured";
import { unconfiguredPaymentAdapter } from "@/integrations/payments/unconfigured";
import { createDrizzleJobRepository } from "@/jobs/job-repo";
import { createJobQueue } from "@/jobs/queue";

export function getServices() {
  const db = getDb();
  const organizations = createDrizzleOrganizationRepository(db);
  const members = createDrizzleMembershipRepository(db);
  const calendars = createDrizzleCalendarRepository(db);
  const slugChanges = createDrizzleCalendarSlugChangeRepository(db);
  const events = createDrizzleEventRepository(db);
  const tickets = createDrizzleTicketRepository(db);
  const coupons = createDrizzleCouponRepository(db);
  const addOns = createDrizzleAddOnRepository(db);
  const orders = createDrizzleOrderRepository(db);
  const eventRegistrations = createDrizzleRegistrationRepository(db);
  const eventContent = createDrizzleEventContentRepository(db);
  const eventChats = createDrizzleEventChatRepository(db);
  const eventChatThreads = createDrizzleEventChatThreadRepository(db);
  const eventChatMessages = createDrizzleEventChatMessageRepository(db);
  const eventChatReports = createDrizzleEventChatReportRepository(db);
  const eventChatModeration = createDrizzleEventChatModerationRepository(db);
  const recurrences = createDrizzleRecurrenceRepository(db);
  const overrides = createDrizzleOverrideRepository(db);
  const geocoder = createNominatimGeocoder();
  const users = createDrizzleUserDirectory(db);
  const invitations = createDrizzleInvitationRepository(db);
  const profiles = createDrizzleProfileRepository(db);
  const tokens = createDrizzleRefreshTokenRepository(db);
  const domains = createDrizzleDomainRepository(db);
  const moderation = createDrizzleModerationRepository(db);
  const followers = createDrizzleCalendarFollowerRepository(db);
  const subscriptions = createDrizzleCalendarSubscriptionRepository(db);
  const tiers = createDrizzleCalendarTierRepository(db);
  const calendarMembers = createDrizzleCalendarMemberRepository(db);
  const secret = getEnv().BETTER_AUTH_SECRET ?? "dev-only-change-me-token-secret-32";
  const jobs = createJobQueue({ jobs: createDrizzleJobRepository(db) });
  const registrations = createRegistrationService({
    events,
    registrations: eventRegistrations,
    tickets,
    coupons,
    addOns,
    orders,
    payments: unconfiguredPaymentAdapter,
    notify: {
      async notify(input) {
        await jobs.enqueue({
          type: "email.send",
          payload: { to: input.email, subject: input.subject, body: input.body },
        });
      },
    },
    schedule: {
      async scheduleOfferExpiry(input) {
        await jobs.enqueue({
          type: "waitlist.expire",
          payload: { eventId: input.eventId, registrationId: input.registrationId },
          availableAt: input.availableAt,
          idempotencyKey: `waitlist-expire:${input.registrationId}`,
        });
      },
    },
  });
  const followerNotify = createCalendarNotifyService({
    followers,
    users,
    enqueue: jobs.enqueue,
  });

  return {
    db,
    users,
    jobs,
    organizations: createOrganizationService({ organizations, members }),
    calendars: createCalendarService({
      calendars,
      slugChanges,
      brandChecker: unconfiguredBrandChecker,
    }),
    events: createEventService({
      events,
      calendars,
      recurrences,
      overrides,
      registrations,
      payments: unconfiguredPaymentAdapter,
      notify: {
        async notify(input) {
          await jobs.enqueue({
            type: "calendar.followers.notify",
            payload: input,
            idempotencyKey: `cal-evt:${input.eventId}:${input.change}`,
          });
        },
      },
    }),
    registrations,
    chat: createChatService({
      events,
      calendars,
      registrations: eventRegistrations,
      chats: eventChats,
      threads: eventChatThreads,
      messages: eventChatMessages,
      reports: eventChatReports,
      moderation: eventChatModeration,
      realtime: chatRealtimeHub,
      schedule: {
        async scheduleArchive(input) {
          await jobs.enqueue({
            type: "chat.archive",
            payload: { eventId: input.eventId },
            availableAt: input.availableAt,
            idempotencyKey: `chat-archive:${input.eventId}:${input.availableAt.toISOString()}`,
          });
        },
      },
    }),
    tickets,
    coupons,
    addOns,
    geocoder,
    discovery: createDiscoveryService({
      events,
      calendars,
      registrations: eventRegistrations,
      tickets,
      followers,
      profiles,
    }),
    publicEvents: createPublicEventService({
      events,
      calendars,
      content: eventContent,
      tickets,
      countActive: (eventId) => eventRegistrations.countActive(eventId),
      profiles,
    }),
    follows: createFollowService({
      calendars,
      followers,
      subscriptions,
      calendarMembers,
      orgMembers: members,
    }),
    calendarMemberships: createMembershipService({
      calendars,
      tiers,
      members: calendarMembers,
      payments: unconfiguredPaymentAdapter,
      notify: {
        async notify(input) {
          if (!input.userId) return;
          const user = await users.findById(input.userId);
          if (!user) return;
          await jobs.enqueue({
            type: "email.send",
            payload: {
              to: user.email,
              subject: input.subject,
              body: input.body,
            },
          });
        },
      },
    }),
    publicCalendars: createPublicCalendarService({
      calendars,
      events,
      followers,
      tiers,
      calendarMembers,
      orgMembers: members,
    }),
    feeds: createCalendarFeedService({ calendars, events }),
    followerNotify,
    memberships: members,
    members: createOrgMembershipService({ members, invitations, users }),
    invitations,
    profiles: createProfileService({
      profiles,
      organizations: createSharedOrganizationLookup(db),
    }),
    tokens: createTokenService({
      tokens,
      signer: createHmacTokenSigner(secret),
    }),
    domains: createDomainService({ domains, members }),
    moderation: createModerationService({
      moderation,
      notify: async (action) => {
        const target = await users.findById(action.userId);
        if (!target) return;
        await sendAuthEmail({
          to: target.email,
          subject: `Account notice: ${action.type}`,
          body: `${action.reason}. Starts at ${action.startsAt.toISOString()}. You may appeal from your account settings.`,
        });
      },
    }),
    calendarRepo: calendars,
    eventRepo: events,
    eventContent,
  };
}
