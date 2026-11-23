import { BriefingForm } from "@/components/client-hub/BriefingForm";
export const metadata = { title: "Briefing e onboarding", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <BriefingForm token={(await params).token} />;
}
