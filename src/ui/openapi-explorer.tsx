"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/fallback";

type OpenApiSpec = {
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, { summary?: string; responses?: Record<string, unknown> }>>;
  components?: { schemas?: Record<string, unknown> };
};

export function OpenApiExplorer({ specUrl }: { specUrl: string }) {
  const { t } = useI18n();
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(specUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(t.errors.unableToLoadOpenApi);
        setSpec(await response.json());
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t.errors.requestFailed));
  }, [specUrl, t.errors.requestFailed, t.errors.unableToLoadOpenApi]);

  if (error) return <p role="alert">{error}</p>;
  if (!spec) return <p>{t.developers.loadingOpenApi}</p>;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-[#E8E8E8] p-5">
        <h2 className="text-xl font-semibold">{spec.info?.title}</h2>
        <p className="mt-2 text-sm text-zinc-600">{spec.info?.description}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-zinc-600">
          {interpolate(t.developers.version, { version: spec.info?.version ?? "—" })}
        </p>
      </section>
      <section className="rounded-xl border border-[#E8E8E8] p-5">
        <h2 className="text-lg font-semibold">{t.developers.errorSchema}</h2>
        <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-50">
          {JSON.stringify(spec.components?.schemas?.Error ?? {}, null, 2)}
        </pre>
      </section>
      <ul className="flex flex-col gap-3">
        {Object.entries(spec.paths ?? {}).map(([path, methods]) =>
          Object.entries(methods).map(([method, operation]) => (
            <li key={`${method}:${path}`} className="rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-sm font-medium">
                <span className="me-2 uppercase text-zinc-600">{method}</span>
                <code>{path}</code>
              </p>
              <p className="mt-1 text-sm text-zinc-600">{operation.summary}</p>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
