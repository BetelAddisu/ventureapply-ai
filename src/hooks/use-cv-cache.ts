import { useEffect, useState, useCallback, useRef } from "react";
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

const CACHE_KEY_PREFIX = "ventureapply_parsed_cv_cache_";
const CACHE_VERSION = 2; // Incremented to invalidate old caches

interface CacheEntry {
  version: number;
  timestamp: number;
  cv: CVCached;
  title: string;
  userId: string | null;
}

const isValidCache = (entry: CacheEntry | null, currentUserId: string | null): entry is CacheEntry => {
  if (!entry) return false;
  if (entry.version !== CACHE_VERSION) return false;
  if (entry.userId !== currentUserId) return false;
  // Cache expires after 24 hours
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - entry.timestamp > DAY_MS) return false;
  return true;
};

const getCacheKey = (userId: string | null): string => {
  return `${CACHE_KEY_PREFIX}${userId || "anonymous"}`;
};

export function useCVCache() {
  const [cachedCV, setCachedCV] = useState<CVCached | null>(null);
  const [cachedTitle, setCachedTitle] = useState<string>("My Resume");
  const [isLoading, setIsLoading] = useState(true);
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Get current user and set up listener
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || null;
      setUserId(uid);
      currentUserIdRef.current = uid;
    };
    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      currentUserIdRef.current = uid;
      // Reload cache for new user
      loadCache(uid);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load cache for a specific user
  const loadCache = (uid: string | null) => {
    try {
      const cacheKey = getCacheKey(uid);
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry = JSON.parse(stored);
        if (isValidCache(entry, uid)) {
          setCachedCV(entry.cv);
          setCachedTitle(entry.title);
          setIsUnsaved(entry.userId === null); // Mark as unsaved if no user
          setIsLoading(false);
          return;
        } else {
          // Clear invalid/expired cache
          localStorage.removeItem(cacheKey);
        }
      }
    } catch {
      // Ignore parse errors - clear corrupted cache
    }
    setCachedCV(null);
    setCachedTitle("My Resume");
    setIsUnsaved(false);
    setIsLoading(false);
  };

  // Load cache from localStorage on mount
  useEffect(() => {
    loadCache(currentUserIdRef.current);
  }, []);

  // Save parsed CV to localStorage and optionally to Supabase
  const saveToCache = useCallback(async (
    cv: CVCached,
    title: string,
    saveToSupabase: boolean = true,
    markAsSaved: boolean = true
  ) => {
    const currentUid = currentUserIdRef.current;
    const entry: CacheEntry = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      cv,
      title,
      userId: markAsSaved ? currentUid : null, // If not saved, mark as unsaved
    };
    try {
      const cacheKey = getCacheKey(currentUid);
      localStorage.setItem(cacheKey, JSON.stringify(entry));
      setCachedCV(cv);
      setCachedTitle(title);
      setIsUnsaved(!markAsSaved);
    } catch (e) {
      console.warn("[CV Cache] Failed to save to localStorage:", e);
    }

    // Optionally save to Supabase if authenticated
    if (saveToSupabase && currentUid) {
      try {
        await supabase
          .from("cvs")
          .upsert(
            { user_id: currentUid, title, raw_json_data: cv as any },
            { onConflict: "user_id,title" as any },
          );
        setIsUnsaved(false); // Mark as saved once Supabase succeeds
      } catch (e) {
        console.warn("[CV Cache] Failed to save to Supabase:", e);
      }
    }
  }, []);

  // Clear the cache
  const clearCache = useCallback(() => {
    const currentUid = currentUserIdRef.current;
    const cacheKey = getCacheKey(currentUid);
    localStorage.removeItem(cacheKey);
    setCachedCV(null);
    setCachedTitle("My Resume");
    setIsUnsaved(false);
  }, []);

  // Get current cache timestamp for display
  const getCacheAge = useCallback((): string | null => {
    try {
      const currentUid = currentUserIdRef.current;
      const cacheKey = getCacheKey(currentUid);
      const stored = localStorage.getItem(cacheKey);
      if (!stored) return null;
      const entry: CacheEntry = JSON.parse(stored);
      if (!isValidCache(entry, currentUid)) return null;
      
      const ageMs = Date.now() - entry.timestamp;
      const hours = Math.floor(ageMs / (60 * 60 * 1000));
      if (hours < 1) return "Just now";
      if (hours < 24) return `${hours}h ago`;
      return null;
    } catch {
      return null;
    }
  }, []);

  // Check if there's unsaved cache (for prompt before sign out)
  const hasUnsavedCache = useCallback((): boolean => {
    try {
      // Check both anonymous and current user caches
      const anonymousKey = getCacheKey(null);
      const anonymousStored = localStorage.getItem(anonymousKey);
      if (anonymousStored) {
        const entry: CacheEntry = JSON.parse(anonymousStored);
        if (isValidCache(entry, null)) return true;
      }
      // Check if current user's cache is marked as unsaved
      return isUnsaved;
    } catch {
      return false;
    }
  }, [isUnsaved]);

  return {
    cachedCV,
    cachedTitle,
    isLoading,
    isUnsaved,
    saveToCache,
    clearCache,
    getCacheAge,
    hasValidCache: cachedCV !== null,
    hasUnsavedCache,
    userId,
  };
}
