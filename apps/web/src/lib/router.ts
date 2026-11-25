import { useSyncExternalStore } from 'react';

// A handful of routes, so a few lines of history API instead of a router library.
const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
};
const snapshot = () => window.location.pathname + window.location.search;

export function useLocation(): { path: string; search: URLSearchParams } {
  const href = useSyncExternalStore(subscribe, snapshot);
  const url = new URL(href, window.location.origin);
  return { path: url.pathname, search: url.searchParams };
}

export function navigate(to: string, replace = false): void {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  const hash = new URL(to, window.location.origin).hash;
  if (hash) scrollToHash(hash);
  else if (!replace) window.scrollTo(0, 0);
}

/** Scrolls to #id once it exists; sections that load data can take a moment to render. */
export function scrollToHash(hash: string, tries = 20): void {
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (el) el.scrollIntoView({ block: 'start' });
  else if (tries > 0) window.setTimeout(() => scrollToHash(hash, tries - 1), 50);
}

/** Left-click on an <a> navigates without a page load; anything else behaves like a normal link. */
export function linkHandler(to: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
}
