import { MachineDetail } from "@/components/fleet";
export default async function Page({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params;
  return <MachineDetail machineId={decodeURIComponent(machineId)} />;
}
