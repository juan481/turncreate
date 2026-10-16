"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { NotificationsButton } from "./notifications-button";
import { resolveTenantRoute } from "./route-meta";

export function MobilePageHeader({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
}) {
  const pathname = usePathname();
  const base = `/app/${tenantSlug}`;
  const route = resolveTenantRoute(pathname, tenantSlug);
  const support = (
    <Link href={`${base}/ayuda`} className="grid h-11 w-11 place-items-center rounded-full text-on-primary transition-colors hover:bg-white/10" aria-label="Ayuda">
      <Icon name="help" className="text-[22px]" />
    </Link>
  );

  if (route.relative === "") {
    return (
      <AppBar
        left={
          <Link href={base} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Logo iconOnly className="h-8 w-8 shrink-0 drop-shadow-sm" />
            <span aria-hidden className="h-6 w-px shrink-0 bg-white/35" />
            <Avatar name={tenantName} src={tenantLogoUrl} size="sm" className="ring-2 ring-white/40" />
            <span className="truncate font-headline-sm text-headline-sm text-on-primary">{tenantName}</span>
          </Link>
        }
        right={<>{support}<NotificationsButton notifications={[]} /></>}
      />
    );
  }

  return <AppBar title={route.title} backHref={route.backHref ?? base} right={support} />;
}
