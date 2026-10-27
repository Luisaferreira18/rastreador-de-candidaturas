import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu, AccountMenuSkeleton, DemoNotice, SidebarNavWithCounts } from "@/components/app-shell/account";
import { AppCommandsProvider } from "@/components/app-shell/app-commands";
import { MobileHeader } from "@/components/app-shell/mobile-header";
import { SidebarPrimaryAction, SidebarSecondaryActions } from "@/components/app-shell/sidebar-actions";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { Logo } from "@/components/logo";
import { InboxAutoProcessor } from "@/features/inbox/components/inbox-auto-processor";
import { JobSearchAutoRunner } from "@/features/job-search/components/search-controls";

/**
 * Estrutura das páginas logadas. A moldura (barra lateral, navegação) é
 * estática e aparece na hora; só as partes que leem a sessão ficam em Suspense.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppCommandsProvider>
      <div className="flex min-h-svh">
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
          <div className="flex h-14 items-center px-4">
            <Link href="/painel" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <Logo />
            </Link>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
            <SidebarPrimaryAction />
            <Suspense fallback={<SidebarNav />}>
              <SidebarNavWithCounts />
            </Suspense>
            <div className="mt-auto space-y-3">
              <SidebarSecondaryActions />
              <div className="border-t pt-3">
                <Suspense fallback={<AccountMenuSkeleton />}>
                  <AccountMenu />
                </Suspense>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            navSlot={
              <Suspense fallback={<SidebarNav />}>
                <SidebarNavWithCounts />
              </Suspense>
            }
            userSlot={
              <Suspense fallback={<AccountMenuSkeleton compact />}>
                <AccountMenu compact />
              </Suspense>
            }
          />
          <Suspense fallback={null}>
            <DemoNotice />
          </Suspense>
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
      <InboxAutoProcessor />
      <JobSearchAutoRunner />
    </AppCommandsProvider>
  );
}
