# The Big Board 🏈

An NFL pick'em league management web application where players make strategic weekly picks throughout the season with a unique 32-pick quota system.

**Live Application:** Deployed on Vercel  
**Primary Users:** Family leagues (including kids ages 11-12 on iPads)

---

## What Is This?

The Big Board is a season-long NFL pick'em game with a twist: each player gets exactly 32 picks total (one per NFL team) to use across the entire season. Players must strategically decide when to use each team, balancing weekly quotas, game difficulty, and playoff implications.

**Core Mechanics:**
- 32 total picks per season (one per NFL team)
- Base quota of 2 picks per week
- Points equal the winning team's final score
- "Wrinkles" add bonus opportunities and scoring multipliers
- Two-week playoff tournament for top performers (Weeks 17-18)

**Why It Exists:**
Started as a family league app, now serves multiple leagues simultaneously with sophisticated features like snake draft playoffs, timed pick windows, and comprehensive statistics.

---

## Tech Stack

- **Framework:** Next.js 15.5 (App Router, React 19)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Auth:** Supabase Auth (magic links + password fallback)
- **Deployment:** Vercel (continuous deployment from GitHub)
- **Styling:** Tailwind CSS 4.1
- **Testing:** Vitest + Testing Library
- **Language:** TypeScript 5

---

## Getting Started

### Prerequisites
- Node.js (>=18)
- Supabase account and project
- Vercel account (for deployment)

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Deployment

The app auto-deploys to Vercel when pushing to the `dev` branch:

```bash
git checkout dev
git pull
git add .
git commit -m "your changes"
git push origin dev
```

---

## Key Features

### 1. **32-Pick Quota System**
- Each player picks exactly 32 teams across the entire season
- Base quota: 2 picks per week
- Once a team is used, it's unavailable for the rest of the season
- Strategic decision-making: save strong teams for tough weeks

### 2. **Wrinkles (Bonus Opportunities)**
- **Bonus Game:** Extra pick opportunity on specific games
- **Bonus Game ATS:** Pick against the spread
- **Bonus Game OOF:** Bonus for picking teams under .400
- **Winless Double:** Double points if team has 0 wins when picked
- Admin-configurable per week/game

### 3. **Playoffs System** *(Weeks 17-18)*
- Top 4 teams advance to two-week tournament
- Snake draft pick selection with timed unlock windows
- **Semifinals (Week 17):** 1-1-2-3-4-1-2-3-4 order
- **Championship (Week 18):** 1-2-1-2-1-2-1-2 order
- 3-hour unlock intervals with sleep mode (8pm-9am)
- 1 pick change per hour after all unlocks complete
- SNF game in Week 18 auto-assigned as tiebreaker

### 4. **Authentication**
- Primary: Magic link authentication (passwordless)
- Fallback: Password authentication (for parental control devices)
- Progressive enhancement approach for accessibility

### 5. **Unified TeamCard Component**
- Single reusable component across all pages
- Automatic light/dark mode using database colors
- Multiple variants: hollow, solid, greyscale
- Responsive design (abbreviation on mobile, full name on desktop)
- Logo support with fallbacks

### 6. **Statistics Dashboard**
- Most picked teams by week
- Win rates by pick timing
- Longest/shortest streaks
- Team performance history
- Multi-league comparison
- Separate "My Stats" vs "League Stats" views

### 7. **Admin Controls**
- League management (create, configure)
- Manual pick assistance for users
- Team color configuration
- Wrinkle creation and management
- Game status override
- Member impersonation *(in development)*

---

## Project Status

### ✅ Complete
- Core pick'em mechanics (32-pick quota system)
- Authentication (magic links + password fallback)
- Weekly game display and pick interface
- TeamCard component system (unified display)
- Wrinkles system (bonus picks and multipliers)
- Playoffs infrastructure (database, APIs, calculations)
- Basic statistics dashboard
- Admin tools (league management, manual picks)
- Row Level Security (RLS) for multi-league isolation
- Consolidated Supabase client architecture
- Responsive mobile-first design

### 🚧 In Progress
- Playoffs UI (pick page with unlock timers) - **NEXT UP**
- Playoffs dashboard/bracket visualization
- GitHub Action for midnight transitions (Week 17→18)

### 📋 Planned (Future Epics)
1. **Playoff UI Completion** - Pick page, dashboard, navigation
2. **Standings Overhaul** - Enhanced visualization and sorting
3. **Stats Enhancement** - Deeper analytics, perfect picks algorithm
4. **Season Management** - Tools for creating and starting new seasons

---

## Architecture Highlights

### Database Schema
- **Core Tables:** teams, games, leagues, league_memberships, picks
- **Wrinkles:** wrinkles, wrinkle_picks, wrinkle_games
- **Playoffs:** playoff_settings, playoff_rounds, playoff_picks, playoff_standings
- **Row Level Security:** League-specific data isolation using RLS policies
- **Auto-Update Triggers:** Automatic updated_at timestamps

### Key Architectural Decisions

**Consolidated Supabase Clients:**
- Single `createClient()` function for server-side usage
- Replaced scattered `createSupabaseClient()` implementations
- Consistent error handling and auth patterns

**TeamCard Component System:**
- Replaced 5+ different team display implementations
- Single source of truth for team rendering
- Database-driven theme colors (ui_light_color_key, ui_dark_color_key)
- Automatic adaptation to system theme

**API Route Patterns:**
- Consistent auth verification (user client + service client)
- League membership validation on all protected routes
- Efficient caching strategies (load data only when needed)
- Service role for cross-user reads (with membership gates)

