import { DomainError } from "@/domain/errors";
import type { DiscoveryFilters, DiscoveryFormat, DiscoveryPage } from "@/domain/discovery/types";

export const AI_PERSONAS = ["neutral", "casual", "corporate", "academic"] as const;
export type AIPersona = (typeof AI_PERSONAS)[number];

export const COVER_STYLES = ["modern_minimal", "retro", "photographic", "illustrated"] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

export const AI_GENERATION_KINDS = [
  "description",
  "cover",
  "search",
  "suggestions",
  "recap",
] as const;
export type AIGenerationKind = (typeof AI_GENERATION_KINDS)[number];

export const AI_PROVIDER_KINDS = ["text", "image"] as const;
export type AIProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export const SUGGESTION_CERTAINTY = "suggestion" as const;

export const AI_DISCLOSURE =
  "This content was generated with AI assistance. Review and edit before publishing. It is a suggestion, not a verified fact.";

export const DEFAULT_PROVIDER_RETENTION_DAYS = 0;

export const DEFAULT_AI_POLICY: Omit<AIOrgPolicy, "organizationId" | "updatedAt"> = {
  optedOut: false,
  trainingAllowed: false,
  providerRetentionDays: DEFAULT_PROVIDER_RETENTION_DAYS,
  disclosureVersion: "1",
};

export type CalendarPalette = {
  primary: string;
  secondary: string;
};

export type DescriptionInput = {
  title: string;
  tags: string[];
  location: string | null;
  format: DiscoveryFormat;
  persona: AIPersona;
};

export type DescriptionSection = {
  heading: string;
  body: string;
};

export type GeneratedDescription = {
  markdown: string;
  structured: {
    headline: string;
    summary: string;
    sections: DescriptionSection[];
  };
  editable: true;
  aiGenerated: true;
  disclosure: string;
  persona: AIPersona;
  providerId: string;
  model: string;
  trainingAllowed: false | boolean;
};

export type CoverInput = {
  title: string;
  tags: string[];
  palette: CalendarPalette;
  style: CoverStyle;
};

export type GeneratedCover = {
  prompt: string;
  style: CoverStyle;
  palette: CalendarPalette;
  imageUrl: string | null;
  status: "prepared" | "generated";
  aiGenerated: true;
  disclosure: string;
  providerId: string;
  model: string;
  trainingAllowed: boolean;
};

export type InterpretedSearch = {
  query: string;
  filters: DiscoveryFilters;
  notes: string[];
  aiGenerated: true;
  disclosure: string;
  certainty: typeof SUGGESTION_CERTAINTY;
  providerId: string;
};

export type SemanticSearchResult = InterpretedSearch & {
  page: DiscoveryPage;
};

export type SuggestionItem = {
  value: string;
  reason: string;
  kind: typeof SUGGESTION_CERTAINTY;
};

export type SmartSuggestions = {
  kind: typeof SUGGESTION_CERTAINTY;
  certainty: typeof SUGGESTION_CERTAINTY;
  disclaimer: string;
  aiGenerated: true;
  disclosure: string;
  tags: SuggestionItem[];
  times: SuggestionItem[];
  followerTargeting: SuggestionItem[];
  providerId: string;
};

export type DemographicSummary = {
  available: boolean;
  legalBasis: string | null;
  reason: "not_legally_available" | "no_demographic_attributes" | "roster_hidden" | "insufficient_consent" | null;
  aggregates: Record<string, number>;
};

export type EventRecap = {
  attendanceRate: number | null;
  engagement: {
    pageViews: number;
    rsvps: number;
    checkedIn: number;
    emailOpenRate: number | null;
    chatMessages: number;
  };
  chatTopics: SuggestionItem[];
  demographics: DemographicSummary;
  keyMetrics: Array<{ label: string; value: string; kind: typeof SUGGESTION_CERTAINTY }>;
  aiGenerated: true;
  disclosure: string;
  certainty: typeof SUGGESTION_CERTAINTY;
  providerId: string;
  model: string;
};

export type AIPrivacySettings = {
  userId: string;
  processingOptOut: boolean;
  trainingConsent: boolean;
  disclosureAcknowledged: boolean;
  updatedAt: Date;
};

export type AIOrgPolicy = {
  organizationId: string;
  optedOut: boolean;
  trainingAllowed: boolean;
  providerRetentionDays: number;
  disclosureVersion: string;
  updatedAt: Date;
};

export type AIGenerationRecord = {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  kind: AIGenerationKind;
  providerId: string;
  model: string;
  inputHash: string;
  outputSummary: string;
  aiGenerated: true;
  trainingAllowed: boolean;
  createdAt: Date;
};

export type ProviderPrivacy = {
  trainingAllowed: boolean;
  retentionDays: number;
};

export type TextCompletionInput = {
  task: AIGenerationKind;
  system: string;
  prompt: string;
  maxTokens?: number;
  privacy: ProviderPrivacy;
};

export type TextCompletionResult = {
  providerId: string;
  model: string;
  text: string;
};

export type CoverPromptInput = CoverInput & {
  prompt: string;
  privacy: ProviderPrivacy;
};

export type CoverProviderResult = {
  providerId: string;
  model: string;
  imageUrl: string | null;
  prompt: string;
};

export type TextAIProvider = {
  id: string;
  kind: "text";
  isConfigured: () => boolean;
  complete: (input: TextCompletionInput) => Promise<TextCompletionResult>;
};

export type ImageAIProvider = {
  id: string;
  kind: "image";
  isConfigured: () => boolean;
  generateCover: (input: CoverPromptInput) => Promise<CoverProviderResult>;
};

export type AIProvider = TextAIProvider | ImageAIProvider;

export type AIProviderRegistry = {
  text: (id?: string) => TextAIProvider;
  image: (id?: string) => ImageAIProvider;
  list: () => AIProvider[];
};

export type AIGenerationRepository = {
  create: (item: AIGenerationRecord) => Promise<AIGenerationRecord>;
  findById: (id: string) => Promise<AIGenerationRecord | null>;
  listByOrganization: (organizationId: string) => Promise<AIGenerationRecord[]>;
};

export type AIConsentRepository = {
  findByUser: (userId: string) => Promise<AIPrivacySettings | null>;
  upsert: (item: AIPrivacySettings) => Promise<AIPrivacySettings>;
};

export type AIPolicyRepository = {
  findByOrganization: (organizationId: string) => Promise<AIOrgPolicy | null>;
  upsert: (item: AIOrgPolicy) => Promise<AIOrgPolicy>;
};

export class AIProviderNotConfiguredError extends DomainError {
  constructor(providerId: string) {
    super("VALIDATION", `AI provider '${providerId}' is not configured`, 422);
    this.name = "AIProviderNotConfiguredError";
  }
}
