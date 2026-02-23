import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatRoom from "./chat-room";

type ChatPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,buyer_id,seller_id")
    .eq("id", conversationId)
    .single();
  if (!conversation) redirect("/");
  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) redirect("/");

  const { data: messages } = await supabase
    .from("messages")
    .select("id,content,sender_id,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <section className="grid" style={{ maxWidth: 760 }}>
      <div className="section-head">
        <h1>Chat</h1>
        <p className="help">Messages update in real time. Keep communication concise and clear.</p>
      </div>
      <ChatRoom conversationId={conversationId} initialMessages={messages ?? []} />
    </section>
  );
}
