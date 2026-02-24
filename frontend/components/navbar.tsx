import Link from "next/link";

const NavLink = ({ href, label }: { href: string; label: string }) => {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
      {label}
    </Link>
  );
};

export function Navbar() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          SaStrane
        </Link>

        <nav className="flex items-center gap-4">
          <NavLink href="/" label="Oglasi" />
          <NavLink href="/inbox" label="Inbox" />
          <NavLink href="/login" label="Login" />
        </nav>
      </div>
    </header>
  );
}