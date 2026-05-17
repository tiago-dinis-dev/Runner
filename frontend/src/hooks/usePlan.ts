import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PlanMeta, PlanDetail } from '../api/client';

export function usePlans() {
  const [plans, setPlans] = useState<PlanMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.plans()
      .then(data => setPlans(data.plans ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading, error };
}

export function usePlan(filename: string | null) {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filename) return;
    setLoading(true);
    api.plan(filename)
      .then(setPlan)
      .finally(() => setLoading(false));
  }, [filename]);

  return { plan, loading };
}
