import type {
  IntegrationAuthType,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationProviderId,
} from "@/domain/integration/types";

export type IntegrationSpec = {
  id: IntegrationProviderId;
  category: IntegrationCategory;
  label: string;
  authType: IntegrationAuthType;
  capabilities: IntegrationCapability[];
  credentialFields: string[];
  clientIdEnv?: string;
  clientSecretEnv?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  apiBase?: string;
};

export const INTEGRATION_SPECS: IntegrationSpec[] = [
  {
    id: "hubspot",
    category: "crm",
    label: "HubSpot",
    authType: "oauth",
    capabilities: ["contacts", "accounts", "leads", "deals", "activities", "attendance"],
    credentialFields: [],
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
    authorizeUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: ["crm.objects.contacts.write", "crm.objects.deals.write", "crm.objects.companies.write"],
    apiBase: "https://api.hubapi.com",
  },
  {
    id: "salesforce",
    category: "crm",
    label: "Salesforce",
    authType: "oauth",
    capabilities: ["contacts", "accounts", "leads", "deals", "activities", "attendance"],
    credentialFields: [],
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
    authorizeUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: ["api", "refresh_token"],
    apiBase: "https://login.salesforce.com",
  },
  {
    id: "pipedrive",
    category: "crm",
    label: "Pipedrive",
    authType: "either",
    capabilities: ["contacts", "accounts", "leads", "deals", "activities", "attendance"],
    credentialFields: ["apiKey"],
    clientIdEnv: "PIPEDRIVE_CLIENT_ID",
    clientSecretEnv: "PIPEDRIVE_CLIENT_SECRET",
    authorizeUrl: "https://oauth.pipedrive.com/oauth/authorize",
    tokenUrl: "https://oauth.pipedrive.com/oauth/token",
    scopes: ["contacts:full", "deals:full", "activities:full"],
    apiBase: "https://api.pipedrive.com/v1",
  },
  {
    id: "mailchimp",
    category: "marketing",
    label: "Mailchimp",
    authType: "oauth",
    capabilities: ["registrant.created", "registrant.updated", "check_in", "cancellation"],
    credentialFields: [],
    clientIdEnv: "MAILCHIMP_CLIENT_ID",
    clientSecretEnv: "MAILCHIMP_CLIENT_SECRET",
    authorizeUrl: "https://login.mailchimp.com/oauth2/authorize",
    tokenUrl: "https://login.mailchimp.com/oauth2/token",
    apiBase: "https://login.mailchimp.com",
  },
  {
    id: "klaviyo",
    category: "marketing",
    label: "Klaviyo",
    authType: "api_key",
    capabilities: ["registrant.created", "registrant.updated", "check_in", "cancellation"],
    credentialFields: ["apiKey"],
    apiBase: "https://a.klaviyo.com/api",
  },
  {
    id: "customerio",
    category: "marketing",
    label: "Customer.io",
    authType: "api_key",
    capabilities: ["registrant.created", "registrant.updated", "check_in", "cancellation"],
    credentialFields: ["siteId", "apiKey"],
    apiBase: "https://track.customer.io/api/v1",
  },
  {
    id: "notion",
    category: "productivity",
    label: "Notion",
    authType: "oauth",
    capabilities: ["pages"],
    credentialFields: [],
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    apiBase: "https://api.notion.com/v1",
  },
  {
    id: "slack",
    category: "productivity",
    label: "Slack",
    authType: "oauth",
    capabilities: ["messages"],
    credentialFields: [],
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["chat:write"],
    apiBase: "https://slack.com/api",
  },
  {
    id: "discord",
    category: "productivity",
    label: "Discord",
    authType: "api_key",
    capabilities: ["messages"],
    credentialFields: ["webhookUrl"],
  },
  {
    id: "zoom",
    category: "video",
    label: "Zoom",
    authType: "oauth",
    capabilities: ["meetings"],
    credentialFields: [],
    clientIdEnv: "ZOOM_CLIENT_ID",
    clientSecretEnv: "ZOOM_CLIENT_SECRET",
    authorizeUrl: "https://zoom.us/oauth/authorize",
    tokenUrl: "https://zoom.us/oauth/token",
    scopes: ["meeting:write"],
    apiBase: "https://api.zoom.us/v2",
  },
  {
    id: "google_meet",
    category: "video",
    label: "Google Meet",
    authType: "oauth",
    capabilities: ["meetings"],
    credentialFields: [],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    apiBase: "https://www.googleapis.com/calendar/v3",
  },
  {
    id: "microsoft_teams",
    category: "video",
    label: "Microsoft Teams",
    authType: "oauth",
    capabilities: ["meetings"],
    credentialFields: [],
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["OnlineMeetings.ReadWrite"],
    apiBase: "https://graph.microsoft.com/v1.0",
  },
  {
    id: "youtube",
    category: "video",
    label: "YouTube",
    authType: "oauth",
    capabilities: ["streams"],
    credentialFields: [],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube"],
    apiBase: "https://www.googleapis.com/youtube/v3",
  },
  {
    id: "vimeo",
    category: "video",
    label: "Vimeo",
    authType: "oauth",
    capabilities: ["streams"],
    credentialFields: [],
    clientIdEnv: "VIMEO_CLIENT_ID",
    clientSecretEnv: "VIMEO_CLIENT_SECRET",
    authorizeUrl: "https://api.vimeo.com/oauth/authorize",
    tokenUrl: "https://api.vimeo.com/oauth/access_token",
    scopes: ["create"],
    apiBase: "https://api.vimeo.com",
  },
  {
    id: "google_calendar",
    category: "calendar",
    label: "Google Calendar",
    authType: "oauth",
    capabilities: ["calendar.sync"],
    credentialFields: [],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    apiBase: "https://www.googleapis.com/calendar/v3",
  },
  {
    id: "outlook",
    category: "calendar",
    label: "Outlook",
    authType: "oauth",
    capabilities: ["calendar.sync"],
    credentialFields: [],
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Calendars.ReadWrite"],
    apiBase: "https://graph.microsoft.com/v1.0",
  },
];

export function specById(id: IntegrationProviderId): IntegrationSpec {
  const spec = INTEGRATION_SPECS.find((item) => item.id === id);
  if (!spec) throw new Error(`Unknown integration provider ${id}`);
  return spec;
}

export function envValue(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}
