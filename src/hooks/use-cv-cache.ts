import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CVCached = {
  profile: {
    name: string;
    title: string;
    email: string;
    phone: string;
    summary: string;
  };
  experiences: Array<{
    role: string;
    company: string;
    period: string;
    bullets: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  skills: string;
};

const CACHE_KEY = "ventureapply_parsed_cv_cache";
const CACHE_VERSION = 1;

interface CacheEntry {
  version: number;
  timestamp: number;
  cv: CVCached;
  title: string;
}

const isValidCache = (entry: CacheEntry | null): entry is CacheEntry => {
  if (!entry) return false;
  if (entry.version !== CACHE_VERSION) return false;
  // Cache expires after 24 hours
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - entry.timestamp > DAY_MS) return false;
  return true;
};

export function useCVCache() {
  const [cachedCV, setCachedCV] = useState<CVCached | null>(null);
  const [cachedTitle, setCachedTitle] = useState<string>("My Resume");
  const [isLoading, setIsLoading] = useState(true);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const entry: CacheEntry = JSON.parse(stored);
        if (isValidCache(entry)) {
          setCachedCV(entry.cv);
          setCachedTitle(entry.title);
        } else {
          // Clear invalid cache
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch {
      // Ignore parse errors - clear corrupted cache
      localStorage.removeItem(CACHE_KEY);
    }
    setIsLoading(false);
  }, []);

  // Save parsed CV to localStorage and optionally to Supabase
  const saveToCache = useCallback(async (
    cv: CVCached,
    title: string,
    saveToSupabase: boolean = true
  ) => {
    // Always save to localStorage
    const entry: CacheEntry = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      cv,
      title,
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
      setCachedCV(cv);
      setCachedTitle(title);
    } catch (e) {
      console.warn("[CV Cache] Failed to save to localStorage:", e);
    }

    // Optionally save to Supabase if authenticated
    if (saveToSupabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("cvs")
            .upsert(
              { user_id: user.id, title, raw_json_data: cv as any },
              { onConflict: "user_id,title" as any },
            );
        }
      } catch (e) {
        console.warn("[CV Cache] Failed to save to Supabase:", e);
      }
    }
  }, []);

  // Clear the cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setCachedCV(null);
    setCachedTitle("My Resume");
  }, []);

  // Get current cache timestamp for display
  const getCacheAge = useCallback((): string | null => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return null;
      const entry: CacheEntry = JSON.parse(stored);
      if (!isValidCache(entry)) return null;
      
      const ageMs = Date.now() - entry.timestamp;
      const hours = Math.floor(ageMs / (60 * 60 * 1000));
      if (hours < 1) return "Just now";
      if (hours < 24) return `${hours}h ago`;
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    cachedCV,
    cachedTitle,
    isLoading,
    saveToCache,
    clearCache,
    getCacheAge,
    hasValidCache: cachedCV !== null,
  };
}
