# 🎨 Frontend Integration Guide - Sponsorship System

## Overview

This guide shows how to connect your comprehensive sponsorship backend to your frontend application (React/Next.js).

## 📋 Table of Contents

1. [TypeScript Types](#typescript-types)
2. [Supabase Client Setup](#supabase-client-setup)
3. [React Hooks](#react-hooks)
4. [UI Components](#ui-components)
5. [Page Examples](#page-examples)
6. [Real-time Features](#real-time-features)
7. [Sponsorship Wing Dashboards](#sponsorship-wing-dashboards)

---

## 1. TypeScript Types

First, generate or create types from your database schema:

### Generate Types Automatically
```bash
# Generate types from Supabase
npx supabase gen types typescript --project-id your-project-id > src/types/database.types.ts
```

### Or Use the Types We Created
```typescript
// src/types/sponsorship.ts
export interface Sponsor {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
  contact_email: string | null
  industry: string | null
  company_size: string | null
  brand_values: Record<string, any>
  created_by: string
  created_at: string
  updated_at?: string
}

export interface SponsorProfile {
  id: string
  sponsor_id: string
  industry: string | null
  company_size: string | null
  annual_budget_cents: number | null
  brand_objectives: Record<string, any>
  target_audience: Record<string, any>
  preferred_categories: string[]
  regions: string[]
  activation_preferences: Record<string, any>
  verification_status: 'none' | 'pending' | 'verified' | 'revoked'
  public_visibility: 'hidden' | 'limited' | 'full'
  case_studies: Record<string, any> | null
  preferred_formats: string[] | null
  objectives_embedding: number[] | null
  created_at: string
  updated_at: string
}

export interface SponsorshipPackage {
  id: string
  event_id: string
  tier: string
  price_cents: number
  title: string | null
  description: string | null
  benefits: Record<string, any>
  inventory: number
  sold: number
  is_active: boolean
  visibility: string
  expected_reach: number | null
  avg_engagement_score: number | null
  package_type: string | null
  quality_score: number | null
  template_id: string | null
  version: number
  availability: Record<string, any> | null
  audience_snapshot: Record<string, any> | null
  constraints: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface SponsorshipMatch {
  id: string
  event_id: string
  sponsor_id: string
  score: number
  overlap_metrics: Record<string, any>
  status: 'pending' | 'suggested' | 'accepted' | 'rejected'
  explanations: Record<string, any> | null
  reason_codes: string[] | null
  viewed_at: string | null
  contacted_at: string | null
  updated_at: string
}

export interface ProposalThread {
  id: string
  event_id: string
  sponsor_id: string
  status: 'draft' | 'sent' | 'counter' | 'accepted' | 'rejected' | 'expired'
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProposalMessage {
  id: string
  thread_id: string
  sender_type: 'organizer' | 'sponsor'
  sender_user_id: string
  body: string | null
  offer: Record<string, any>
  attachments: Record<string, any> | null
  created_at: string
}

export interface Deliverable {
  id: string
  event_id: string
  sponsor_id: string
  type: string
  spec: Record<string, any>
  due_at: string | null
  status: 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived'
  evidence_required: boolean
  order_id: string | null
  package_id: string | null
  created_at: string
  updated_at: string
}

// View types
export interface PackageCard {
  package_id: string
  event_id: string
  title: string
  tier: string
  price_cents: number
  inventory: number
  sold: number
  quality_score: number | null
  total_views: number
  tickets_sold: number
  avg_engagement_score: number | null
  event_title: string
  event_start: string
}
```

---

## 2. Supabase Client Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// For server-side operations
export const getServerClient = (accessToken?: string) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    }
  })
}
```

---

## 3. React Hooks

### Sponsor Discovery Hook
```typescript
// src/hooks/useSponsors.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useSponsors(filters?: {
  industry?: string
  budgetMin?: number
  budgetMax?: number
  verified?: boolean
}) {
  return useQuery({
    queryKey: ['sponsors', filters],
    queryFn: async () => {
      let query = supabase
        .from('sponsor_public_profiles')
        .select(`
          *,
          sponsors!inner(id, name, logo_url, website_url),
          sponsor_profiles!inner(
            industry,
            company_size,
            annual_budget_cents,
            preferred_categories
          )
        `)
      
      if (filters?.verified) {
        query = query.eq('is_verified', true)
      }
      
      if (filters?.industry) {
        query = query.eq('sponsor_profiles.industry', filters.industry)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    }
  })
}
```

### Package Marketplace Hook
```typescript
// src/hooks/usePackageMarketplace.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function usePackageMarketplace(filters?: {
  category?: string
  minPrice?: number
  maxPrice?: number
  qualityTier?: string
}) {
  return useQuery({
    queryKey: ['package-marketplace', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sponsorship_package_cards')
        .select('*')
        .eq('is_active', true)
        .gt('inventory', supabase.raw('sold'))
        .order('quality_score_100', { ascending: false })
        .limit(50)
      
      if (error) throw error
      return data
    }
  })
}
```

### Sponsor Recommendations Hook
```typescript
// src/hooks/useSponsorRecommendations.ts
import { useQuery } from '@tantml:function_calls>
import { supabase } from '@/lib/supabase'

