import Link from "next/link";
import { markNotificationRead } from "@/app/server-actions";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell({
  unreadCount,
  notifications
}: {
  unreadCount: number;
  notifications: NotificationItem[];
}) {
  return (
    <details className="notify-wrap">
      <summary className="notify-trigger" aria-label="Notifications">
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 ? <span className="notify-count">{unreadCount}</span> : null}
      </summary>
      <div className="notify-panel card">
        <div className="notify-head">
          <strong>Notifications</strong>
          <Link href="/profile" className="btn light">
            View all
          </Link>
        </div>
        <div className="grid">
          {notifications.length ? (
            notifications.map((item) => (
              <article key={item.id} className="card" style={{ boxShadow: "none" }}>
                <p>
                  <strong>{item.title}</strong>{" "}
                  {!item.is_read ? <span className="verified-badge">New</span> : null}
                </p>
                <p>{item.body}</p>
                <p className="muted">{new Date(item.created_at).toLocaleString()}</p>
                {!item.is_read ? (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="notificationId" value={item.id} />
                    <button className="btn outline" type="submit">
                      Mark read
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          ) : (
            <p className="help">No notifications.</p>
          )}
        </div>
      </div>
    </details>
  );
}
