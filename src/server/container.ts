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
  createDrizzleAgencyClientRepository,
  createDrizzleAuditRepository,
  createDrizzleCustomRoleRepository,
  createDrizzleMembershipRepository,
  createDrizzleOrganizationRepository,
} from "@/db/repositories/organization-repo";
import { createHmacTokenSigner } from "@/lib/access-token";
import { getEnv } from "@/lib/env";
import { createOnboardingService } from "@/domain/onboarding/service";
import { createSeoService } from "@/domain/seo/service";
import { createReferralService } from "@/domain/referral/service";
import { createEmbedService } from "@/domain/embed/service";
import { childLogger } from "@/lib/logger";
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
import { createAccessService } from "@/domain/access/service";
import { createCustomRoleService } from "@/domain/custom-role/service";
import { createAgencyService } from "@/domain/agency/service";
import { createAuditService } from "@/domain/audit/service";
import { createProfileService } from "@/domain/profile/service";
import { createTokenService } from "@/domain/session/service";
import { sendAuthEmail } from "@/auth/mailer";
import { unconfiguredBrandChecker } from "@/integrations/brand/unconfigured";
import { unconfiguredStripeConnect } from "@/integrations/payments/unconfigured";
import { createStripeConnectAdapter } from "@/integrations/payments/stripe-connect";
import { createStripeTaxPort } from "@/integrations/payments/stripe-tax";
import { createPaymentService } from "@/domain/payments/service";
import { DEFAULT_PLATFORM_FEE_BPS } from "@/domain/payments/fees";
import {
  createDrizzleCheckoutPaymentRepository,
  createDrizzleConnectedAccountRepository,
  createDrizzleIssuedTicketRepository,
  createDrizzlePaymentRefundRepository,
  createDrizzleStripeWebhookRepository,
  createDrizzleTaxRecordRepository,
} from "@/db/repositories/payment-repo";
import { createNotificationService } from "@/domain/notification/service";
import { createLogProvider } from "@/notifications/log-adapter";
import {
  createDrizzleNewsletterRepository,
  createDrizzleNotificationDeliveryRepository,
  createDrizzleNotificationPreferenceRepository,
  createDrizzleNotificationSuppressionRepository,
  createDrizzleNotificationTemplateRepository,
  createDrizzleSmsConsentRepository,
} from "@/db/repositories/notification-repo";
import { createDrizzleJobRepository } from "@/jobs/job-repo";
import { createJobQueue } from "@/jobs/queue";
import { createHmacCaptchaVerifier } from "@/domain/privacy/captcha";
import { createPrivacyService } from "@/domain/privacy/service";
import { createCheckInService } from "@/domain/checkin/service";
import { checkInRealtimeHub } from "@/domain/checkin/realtime";
import {
  createDrizzleCapacityAlertRepository,
  createDrizzleCheckInPassRepository,
  createDrizzleCheckInRecordRepository,
} from "@/db/repositories/checkin-repo";
import { createAnalyticsService } from "@/domain/analytics/service";
import { createImportService } from "@/domain/import/service";
import { createDrizzleImportRepository } from "@/db/repositories/import-repo";
import { createIntegrationService } from "@/domain/integration/service";
import {
  createDrizzleIntegrationConnectionRepository,
  createDrizzleIntegrationRefRepository,
} from "@/db/repositories/integration-repo";
import { createPublicApiService } from "@/domain/public-api/service";
import {
  createDrizzlePublicApiKeyRepository,
  createDrizzlePublicOAuthClientRepository,
  createDrizzlePublicOAuthCodeRepository,
  createDrizzlePublicWebhookDeliveryRepository,
  createDrizzlePublicWebhookEndpointRepository,
} from "@/db/repositories/public-api-repo";
import { createBillingService } from "@/domain/billing/service";
import { createSupportService } from "@/domain/support/service";
import { createMobileService } from "@/domain/mobile/service";
import { unconfiguredMobilePush } from "@/integrations/push/unconfigured";
import {
  createDrizzleCancellationRepository,
  createDrizzleInvoiceRepository,
  createDrizzlePaymentMethodRepository,
  createDrizzleSubscriptionItemRepository,
  createDrizzleSubscriptionRepository,
  createDrizzleUsageRepository,
} from "@/db/repositories/billing-repo";
import {
  createDrizzleStatusIncidentRepository,
  createDrizzleStatusMaintenanceRepository,
  createDrizzleStatusUptimeRepository,
  createDrizzleSupportTicketRepository,
  createDrizzleTicketAssignmentRepository,
  createDrizzleTicketEventRepository,
  createDrizzleTicketMessageRepository,
} from "@/db/repositories/support-repo";
import { createDrizzleMobileDeviceRepository } from "@/db/repositories/mobile-repo";
import {
  createDrizzleAIConsentRepository,
  createDrizzleAIGenerationRepository,
  createDrizzleAIPolicyRepository,
} from "@/db/repositories/ai-repo";
import { createAIService } from "@/domain/ai/service";
import { createAIProviderRegistry } from "@/domain/ai/registry";
import { createHeuristicImageProvider, createHeuristicTextProvider } from "@/integrations/ai/heuristic";
import { unconfiguredImageProvider, unconfiguredTextProvider } from "@/integrations/ai/unconfigured";
import { createOpenAIImageProvider, createOpenAITextProvider } from "@/integrations/ai/openai";
import {
  createDrizzleAnalyticsPlanRepository,
  createDrizzleAttributionRepository,
  createDrizzlePageViewRepository,
  createDrizzleSnapshotRepository,
} from "@/db/repositories/analytics-repo";
import {
  createDrizzleEmbedImpressionRepository,
  createDrizzleReferralCodeRepository,
  createDrizzleReferralConversionRepository,
} from "@/db/repositories/growth-repo";
import {
  createDrizzleCcpaRepository,
  createDrizzleConsentRepository,
  createDrizzleDeletionRepository,
  createDrizzlePrivacyAuditRepository,
  createDrizzlePrivacySubjects,
  createDrizzleProcessingRepository,
} from "@/db/repositories/privacy-repo";

