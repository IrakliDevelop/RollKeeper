# DM Module Routing Structure

## 🗺️ URL Structure Overview

The DM module uses a hierarchical routing structure that provides clear navigation and maintains separation from player-focused features. All DM routes are prefixed with `/dm` to establish a clear namespace.

```
/dm                                   # DM Dashboard
├── /campaigns                        # Campaign Management
│   ├── /new                         # Create New Campaign
│   └── /[campaignId]                # Specific Campaign
│       ├── /                        # Campaign Overview
│       ├── /characters              # Character Management
│       │   ├── /                    # Character Pool
│       │   └── /import              # Import Characters
│       ├── /combat                  # Combat Tracker
│       │   ├── /                    # Active Combat
│       │   ├── /new                 # Start New Encounter
│       │   └── /[encounterId]       # Specific Encounter
│       ├── /encounters              # Encounter Management
│       │   ├── /                    # Encounter Library
│       │   └── /new                 # Create Encounter
│       └── /notes                   # Campaign Notes
│           ├── /                    # Notes Overview
│           └── /canvas              # Notes Canvas
└── /settings                        # DM Settings
    ├── /                            # General Settings
    ├── /automation                  # Automation Preferences
    └── /export                      # Data Export/Import
```

## 📁 File Structure Mapping

```
src/app/dm/
├── layout.tsx                       # DM module layout
├── page.tsx                         # DM dashboard (/dm)
├── loading.tsx                      # Loading states
├── error.tsx                        # Error handling
├── campaigns/
│   ├── page.tsx                     # Campaign list (/dm/campaigns)
│   ├── new/
│   │   └── page.tsx                 # Create campaign (/dm/campaigns/new)
│   └── [campaignId]/
│       ├── page.tsx                 # Campaign overview (/dm/campaigns/[id])
│       ├── layout.tsx               # Campaign-specific layout
│       ├── loading.tsx              # Campaign loading
│       ├── characters/
│       │   ├── page.tsx             # Character pool (/dm/campaigns/[id]/characters)
│       │   └── import/
│       │       └── page.tsx         # Import characters (/dm/campaigns/[id]/characters/import)
│       ├── combat/
│       │   ├── page.tsx             # Combat tracker (/dm/campaigns/[id]/combat)
│       │   ├── new/
│       │   │   └── page.tsx         # New encounter (/dm/campaigns/[id]/combat/new)
│       │   └── [encounterId]/
│       │       └── page.tsx         # Specific encounter (/dm/campaigns/[id]/combat/[encounterId])
│       ├── encounters/
│       │   ├── page.tsx             # Encounter library (/dm/campaigns/[id]/encounters)
│       │   └── new/
│       │       └── page.tsx         # Create encounter (/dm/campaigns/[id]/encounters/new)
│       └── notes/
│           ├── page.tsx             # Campaign notes (/dm/campaigns/[id]/notes)
│           └── canvas/
│               └── page.tsx         # Notes canvas (/dm/campaigns/[id]/notes/canvas)
└── settings/
    ├── page.tsx                     # DM settings (/dm/settings)
    ├── automation/
    │   └── page.tsx                 # Automation settings (/dm/settings/automation)
    └── export/
        └── page.tsx                 # Export/import (/dm/settings/export)
```

## 🎯 Route Definitions & Components

### DM Module Layout
```typescript
// src/app/dm/layout.tsx
import { DMSidebar } from '@/components/dm/Navigation/DMSidebar';
import { DMBreadcrumbs } from '@/components/dm/Navigation/DMBreadcrumbs';

export default function DMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dm-layout">
      <DMSidebar />
      <main className="dm-main">
        <DMBreadcrumbs />
        {children}
      </main>
    </div>
  );
}
```

### DM Dashboard
```typescript
// src/app/dm/page.tsx
import { DMDashboard } from '@/components/dm/DMDashboard';
import { RecentCampaigns } from '@/components/dm/CampaignManager/RecentCampaigns';
import { QuickActions } from '@/components/dm/QuickActions';

export default function DMHomePage() {
  return (
    <div className="dm-dashboard">
      <h1>Dungeon Master Dashboard</h1>
      <div className="dashboard-grid">
        <RecentCampaigns />
        <QuickActions />
        <DMDashboard />
      </div>
    </div>
  );
}
```

### Campaign Routes

