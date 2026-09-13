import { ValidationError } from "@/domain/errors";
import {
  LOCATION_KINDS,
  REGISTRATION_MODES,
  type EventWriteInput,
  type LocationKind,
} from "@/domain/event/types";

export const WIZARD_STEPS = ["basics", "location", "registration", "review"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function validateWizardStep(step: WizardStep, input: EventWriteInput): void {
  if (step === "basics") {
    if (!input.title || input.title.trim().length < 2) {
      throw new ValidationError("A title is required");
    }
    if (!input.startsAt || !input.endsAt) {
      throw new ValidationError("Start and end dates are required");
    }
    if (input.endsAt <= input.startsAt) {
      throw new ValidationError("Event end must be after start");
    }
    return;
  }

  if (step === "location") {
    const kind = (input.locationKind ?? "physical") as LocationKind;
    if (!LOCATION_KINDS.includes(kind)) {
      throw new ValidationError("Unknown location kind");
    }
    if ((kind === "physical" || kind === "hybrid") && !input.venueAddress && !input.venueName) {
      throw new ValidationError("A physical address or venue name is required");
    }
    if ((kind === "virtual" || kind === "hybrid") && !input.virtualUrl) {
      throw new ValidationError("A virtual URL is required");
    }
    return;
  }

  if (step === "registration") {
    if (input.registrationMode && !REGISTRATION_MODES.includes(input.registrationMode)) {
      throw new ValidationError("Unknown registration mode");
    }
    if (input.capacity != null && input.capacity < 1) {
      throw new ValidationError("Capacity must be at least 1");
    }
    if (input.registrationMode === "password" && !input.registrationPassword) {
      throw new ValidationError("A registration password is required");
    }
    if (
      input.registrationMode === "email_domain" &&
      (!input.allowedEmailDomains || input.allowedEmailDomains.length === 0)
    ) {
      throw new ValidationError("At least one allowed email domain is required");
    }
    if (input.registrationMode === "token" && !input.accessToken) {
      throw new ValidationError("An access token is required");
    }
  }
}
