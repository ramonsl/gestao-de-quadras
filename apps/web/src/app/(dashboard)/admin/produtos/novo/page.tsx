import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { createProductAction } from "../_actions/create-product.action";

export default async function Page() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  if (!["admin", "gerente"].includes(s.user.role ?? "")) redirect("/dashboard");

  return <div className="space-y-6"><h1 className="text-3xl font-bold">Novo Produto</h1><ProductForm action={createProductAction} /></div>;
}
