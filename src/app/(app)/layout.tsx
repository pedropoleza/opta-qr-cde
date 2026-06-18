import Link from "next/link";

// App embutido como iframe no CRM — sem tela de login. O CRM autentica o
// usuário; aqui apenas a navegação do painel do organizador.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <Link href="/events" className="rounded-md px-3 py-2 hover:bg-neutral-100">
            Eventos
          </Link>
        </nav>
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
