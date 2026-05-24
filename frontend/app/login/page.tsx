import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to manage invoices and view the dashboard.
          </p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
