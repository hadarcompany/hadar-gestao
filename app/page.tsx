import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { homeForUser } from "@/lib/page-access";

export default async function Home() {
  const user = await getServerAuth();
  redirect(user ? homeForUser(user) : "/login");
}
