import { PublicHub } from "@/components/client-hub/PublicHub";
export const metadata = { title: "Portal do cliente", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <PublicHub token={(await params).token} />;
}
