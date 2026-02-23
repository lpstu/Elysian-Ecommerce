"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);
  const key = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      const bootTimer = setTimeout(() => setLoading(false), 900);
      return () => clearTimeout(bootTimer);
    }

    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(timer);
  }, [key]);

  if (!loading) return null;

  return (
    <div className="route-loader" role="status" aria-label="Loading">
      <div className="loader-icon" />
    </div>
  );
}
