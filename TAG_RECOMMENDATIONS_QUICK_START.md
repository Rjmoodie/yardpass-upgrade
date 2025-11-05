# Tag Recommendations - Quick Start Guide

## 🎯 Overview

Your YardPass platform now has **intelligent tag-based recommendations** that automatically learn user preferences and personalize their feed.

---

## 🚀 How It Works

### **Automatic Learning**
The system learns user preferences automatically:

| User Action | Tag Weight | Example |
|------------|------------|---------|
| **Buys Ticket** | +3.0 | User buys ticket for "Jazz Night" with tags [music, jazz] → Gets +3.0 weight for each tag |
| **Follows Event** | +2.0 | User follows "Music Festival" → Gets +2.0 for [music, festival, outdoor] |
| **Views Event >5s** | +0.5 | User spends 6 seconds on event page → Gets +0.5 for event's tags |

### **Feed Personalization**
Enhanced scoring formula:
```
Event Score = 35% Freshness + 20% Engagement + 25% Affinity + 20% Tag Affinity
```

**Example:**
- User has weights: `music: 15.0, jazz: 9.0, festival: 6.0`
- Event tagged `[music, jazz]` gets: +15.0 + 9.0 = **24.0 tag boost**
- Event tagged `[sports]` gets: **0 boost**

---

## 📊 Using the New Functions

### 1. **Enhanced Feed (Automatic)**
```typescript
// Your existing feed call now includes tag personalization!
const { data: feed } = await supabase.rpc('get_home_feed_ranked', {
  p_user: userId,
  p_limit: 20
});

// New fields returned:
feed.forEach(event => {
  console.log(event.title);
  console.log('Tag Affinity:', event.tag_affinity);  // NEW!
  console.log('Matched Tags:', event.matched_tags);  // NEW!
  console.log('Overall Score:', event.score);
});
```

### 2. **Tag Autocomplete**
```typescript
// As user types in tag input
async function handleTagInput(query: string) {
  const { data } = await supabase
    .rpc('get_tag_suggestions', { 
      p_query: query,
      p_limit: 10 
    });
  
  return data; // ['music', 'museum', 'musical', ...]
}
```

### 3. **Trending Tags**
```typescript
// Show popular tags on homepage
const { data: trending } = await supabase
  .rpc('get_popular_tags', { 
    p_limit: 20,
    p_timeframe_days: 30 
  });

trending.forEach(tag => {
  console.log(`#${tag.tag} (${tag.usage_count} uses)`);
  if (tag.is_trending) console.log('🔥 TRENDING');
});
```

### 4. **Browse by Tag**
```typescript
// When user clicks a tag
async function browseTag(tag: string) {
  const { data: events } = await supabase
    .rpc('get_events_by_tag', {
      p_tag: tag,
      p_user_id: userId,
      p_limit: 20
    });
  
  return events; // All events with that tag
}
```

### 5. **Enhanced Search**
```typescript
// Search with tag boosting
const { data: results } = await supabase
  .rpc('search_events_with_tags', {
    p_query: 'jazz concert',
    p_user_id: userId,
    p_limit: 20
  });

results.forEach(event => {
  console.log(event.title);
  console.log('Matched Tags:', event.matched_tags);
  console.log('Relevance:', event.relevance_score);
});
```

### 6. **Collaborative Filtering**
```typescript
// "Users like you also attended..."
const { data: recommendations } = await supabase
  .rpc('get_collaborative_recommendations', {
    p_user_id: userId,
    p_limit: 10
  });

recommendations.forEach(rec => {
  console.log('Event ID:', rec.event_id);
  console.log('Score:', rec.recommendation_score);
  console.log('Similar users:', rec.similar_users_count);
});
```

### 7. **Find Similar Users**
```typescript
// Find users with similar interests
const { data: similarUsers } = await supabase
  .rpc('find_similar_users', {
    p_user_id: userId,
    p_limit: 10
  });