export function getServices() {
  const db = getDb();
  const organizations = createDrizzleOrganizationRepository(db);
  const members = createDrizzleMembershipRepository(db);
  const customRoles = createDrizzleCustomRoleRepository(db);
  const agencyClients = createDrizzleAgencyClientRepository(db);
  const auditLogs = createDrizzleAuditRepository(db);
  const access = createAccessService({
    members,
    organizations,
    customRoles,
    agencyClients,
  });
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
  const deliveries = createDrizzleNotificationDeliveryRepository(db);
  const notifications = createNotificationService({
    providers: {
      email: createLogProvider("email"),
      sms: createLogProvider("sms"),
      whatsapp: createLogProvider("whatsapp"),
      web_push: createLogProvider("web_push"),
      mobile_push: createLogProvider("mobile_push"),
    },
    preferences: createDrizzleNotificationPreferenceRepository(db),
    suppressions: createDrizzleNotificationSuppressionRepository(db),
    templates: createDrizzleNotificationTemplateRepository(db),
    deliveries,
    smsConsents: createDrizzleSmsConsentRepository(db),
    newsletters: createDrizzleNewsletterRepository(db),
    enqueue: jobs.enqueue,
    unsubscribeSecret: secret,
    appUrl: getEnv().APP_URL ?? getEnv().BETTER_AUTH_URL ?? "http://localhost:3000",
  });
  const env = getEnv();
  const appUrl = env.APP_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const stripe = env.STRIPE_SECRET_KEY
    ? createStripeConnectAdapter({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      })
    : unconfiguredStripeConnect;
  const tax = createStripeTaxPort({
    secretKey: env.STRIPE_SECRET_KEY,
    enabled: env.STRIPE_TAX_ENABLED,
  });
  const connectedAccounts = createDrizzleConnectedAccountRepository(db);
  const checkoutPayments = createDrizzleCheckoutPaymentRepository(db);
  const paymentRefunds = createDrizzlePaymentRefundRepository(db);
  const issuedTickets = createDrizzleIssuedTicketRepository(db);
  const stripeWebhooks = createDrizzleStripeWebhookRepository(db);
  const taxRecords = createDrizzleTaxRecordRepository(db);
  const billing = createBillingService({
    organizations,
    subscriptions: createDrizzleSubscriptionRepository(db),
    items: createDrizzleSubscriptionItemRepository(db),
    invoices: createDrizzleInvoiceRepository(db),
    usage: createDrizzleUsageRepository(db),
    paymentMethods: createDrizzlePaymentMethodRepository(db),
    cancellations: createDrizzleCancellationRepository(db),
    tax,
    stripe,
    appUrl,
    notify: {
      async notify(input) {
        const orgMembers = await members.listByOrganization(input.organizationId);
        for (const member of orgMembers) {
          if (member.role === "check_in_manager" || member.role === "read_only") continue;
          const user = await users.findById(member.userId);
          if (!user?.email) continue;
          await notifications.enqueue({
            channel: "email",
            to: user.email,
            templateKey: input.templateKey,
            subjectOverride: input.subject,
            bodyOverride: input.body,
            vars: { details: input.body },
            idempotencyKey: `${input.idempotencyKey}:${user.id}`,
          });
        }
      },
    },
  });
  const entitlements = { forOrganization: (organizationId: string) => billing.entitlementsFor(organizationId) };
  const support = createSupportService({
    tickets: createDrizzleSupportTicketRepository(db),
    messages: createDrizzleTicketMessageRepository(db),
    assignments: createDrizzleTicketAssignmentRepository(db),
    events: createDrizzleTicketEventRepository(db),
    incidents: createDrizzleStatusIncidentRepository(db),
    maintenance: createDrizzleStatusMaintenanceRepository(db),
    uptime: createDrizzleStatusUptimeRepository(db),
    entitlements,
    members,
    notify: {
      async notify(input) {
        const orgMembers = await members.listByOrganization(input.organizationId);
        for (const member of orgMembers) {
          if (member.role !== "owner" && member.role !== "admin") continue;
          const user = await users.findById(member.userId);
          if (!user?.email) continue;
          await notifications.enqueue({
            channel: "email",
            to: user.email,
            templateKey: input.templateKey,
            subjectOverride: input.subject,
            bodyOverride: input.body,
            vars: { details: input.body },
            idempotencyKey: `support:${input.ticketId}:${input.templateKey}:${user.id}`,
          });
        }
      },
    },
  });
  const publicApi = createPublicApiService({
    keys: createDrizzlePublicApiKeyRepository(db),
    clients: createDrizzlePublicOAuthClientRepository(db),
    codes: createDrizzlePublicOAuthCodeRepository(db),
    endpoints: createDrizzlePublicWebhookEndpointRepository(db),
    deliveries: createDrizzlePublicWebhookDeliveryRepository(db),
    plans: createDrizzleAnalyticsPlanRepository(db),
    entitlements,
    secret,
    enqueue: jobs.enqueue,
  });
  const paymentsModule = createPaymentService({
    accounts: connectedAccounts,
    payments: checkoutPayments,
    refunds: paymentRefunds,
    issuedTickets,
    webhooks: stripeWebhooks,
    taxRecords,
    orders,
    registrations: eventRegistrations,
    events,
    stripe,
    tax,
    publicWebhooks: publicApi,
    onUnmatchedStripeEvent: (event) => billing.handleStripeEvent(event).then(() => undefined),
    appUrl,
    notify: {
      async notify(input) {
        await notifications.enqueue({
          channel: "email",
          to: input.email,
          templateKey: input.kind === "refund" ? "receipt" : "cancellation",
          subjectOverride: input.subject,
          bodyOverride: input.body,
          idempotencyKey: `pay:${input.kind}:${input.email}:${input.subject}`,
        });
      },
    },
  });
  const checkInRecords = createDrizzleCheckInRecordRepository(db);
  const integrations = createIntegrationService({
    connections: createDrizzleIntegrationConnectionRepository(db),
    refs: createDrizzleIntegrationRefRepository(db),
    secret,
    appUrl,
    enqueue: jobs.enqueue,
    events,
    calendars,
    registrations: eventRegistrations,
    orders,
    listCheckIns: (eventId) => checkInRecords.listByEvent(eventId),
  });
  const captcha = createHmacCaptchaVerifier({ secret });
  const privacy = createPrivacyService({
    events,
    listRegistrations: (eventId) => eventRegistrations.listByEvent(eventId),
    profiles,
    consents: createDrizzleConsentRepository(db),
    deletions: createDrizzleDeletionRepository(db),
    processing: createDrizzleProcessingRepository(db),
    ccpa: createDrizzleCcpaRepository(db),
    audit: createDrizzlePrivacyAuditRepository(db),
    subjects: createDrizzlePrivacySubjects(db),
    captcha,
  });
  const onboarding = createOnboardingService({
    calendars,
    events,
    registrations: eventRegistrations,
    followers,
    organizationIdsForUser: async (userId) => {
      const memberships = await members.listByUser(userId);
      return [...new Set(memberships.map((item) => item.organizationId))];
    },
    scheduleLifecycle: async (input) => {
      await jobs.enqueue({
        type: "onboarding.lifecycle",
        payload: { userId: input.userId, email: input.email, templateKey: input.key },
        availableAt: input.availableAt,
        idempotencyKey: `onboarding:${input.userId}:${input.key}`,
      });
    },
  });
  const skipOnboarding = async (work: () => Promise<unknown>): Promise<void> => {
    try {
      await work();
    } catch (error) {
      childLogger({ service: "onboarding" }).warn({ err: error }, "Onboarding hook skipped");
    }
  };
  const registrations = createRegistrationService({
    events,
    registrations: eventRegistrations,
    tickets,
    coupons,
    addOns,
    orders,
    payments: stripe,
    ledger: {
      accounts: connectedAccounts,
      checkoutPayments,
      tax,
      taxRecords,
      issuedTickets,
      requireConnectedAccount: (organizationId) => paymentsModule.requireConnectedAccount(organizationId),
      issueTickets: (input) => paymentsModule.issueTickets(input),
      refundEventCancellation: (organizationId, eventId, reason) =>
        paymentsModule.refundEventCancellation(organizationId, eventId, reason),
      platformFeeBps: env.PLATFORM_FEE_BPS ?? DEFAULT_PLATFORM_FEE_BPS,
    },
    captcha,
    integrations,
    publicWebhooks: publicApi,
    entitlements,
    onRegistered: (registration) => {
      if (!registration.userId) return Promise.resolve();
      return skipOnboarding(() =>
        onboarding.track({
          userId: registration.userId as string,
          name: "first_rsvp",
          organizationId: registration.organizationId,
        }),
      );
    },
    notify: {
      async notify(input) {
        const templateKey =
          input.kind === "cancelled"
            ? "cancellation"
            : input.kind === "refund"
              ? "receipt"
              : input.kind === "registration"
                ? "registration_confirmation"
                : "event_update";
        await notifications.enqueue({
          channel: "email",
          to: input.email,
          templateKey,
          subjectOverride: input.subject,
          bodyOverride: input.body,
          idempotencyKey: `reg:${input.kind}:${input.email}:${input.subject}`,
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
  const organizationService = createOrganizationService({
    organizations,
    members,
    calendars,
    entitlements,
    onCreated: (organizationId) => billing.ensureFreeSubscription(organizationId).then(() => undefined),
  });
  const calendarService = createCalendarService({
    calendars,
    slugChanges,
    brandChecker: unconfiguredBrandChecker,
    limits: {
      forOrganization: (organizationId) => organizationService.calendarUsage(organizationId),
    },
    organizationBranding: async (organizationId) => {
      const organization = await organizations.findById(organizationId);
      if (!organization) return null;
      return { logoUrl: organization.logoUrl, primaryColor: organization.primaryColor };
    },
    onCreated: ({ actor, calendar }) =>
      skipOnboarding(() =>
        onboarding.track({
          userId: actor.userId,
          name: "calendar_created",
          organizationId: calendar.organizationId,
        }),
      ),
  });
  const eventService = createEventService({
    events,
    calendars,
    recurrences,
    overrides,
    registrations,
    integrations,
    publicWebhooks: publicApi,
    payments: stripe,
    notify: {
      async notify(input) {
        await jobs.enqueue({
          type: "calendar.followers.notify",
          payload: input,
          idempotencyKey: `cal-evt:${input.eventId}:${input.change}`,
        });
        if (input.change === "published") {
          await jobs.enqueue({
            type: "reminder.schedule",
            payload: { eventId: input.eventId },
            idempotencyKey: `reminders:${input.eventId}`,
          });
        }
      },
    },
    onActivation: ({ name, actor, event }) =>
      skipOnboarding(() =>
        onboarding.track({
          userId: actor.userId,
          name,
          organizationId: event.organizationId,
        }),
      ),
  });
  const imports = createImportService({
    imports: createDrizzleImportRepository(db),
    calendars,
    events,
    registrations: eventRegistrations,
    subscriptions,
    tickets,
    updateCalendar: (actor, calendarId, input) => calendarService.updateCalendar(actor, calendarId, input),
    createEvent: (actor, input) => eventService.createEvent(actor, input),
    attributions: createDrizzleAttributionRepository(db),
    secret,
    enqueue: jobs.enqueue,
  });
  const analytics = createAnalyticsService({
    events,
    calendars,
    registrations: eventRegistrations,
    orders,
    followers,
    payments: checkoutPayments,
    refunds: paymentRefunds,
    issuedTickets,
    records: createDrizzleCheckInRecordRepository(db),
    passes: createDrizzleCheckInPassRepository(db),
    deliveries,
    attributions: createDrizzleAttributionRepository(db),
    pageViews: createDrizzlePageViewRepository(db),
    snapshots: createDrizzleSnapshotRepository(db),
    plans: createDrizzleAnalyticsPlanRepository(db),
    entitlements,
    secret,
    enqueueRefresh: async (input) => {
      await jobs.enqueue({
        type: "report.generate",
        payload: input,
        idempotencyKey: `analytics:${input.eventId ?? input.organizationId}:${Math.floor(Date.now() / 60_000)}`,
      });
    },
  });
  const mobile = createMobileService({
    devices: createDrizzleMobileDeviceRepository(db),
    home: {
      attendeeHome: (userId, email) => analytics.attendeeHome(userId, email),
    },
    events,
    calendars,
    push: {
      apns: unconfiguredMobilePush("apns"),
      fcm: unconfiguredMobilePush("fcm"),
    },
  });
  const discovery = createDiscoveryService({
    events,
    calendars,
    registrations: eventRegistrations,
    tickets,
    followers,
    profiles,
  });
  const heuristicText = createHeuristicTextProvider();
  const heuristicImage = createHeuristicImageProvider();
  const openaiText = createOpenAITextProvider({ apiKey: env.OPENAI_API_KEY });
  const openaiImage = createOpenAIImageProvider({ apiKey: env.OPENAI_API_KEY });
  const ai = createAIService({
    providers: createAIProviderRegistry({
      text: [heuristicText, openaiText, unconfiguredTextProvider],
      image: [heuristicImage, openaiImage, unconfiguredImageProvider],
      defaultTextId: env.AI_TEXT_PROVIDER ?? "heuristic",
      defaultImageId: env.AI_IMAGE_PROVIDER ?? "unconfigured",
    }),
    generations: createDrizzleAIGenerationRepository(db),
    consents: createDrizzleAIConsentRepository(db),
    policies: createDrizzleAIPolicyRepository(db),
    events,
    calendars,
    followers,
    messages: eventChatMessages,
    discovery,
    analytics,
    entitlements,
    jobs,
  });

  return {
    db,
    users,
    jobs,
    organizations: organizationService,
    access,
    customRoles: createCustomRoleService({ roles: customRoles, members }),
    agency: createAgencyService({ organizations, agencyClients }),
    audit: createAuditService({ audit: auditLogs, organizations }),
    calendars: calendarService,
    events: eventService,
    registrations,
    checkin: createCheckInService({
      events,
      registrations: eventRegistrations,
      tickets,
      issuedTickets,
      passes: createDrizzleCheckInPassRepository(db),
      records: checkInRecords,
      alerts: createDrizzleCapacityAlertRepository(db),
      secret,
      registrationsService: registrations,
      integrations,
      publicWebhooks: publicApi,
      profiles,
      onCheckedIn: ({ registration }) => {
        if (!registration.userId) return Promise.resolve();
        return skipOnboarding(() =>
          onboarding.track({
            userId: registration.userId as string,
            name: "first_checkin",
            organizationId: registration.organizationId,
          }),
        );
      },
      realtime: checkInRealtimeHub,
      listOrganizerEmails: async (organizationId) => {
        const orgMembers = await members.listByOrganization(organizationId);
        const emails: string[] = [];
        for (const member of orgMembers) {
          if (member.role === "check_in_manager" || member.role === "read_only") continue;
          const user = await users.findById(member.userId);
          if (user?.email) emails.push(user.email);
        }
        return emails;
      },
      notify: {
        async notifyCapacity(input) {
          for (const email of input.emails) {
            await notifications.enqueue({
              channel: "email",
              to: email,
              templateKey: "event_update",
              subjectOverride: `${input.title}: capacity ${input.threshold}%`,
              bodyOverride: `${input.checkedIn}/${input.capacity} guests are checked in for ${input.title}.`,
              idempotencyKey: `capacity:${input.eventId}:${input.threshold}`,
            });
          }
        },
      },
    }),
    payments: paymentsModule,
    privacy,
    notifications,
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
    discovery,
    publicEvents: createPublicEventService({
      events,
      calendars,
      content: eventContent,
      tickets,
      addOns,
      countActive: (eventId) => eventRegistrations.countActive(eventId),
      profiles,
    }),
    follows: createFollowService({
      calendars,
      followers,
      subscriptions,
      calendarMembers,
      orgMembers: members,
      onFollowed: (follower) =>
        skipOnboarding(() =>
          onboarding.track({
            userId: follower.userId,
            name: "first_follow",
            organizationId: follower.organizationId,
          }),
        ),
    }),
    calendarMemberships: createMembershipService({
      calendars,
      tiers,
      members: calendarMembers,
      payments: stripe,
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
    members: createOrgMembershipService({ members, invitations, users, customRoles, entitlements }),
    invitations,
    profiles: createProfileService({
      profiles,
      organizations: createSharedOrganizationLookup(db),
    }),
    tokens: createTokenService({
      tokens,
      signer: createHmacTokenSigner(secret),
    }),
    domains: createDomainService({ domains, members, entitlements }),
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
    analytics,
    onboarding,
    seo: createSeoService({ events, calendars }),
    referrals: createReferralService({
      codes: createDrizzleReferralCodeRepository(db),
      conversions: createDrizzleReferralConversionRepository(db),
    }),
    embeds: createEmbedService({
      impressions: createDrizzleEmbedImpressionRepository(db),
    }),
    calendarRepo: calendars,
    eventRepo: events,
    eventRegistrations,
    calendarSubscriptions: subscriptions,
    eventContent,
    imports,
    integrations,
    publicApi,
    billing,
    support,
    mobile,
    ai,
  };
}
