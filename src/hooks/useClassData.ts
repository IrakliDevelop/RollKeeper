import { useState, useEffect } from 'react';
import { ProcessedClass } from '@/types/classes';
import { fetchClasses } from '@/utils/apiClient';

export function useClassData() {
  const [classData, setClassData] = useState<ProcessedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const classes = await fetchClasses();
        setClassData(classes);
        setError(null);
      } catch (err) {
        console.error('Failed to load class data:', err);
        setError('Failed to load class data');
      } finally {
        setLoading(false);
      }
    }

    loadClasses();
  }, []);

  return { classData, loading, error };
}
