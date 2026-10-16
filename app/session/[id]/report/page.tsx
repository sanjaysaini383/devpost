import { ReportView } from "@/components/ReportView";

export const metadata = { title: "Ownership Map — TeachBack" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportView id={id} />;
}
