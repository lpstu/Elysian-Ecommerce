import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markNotificationRead, updateProfile } from "@/app/server-actions";
import AvatarUploader from "@/app/components/avatar-uploader";

type ProfilePageProps = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase
    .from("profiles")
    .select("id,full_name,phone,bio,avatar_url,role")
    .eq("id", user.id)
    .single(),
    supabase
      .from("notifications")
      .select("id,title,body,type,is_read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  return (
    <section className="grid" style={{ maxWidth: 800 }}>
      <div className="section-head">
        <h1>My Profile</h1>
        <p className="help">
          Update contact and photo details. This profile is shared across buyer, seller, and admin areas.
        </p>
      </div>
      {params.saved ? <p className="help">Profile saved successfully.</p> : null}
      <article className="card">
        <p className="help">Current role: {profile?.role ?? "buyer"}</p>
        <form action={updateProfile}>
          <input
            name="fullName"
            placeholder="Full name"
            defaultValue={profile?.full_name ?? ""}
            required
          />
          <input name="phone" placeholder="Phone number" defaultValue={profile?.phone ?? ""} />
          <textarea
            name="bio"
            placeholder="Short bio"
            rows={3}
            defaultValue={profile?.bio ?? ""}
          />
          <AvatarUploader userId={user.id} currentValue={profile?.avatar_url} />
          <button className="btn primary" type="submit">
            Save Profile
          </button>
        </form>
      </article>
      <article className="card">
        <h2>Notifications</h2>
        <p className="help">Order updates and admin announcements appear here.</p>
        <div className="grid">
          {notifications?.map((notification) => (
            <div
              key={notification.id}
              className="card"
              style={{
                boxShadow: "none",
                borderColor: notification.is_read ? "var(--line)" : "#8cd3c3"
              }}
            >
              <p>
                <strong>{notification.title}</strong>{" "}
                {!notification.is_read ? <span className="verified-badge">New</span> : null}
              </p>
              <p>{notification.body}</p>
              <p className="muted">{new Date(notification.created_at).toLocaleString()}</p>
              {!notification.is_read ? (
                <form action={markNotificationRead}>
                  <input type="hidden" name="notificationId" value={notification.id} />
                  <button className="btn light" type="submit">
                    Mark as read
                  </button>
                </form>
              ) : null}
            </div>
          ))}
          {!notifications?.length ? <p className="help">No notifications yet.</p> : null}
        </div>
      </article>
    </section>
  );
}
