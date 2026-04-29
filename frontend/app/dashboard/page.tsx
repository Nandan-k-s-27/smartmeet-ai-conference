import App from "@/src/App";
import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await requireAuth();

  return <App session={session} />;
}
