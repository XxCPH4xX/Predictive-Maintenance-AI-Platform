"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const navigation = [
  ["/", "Overview", "◫"],
  ["/machines", "Machines", "▦"],
  ["/prediction", "Prediction", "⌁"],
  ["/batch", "Batch analysis", "▤"],
  ["/scenario", "What-if analysis", "⇄"],
  ["/performance", "Model performance", "▥"],
  ["/history", "History", "◷"],
  ["/simulation", "Simulation", "◉"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const check = () =>
      api("/health")
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-symbol">⌁</span>
          <span>
            CPH4<span className="brand-sub">MAINTENANCE PLATFORM</span>
          </span>
        </Link>
        <div className="workspace-label">
          WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {pathname === href && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">DATA ENVIRONMENT</span>
          <strong>AI4I · Synthetic dataset</strong>
          <p>Explore equipment risk through measured model predictions.</p>
        </div>
        <div className="sidebar-footer">
          <span className={`status-dot ${connected ? "online" : ""}`} />
          {connected ? "Prediction service online" : "Service unavailable"}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="slash">/</span>
            <span>Equipment intelligence</span>
          </div>
          <span className="environment-pill">● &nbsp; Local demonstration</span>
        </header>
        <main>{children}</main>
        <footer className="page-footer">
          CPH4{" "}
          <span>
            Synthetic data · Model estimates, not an industrial safety system
          </span>
        </footer>
      </div>
    </div>
  );
}
