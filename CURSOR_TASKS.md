# Cursor Pro — Parallel Task Assignments

These are tasks to work on in Cursor while Claude Code handles architecture and integration.
Work on them in order. Each task is self-contained with the target file.

---

## Task 1: Auth Modal Component
**File:** `src/components/AuthModal.tsx`
**Context:** We use Supabase Auth. The supabase client is in `src/lib/supabase.ts` (use `getSupabase()`).

Build a modal component with:
- Email + password sign up / sign in toggle
- Google OAuth button (Supabase handles the redirect)
- Clean dark-themed UI matching the app (bg-gray-900, text-white, blue-600 accents)
- Props: `isOpen: boolean`, `onClose: () => void`, `onAuth: (user) => void`
- Use Supabase `auth.signUp()`, `auth.signInWithPassword()`, `auth.signInWithOAuth({ provider: 'google' })`
- Handle errors inline (show below the form)
- Include a "Continue as guest" link that calls onClose

---

## Task 2: Wire Auth Into Main Page
**File:** `src/app/page.tsx`
**Context:** The page already has `const [isAuthenticated] = useState(false)` as a TODO.

- Import AuthModal
- Add state: `const [user, setUser] = useState(null)`
- Add state: `const [showAuth, setShowAuth] = useState(false)`
- On mount, check `getSupabase()?.auth.getUser()` to see if already logged in
- Wire the "Sign In" button in the header to open the auth modal
- Show user email or "Sign In" based on auth state
- Add a sign out option (dropdown or simple button)
- Pass `isAuthenticated={!!user}` to SpeedMap
- Pass `onAuthRequired={() => setShowAuth(true)}` to SpeedMap

---

## Task 3: Share Results Card
**File:** `src/components/ShareCard.tsx`
**Context:** After a speed test completes, users should be able to share a pretty card.

Build a component that:
- Takes props: `download_mbps`, `upload_mbps`, `latency_ms`, `locationName?: string`
- Renders a card-style div (280x160px) with the speed results, styled for screenshots
- Dark background, colorful speed numbers, "Tested on SpeedTest" branding
- Has a "Copy Link" button and a "Share" button (uses navigator.share if available)
- The share text: "I just tested {download} Mbps download at {locationName || 'my location'}! Find fast WiFi near you at speedtest.thirstmetrics.com"

---

## Task 4: Location Detail Panel
**File:** `src/components/LocationDetail.tsx`
**Context:** When a user clicks a point on the map at high zoom, show a slide-up panel.

Build a component that:
- Takes a location object (see `LocationAggregate` type in `src/types/index.ts`)
- Shows: business name (if available), average speeds, test count, last tested time
- If unclaimed: shows "Claim this location" button (for future use, just logs for now)
- If claimed + featured/premium: shows a badge
- Has a "Test Here" button that switches to the test tab
- Slide-up from bottom on mobile, side panel on desktop
- Dark theme matching the app

---

## Task 5: Speed Test History List
**File:** `src/components/TestHistory.tsx`
**Context:** Users should see their past test results.

Build a component that:
- On mount, queries Supabase: `speed_tests` table where `user_id` matches current user
- If no user (guest), reads from localStorage (store last 10 results)
- Displays a scrollable list of past tests: date, download, upload, ping, location
- Each item is tappable to show on map
- Empty state: "No tests yet. Run your first speed test!"
- Store guest results in localStorage key `speedtest_history` as JSON array

---

## Task 6: Leaderboard Component
**File:** `src/components/Leaderboard.tsx`
**Context:** Show the top 20 fastest public WiFi locations in the Las Vegas area.

Build a component that:
- Fetches from `/api/locations?lat=36.1699&lng=-115.1398&radius=25`
- Sorts by avg_download_mbps descending, takes top 20
- Displays as a ranked list: #1, #2, etc.
- Each row: rank, business name (or "Unknown Location"), download speed, upload speed
- Featured/premium tier locations get a highlight/badge
- Tapping a row should trigger a callback to center the map on that location
- Add a "See on Map" link that switches to the map tab
