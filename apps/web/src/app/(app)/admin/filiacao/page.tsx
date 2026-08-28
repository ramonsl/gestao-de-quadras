import { requireAdmin } from "@/lib/session";
import { getCustomersByTenant } from "@gestao-de-quadras/core/customers/customer.service";
import { listCustomerMemberships, listMembershipPlans } from "@gestao-de-quadras/core/membership";
import { MembershipDashboard } from "./_components/membership-dashboard";

export default async function MembershipPage() {
  const { ctx } = await requireAdmin();
  const [plans, memberships, customers] = await Promise.all([
    listMembershipPlans(ctx),
    listCustomerMemberships(ctx),
    getCustomersByTenant(ctx),
  ]);
  return <main className="flex-1 p-[22px]"><MembershipDashboard plans={plans} memberships={memberships} customers={customers} /></main>;
}