export function useSponsorRecommendations(sponsorId: string) {
  return useQuery({
    queryKey: ['sponsor-recommendations', sponsorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sponsor_recommended_packages')
        .select('*')
        .eq('sponsor_id', sponsorId)
        .gte('score', 0.5)
        .order('score', { ascending: false })
        .limit(20)
      
      if (error) throw error
      return data
    },
    enabled: !!sponsorId
  })
}
```

### Event Sponsor Matches Hook
```typescript
// src/hooks/useEventSponsorMatches.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEventSponsorMatches(eventId: string) {
  return useQuery({
    queryKey: ['event-sponsor-matches', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_event_recommended_sponsors')
        .select('*')
        .eq('event_id', eventId)
        .gte('score', 0.5)
        .order('score', { ascending: false })
        .limit(20)
      
      if (error) throw error
      return data
    },
    enabled: !!eventId
  })
}
```

### Proposal Thread Hook
```typescript
// src/hooks/useProposalThread.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useProposalThread(threadId: string) {
  const queryClient = useQueryClient()
  
  const thread = useQuery({
    queryKey: ['proposal-thread', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_threads')
        .select(`
          *,
          events!inner(id, title, start_at),
          sponsors!inner(id, name, logo_url)
        `)
        .eq('id', threadId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!threadId
  })
  
  const messages = useQuery({
    queryKey: ['proposal-messages', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data
    },
    enabled: !!threadId
  })
  
  const sendMessage = useMutation({
    mutationFn: async (message: {
      body: string
      offer: Record<string, any>
      sender_type: 'organizer' | 'sponsor'
    }) => {
      const { data: user } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('proposal_messages')
        .insert({
          thread_id: threadId,
          sender_user_id: user.user!.id,
          ...message
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-messages', threadId] })
      queryClient.invalidateQueries({ queryKey: ['proposal-thread', threadId] })
    }
  })
  
  return { thread, messages, sendMessage }
}
```

### Deliverables Hook
```typescript
// src/hooks/useDeliverables.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useDeliverables(sponsorId: string) {
  const queryClient = useQueryClient()
  
  const deliverables = useQuery({
    queryKey: ['deliverables', sponsorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliverables')
        .select(`
          *,
          events!inner(id, title, start_at)
        `)
        .eq('sponsor_id', sponsorId)
        .in('status', ['pending', 'needs_changes'])
        .order('due_at', { ascending: true, nullsFirst: false })
      
      if (error) throw error
      return data
    },
    enabled: !!sponsorId
  })
  
  const submitProof = useMutation({
    mutationFn: async ({
      deliverableId,
      assetUrl,
      metrics
    }: {
      deliverableId: string
      assetUrl: string
      metrics: Record<string, any>
    }) => {
      const { data: user } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('deliverable_proofs')
        .insert({
          deliverable_id: deliverableId,
          asset_url: assetUrl,
          metrics,
          submitted_by: user.user!.id
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Update deliverable status
      await supabase
        .from('deliverables')
        .update({ status: 'submitted' })
        .eq('id', deliverableId)
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', sponsorId] })
    }
  })
  
  return { deliverables, submitProof }
}
```

---

## 4. UI Components

### Package Card Component
```typescript
// src/components/sponsorship/PackageCard.tsx
import { PackageCard as PackageCardType } from '@/types/sponsorship'
import { formatCurrency } from '@/lib/utils'

interface Props {
  package: PackageCardType
  onSelect?: (pkg: PackageCardType) => void
}

export function PackageCard({ package: pkg, onSelect }: Props) {
  const availability = pkg.inventory - pkg.sold
  const price = formatCurrency(pkg.price_cents / 100)
  
  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      {/* Quality Badge */}
      {pkg.quality_score && (
        <div className="mb-4">
          <span className={`
            px-2 py-1 rounded text-xs font-medium
            ${pkg.quality_score >= 80 ? 'bg-green-100 text-green-800' :
              pkg.quality_score >= 60 ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'}
          `}>
            Quality: {pkg.quality_score}/100
          </span>
        </div>
      )}
      
      {/* Package Info */}
      <h3 className="text-xl font-bold mb-2">{pkg.title}</h3>
      <p className="text-sm text-gray-600 mb-4">{pkg.event_title}</p>
      
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-500">Reach</p>
          <p className="font-semibold">{pkg.total_views.toLocaleString()} views</p>
        </div>
        <div>
          <p className="text-gray-500">Engagement</p>
          <p className="font-semibold">{pkg.avg_engagement_score?.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-gray-500">Tickets Sold</p>
          <p className="font-semibold">{pkg.tickets_sold}</p>
        </div>
        <div>
          <p className="text-gray-500">Availability</p>
          <p className="font-semibold">{availability} of {pkg.inventory}</p>
        </div>
      </div>
      
      {/* Price & CTA */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          <p className="text-sm text-gray-500">Starting at</p>
          <p className="text-2xl font-bold">{price}</p>
        </div>
        <button
          onClick={() => onSelect?.(pkg)}
          disabled={availability === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {availability === 0 ? 'Sold Out' : 'Learn More'}
        </button>
      </div>
    </div>
  )
}
```

### Match Score Explanation Component
```typescript
// src/components/sponsorship/MatchScoreExplanation.tsx
interface Props {
  score: number
  breakdown: {
    budget_fit: number
    audience_overlap: { categories: number; geo: number; combined: number }
    engagement_quality: number
    objectives_similarity: number
  }
}

export function MatchScoreExplanation({ score, breakdown }: Props) {
  const scorePercentage = Math.round(score * 100)
  
  const getScoreColor = (value: number) => {
    if (value >= 0.8) return 'text-green-600'
    if (value >= 0.6) return 'text-blue-600'
    if (value >= 0.4) return 'text-yellow-600'
    return 'text-gray-600'
  }
  
  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Overall Score */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Match Score</h3>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
            {scorePercentage}%
          </div>
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  score >= 0.8 ? 'bg-green-600' :
                  score >= 0.6 ? 'bg-blue-600' :
                  score >= 0.4 ? 'bg-yellow-600' :
                  'bg-gray-600'
                }`}
                style={{ width: `${scorePercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Breakdown */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-gray-500">Score Breakdown</h4>
        
        <div className="space-y-3">
          <ScoreItem
            label="Budget Fit"
            value={breakdown.budget_fit}
            weight={25}
          />
          <ScoreItem
            label="Audience Alignment"
            value={breakdown.audience_overlap.combined}
            weight={35}
            details={[
              { label: 'Category Match', value: breakdown.audience_overlap.categories },
              { label: 'Geographic Match', value: breakdown.audience_overlap.geo }
            ]}
          />
          <ScoreItem
            label="Engagement Quality"
            value={breakdown.engagement_quality}
            weight={15}
          />
          <ScoreItem
            label="Objectives Similarity"
            value={breakdown.objectives_similarity}
            weight={10}
          />
        </div>
      </div>
    </div>
  )
}

function ScoreItem({
  label,
  value,
  weight,
  details
}: {
  label: string
  value: number
  weight: number
  details?: { label: string; value: number }[]
}) {
  const percentage = Math.round(value * 100)
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-gray-500">
          {percentage}% <span className="text-xs">(weight: {weight}%)</span>
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 bg-blue-600 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {details && (
        <div className="mt-2 ml-4 space-y-1">
          {details.map(detail => (
            <div key={detail.label} className="flex items-center justify-between text-xs text-gray-600">
              <span>{detail.label}</span>
              <span>{Math.round(detail.value * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Proposal Chat Interface
```typescript
// src/components/sponsorship/ProposalChat.tsx
import { useState } from 'react'
import { useProposalThread } from '@/hooks/useProposalThread'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  threadId: string
  userType: 'organizer' | 'sponsor'
}

export function ProposalChat({ threadId, userType }: Props) {
  const { thread, messages, sendMessage } = useProposalThread(threadId)
  const [message, setMessage] = useState('')
  const [offer, setOffer] = useState({
    price_cents: 0,
    benefits: [],
    exclusivity: false
  })
  
  const handleSend = async () => {
    if (!message.trim() && offer.price_cents === 0) return
    
    await sendMessage.mutateAsync({
      body: message,
      offer,
      sender_type: userType
    })
    
    setMessage('')
  }
  
  if (thread.isLoading || messages.isLoading) {
    return <div>Loading...</div>
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-xl font-bold">{thread.data?.events.title}</h2>
        <p className="text-sm text-gray-600">
          with {thread.data?.sponsors.name}
        </p>
        <span className={`
          inline-block mt-2 px-2 py-1 rounded text-xs font-medium
          ${thread.data?.status === 'accepted' ? 'bg-green-100 text-green-800' :
            thread.data?.status === 'rejected' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'}
        `}>
          {thread.data?.status}
        </span>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.data?.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_type === userType ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[70%] rounded-lg p-4
              ${msg.sender_type === userType
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'}
            `}>
              {msg.body && <p className="mb-2">{msg.body}</p>}
              
              {msg.offer && Object.keys(msg.offer).length > 0 && (
                <div className="mt-2 pt-2 border-t border-opacity-20">
                  <p className="text-xs font-medium mb-1">Offer:</p>
                  <div className="text-sm space-y-1">
                    {msg.offer.price_cents && (
                      <p>Price: ${(msg.offer.price_cents / 100).toLocaleString()}</p>
                    )}
                    {msg.offer.exclusivity !== undefined && (
                      <p>Exclusivity: {msg.offer.exclusivity ? 'Yes' : 'No'}</p>
                    )}
                  </div>
                </div>
              )}
              
              <p className={`
                text-xs mt-2
                ${msg.sender_type === userType ? 'text-blue-100' : 'text-gray-500'}
              `}>
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Input */}
      {thread.data?.status !== 'accepted' && thread.data?.status !== 'rejected' && (
        <div className="border-t p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full border rounded-lg p-3 mb-2 resize-none"
            rows={3}
          />
          
          {/* Offer Builder */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="number"
              placeholder="Offer price"
              value={offer.price_cents / 100 || ''}
              onChange={(e) => setOffer(prev => ({
                ...prev,
                price_cents: Number(e.target.value) * 100
              }))}
              className="border rounded p-2"
            />
            <label className="flex items-center gap-2 border rounded p-2">
              <input
                type="checkbox"
                checked={offer.exclusivity}
                onChange={(e) => setOffer(prev => ({
                  ...prev,
                  exclusivity: e.target.checked
                }))}
              />
              <span className="text-sm">Exclusivity</span>
            </label>
          </div>
          
          <button
            onClick={handleSend}
            disabled={sendMessage.isPending}
            className="w-full bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:bg-gray-300"
          >
            {sendMessage.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## 5. Page Examples

### Sponsor Discovery Page
```typescript
// src/app/(sponsors)/marketplace/page.tsx
'use client'

import { useState } from 'react'
import { usePackageMarketplace } from '@/hooks/usePackageMarketplace'
import { PackageCard } from '@/components/sponsorship/PackageCard'

export default function MarketplacePage() {
  const [filters, setFilters] = useState({
    category: '',
    minPrice: 0,
    maxPrice: 1000000
  })
  
  const { data: packages, isLoading } = usePackageMarketplace(filters)
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Sponsorship Marketplace</h1>
        <p className="text-gray-600">
          Discover high-quality sponsorship opportunities
        </p>
      </div>
      
      {/* Filters */}
      <div className="mb-8 flex gap-4">
        <select
          value={filters.category}
          onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
          className="border rounded-lg px-4 py-2"
        >
          <option value="">All Categories</option>
          <option value="music">Music</option>
          <option value="sports">Sports</option>
          <option value="technology">Technology</option>
          <option value="business">Business</option>
        </select>
        
        <input
          type="number"
          placeholder="Min Price"
          value={filters.minPrice || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, minPrice: Number(e.target.value) }))}
          className="border rounded-lg px-4 py-2"
        />
        
        <input
          type="number"
          placeholder="Max Price"
          value={filters.maxPrice || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: Number(e.target.value) }))}
          className="border rounded-lg px-4 py-2"
        />
      </div>
      
      {/* Grid */}
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages?.map(pkg => (
            <PackageCard key={pkg.package_id} package={pkg} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### Event Dashboard with Sponsor Matches
```typescript
// src/app/(organizers)/events/[id]/sponsors/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useEventSponsorMatches } from '@/hooks/useEventSponsorMatches'
import { MatchScoreExplanation } from '@/components/sponsorship/MatchScoreExplanation'

export default function EventSponsorsPage() {
  const params = useParams()
  const eventId = params.id as string
  
  const { data: matches, isLoading } = useEventSponsorMatches(eventId)
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Recommended Sponsors</h1>
      
      <div className="space-y-6">
        {matches?.map(match => (
          <div key={match.sponsor_id} className="border rounded-lg p-6">
            <div className="flex items-start gap-6">
              {/* Sponsor Info */}
              <div className="flex-shrink-0">
                <img
                  src={match.logo_url || '/placeholder-logo.png'}
                  alt={match.sponsor_name}
                  className="w-24 h-24 rounded-lg object-cover"
                />
              </div>
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{match.sponsor_name}</h2>
                <p className="text-gray-600 mb-4">{match.industry}</p>
                
                {/* Match Score */}
                <MatchScoreExplanation
                  score={match.score}
                  breakdown={match.overlap_metrics}
                />
                
                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Start Proposal
                  </button>
                  <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 6. Real-time Features

### Subscribe to Proposal Updates
```typescript
// src/hooks/useRealtimeProposal.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRealtimeProposal(threadId: string) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const channel = supabase
      .channel(`proposal:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposal_messages',
          filter: `thread_id=eq.${threadId}`
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['proposal-messages', threadId]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'proposal_threads',
          filter: `id=eq.${threadId}`
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['proposal-thread', threadId]
          })
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId, queryClient])
}
```

---

## 7. Sponsorship Wing Dashboards

The sponsorship wing surfaces curated sponsor workspaces, configurable widgets, and a live command center. Pair these UI patterns with the new backend contracts to deliver an opinionated experience fast.

### 7.1 Workspace Shell

```tsx
// src/features/sponsorship-wing/components/WorkspaceShell.tsx
import { PropsWithChildren } from 'react'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceHeader } from './WorkspaceHeader'

export function WorkspaceShell({ children }: PropsWithChildren) {
  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-surface-1">
      <WorkspaceSidebar />
      <div className="flex flex-col">
        <WorkspaceHeader />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  )
}
```

**Key ideas**
- Sidebar pulls workspace + member data from `useWorkspace()` hook
- Header surfaces quick stats (GMV, win rate, active proposals)
- Wrap all wing routes (e.g. `/wing/[workspaceSlug]/*`) with this shell

### 7.2 Widget Grid

```tsx
// src/features/sponsorship-wing/components/WidgetGrid.tsx
import { lazy } from 'react'
import { useWidgetRegistry } from '../hooks/useWidgetRegistry'
import { MarketplaceCardWidget } from './widgets/MarketplaceCardWidget'
import { CommandCenterWidget } from './widgets/CommandCenterWidget'

const registryComponentMap = {
  marketplace_card: MarketplaceCardWidget,
  command_center: CommandCenterWidget,
  pipeline_funnel: lazy(() => import('./widgets/PipelineFunnelWidget'))
} as const

export function WidgetGrid({ workspaceId }: { workspaceId: string }) {
  const { data: widgets, isLoading } = useWidgetRegistry(workspaceId)

  if (isLoading) {
    return <SkeletonGrid />
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {widgets?.map((widget) => {
        const Component = registryComponentMap[widget.widget_type]
        if (!Component) return null

        return <Component key={widget.id} widget={widget} />
      })}
    </div>
  )
}
```

**Implementation tips**
- `useWidgetRegistry` subscribes to `widget.updated` realtime channel for instant updates
- Provide lazy loading for experimental widget types so labs can ship faster
- Ship analytics by wrapping `Component` with `withWidgetInstrumentation`

### 7.3 Command Center Stream

```tsx
// src/features/sponsorship-wing/hooks/useCommandCenterFeed.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export function useCommandCenterFeed(workspaceId: string) {
  const client = createBrowserSupabaseClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = client
      .channel(`command_center:${workspaceId}`)
      .on('broadcast', { event: 'metrics' }, ({ payload }) => {
        queryClient.setQueryData(['command-center-feed', workspaceId], (prev: any[] = []) => {
          return [payload, ...prev].slice(0, 50)
        })
      })
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [client, queryClient, workspaceId])
}
```

**Usage**
- Call inside dashboard page component and pair with a standard `useQuery` for initial feed
- Render latest metrics in a sparkline/leaderboard hybrid view
- Bubble warnings (e.g. SLA drift) using toast notifications triggered by payload flags

### 7.4 Navigation & Routing

- App Router suggestion: nest wing routes under `app/(sponsorship-wing)/wing/[workspaceSlug]/page.tsx`
- Preload workspace + widget data via server components for snappy time-to-first-interaction
- Gate access with middleware that checks `sponsorship_workspace_members` membership via Supabase JWT claims

---

## 🚀 Quick Start Checklist

- [ ] Generate or create TypeScript types
- [ ] Set up Supabase client
- [ ] Install required packages (`@tanstack/react-query`, `date-fns`, etc.)
- [ ] Create base hooks for data fetching
- [ ] Build reusable UI components
- [ ] Implement page layouts
- [ ] Add real-time subscriptions
- [ ] Test with sample data
- [ ] Deploy to production

## 📚 Additional Resources

- [Supabase React Guide](https://supabase.com/docs/guides/with-react)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Next.js App Router](https://nextjs.org/docs)

---

**Your backend is ready, now build amazing UI on top of it!** 🎨
