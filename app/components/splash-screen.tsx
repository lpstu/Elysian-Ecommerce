"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="splash-screen" aria-live="polite">
      <div className="splash-content">
        <div className="orb" />
        <h1>Elysian Commerce</h1>
        <p>Shop. Sell. Connect.</p>
      </div>
    </div>
  );
}
