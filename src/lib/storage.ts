const MAP_VIEWS_KEY = 'speedtest_map_views';
const MAP_VIEWS_RESET_KEY = 'speedtest_map_views_reset';

const FREE_MAP_VIEWS = parseInt(process.env.NEXT_PUBLIC_FREE_MAP_VIEWS || '10', 10);

export function getMapViewsRemaining(): number {
  if (typeof window === 'undefined') return FREE_MAP_VIEWS;

  const resetAt = localStorage.getItem(MAP_VIEWS_RESET_KEY);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;

  // Reset counter each month
  if (resetAt !== currentMonth) {
    localStorage.setItem(MAP_VIEWS_KEY, '0');
    localStorage.setItem(MAP_VIEWS_RESET_KEY, currentMonth);
    return FREE_MAP_VIEWS;
  }

  const used = parseInt(localStorage.getItem(MAP_VIEWS_KEY) || '0', 10);
  return Math.max(0, FREE_MAP_VIEWS - used);
}

export function incrementMapViews(): number {
  if (typeof window === 'undefined') return FREE_MAP_VIEWS;

  const used = parseInt(localStorage.getItem(MAP_VIEWS_KEY) || '0', 10);
  localStorage.setItem(MAP_VIEWS_KEY, String(used + 1));
  return Math.max(0, FREE_MAP_VIEWS - (used + 1));
}

export function hasMapViewsRemaining(): boolean {
  return getMapViewsRemaining() > 0;
}
