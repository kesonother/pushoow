import { ForbiddenError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { EntitlementResolver } from "@/domain/billing/entitlements";
import { assertFeature } from "@/domain/billing/entitlements";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import type { CalendarFollowerRepository } from "@/domain/calendar/follow-types";
import type { Event, EventRepository } from "@/domain/event/types";
import type { EventChatMessage, EventChatMessageRepository } from "@/domain/chat/types";
import type { DiscoveryPage, DiscoveryFilters, OrganizerInsights } from "@/domain/discovery/types";
import type { EventDashboard } from "@/domain/analytics/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { childLogger } from "@/lib/logger";
import type { JobType } from "@/jobs/types";
import {
  AI_DISCLOSURE,
  AI_PERSONAS,
  COVER_STYLES,
  DEFAULT_AI_POLICY,
  DEFAULT_PROVIDER_RETENTION_DAYS,
  type AIConsentRepository,
  type AIGenerationKind,
  type AIGenerationRecord,
  type AIGenerationRepository,
  type AIOrgPolicy,
  type AIPolicyRepository,
  type AIPrivacySettings,
  type AIProviderRegistry,
  type CoverInput,
  type CoverStyle,
  type DescriptionInput,
  type EventRecap,
  type GeneratedCover,
  type GeneratedDescription,
  type InterpretedSearch,
  type ProviderPrivacy,
  type SemanticSearchResult,
  type SmartSuggestions,
  type AIPersona,
} from "@/domain/ai/types";
import { AIProviderNotConfiguredError } from "@/domain/ai/types";
import {
  assertSafeUserText,
  hashMinimizedInput,
  redactPii,
  safeLogFields,
  summarizeOutput,
} from "@/domain/ai/safety";
import { descriptionSystemPrompt, minimizeDescriptionInput, toGeneratedDescription } from "@/domain/ai/description";
import { buildCoverPrompt, resolvePalette, toGeneratedCover } from "@/domain/ai/cover";
import { filtersFromModelJson, interpretSearchIntent } from "@/domain/ai/intent";
import { buildSmartSuggestions } from "@/domain/ai/suggestions";
import { buildEventRecap } from "@/domain/ai/recap";

const log = childLogger({ module: "ai" });

export type AIDiscoveryPort = {
  discover: (filters: DiscoveryFilters) => Promise<DiscoveryPage>;
  insights: (calendarId: string) => Promise<OrganizerInsights | null>;
};

export type AIAnalyticsPort = {
  eventDashboard: (actor: Actor, eventId: string) => Promise<EventDashboard>;
};

export type AIJobQueue = {
  enqueue: (input: {
    type: JobType;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }) => Promise<unknown>;
};

export type AIServiceDeps = {
  providers: AIProviderRegistry;
  generations: AIGenerationRepository;
  consents: AIConsentRepository;
  policies: AIPolicyRepository;
  events: EventRepository;
  calendars: CalendarRepository;
  followers?: Pick<CalendarFollowerRepository, "countByCalendar">;
  messages?: Pick<EventChatMessageRepository, "listByEvent">;
  discovery: AIDiscoveryPort;
  analytics?: AIAnalyticsPort;
  entitlements?: EntitlementResolver;
  jobs?: AIJobQueue;
  clock?: Clock;
  ids?: IdGenerator;
};

function isPersona(value: string): value is AIPersona {
  return (AI_PERSONAS as readonly string[]).includes(value);
}

function isCoverStyle(value: string): value is CoverStyle {
  return (COVER_STYLES as readonly string[]).includes(value);
}

function defaultConsent(userId: string, at: Date): AIPrivacySettings {
  return {
    userId,
    processingOptOut: false,
    trainingConsent: false,
    disclosureAcknowledged: false,
    updatedAt: at,
  };
}

function defaultPolicy(organizationId: string, at: Date): AIOrgPolicy {
  return {
    organizationId,
    ...DEFAULT_AI_POLICY,
    updatedAt: at,
  };
}

export function createAIService(deps: AIServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function privacyFor(userId: string | null, organizationId: string | null) {
    const [consent, policy] = await Promise.all([
      userId ? deps.consents.findByUser(userId) : Promise.resolve(null),
      organizationId ? deps.policies.findByOrganization(organizationId) : Promise.resolve(null),
    ]);
    const user = consent ?? (userId ? defaultConsent(userId, clock.now()) : null);
    const org = policy ?? (organizationId ? defaultPolicy(organizationId, clock.now()) : null);
    const trainingAllowed = Boolean(user?.trainingConsent && org?.trainingAllowed);
    const privacy: ProviderPrivacy = {
      trainingAllowed,
      retentionDays: org?.providerRetentionDays ?? DEFAULT_PROVIDER_RETENTION_DAYS,
    };
    return { user, org, privacy };
  }

  async function assertCanUse(actor: Actor) {
    assertPermission(actor, "ai:use");
    if (deps.entitlements) {
      const entitlements = await deps.entitlements.forOrganization(actor.organizationId);
      assertFeature(entitlements, "aiEnabled");
    }
    const { user, org } = await privacyFor(actor.userId, actor.organizationId);
    if (org?.optedOut) throw new ForbiddenError("This organization has opted out of AI processing");
    if (user?.processingOptOut) throw new ForbiddenError("You have opted out of AI processing");
  }

  async function record(input: {
    organizationId: string | null;
    actorUserId: string | null;
    kind: AIGenerationKind;
    providerId: string;
    model: string;
    minimized: unknown;
    outputSummary: string;
    trainingAllowed: boolean;
  }): Promise<AIGenerationRecord> {
    const row = await deps.generations.create({
      id: ids.id(),
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      kind: input.kind,
      providerId: input.providerId,
      model: input.model,
      inputHash: hashMinimizedInput(input.minimized),
      outputSummary: input.outputSummary,
      aiGenerated: true,
      trainingAllowed: input.trainingAllowed,
      createdAt: clock.now(),
    });
    await deps.jobs?.enqueue({
      type: "ai.process",
      payload: { generationId: row.id, kind: input.kind, providerId: input.providerId },
      idempotencyKey: `ai.process:${row.id}`,
    });
    log.info(
      safeLogFields({ generationId: row.id, providerId: input.providerId, task: input.kind, ok: true }),
      "ai.generation",
    );
    return row;
  }

  async function generateDescription(
    actor: Actor,
    input: DescriptionInput & { providerId?: string },
  ): Promise<GeneratedDescription> {
    await assertCanUse(actor);
    const minimized = minimizeDescriptionInput(input);
    assertSafeUserText(minimized.title, "title");
    if (minimized.location) assertSafeUserText(minimized.location, "location");
    for (const tag of minimized.tags) assertSafeUserText(tag, "tag");
    if (!isPersona(minimized.persona)) throw new ValidationError("Unknown persona");
    const { privacy } = await privacyFor(actor.userId, actor.organizationId);
    const provider = deps.providers.text(input.providerId);
    if (!provider.isConfigured()) throw new AIProviderNotConfiguredError(provider.id);
    const completed = await provider.complete({
      task: "description",
      system: descriptionSystemPrompt(minimized.persona),
      prompt: JSON.stringify(minimized),
      privacy,
    });
    const generated = toGeneratedDescription({
      markdown: completed.text,
      persona: minimized.persona,
      providerId: completed.providerId,
      model: completed.model,
      trainingAllowed: privacy.trainingAllowed,
      title: minimized.title,
    });
    await record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      kind: "description",
      providerId: generated.providerId,
      model: generated.model,
      minimized,
      outputSummary: summarizeOutput(generated.structured.summary),
      trainingAllowed: privacy.trainingAllowed,
    });
    return generated;
  }

  async function generateCover(actor: Actor, input: CoverInput & { providerId?: string }): Promise<GeneratedCover> {
    await assertCanUse(actor);
    assertSafeUserText(input.title, "title");
    if (!isCoverStyle(input.style)) throw new ValidationError("Unknown cover style");
    const { privacy } = await privacyFor(actor.userId, actor.organizationId);
    const coverInput: CoverInput = {
      title: input.title.trim(),
      tags: input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12),
      palette: input.palette,
      style: input.style,
    };
    const prompt = buildCoverPrompt(coverInput);
    const provider = deps.providers.image(input.providerId);
    let imageUrl: string | null = null;
    let providerId = provider.id;
    let model = "unconfigured";
    if (provider.isConfigured()) {
      const result = await provider.generateCover({ ...coverInput, prompt, privacy });
      imageUrl = result.imageUrl;
      providerId = result.providerId;
      model = result.model;
    }
    const generated = toGeneratedCover({
      prompt,
      style: coverInput.style,
      palette: coverInput.palette,
      imageUrl,
      providerId,
      model,
      trainingAllowed: privacy.trainingAllowed,
    });
    await record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      kind: "cover",
      providerId,
      model,
      minimized: { title: coverInput.title, tags: coverInput.tags, style: coverInput.style, palette: coverInput.palette },
      outputSummary: generated.status,
      trainingAllowed: privacy.trainingAllowed,
    });
    return generated;
  }

  async function interpret(query: string, providerId?: string): Promise<InterpretedSearch> {
    assertSafeUserText(query, "query");
    const now = clock.now();
    const heuristic = interpretSearchIntent(redactPii(query), now, "heuristic");
    const provider = deps.providers.text(providerId);
    if (!provider.isConfigured() || provider.id === "heuristic") return heuristic;
    const { privacy } = await privacyFor(null, null);
    const completed = await provider.complete({
      task: "search",
      system: "Return JSON filters only: q, city, tag, format, price, dateFrom, dateTo. No prose.",
      prompt: JSON.stringify({ query: redactPii(query), now: now.toISOString() }),
      privacy,
    });
    try {
      const parsed = filtersFromModelJson(JSON.parse(completed.text) as unknown, now);
      if (!parsed) return { ...heuristic, providerId: completed.providerId };
      return {
        ...heuristic,
        filters: { ...heuristic.filters, ...parsed },
        providerId: completed.providerId,
      };
    } catch {
      return heuristic;
    }
  }

  async function searchByIntent(query: string, providerId?: string): Promise<SemanticSearchResult> {
    const interpretation = await interpret(query, providerId);
    const page = await deps.discovery.discover(interpretation.filters);
    await record({
      organizationId: null,
      actorUserId: null,
      kind: "search",
      providerId: interpretation.providerId,
      model: interpretation.providerId,
      minimized: { queryLength: query.length, notes: interpretation.notes },
      outputSummary: Object.keys(interpretation.filters).join(","),
      trainingAllowed: false,
    });
    return { ...interpretation, page };
  }

  async function suggest(
    actor: Actor,
    input: { calendarId: string; title?: string; tags?: string[] },
  ): Promise<SmartSuggestions> {
    await assertCanUse(actor);
    const calendar = await requireCalendar(actor, input.calendarId);
    const [insights, events, followerCount] = await Promise.all([
      deps.discovery.insights(calendar.id),
      deps.events.listByCalendar(calendar.id),
      deps.followers?.countByCalendar(calendar.id) ?? 0,
    ]);
    const provider = deps.providers.text();
    const suggestions = buildSmartSuggestions({
      title: input.title,
      tags: input.tags ?? calendar.tags,
      insights,
      events,
      followerCount,
      providerId: provider.id,
    });
    await record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      kind: "suggestions",
      providerId: suggestions.providerId,
      model: suggestions.providerId,
      minimized: { calendarId: calendar.id, title: input.title ?? null, tagCount: (input.tags ?? []).length },
      outputSummary: `${suggestions.tags.length} tag suggestions`,
      trainingAllowed: false,
    });
    return suggestions;
  }

  async function recap(actor: Actor, eventId: string): Promise<EventRecap> {
    assertPermission(actor, "ai:read");
    const { user, org, privacy } = await privacyFor(actor.userId, actor.organizationId);
    if (org?.optedOut) throw new ForbiddenError("This organization has opted out of AI processing");
    if (user?.processingOptOut) throw new ForbiddenError("You have opted out of AI processing");
    const event = await requireEvent(actor, eventId);
    if (!deps.analytics) throw new ValidationError("Analytics are not available for recap");
    const dashboard = await deps.analytics.eventDashboard(actor, event.id);
    const messages: EventChatMessage[] = deps.messages
      ? await deps.messages.listByEvent(event.id, { limit: 200 })
      : [];
    const provider = deps.providers.text();
    const generated = buildEventRecap({
      dashboard,
      event,
      messages,
      processingAllowed: Boolean(user && !user.processingOptOut && org && !org.optedOut),
      providerId: provider.id,
      model: provider.id,
    });
    await record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      kind: "recap",
      providerId: generated.providerId,
      model: generated.model,
      minimized: { eventId: event.id },
      outputSummary: `attendance=${generated.attendanceRate ?? "unknown"}`,
      trainingAllowed: privacy.trainingAllowed,
    });
    return generated;
  }

  async function privacySettings(userId: string): Promise<AIPrivacySettings> {
    return (await deps.consents.findByUser(userId)) ?? defaultConsent(userId, clock.now());
  }

  async function updatePrivacy(
    userId: string,
    patch: Partial<Pick<AIPrivacySettings, "processingOptOut" | "trainingConsent" | "disclosureAcknowledged">>,
  ): Promise<AIPrivacySettings> {
    const current = await privacySettings(userId);
    const next: AIPrivacySettings = {
      ...current,
      processingOptOut: patch.processingOptOut ?? current.processingOptOut,
      trainingConsent: patch.trainingConsent ?? current.trainingConsent,
      disclosureAcknowledged: patch.disclosureAcknowledged ?? current.disclosureAcknowledged,
      updatedAt: clock.now(),
    };
    return deps.consents.upsert(next);
  }

  async function orgPolicy(actor: Actor): Promise<AIOrgPolicy> {
    assertPermission(actor, "organization:update");
    return (await deps.policies.findByOrganization(actor.organizationId)) ?? defaultPolicy(actor.organizationId, clock.now());
  }

  async function updateOrgPolicy(
    actor: Actor,
    patch: Partial<Pick<AIOrgPolicy, "optedOut" | "trainingAllowed" | "providerRetentionDays">>,
  ): Promise<AIOrgPolicy> {
    assertPermission(actor, "organization:update");
    const current = await orgPolicy(actor);
    const retention =
      patch.providerRetentionDays === undefined
        ? current.providerRetentionDays
        : Math.max(0, Math.min(365, Math.floor(patch.providerRetentionDays)));
    const next: AIOrgPolicy = {
      ...current,
      optedOut: patch.optedOut ?? current.optedOut,
      trainingAllowed: patch.trainingAllowed ?? current.trainingAllowed,
      providerRetentionDays: retention,
      updatedAt: clock.now(),
    };
    return deps.policies.upsert(next);
  }

  async function processJob(payload: Record<string, unknown>): Promise<AIGenerationRecord | null> {
    const generationId = typeof payload.generationId === "string" ? payload.generationId : "";
    if (!generationId) return null;
    return deps.generations.findById(generationId);
  }

  async function requireCalendar(actor: Actor, calendarId: string): Promise<Calendar> {
    const calendar = await deps.calendars.findById(calendarId);
    assertSameTenant(calendar, actor.organizationId, "Calendar");
    return calendar;
  }

  async function requireEvent(actor: Actor, eventId: string): Promise<Event> {
    const event = await deps.events.findById(eventId);
    assertSameTenant(event, actor.organizationId, "Event");
    return event;
  }

  function paletteFor(calendar: Calendar, organization?: { primaryColor?: string | null; secondaryColor?: string | null }) {
    return resolvePalette({
      primaryColor: calendar.primaryColor ?? organization?.primaryColor,
      secondaryColor: organization?.secondaryColor ?? null,
    });
  }

  return {
    generateDescription,
    generateCover,
    interpret,
    searchByIntent,
    suggest,
    recap,
    privacySettings,
    updatePrivacy,
    orgPolicy,
    updateOrgPolicy,
    processJob,
    paletteFor,
    disclosure: AI_DISCLOSURE,
    providers: () => deps.providers.list().map((provider) => ({ id: provider.id, kind: provider.kind, configured: provider.isConfigured() })),
  };
}
