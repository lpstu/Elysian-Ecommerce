export default function Loading() {
  return (
    <section className="card" style={{ minHeight: "42vh", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", gap: "0.75rem", textAlign: "center" }}>
        <div className="loader-icon" style={{ margin: "0 auto", width: 26, height: 26 }} />
        <p className="muted">Loading page...</p>
      </div>
    </section>
  );
}
