"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { SignOutButton } from "../SignOutButton";

function breadcrumbsFromPath(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/") return [{ label: "Dashboard" }];
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "Home", href: "/" }];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += "/" + parts[i];
    const label =
      parts[i].length === 36 || /^[0-9a-f-]{8,}$/i.test(parts[i])
        ? parts[i].slice(0, 8) + "…"
        : titleCase(parts[i]);
    crumbs.push({ label, href: i === parts.length - 1 ? undefined : acc });
  }
  return crumbs;
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Topbar() {
  const pathname = usePathname() ?? "/";
  const crumbs = breadcrumbsFromPath(pathname);
  return (
    <div className="cl-topbar">
      <nav className="cl-breadcrumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="cl-row-gap">
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="cl-bc-current">{c.label}</span>}
            {i < crumbs.length - 1 ? <span className="cl-bc-sep">/</span> : null}
          </span>
        ))}
      </nav>
      <div className="cl-topbar-right">
        <Link href="/invoices/new" className="cl-btn is-primary is-sm">
          <Plus size={14} />
          New invoice
        </Link>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}
