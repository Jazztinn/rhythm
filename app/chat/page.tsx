import type { Metadata } from "next";
import { ChatView } from "@/components/chat-view";

export const metadata: Metadata = {
  title: "Chat",
  description: "Plan your work with Rhythm, your calm personal chief of staff.",
};

export default function ChatPage() {
  return <ChatView />;
}
