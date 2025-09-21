# D&D App Data Optimization Strategy

## 🎯 Overview

This document outlines the comprehensive strategy to optimize data loading and search performance for the D&D RollKeeper application. The current architecture loads 8-10MB of JSON data (monsters, spells, classes) on every page load, causing performance issues and poor user experience in the combat tracker.

## 📊 Current State Analysis

### Data Scale
- **Monsters**: ~100 JSON files, largest 1.6MB (`bestiary-mm.json` - 77,732 lines)
- **Spells**: ~16 JSON files, largest 603KB (`spells-phb.json` - 21,109 lines)  
- **Classes**: Multiple JSON files in `json/class/` directory
- **Total**: 8-10MB+ of JSON data loaded on every page

### Current Problems
1. **Large bundle size**: 8-10MB sent to every client
2. **Combat tracker limitation**: Only 3 hardcoded sample monsters
3. **Client-side filtering**: Inefficient search through thousands of items
4. **Memory usage**: All data loaded simultaneously
5. **Poor search UX**: No instant search, no fuzzy matching

## 🏆 Recommended Solution: Hybrid Database + Smart Caching

### Architecture Overview
```
Database (PostgreSQL/SQLite) → API Routes → Client Search Index → React Query Cache → UI
```

### Key Components

#### 1. Database Layer
```sql
-- Optimized schema for fast searches
CREATE TABLE monsters (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  cr VARCHAR(10) NOT NULL,
  size TEXT[] NOT NULL,
  source VARCHAR(20) NOT NULL,
  search_text TEXT NOT NULL, -- Concatenated searchable fields
  data JSONB NOT NULL,       -- Full monster data
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast searches
CREATE INDEX idx_monsters_name ON monsters USING GIN (name gin_trgm_ops);
CREATE INDEX idx_monsters_type ON monsters (type);
CREATE INDEX idx_monsters_cr ON monsters (cr);
CREATE INDEX idx_monsters_search ON monsters USING GIN (search_text gin_trgm_ops);
CREATE INDEX idx_monsters_source ON monsters (source);
```

#### 2. Search API Endpoints
```typescript
// /api/monsters/search - Main search endpoint
interface SearchParams {
  q?: string;           // Search query
  type?: string;        // Monster type filter
  cr?: string;          // Challenge rating filter
  source?: string;      // Source book filter
  limit?: number;       // Results per page (default: 20)
  offset?: number;      // Pagination offset
}

// /api/monsters/popular - Preload top 50 most used monsters
// /api/monsters/[id] - Get specific monster details
// /api/monsters/bulk - Get multiple monsters by IDs
```

#### 3. Client-Side Architecture
```typescript
// React Query for caching and background updates
const useMonsterSearch = (query: string, filters: MonsterFilters) => {
  return useQuery({
    queryKey: ['monsters', query, filters],
    queryFn: () => searchMonsters(query, filters),
    enabled: query.length > 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Debounced search hook
const useDebouncedSearch = (query: string, delay: number = 300) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(timer);
  }, [query, delay]);
  
  return debouncedQuery;
};
```

#### 4. Combat Tracker Integration
```typescript
// Enhanced monster selector for combat tracker
function MonsterSelector({ onAddMonster }: MonsterSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<MonsterFilters>({});
  
  const debouncedSearch = useDebouncedSearch(searchTerm);
  const { data, isLoading, error } = useMonsterSearch(debouncedSearch, filters);
  
  // Preload popular monsters for instant access
  const { data: popularMonsters } = useQuery({
    queryKey: ['monsters', 'popular'],
    queryFn: getPopularMonsters,
    staleTime: Infinity, // Cache forever
  });
  
  const displayMonsters = searchTerm.length < 3 
    ? popularMonsters?.slice(0, 12) 
    : data?.monsters;
    
  return (
    <div className="monster-selector">
      <SearchInput 
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search monsters (e.g., 'goblin', 'CR 5', 'dragon')"
      />
      
      <FilterBar filters={filters} onChange={setFilters} />
      
      <VirtualizedMonsterGrid 
        monsters={displayMonsters}
        onAddMonster={onAddMonster}
        loading={isLoading}
      />
    </div>
  );
}
```

## 📈 Performance Improvements

### Before vs After
| Metric | Current | After Optimization |
|--------|---------|-------------------|
| Initial Bundle Size | 8-10MB | ~100KB |
| Search Response Time | 50-200ms | <10ms (cached) / 50-100ms (API) |
| Memory Usage | High (all data in memory) | Low (paginated loading) |
| Combat Tracker Monsters | 3 hardcoded | 2000+ searchable |
| Search Features | Basic text match | Fuzzy search, filters, autocomplete |
| Offline Support | None | Cached results available |

### Search Performance Optimizations
1. **Database indexes** - GIN indexes for full-text search
2. **Query optimization** - Limit, offset, and filtered queries
3. **Client-side caching** - React Query with smart invalidation
4. **Debounced search** - Reduce API calls by 80%
5. **Popular monsters preload** - Instant access to common monsters
6. **Virtual scrolling** - Handle thousands of results smoothly

## 🚀 Implementation Phases

### Phase 1: Database Migration (Week 1)
- [ ] Set up database schema (PostgreSQL recommended)
- [ ] Create migration scripts for JSON → Database
- [ ] Add database indexes for search performance
- [ ] Implement data validation and cleanup

