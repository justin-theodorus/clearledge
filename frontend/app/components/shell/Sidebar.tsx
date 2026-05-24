"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ScrollText,
  Settings,
  ChevronsUpDown,
} from "lucide-react";
import { clsx } from "../ui/primitives";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  match?: RegExp;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: /^\/$/ },
  { href: "/invoices", label: "Invoices", icon: FileText, match: /^\/invoices(\/|$)/ },
  { href: "/audit", label: "Audit log", icon: ScrollText, match: /^\/audit(\/|$)/ },
  { href: "/settings", label: "Settings", icon: Settings, match: /^\/settings(\/|$)/ },
];

function initials(email: string | null): string {
  if (!email) return "··";
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function Sidebar({ user }: { user: { email: string | null } }) {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="cl-sidebar">
      <Link href="/" className="cl-brand">
        <span
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: "#f7f5ef",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Image src="/logo/standalone-removebg-preview.png" alt="ClearLedge" width={22} height={22} priority />
        </span>
        <span>ClearLedge</span>
      </Link>

      <div className="cl-org-picker">
        <span className="cl-org-avatar">AT</span>
        <div className="cl-org-meta">
          <span>Acme Trading Pte Ltd</span>
          <span>Pro · Singapore</span>
        </div>
        <ChevronsUpDown size={14} color="var(--cl-fg-subtle)" />
      </div>

      <div className="cl-nav-label">Workspace</div>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.match ? item.match.test(pathname) : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx("cl-nav-item", active && "is-active")}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="cl-sidebar-foot">
        <div className="cl-user-card">
          <span className="cl-avatar">{initials(user.email)}</span>
          <div className="cl-user-meta">
            <span>Admin</span>
            <span>{user.email ?? "—"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
