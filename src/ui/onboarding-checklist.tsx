import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AttendeeOnboarding, OrganizerOnboarding } from "@/domain/onboarding/types";

function labelFor(t: Dictionary, id: string): string {
  const map = t.onboarding as Record<string, string>;
  return map[id] ?? id;
}

export function OnboardingChecklist({
  title,
  progress,
  t,
}: {
  title: string;
  progress: OrganizerOnboarding | AttendeeOnboarding;
  t: Dictionary;
}) {
  if (progress.complete) return null;
  return (
    <section className="rounded-xl border border-[#E8E8E8] bg-white p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ol className="mt-3 grid gap-2">
        {progress.steps.map((step, index) => (
          <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {index + 1}. {labelFor(t, step.id)}
              {step.complete ? ` · ${t.onboarding.done}` : ""}
            </span>
            {step.complete ? null : (
              <Link className="underline" href={step.href}>
                {t.onboarding.continue}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