### Phase 2: API Development (Week 1-2)
- [ ] Create search API endpoints
- [ ] Implement pagination and filtering
- [ ] Add caching layer (Redis optional)
- [ ] Create bulk operations for efficiency

### Phase 3: Frontend Integration (Week 2-3)
- [ ] Replace JSON loaders with API calls
- [ ] Implement React Query for caching
- [ ] Add debounced search hooks
- [ ] Create virtualized components for large lists

### Phase 4: Combat Tracker Enhancement (Week 3)
- [ ] Replace sample monsters with real search
- [ ] Add advanced filtering (CR, type, source)
- [ ] Implement monster favorites/recent
- [ ] Add bulk monster addition

### Phase 5: Performance Optimization (Week 4)
- [ ] Implement virtual scrolling
- [ ] Add search analytics and popular monsters
- [ ] Optimize bundle size and lazy loading
- [ ] Add offline support with service workers

## 🔧 Technical Implementation Details

### Database Setup (Prisma Example)
```typescript
// schema.prisma
model Monster {
  id          String   @id
  name        String   @db.VarChar(100)
  type        String   @db.VarChar(50)
  cr          String   @db.VarChar(10)
  size        String[]
  source      String   @db.VarChar(20)
  searchText  String   @map("search_text") // Concatenated searchable fields
  data        Json     // Full monster data
  createdAt   DateTime @default(now()) @map("created_at")
  
  @@index([name])
  @@index([type])
  @@index([cr])
  @@index([searchText])
  @@index([source])
  @@map("monsters")
}

model Spell {
  id          String   @id
  name        String   @db.VarChar(100)
  level       Int
  school      String   @db.VarChar(20)
  classes     String[] // Which classes can cast this spell
  source      String   @db.VarChar(20)
  searchText  String   @map("search_text")
  data        Json
  createdAt   DateTime @default(now()) @map("created_at")
  
  @@index([name])
  @@index([level])
  @@index([school])
  @@index([searchText])
  @@map("spells")
}
```

### Migration Script
```typescript
// scripts/migrate-json-to-db.ts
import { PrismaClient } from '@prisma/client';
import { loadAllBestiary } from '../src/utils/bestiaryDataLoader';
import { loadAllSpells } from '../src/utils/spellDataLoader';

const prisma = new PrismaClient();

async function migrateMonsters() {
  console.log('Loading monsters from JSON files...');
  const monsters = await loadAllBestiary();
  
  console.log(`Migrating ${monsters.length} monsters to database...`);
  
  for (const monster of monsters) {
    const searchText = [
      monster.name,
      monster.type,
      monster.cr,
      monster.size.join(' '),
      monster.source
    ].join(' ').toLowerCase();
    
    await prisma.monster.upsert({
      where: { id: monster.id },
      update: {
        name: monster.name,
        type: typeof monster.type === 'string' ? monster.type : monster.type.type,
        cr: monster.cr,
        size: monster.size,
        source: monster.source,
        searchText,
        data: monster as any,
      },
      create: {
        id: monster.id,
        name: monster.name,
        type: typeof monster.type === 'string' ? monster.type : monster.type.type,
        cr: monster.cr,
        size: monster.size,
        source: monster.source,
        searchText,
        data: monster as any,
      },
    });
  }
  
  console.log('Monster migration completed!');
}

async function main() {
  await migrateMonsters();
  // await migrateSpells();
  // await migrateClasses();
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

## 📱 User Experience Improvements

### Combat Tracker Enhancements
1. **Instant monster search** - Type and see results immediately
2. **Smart suggestions** - Show popular monsters when search is empty
3. **Advanced filters** - Filter by CR, type, source, environment
4. **Monster favorites** - Save frequently used monsters
5. **Bulk operations** - Add multiple monsters at once
6. **Monster variants** - Easy access to different CR versions

### Search Features
1. **Fuzzy matching** - Find "goblins" when typing "goblin"
2. **Autocomplete** - Suggest monster names as you type
3. **Search history** - Remember recent searches
4. **Quick filters** - One-click CR ranges, monster types
5. **Advanced search** - Complex queries like "CR 5-10 dragons"

## 🎯 Success Metrics

### Performance Targets
- [ ] Initial page load: < 2 seconds
- [ ] Search response time: < 100ms (cached), < 300ms (API)
- [ ] Bundle size reduction: > 90% (from 10MB to < 1MB)
- [ ] Combat tracker monster count: 2000+ (from 3)
- [ ] Search accuracy: > 95% relevant results

### User Experience Goals
- [ ] Zero-delay search experience (debounced + cached)
- [ ] Smooth scrolling through thousands of results
- [ ] Offline access to recently viewed monsters
- [ ] Mobile-optimized search and selection
- [ ] Accessibility compliance (keyboard navigation, screen readers)

## 🔄 Maintenance and Monitoring

### Data Updates
- Automated JSON file monitoring for new D&D releases
- Database migration scripts for new content
- Search index rebuilding for optimal performance
- Cache invalidation strategies

### Performance Monitoring
- API response time tracking
- Search query analytics
- User behavior insights (popular monsters, search patterns)
- Error tracking and alerting

---

This architecture provides a scalable, performant foundation that can handle the current D&D data and easily accommodate future growth (new books, homebrew content, etc.).
