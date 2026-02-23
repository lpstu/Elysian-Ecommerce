"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/app/server-actions";

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

export default function ChatRoom({
  conversationId,
  initialMessages
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  return (
    <div className="grid">
      <div className="card" style={{ maxHeight: 380, overflowY: "auto" }}>
        {messages.map((message) => (
          <div key={message.id} style={{ marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            <p style={{ margin: 0 }}>{message.content}</p>
            <small className="muted">{new Date(message.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
      <form action={sendMessage}>
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea name="content" rows={3} placeholder="Type message..." required />
        <button className="btn primary" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