#### Campaign List
```typescript
// src/app/dm/campaigns/page.tsx
import { CampaignList } from '@/components/dm/CampaignManager/CampaignList';
import { CreateCampaignButton } from '@/components/dm/CampaignManager/CreateCampaignButton';

export default function CampaignsPage() {
  return (
    <div className="campaigns-page">
      <div className="page-header">
        <h1>Campaigns</h1>
        <CreateCampaignButton />
      </div>
      <CampaignList />
    </div>
  );
}
```

#### Campaign Overview
```typescript
// src/app/dm/campaigns/[campaignId]/page.tsx
import { CampaignOverview } from '@/components/dm/CampaignManager/CampaignOverview';
import { CampaignStats } from '@/components/dm/CampaignManager/CampaignStats';

interface CampaignPageProps {
  params: { campaignId: string };
}

export default function CampaignPage({ params }: CampaignPageProps) {
  return (
    <div className="campaign-page">
      <CampaignOverview campaignId={params.campaignId} />
      <CampaignStats campaignId={params.campaignId} />
    </div>
  );
}
```

#### Combat Tracker
```typescript
// src/app/dm/campaigns/[campaignId]/combat/page.tsx
import { CombatTracker } from '@/components/dm/CombatTracker/CombatTracker';
import { InitiativeTracker } from '@/components/dm/InitiativeTracker/InitiativeTracker';

interface CombatPageProps {
  params: { campaignId: string };
}

export default function CombatPage({ params }: CombatPageProps) {
  return (
    <div className="combat-page">
      <div className="combat-layout">
        <aside className="combat-sidebar">
          <InitiativeTracker campaignId={params.campaignId} />
        </aside>
        <main className="combat-main">
          <CombatTracker campaignId={params.campaignId} />
        </main>
      </div>
    </div>
  );
}
```

### Character Management Routes

#### Character Pool
```typescript
// src/app/dm/campaigns/[campaignId]/characters/page.tsx
import { CharacterPool } from '@/components/dm/CharacterManager/CharacterPool';
import { ImportCharacterButton } from '@/components/dm/CharacterManager/ImportCharacterButton';

interface CharactersPageProps {
  params: { campaignId: string };
}

export default function CharactersPage({ params }: CharactersPageProps) {
  return (
    <div className="characters-page">
      <div className="page-header">
        <h1>Player Characters</h1>
        <ImportCharacterButton campaignId={params.campaignId} />
      </div>
      <CharacterPool campaignId={params.campaignId} />
    </div>
  );
}
```

#### Character Import
```typescript
// src/app/dm/campaigns/[campaignId]/characters/import/page.tsx
import { CharacterImport } from '@/components/dm/CharacterManager/CharacterImport';

interface ImportPageProps {
  params: { campaignId: string };
}

export default function ImportPage({ params }: ImportPageProps) {
  return (
    <div className="import-page">
      <h1>Import Characters</h1>
      <CharacterImport campaignId={params.campaignId} />
    </div>
  );
}
```

## 🧭 Navigation Components

### DM Sidebar Navigation
```typescript
// src/components/dm/Navigation/DMSidebar.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType;
  children?: NavItem[];
}

export function DMSidebar() {
  const pathname = usePathname();
  
  const navigation: NavItem[] = [
    {
      href: '/dm',
      label: 'Dashboard',
      icon: Home,
    },
    {
      href: '/dm/campaigns',
      label: 'Campaigns',
      icon: BookOpen,
      children: [
        { href: '/dm/campaigns/new', label: 'New Campaign', icon: Plus },
      ],
    },
    {
      href: '/dm/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="dm-sidebar">
      <nav className="dm-nav">
        {navigation.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname.startsWith(item.href)}
          />
        ))}
      </nav>
    </aside>
  );
}
```

### Campaign Navigation
```typescript
// src/components/dm/Navigation/CampaignNav.tsx
export function CampaignNav({ campaignId }: { campaignId: string }) {
  const campaignNavigation = [
    { href: `/dm/campaigns/${campaignId}`, label: 'Overview', icon: Home },
    { href: `/dm/campaigns/${campaignId}/characters`, label: 'Characters', icon: Users },
    { href: `/dm/campaigns/${campaignId}/combat`, label: 'Combat', icon: Sword },
    { href: `/dm/campaigns/${campaignId}/encounters`, label: 'Encounters', icon: Shield },
    { href: `/dm/campaigns/${campaignId}/notes`, label: 'Notes', icon: FileText },
  ];

  return (
    <nav className="campaign-nav">
      {campaignNavigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="campaign-nav-item"
        >
          <item.icon size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

### Breadcrumb Navigation
```typescript
// src/components/dm/Navigation/DMBreadcrumbs.tsx
import { usePathname } from 'next/navigation';
import { useCampaign } from '@/hooks/useCampaign';

