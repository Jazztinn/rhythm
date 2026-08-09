import { ConnectionsSection } from "@/components/integration-status";
import { RoutineLearningSettings } from "@/components/routine-learning";

export default function SettingsPage() {
  return <RoutineLearningSettings connections={<ConnectionsSection />} />;
}