similarUsers.forEach(user => {
  console.log('User ID:', user.similar_user_id);
  console.log('Similarity:', user.similarity_score);
  console.log('Shared tags:', user.shared_tags);
});
```

---

## 🎨 UI Component Examples

### Tag Input Component
```typescript
function TagInput({ tags, setTags }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleInput = async (value) => {
    setInput(value);
    if (value.length > 1) {
      const { data } = await supabase
        .rpc('get_tag_suggestions', { p_query: value });
      setSuggestions(data);
    }
  };

  const addTag = (tag) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setInput('');
    }
  };

  return (
    <div>
      {tags.map(tag => (
        <span key={tag} className="tag-chip">
          #{tag}
          <button onClick={() => setTags(tags.filter(t => t !== tag))}>×</button>
        </span>
      ))}
      <input 
        value={input}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && addTag(input)}
        placeholder="Add tag..."
      />
      {suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map(s => (
            <li key={s.tag} onClick={() => addTag(s.tag)}>
              #{s.tag} <span>({s.usage_count})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Trending Tags Widget
```typescript
function TrendingTags() {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    async function loadTags() {
      const { data } = await supabase
        .rpc('get_popular_tags', { p_limit: 15 });
      setTags(data);
    }
    loadTags();
  }, []);

  return (
    <div className="trending-tags">
      <h3>🔥 Trending Tags</h3>
      <div className="tag-cloud">
        {tags.map(tag => (
          <a 
            key={tag.tag}
            href={`/events/tag/${tag.tag}`}
            className={tag.is_trending ? 'trending' : ''}
          >
            #{tag.tag} <span>({tag.usage_count})</span>
          </a>
        ))}
      </div>
    </div>
  );
}
```

### Event Card with Tag Affinity
```typescript
function EventCard({ event }) {
  return (
    <div className="event-card">
      <img src={event.cover_image_url} alt={event.title} />
      <h3>{event.title}</h3>
      
      {/* Show tag affinity if personalized */}
      {event.tag_affinity > 0 && (
        <div className="personalization-badge">
          ⭐ Based on your interests
        </div>
      )}
      
      {/* Show matched tags */}
      {event.matched_tags?.length > 0 && (
        <div className="matched-tags">
          {event.matched_tags.map(tag => (
            <span key={tag} className="tag-match">#{tag}</span>
          ))}
        </div>
      )}
      
      {/* All tags */}
      <div className="tags">
        {event.tags?.map(tag => (
          <a key={tag} href={`/events/tag/${tag}`}>#{tag}</a>
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 Monitoring & Analytics

### Check User Preferences
```sql
-- See what a user is interested in
SELECT 
  tag,
  weight,
  interaction_count,
  last_interacted_at
FROM public.user_tag_preferences
WHERE user_id = 'USER_ID'
ORDER BY weight DESC;
```

### Tag Performance
```sql
-- Which tags drive the most tickets?
SELECT 
  unnest(e.tags) AS tag,
  COUNT(DISTINCT t.id) AS tickets_sold,
  COUNT(DISTINCT e.id) AS events_count
FROM events.events e
JOIN ticketing.tickets t ON t.event_id = e.id
WHERE e.tags IS NOT NULL
GROUP BY unnest(e.tags)
ORDER BY tickets_sold DESC
LIMIT 20;
```

### Feed Quality
```sql
-- How many users have personalized feeds?
SELECT 
  COUNT(DISTINCT user_id) AS users_with_preferences,
  AVG(tag_count) AS avg_tags_per_user,
  AVG(total_weight) AS avg_preference_strength
FROM (
  SELECT 
    user_id,
    COUNT(*) AS tag_count,
    SUM(weight) AS total_weight
  FROM public.user_tag_preferences
  GROUP BY user_id
) subquery;
```

---

## 🔧 Maintenance

### Weekly Tag Decay (Optional)
```sql
-- Keep preferences fresh by decaying old ones
SELECT public.decay_tag_preferences();
```

Set up a cron job:
```typescript
// In Supabase Edge Function or cron service
export async function handler() {
  await supabase.rpc('decay_tag_preferences');
  return { success: true };
}
```

### Clear Stale Preferences
```sql
-- Remove very weak preferences (< 0.1)
DELETE FROM public.user_tag_preferences
WHERE weight < 0.1;
```

---

## 🎯 Best Practices

### For Event Creators:
1. **Use 3-7 tags per event** - Not too few (won't match), not too many (dilutes signal)
2. **Be specific** - `#indie-rock` better than just `#music`
3. **Include category** - Add the event category as a tag
4. **Think like users** - What would they search for?

### For Developers:
1. **Always pass user_id** - Even for guest users (use session_id)
2. **Show matched tags** - Help users understand why they're seeing events
3. **Make tags clickable** - Enable easy browsing
4. **Cache trending tags** - Update hourly, not on every page load

---

## 🚀 Performance Tips

### Client-Side Caching
```typescript
// Cache trending tags for 1 hour
const CACHE_KEY = 'trending_tags';
const CACHE_TTL = 3600000; // 1 hour

async function getTrendingTags() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }
  
  const { data } = await supabase.rpc('get_popular_tags');
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  return data;
}
```

### Debounce Tag Suggestions
```typescript
import { debounce } from 'lodash';

const fetchSuggestions = debounce(async (query) => {
  const { data } = await supabase
    .rpc('get_tag_suggestions', { p_query: query });
  setSuggestions(data);
}, 300); // Wait 300ms after user stops typing
```

---

## 📈 Expected Results

### Immediate (Week 1):
- ✅ Tag autocomplete working
- ✅ Events display with tags
- ✅ Search includes tags
- ✅ Trending tags widget live

### Short-term (Month 1):
- 📊 10-15% of users have tag preferences
- 📊 Tag-based browsing accounts for 5% of traffic
- 📊 Feed personalization improving CTR by 8-12%

### Long-term (Month 3):
- 🚀 50%+ users have preferences
- 🚀 Tag recommendations drive 20% of tickets
- 🚀 Conversion lift: 15-25%
- 🚀 Collaborative filtering active

---

## 🎉 Summary

**Your recommendation system is now:**
- ✅ Automatically learning user interests
- ✅ Personalizing feeds with 20% tag weight
- ✅ Enabling tag-based discovery
- ✅ Powering collaborative filtering
- ✅ Tracking trending topics
- ✅ Boosting search with tags

**No manual intervention needed!** The system learns as users interact with events. 🚀





