import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook to persist selection state across page changes, reloads, and app restarts.
 * Priority order for initial state:
 * 1. URL search parameter (?paramName=val)
 * 2. localStorage entry (fanion_sel_storageKey)
 * 3. defaultValue fallback
 *
 * Updates React state, syncs to localStorage, and updates URL query params smoothly.
 */
export function useSelectionPersistence<T extends string = string>(
  storageKey: string,
  defaultValue: T = "" as T,
  paramName: string = storageKey
): [T, (newValue: T | ((prev: T) => T)) => void] {
  const fullStorageKey = `fanion_sel_${storageKey}`;

  // Read initial value from URL or localStorage or defaultValue
  const getInitialValue = (): T => {
    if (typeof window !== "undefined") {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const urlValue = searchParams.get(paramName);
        if (urlValue !== null && urlValue !== "") {
          return urlValue as T;
        }

        const storedValue = localStorage.getItem(fullStorageKey);
        if (storedValue !== null && storedValue !== "") {
          return storedValue as T;
        }
      } catch (err) {
        console.warn(`Error reading persisted selection for key ${storageKey}:`, err);
      }
    }
    return defaultValue;
  };

  const [state, setState] = useState<T>(getInitialValue);

  // Sync state changes to localStorage and URL search params
  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setState((prev) => {
        const resolvedValue = typeof newValue === "function" ? (newValue as Function)(prev) : newValue;
        const stringValue = String(resolvedValue ?? "");

        if (typeof window !== "undefined") {
          try {
            // Update localStorage
            if (stringValue) {
              localStorage.setItem(fullStorageKey, stringValue);
            } else {
              localStorage.removeItem(fullStorageKey);
            }

            // Update URL search parameters without page reload
            const url = new URL(window.location.href);
            if (stringValue && stringValue !== "all") {
              url.searchParams.set(paramName, stringValue);
            } else {
              url.searchParams.delete(paramName);
            }
            window.history.replaceState(null, "", url.pathname + url.search + url.hash);
          } catch (err) {
            console.warn(`Error persisting selection for key ${storageKey}:`, err);
          }
        }

        return resolvedValue;
      });
    },
    [fullStorageKey, paramName, storageKey]
  );

  // If state was initialized from localStorage, ensure URL param reflects it initially
  useEffect(() => {
    if (typeof window !== "undefined" && state && state !== "all") {
      try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(paramName)) {
          url.searchParams.set(paramName, state);
          window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      } catch (err) {
        console.warn(`Error syncing URL parameter for key ${storageKey}:`, err);
      }
    }
  }, [paramName, state, storageKey]);

  return [state, setValue];
}
