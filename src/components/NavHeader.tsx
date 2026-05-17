import Link from "next/link";
import NavTabs from "./NavTabs";
import { GPostLogo } from "./GPostLogo";

export default function NavHeader() {
  return (
    <header className="border-b border-card-border relative z-20">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/80 hover:text-foreground transition-colors"
        >
          <GPostLogo size={20} />
          GPost
        </Link>
        <NavTabs variant="floating" />
      </div>
    </header>
  );
}
