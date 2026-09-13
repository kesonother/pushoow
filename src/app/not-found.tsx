import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="mx-auto flex min-h-full max-w-xl flex-col gap-4 px-4 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-zinc-600">This calendar or page does not exist.</p>
      <Link href="/" className="underline">
        Home
      </Link>
    </main>
  );
}
