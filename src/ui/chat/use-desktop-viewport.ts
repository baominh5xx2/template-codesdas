import { useSyncExternalStore } from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", callback);
    return () => {
      mql.removeEventListener("change", callback);
    };
  }
  if (typeof mql.addListener === "function") {
    mql.addListener(callback);
    return () => {
      mql.removeListener(callback);
    };
  }
  return () => {};
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useDesktopViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
