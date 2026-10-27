import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/session";
import { countPendingInbox } from "@/features/inbox/queries";
import { countNewLeads } from "@/features/job-search/queries";
import { SidebarNav } from "./sidebar-nav";
import { DemoBanner } from "./demo-banner";
import { UserMenu } from "./user-menu";

/** Menu da conta (lê a sessão; fica dentro de um Suspense no layout). */
export async function AccountMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu user={user} compact={compact} />;
}

export function AccountMenuSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) return <Skeleton className="size-7 rounded-full" />;
  return (
    <div className="flex items-center gap-2 p-1.5">
      <Skeleton className="size-7 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );
}

/** Navegação com o número de sugestões pendentes e de vagas novas. */
export async function SidebarNavWithCounts() {
  const [pending, newLeads] = await Promise.all([countPendingInbox(), countNewLeads()]);
  return <SidebarNav badges={{ "/caixa-de-entrada": pending, "/vagas": newLeads }} />;
}

export async function DemoNotice() {
  const user = await getCurrentUser();
  return user?.isDemo ? <DemoBanner /> : null;
}
