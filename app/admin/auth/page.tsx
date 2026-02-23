import { redirect } from "next/navigation";

export default function AdminAuthRedirectPage() {
  redirect("/admin/login");
}
