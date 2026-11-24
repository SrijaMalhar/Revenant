import { useSyncExternalStore } from 'react';

// Two routes, so a dozen lines of history API instead of a router library.
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
  if (!replace) window.scrollTo(0, 0);
}

/** Left-click on an <a> navigates without a page load; anything else behaves like a normal link. */
export function linkHandler(to: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
}
