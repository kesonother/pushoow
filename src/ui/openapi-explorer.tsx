"use client";

import { useEffect, useState } from "react";

type OpenApiSpec = {
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, { summary?: string; responses?: Record<string, unknown> }>>;
  components?: { schemas?: Record<string, unknown> };
};

export function OpenApiExplorer({ specUrl }: { specUrl: string }) {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(specUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load OpenAPI");
        setSpec(await response.json());
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error"));
  }, [specUrl]);

  if (error) return <p role="alert">{error}</p>;
  if (!spec) return <p>Loading OpenAPI…</p>;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-200 p-5">
        <h2 className="text-xl font-semibold">{spec.info?.title}</h2>
        <p className="mt-2 text-sm text-zinc-600">{spec.info?.description}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">Version {spec.info?.version}</p>
      </section>
      <section className="rounded-2xl border border-zinc-200 p-5">
        <h2 className="text-lg font-semibold">Error schema</h2>
        <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-50">
          {JSON.stringify(spec.components?.schemas?.Error ?? {}, null, 2)}
        </pre>
      </section>
      <ul className="flex flex-col gap-3">
        {Object.entries(spec.paths ?? {}).map(([path, methods]) =>
          Object.entries(methods).map(([method, operation]) => (
            <li key={`${method}:${path}`} className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-sm font-medium">
                <span className="mr-2 uppercase text-zinc-500">{method}</span>
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
