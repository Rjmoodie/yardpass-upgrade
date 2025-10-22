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
  created_by: string
  created_at: string
  industry: string | null
  company_size: string | null
  brand_values: Record<string, unknown>
  preferred_visibility_options: Record<string, unknown>
}

export interface SponsorProfile {
  id: string
  sponsor_id: string
  industry: string | null
  company_size: string | null
  annual_budget_cents: number | null
  brand_objectives: Record<string, unknown>
  target_audience: Record<string, unknown>
  preferred_categories: string[]
  regions: string[]
  activation_preferences: Record<string, unknown>
  reputation_score: number | null
  verification_status: 'none' | 'pending' | 'verified' | 'revoked'
  public_visibility: 'hidden' | 'limited' | 'full'
  case_studies: Record<string, unknown> | null
  preferred_formats: string[] | null
  objectives_embedding: number[] | null
  created_at: string
  updated_at: string
}

export interface SponsorPublicProfile {
  sponsor_id: string
  slug: string
  headline: string | null
  about: string | null
  brand_values: Record<string, unknown>
  badges: string[]
  is_verified: boolean
  social_links: Record<string, unknown>[]
  created_at: string
  updated_at: string
}

export interface EventSponsorship {
  event_id: string
  sponsor_id: string
  tier: string
  amount_cents: number
  benefits: Record<string, unknown>
  status: string
  activation_status: string | null
  activation_state: 'draft' | 'in_progress' | 'complete' | null
  deliverables_due_date: string | null
  deliverables_submitted_at: string | null
  organizer_approved_at: string | null
  roi_summary: Record<string, unknown>
}