**Team Tracking Consistency:**
- Both regular season picks and playoff picks include team_id
- Enables efficient "teams used" queries
- Consistent data structure across pick types

### File Structure
```
app/
├── picks/              # Main pick interface
├── standings/          # League standings
├── stats/              # Statistics dashboard
├── admin/              # Admin tools
│   ├── teams/          # Team color configuration
│   ├── leagues/        # League management
│   └── [leagueId]/     # League-specific admin
├── api/                # API routes
│   ├── picks/          # Pick management
│   ├── standings/      # Standings calculation
│   ├── playoffs/       # Playoff system
│   └── wrinkles/       # Bonus opportunities
components/
├── TeamCard.tsx        # Unified team display
├── WrinkleCard.tsx     # Bonus pick display
└── ...
lib/
├── teamCardHelpers.ts  # Theme and color utilities
└── ...
utils/
└── supabase/
    ├── server.ts       # Server-side client
    └── client.ts       # Client-side client
db/
└── migrations/         # Database migrations
```

---

## Important Files & Locations

### Reference Documents
- `Playoff_Epic` - Comprehensive playoff system documentation (in project root)

### Key Configuration Files
- `package.json` - Dependencies and scripts
- `tailwind.config.ts` - Tailwind configuration
- `next.config.ts` - Next.js configuration
- `.env.local` - Environment variables (not in repo)

### Critical Components
- `components/TeamCard.tsx` - Unified team display
- `app/picks/page.tsx` - Main pick interface
- `app/standings/page.tsx` - Standings page
- `app/stats/page.tsx` - Statistics dashboard

### API Routes (Most Used)
- `/api/picks` - Create, read, delete picks
- `/api/standings` - Calculate and fetch standings
- `/api/games-for-week` - Get games by week
- `/api/team-map` - Get all teams with colors
- `/api/playoffs/*` - Playoff system endpoints

---

## Development Workflow

### Terminal Commands (macOS)
```bash
# Create/update files using cat
cat > path/to/file.tsx << 'EOF'
[your code here]
EOF

# Verify file
cat path/to/file.tsx

# Standard git workflow
git checkout dev
git pull
git add [files]
git commit -m "description"
git push origin dev
```

### Testing Approach
- Test one change at a time
- Verify in local dev before deploying
- Avoid scope creep during implementation
- Maintain stable functionality for active users

### GitHub Integration
- **Branch:** `dev` (main development branch)
- **Deployment:** Auto-deploys to Vercel on push to `dev`
- **Workflow:** Local development → Test → Commit → Push → Auto-deploy

---

## Lessons Learned & Important Gotchas

### 🔐 Authentication
- **Magic links fail with parental controls** - iPads with restrictions can't access email verification links
- **Solution:** Password authentication as progressive enhancement
- Always provide multiple auth paths for accessibility

### 🎨 Design Consistency
- **Scattered implementations cause confusion** - Multiple team display patterns led to maintenance issues
- **Solution:** Consolidated TeamCard component with single source of truth
- Establish design systems early, resist "quick fix" duplicates

### 🔧 Database Architecture
- **Add columns for consistency, not just optimization** - Added team_id to playoff_picks to match regular season pattern
- **Use Supabase's built-in features** - auth.users table instead of custom password storage
- **RLS policies are critical** - Properly isolate multi-league data

### 📱 User Experience
- **Mobile-first is essential** - 99% of users access via mobile/iPad
- **Consider younger users** - Kids (11-12) need clear UI, simple interactions
- **Accessibility matters** - Parental controls, screen readers, color contrast

### 🚀 Deployment & Reliability
- **Test before peak usage** - Auth failures during critical pick windows frustrate users
- **Rollback beats complex fixes** - Revert to stable commits under pressure
- **One change at a time** - Easier to debug, safer for production

### 📊 Performance
- **Efficient queries matter** - Calculate availability on-the-fly rather than storing
- **Cache strategically** - Load data only when needed, avoid over-fetching
- **Index critical paths** - Add indexes for frequently queried columns

---

## Future Considerations

### Short Term
1. Complete playoffs UI (pick page, dashboard, bracket)
2. Implement GitHub Action for midnight transitions
3. Enhanced standings visualization

### Medium Term
1. Perfect picks algorithm (calculate theoretical maximum points)
2. Expanded statistics (team performance trends, pick timing analysis)
3. Season management tools (create new season, archive old data)
4. Mobile app (React Native?) given heavy iPad usage

### Long Term
1. Admin impersonation (previously attempted, needs careful architecture)
2. Multi-season historical comparisons
3. Social features (pick predictions, friendly rivalries)
4. Advanced wrinkle types (survivor pools, confidence points)

---

## Maintaining This README

**Update this README when:**
- ✅ Completing major epics (Playoffs, Stats, etc.)
- ✅ Making significant architectural changes
- ✅ Adding new features that change user experience
- ✅ Learning important lessons (especially production issues)
- ✅ Changing deployment or development workflow

**How to update:**
1. Open this file in your editor
2. Update relevant sections (Project Status, Architecture, Lessons Learned, etc.)
3. Commit with descriptive message: `docs: update README after [epic/feature name]`

---

## Contact & Support

This is a private family project with no public issue tracker. For questions or issues, contact the project maintainer directly.

**Project Started:** 2024  
**Current Season:** 2024-2025 NFL Season  
**Last Major Update:** November 2024 (Playoffs Epic implementation)

---

## Acknowledgments

Built with love for family and friends who enjoy NFL football and strategic competition. Special thanks to the users (especially the kids) who provide honest feedback and catch bugs we missed! 🏈

---

**Remember:** Have fun, make good picks, and may your teams always cover! 🎉
