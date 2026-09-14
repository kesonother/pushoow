import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type { EventRegistration } from "@/domain/event/commerce-types";
import type { Event, EventRepository } from "@/domain/event/types";
import type { AttendeeProfile, ProfileRepository } from "@/domain/profile/types";
import { CCPA_DISCLOSURE, PLATFORM_DPA, defaultCcpaSettings } from "@/domain/privacy/policy";
import { buildRoster } from "@/domain/privacy/roster";
import {
  DELETION_SLA_MS,
  type CaptchaVerifier,
  type CcpaSettingsRepository,
  type ConsentPurpose,
  type ConsentRepository,
  type DeletionRequestRepository,
  type PrivacyAuditRepository,
  type PrivacyExport,
  type PrivacySubjectDirectory,
  type ProcessingRecordRepository,
  type RosterViewer,
} from "@/domain/privacy/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export function createPrivacyService(deps: {
  events: EventRepository;
  listRegistrations: (eventId: string) => Promise<EventRegistration[]>;
  profiles: ProfileRepository;
  consents: ConsentRepository;
  deletions: DeletionRequestRepository;
  processing: ProcessingRecordRepository;
  ccpa: CcpaSettingsRepository;
  audit: PrivacyAuditRepository;
  subjects: PrivacySubjectDirectory;
  captcha: CaptchaVerifier;
  clock?: Clock;
  ids?: IdGenerator;
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function audit(input: {
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    organizationId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return deps.audit.append({
      id: ids.id(),
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      organizationId: input.organizationId ?? null,
      metadata: input.metadata ?? {},
      createdAt: clock.now(),
    });
  }

  function assertSelf(actorUserId: string, targetUserId: string, action: string) {
    if (actorUserId !== targetUserId) {
      throw new ForbiddenError(`You cannot ${action} another user's data`);
    }
  }

  async function recordProcessing(input: {
    userId: string | null;
    organizationId?: string | null;
    purpose: string;
    legalBasis: string;
    categories: string[];
  }) {
    return deps.processing.create({
      id: ids.id(),
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      purpose: input.purpose,
      legalBasis: input.legalBasis,
      categories: input.categories,
      createdAt: clock.now(),
    });
  }

  async function recordConsent(input: {
    userId: string;
    purpose: ConsentPurpose;
    granted: boolean;
    source: string;
  }) {
    if (input.purpose === "data_sale" && input.granted) {
      throw new ValidationError("Personal data is not sold");
    }
    const record = await deps.consents.create({
      id: ids.id(),
      userId: input.userId,
      purpose: input.purpose,
      granted: input.granted,
      source: input.source,
      createdAt: clock.now(),
    });
    await recordProcessing({
      userId: input.userId,
      purpose: `consent:${input.purpose}`,
      legalBasis: "consent",
      categories: [input.purpose],
    });
    return record;
  }

  async function getCcpa(userId: string) {
    return (await deps.ccpa.findByUser(userId)) ?? defaultCcpaSettings(userId, clock.now());
  }

  async function acknowledgeDisclosure(actorUserId: string) {
    const current = await getCcpa(actorUserId);
    const saved = await deps.ccpa.upsert({
      ...current,
      disclosureAcknowledged: true,
      saleOptOut: true,
      updatedAt: clock.now(),
    });
    await audit({
      actorUserId,
      action: "privacy.disclosure.ack",
      resourceType: "user",
      resourceId: actorUserId,
    });
    return saved;
  }

  async function optOutOfSale(actorUserId: string) {
    const current = await getCcpa(actorUserId);
    const saved = await deps.ccpa.upsert({
      ...current,
      saleOptOut: true,
      updatedAt: clock.now(),
    });
    await recordConsent({
      userId: actorUserId,
      purpose: "data_sale",
      granted: false,
      source: "ccpa_opt_out",
    });
    await audit({
      actorUserId,
      action: "privacy.ccpa.opt_out",
      resourceType: "user",
      resourceId: actorUserId,
    });
    return saved;
  }

  async function exportData(actorUserId: string, targetUserId: string, format: PrivacyExport["format"]) {
    assertSelf(actorUserId, targetUserId, format === "portability" ? "port" : "export");
    const [payload, consents, ccpa, processing] = await Promise.all([
      deps.subjects.getExportPayload(targetUserId),
      deps.consents.listByUser(targetUserId),
      getCcpa(targetUserId),
      deps.processing.listByUser(targetUserId),
    ]);
    await recordProcessing({
      userId: targetUserId,
      purpose: format === "portability" ? "gdpr_portability" : "gdpr_export",
      legalBasis: "legal_obligation",
      categories: ["profile", "registrations", "consents"],
    });
    await audit({
      actorUserId,
      action: format === "portability" ? "privacy.portability" : "privacy.export",
      resourceType: "user",
      resourceId: targetUserId,
    });
    return {
      format,
      version: 1 as const,
      exportedAt: clock.now().toISOString(),
      subjectUserId: targetUserId,
      data: {
        profile: payload.profile,
        registrations: payload.registrations,
        consents,
        ccpa,
        processingRecords: processing,
      },
    } satisfies PrivacyExport;
  }

  async function requestDeletion(actorUserId: string, targetUserId: string) {
    assertSelf(actorUserId, targetUserId, "delete");
    const open = await deps.deletions.findOpenByUser(targetUserId);
    if (open) throw new ConflictError("A deletion request is already pending");
    const now = clock.now();
    const request = await deps.deletions.create({
      id: ids.id(),
      userId: targetUserId,
      status: "pending",
      requestedAt: now,
      dueAt: new Date(now.getTime() + DELETION_SLA_MS),
      processedAt: null,
    });
    await recordProcessing({
      userId: targetUserId,
      purpose: "gdpr_erasure",
      legalBasis: "legal_obligation",
      categories: ["account"],
    });
    await audit({
      actorUserId,
      action: "privacy.deletion.request",
      resourceType: "deletion_request",
      resourceId: request.id,
    });
    return request;
  }

  async function processDueDeletions() {
    const due = await deps.deletions.listDue(clock.now());
    const processed = [];
    for (const request of due) {
      const now = clock.now();
      if (now.getTime() - request.requestedAt.getTime() > DELETION_SLA_MS + 1000) {
        throw new ConflictError("Deletion exceeded the policy deadline");
      }
      await deps.deletions.save({ ...request, status: "processing" });
      await deps.subjects.eraseSubject(request.userId, now);
      const completed = await deps.deletions.save({
        ...request,
        status: "completed",
        processedAt: now,
      });
      await audit({
        actorUserId: null,
        action: "privacy.deletion.process",
        resourceType: "deletion_request",
        resourceId: request.id,
        metadata: { userId: request.userId },
      });
      processed.push(completed);
    }
    return processed;
  }

  async function getRoster(input: { eventId: string; viewer: RosterViewer }) {
    const event = await deps.events.findById(input.eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", input.eventId);
    const registrations = await deps.listRegistrations(event.id);
    const profiles = new Map<string, AttendeeProfile>();
    for (const registration of registrations) {
      if (!registration.userId || profiles.has(registration.userId)) continue;
      const profile = await deps.profiles.getAttendee(registration.userId);
      if (profile) profiles.set(registration.userId, profile);
    }
    const view = buildRoster({ event, registrations, profiles, viewer: input.viewer });
    if (input.viewer.canReadRegistrants) {
      await audit({
        actorUserId: input.viewer.userId ?? null,
        action: "privacy.roster.staff_view",
        resourceType: "event",
        resourceId: event.id,
        organizationId: event.organizationId,
      });
    }
    return view;
  }

  return {
    dpa: () => PLATFORM_DPA,
    disclosure: () => CCPA_DISCLOSURE,
    issueCaptcha: () => deps.captcha.issue(),
    verifyCaptcha: (input: { id: string; answer: string; action: string }) => deps.captcha.verify(input),
    recordConsent,
    getCcpa,
    acknowledgeDisclosure,
    optOutOfSale,
    exportData,
    requestDeletion,
    processDueDeletions,
    getRoster,
    audit,
    settings: async (userId: string) => ({
      dpa: PLATFORM_DPA,
      disclosure: CCPA_DISCLOSURE,
      ccpa: await getCcpa(userId),
      consents: await deps.consents.listByUser(userId),
    }),
  };
}

export type PrivacyService = ReturnType<typeof createPrivacyService>;

export function eventHasRoster(event: Pick<Event, "rosterMode">) {
  return event.rosterMode;
}