export interface SponsorshipPackage {
  id: string
  event_id: string
  tier: string
  title: string | null
  description: string | null
  price_cents: number
  currency: string
  inventory: number
  benefits: Record<string, unknown>
  visibility: string
  sold: number
  is_active: boolean
  created_by: string | null
  expected_reach: number | null
  avg_engagement_score: number | null
  package_type: string | null
  stat_snapshot_id: string | null
  quality_score: number | null
  quality_updated_at: string | null
  template_id: string | null
  version: number
  availability: Record<string, unknown> | null
  audience_snapshot: Record<string, unknown> | null
  constraints: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

export interface MatchFeature {
  id: string
  event_id: string
  sponsor_id: string
  features: Record<string, unknown>
  version: number
  computed_at: string
}

export interface SponsorshipMatch {
  id: string
  event_id: string
  sponsor_id: string
  score: number
  overlap_metrics: Record<string, unknown>
  status: 'pending' | 'suggested' | 'accepted' | 'rejected'
  viewed_at: string | null
  contacted_at: string | null
  declined_reason: string | null
  notes: string | null
  updated_at: string
  explanations: Record<string, unknown> | null
  reason_codes: string[] | null
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
  offer: Record<string, unknown>
  attachments: Record<string, unknown> | null
  created_at: string
}

export interface Deliverable {
  id: string
  event_id: string
  sponsor_id: string
  type: string
  spec: Record<string, unknown>
  due_at: string | null
  status: 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived'
  evidence_required: boolean
  created_at: string
  updated_at: string
}

export interface DeliverableProof {
  id: string
  deliverable_id: string
  asset_url: string
  metrics: Record<string, unknown>
  submitted_by: string | null
  submitted_at: string
  approved_at: string | null
  rejected_reason: string | null
}

export interface SponsorshipOrder {
  id: string
  package_id: string
  sponsor_id: string
  event_id: string
  amount_cents: number
  currency: string
  status: string
  escrow_state: 'pending' | 'funded' | 'locked' | 'released' | 'refunded' | 'cancelled' | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  stripe_transfer_id: string | null
  application_fee_cents: number
  created_at: string
  updated_at: string | null
  payout_status: string | null
}

export interface PayoutQueueItem {
  id: string
  order_id: string
  priority: number
  scheduled_for: string
  attempts: number
  max_attempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error_message: string | null
  created_at: string
  processed_at: string | null
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

Ground your UI in the actual sponsorship lifecycle tables: packages, matches, proposals, deliverables, and orders. The patterns below compose them into a cohesive operator dashboard without relying on undocumented views or workspace abstractions.

### 7.1 Pipeline Shell

```tsx
// src/features/sponsorship-wing/components/PipelineShell.tsx
import { PropsWithChildren } from 'react'
import { SponsorList } from './SponsorList'
import { KeyMetricsBar } from './KeyMetricsBar'

export function PipelineShell({ children }: PropsWithChildren) {
  return (
    <div className="grid min-h-screen grid-cols-[320px_1fr] bg-surface-1">
      <aside className="border-r border-border-subtle bg-surface-0">
        <SponsorList />
      </aside>
      <div className="flex flex-col">
        <KeyMetricsBar />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  )
}
```

**Key ideas**
- Sidebar queries `sponsorship_matches` joined with `sponsors` to surface high-value prospects.
- `KeyMetricsBar` aggregates `sponsorship_orders`, `deliverables`, and `payout_queue` counts for quick readouts.
- Keep route structure simple: e.g. `/sponsorship/pipeline/[eventId]` and `/sponsorship/proposals/[threadId]`.

### 7.2 Packages & Match View

```tsx
// src/features/sponsorship-wing/components/PackagesBoard.tsx
import { useMatches } from '../hooks/useMatches'
import { usePackages } from '../hooks/usePackages'

export function PackagesBoard({ eventId }: { eventId: string }) {
  const { data: packages } = usePackages(eventId)
  const { data: matches } = useMatches(eventId)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        {packages?.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </section>
      <aside className="space-y-3">
        {matches?.map((match) => (
          <MatchTile key={match.id} match={match} />
        ))}
      </aside>
    </div>
  )
}
```

**Implementation tips**
- `usePackages` selects from `sponsorship_packages` and enriches with event metadata as needed.
- `useMatches` joins `sponsorship_matches` with `match_features` for context such as `features.audience_overlap`.
- Provide visual cues for `status` (e.g. highlight `accepted` matches).

### 7.3 Negotiation Workspace

```tsx
// src/features/sponsorship-wing/components/NegotiationThread.tsx
import { useProposalThread } from '../hooks/useProposalThread'
import { useProposalMessages } from '../hooks/useProposalMessages'

export function NegotiationThread({ threadId }: { threadId: string }) {
  const { data: thread } = useProposalThread(threadId)
  const { data: messages, sendMessage } = useProposalMessages(threadId)

  return (
    <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-surface-0">
      <header className="border-b border-border-subtle px-6 py-4">
        <h2 className="text-lg font-semibold">{thread?.sponsor?.name}</h2>
        <p className="text-sm text-muted-foreground">Status: {thread?.status}</p>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {messages?.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <footer className="border-t border-border-subtle px-6 py-4">
        <ComposeBar threadId={threadId} onSend={sendMessage} />
      </footer>
    </div>
  )
}
```

**Implementation tips**
- Use Supabase realtime on `proposal_messages` to append new messages instantly.
- Promote negotiation milestones by reading `sponsorship_orders` rows tied to the same sponsor/event.
- Link deliverable requirements inline by pulling `deliverables` filtered by sponsor/event.

### 7.4 Financial Status Snapshot

```tsx
// src/features/sponsorship-wing/components/FinanceSnapshot.tsx
import { useOrders } from '../hooks/useOrders'
import { usePayoutQueue } from '../hooks/usePayoutQueue'

export function FinanceSnapshot({ eventId }: { eventId: string }) {
  const { data: orders } = useOrders(eventId)
  const { data: payouts } = usePayoutQueue()

  const fundedOrders = orders?.filter((order) => order.status === 'funded') ?? []
  const pendingPayouts = payouts?.filter((p) => p.status === 'pending') ?? []

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricTile label="Funded Orders" value={fundedOrders.length} trend="day" />
      <MetricTile label="Pending Payouts" value={pendingPayouts.length} trend="week" />
      <OrdersTable orders={orders ?? []} />
      <PayoutQueueTable items={payouts ?? []} />
    </div>
  )
}
```

**Implementation tips**
- Drive `OrdersTable` directly from `sponsorship_orders` (status, escrow_state, stripe ids).
- `PayoutQueueTable` pairs `payout_queue` with `sponsorship_payouts` to show fulfillment history.
- Include alerts when `attempts` nears `max_attempts` so operators can intervene.

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
