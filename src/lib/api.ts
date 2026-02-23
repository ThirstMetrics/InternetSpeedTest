/**
 * Prepend the API base path for Cloudways deployment.
 * On Cloudways, Nginx only passes *.php paths to Apache,
 * so API routes go through /index.php/api/...
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE || '';
  return `${base}${path}`;
}
