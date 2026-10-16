import { SessionView } from "@/components/SessionView";

export const metadata = { title: "Teach-back — TeachBack" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionView id={id} />;
}
