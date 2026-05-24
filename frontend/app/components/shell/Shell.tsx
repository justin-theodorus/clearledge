"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const FULL_BLEED = [
  /^\/login(?:\/|$)/,
  /^\/invoices\/[^/]+\/pay(?:\/|$)/,
  /^\/invoices\/[^/]+\/proof(?:\/|$)/,
];

export function Shell({
  user,
  children,
}: {
  user: { email: string | null } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const bleed = FULL_BLEED.some((r) => r.test(pathname));

  if (bleed || !user) {
    return <>{children}</>;
  }

  return (
    <div className="cl-app">
      <Sidebar user={user} />
      <div className="cl-main">
        <Topbar />
        <div className="cl-content">{children}</div>
      </div>
    </div>
  );
}
