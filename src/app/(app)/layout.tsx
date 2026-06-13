import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrganizerSession } from "@/lib/auth";
import { LogoutButton } from "@/components/app/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOrganizerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="hidden w-56 flex-col border-r bg-white p-4 sm:flex">
        <Link href="/" className="mb-8 text-lg font-bold">
          Spark Check-in
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-2 hover:bg-neutral-100">
            Dashboard
          </Link>
          <Link
            href="/events"
            className="rounded-md px-3 py-2 hover:bg-neutral-100"
          >
            Eventos
          </Link>
        </nav>
        <div className="mt-auto space-y-2 text-sm text-neutral-500">
          <p className="truncate px-3">{session.name}</p>
          <LogoutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 sm:hidden">
          <Link href="/" className="font-bold">
            Spark Check-in
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/events">Eventos</Link>
          </nav>
        </header>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
