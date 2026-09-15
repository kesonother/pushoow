import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body?: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white px-4 py-5">
      <p className="text-[14px] font-bold text-[#171717]">{title}</p>
      {body ? <p className="mt-1 text-[13px] leading-[1.45] text-zinc-600">{body}</p> : null}
      <Link
        className="mt-3 inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70"
        href={actionHref}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
