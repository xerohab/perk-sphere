import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Fetches the public, projected destination list from the backend function.
// Returns { destinations, loading, error }.
export function usePublicDestinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke("publicDestinations", {});
        if (active) setDestinations(res.data?.destinations || res.destinations || []);
      } catch (e) {
        if (active) setError(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { destinations, loading, error };
}