export function DMBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  
  // Extract campaign ID if present
  const campaignId = segments[2] === 'campaigns' ? segments[3] : null;
  const { campaign } = useCampaign(campaignId);
  
  const breadcrumbs = generateBreadcrumbs(segments, campaign);
  
  return (
    <nav className="dm-breadcrumbs">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.href}>
          {index > 0 && <span className="separator">/</span>}
          <Link href={crumb.href} className="breadcrumb-item">
            {crumb.label}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
}
```

## 🔗 Route Parameters & Query Strings

### URL Parameters
```typescript
// Campaign ID parameter
interface CampaignParams {
  campaignId: string;
}

// Encounter ID parameter
interface EncounterParams {
  campaignId: string;
  encounterId: string;
}

// Example usage in component
export default function EncounterPage({ params }: { params: EncounterParams }) {
  const { campaignId, encounterId } = params;
  // Component implementation
}
```

### Query String Parameters
```typescript
// Combat tracker query parameters
interface CombatQuery {
  round?: string;           // Current round number
  turn?: string;            // Current turn participant ID
  view?: 'canvas' | 'list'; // Display mode
  zoom?: string;            // Canvas zoom level
}

// Character import query parameters
interface ImportQuery {
  source?: 'file' | 'url' | 'storage'; // Import source
  format?: 'json' | 'foundry';        // Data format
  batch?: 'true';                     // Batch import mode
}
```

## 🚦 Route Guards & Permissions

### DM Access Control
```typescript
// src/middleware.ts - Route protection
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if accessing DM routes
  if (request.nextUrl.pathname.startsWith('/dm')) {
    // Future: Add authentication check
    // For now, allow all access
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/dm/:path*',
};
```

### Campaign Access Validation
```typescript
// src/utils/dm/routeValidation.ts
export async function validateCampaignAccess(campaignId: string): Promise<boolean> {
  // Check if campaign exists
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  // Future: Check user permissions
  // if (!hasAccessToCampaign(currentUser, campaign)) {
  //   throw new Error('Access denied');
  // }
  
  return true;
}
```

## 📱 Mobile Route Considerations

### Responsive Route Handling
```typescript
// Different layouts for mobile vs desktop
export default function CombatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { campaignId: string };
}) {
  return (
    <>
      {/* Desktop layout */}
      <div className="hidden md:block">
        <DesktopCombatLayout campaignId={params.campaignId}>
          {children}
        </DesktopCombatLayout>
      </div>
      
      {/* Mobile layout */}
      <div className="md:hidden">
        <MobileCombatLayout campaignId={params.campaignId}>
          {children}
        </MobileCombatLayout>
      </div>
    </>
  );
}
```

### Mobile Navigation Patterns
- **Bottom Tab Bar**: Primary navigation for mobile
- **Hamburger Menu**: Secondary navigation and settings
- **Swipe Gestures**: Navigate between campaign sections
- **Modal Overlays**: Detailed views on small screens

## 🔄 Route State Management

### URL State Synchronization
```typescript
// Sync combat state with URL
export function useCombatRouteSync(campaignId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { combat, updateCombat } = useCombatStore();
  
  // Update URL when combat state changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('round', combat.currentRound.toString());
    params.set('turn', combat.currentTurn.toString());
    
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [combat.currentRound, combat.currentTurn]);
  
  // Update state when URL changes
  useEffect(() => {
    const round = parseInt(searchParams.get('round') || '1');
    const turn = parseInt(searchParams.get('turn') || '0');
    
    updateCombat({ currentRound: round, currentTurn: turn });
  }, [searchParams]);
}
```

### Route-Based Data Loading
```typescript
// Load campaign data based on route
export function useCampaignData(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignId ? getCampaign(campaignId) : null,
    enabled: !!campaignId,
  });
}
```

---

This routing structure provides a clear, hierarchical organization for the DM module while maintaining separation from player features and supporting future expansion.
