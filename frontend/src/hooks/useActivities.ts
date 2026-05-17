import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Activity } from '../api/client';

export function useActivities(limit = 100) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.activities(limit)
      .then(data => setActivities(data.activities))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  return { activities, loading, error };
}
