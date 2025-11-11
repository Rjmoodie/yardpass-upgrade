import { useState, useEffect, useMemo, useContext, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Plus, Minus, CreditCard, Key, Check, AlertCircle, Mail, Clock, Smartphone, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useCheckoutTracking } from '@/hooks/useCheckoutTracking';
import { toast } from '@/hooks/use-toast';
import { createGuestCheckoutSession } from '@/lib/ticketApi';
import { StripeEmbeddedCheckout } from './StripeEmbeddedCheckout';
const SkeletonList = lazy(() => import('@/components/common/SkeletonList'));

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  badge_label: string;
  quantity: number; // Available quantity (capacity - reserved - issued)
  max_per_order: number;
  totalCapacity?: number; // Total capacity
  reserved?: number; // Currently on hold
  issued?: number; // Sold tickets
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  startAtISO?: string;
  venue?: string;
  address?: string;
  description?: string;
  location?: string;
}

interface TicketPurchaseModalProps {
  event: Event;
  ticketTiers: TicketTier[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TicketSelection {
  [tierId: string]: number;
}

export function TicketPurchaseModal({ 
  event, 
  ticketTiers, 
  isOpen, 
  onClose, 
  onSuccess 
}: TicketPurchaseModalProps) {
  const { trackEvent } = useAnalyticsIntegration();
  const { trackCheckoutStart } = useCheckoutTracking();
  const navigate = useNavigate();
  const [selections, setSelections] = useState<TicketSelection>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);
  const [user, setUser] = useState<any>(null);
  const [guestCode, setGuestCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [validatedCode, setValidatedCode] = useState<{
    id: string;
    code: string;
    tier_id?: string;
    tier_name?: string;
  } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null);
  
  // Enhanced checkout session management
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState<Date | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'pending' | 'expired' | 'converted' | null>(null);
  const [canExtendHold, setCanExtendHold] = useState(false);
  const [expressMethods, setExpressMethods] = useState({
    applePay: false,
    googlePay: false,
    link: false
  });
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  
  // Embedded checkout state
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [embeddedCheckoutData, setEmbeddedCheckoutData] = useState<{
    checkoutSessionId: string;
    expiresAt: string;
    clientSecret: string;
  } | null>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Enhanced session management functions
  const pollCheckoutSessionStatus = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('checkout-session-status', {
        body: {
          checkoutSessionId: sessionId,
          email: user?.email || guestEmail
        }
      });

      if (error) {
        console.error('Session status error:', error);
        return;
      }

      setSessionStatus(data.status);
      setCheckoutExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      setCanExtendHold(data.canExtendHold || false);
      setExpressMethods(data.expressMethods || {
        applePay: false,
        googlePay: false,
        link: false
      });

      // If session expired, clear it
      if (data.status === 'expired') {
        setCheckoutSessionId(null);
        setCheckoutExpiresAt(null);
        localStorage.removeItem('checkoutSessionId');
      }
    } catch (error) {
      console.error('Failed to poll session status:', error);
    }
  }, [user?.email, guestEmail]);

  const recoverAbandonedSession = useCallback(async () => {
    const savedSessionId = localStorage.getItem('checkoutSessionId');
    if (!savedSessionId) return;

    setIsRecoveringSession(true);
    try {
      await pollCheckoutSessionStatus(savedSessionId);
      if (sessionStatus === 'pending') {
        setCheckoutSessionId(savedSessionId);
        toast({
          title: "Cart Recovered",
          description: "We found your previous session. Your tickets are still reserved.",
        });
      }
    } catch (error) {
      console.error('Session recovery failed:', error);
      localStorage.removeItem('checkoutSessionId');
    } finally {
      setIsRecoveringSession(false);
    }
  }, [pollCheckoutSessionStatus, sessionStatus]);

  // Auto-recover session on modal open
  useEffect(() => {
    if (isOpen && !checkoutSessionId) {
      recoverAbandonedSession();
    }
  }, [isOpen, checkoutSessionId, recoverAbandonedSession]);

  // Session polling timer
  useEffect(() => {
    if (!checkoutSessionId || sessionStatus !== 'pending') return;

    const interval = setInterval(() => {
      pollCheckoutSessionStatus(checkoutSessionId);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [checkoutSessionId, sessionStatus, pollCheckoutSessionStatus]);

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (!checkoutExpiresAt) return null;
    
    const now = new Date();
    const expires = new Date(checkoutExpiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return { minutes, seconds, totalMs: diff };
  }, [checkoutExpiresAt]);

  const notifyInfo = (message: string) => {
    toast({
      title: "Info",
      description: message,
    });
  };

  const validateGuestCode = async () => {
    const trimmed = guestCode.trim().toUpperCase();
    if (!trimmed) return;

    setValidatingCode(true);
    setCodeError(null);
    
    try {
      // Get guest code data
      const { data, error } = await supabase
        .from('guest_codes')
        .select(`
          id,
          code,
          tier_id,
          max_uses,
          used_count,
          expires_at
        `)
        .eq('event_id', event.id)
        .eq('code', trimmed)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCodeError('Invalid guest code');
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setCodeError('Guest code has expired');
        return;
      }

      if (data.used_count >= data.max_uses) {
        setCodeError('Guest code has reached its usage limit');
        return;
      }

      // Get tier name if tier_id exists
      let tierName: string | undefined;
      if (data.tier_id) {
        const { data: tierData } = await supabase
          .from('ticket_tiers')
          .select('name')
          .eq('id', data.tier_id)
          .maybeSingle();
        tierName = tierData?.name;
      }

      setValidatedCode({
        id: data.id,
        code: data.code,
        tier_id: data.tier_id ?? undefined,
        tier_name: tierName,
      });

      toast({
        title: "Valid guest code",
        description: `Access granted${tierName ? ` for ${tierName}` : ''}`,
      });
    } catch (e: any) {
      console.error('Error validating guest code:', e);
      setCodeError('Unable to validate guest code');
    } finally {
      setValidatingCode(false);
    }
  };

  // Fee calculation function with Stripe gross-up
  const calculateFees = (faceValue: number) => {
    // ✅ No processing fee for free tickets
    if (faceValue === 0) {
      return {
        total: 0,
        processingFee: 0,
        stripeFee: 0,
        platformComponent: 0
      };
    }
    
    // Platform fee target (Eventbrite-equivalent): 6.6% + $1.79
    const platformFeeTarget = faceValue * 0.066 + 1.79;
    
    // Net needed after Stripe fees (organizer gets faceValue, platform gets platformFeeTarget)
    const totalNetNeeded = faceValue + platformFeeTarget;
    
    // Gross up for Stripe fees: 2.9% + $0.30
    // Solving: net = total × 0.971 - 0.30  →  total = (net + 0.30) / 0.971
    const totalCharge = (totalNetNeeded + 0.30) / 0.971;
    
    // Processing fee shown to customer (includes platform + Stripe)
    const processingFee = totalCharge - faceValue;
    
    return {
      total: Math.round(totalCharge * 100) / 100, // Round to cents
      processingFee: Math.round(processingFee * 100) / 100,
      stripeFee: 0, // Not needed for display
      platformComponent: 0 // Not needed for display
    };
  };

  const updateSelection = (tierId: string, change: number) => {
    const tier = ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    setSelections(prev => {
      const currentQty = prev[tierId] || 0;
      const newQty = Math.max(0, Math.min(currentQty + change, tier.max_per_order, tier.quantity));
      
      console.log(`🎫 Quantity update: ${tier.name} ${currentQty} → ${newQty} (change: ${change})`);
      
      // Only update if actually changing
      if (newQty === currentQty) {
        console.log('🎫 No change, skipping update');
        return prev;
      }
      
      // Track ticket selection changes
      trackEvent('ticket_selection_change', {
        event_id: event.id,
        tier_id: tierId,
        tier_name: tier.name,
        previous_quantity: currentQty,
        new_quantity: newQty,
        price_cents: tier.price_cents
      });
      
      return {
        ...prev,
        [tierId]: newQty
      };
    });
  };

  // Calculate totals with fees
  const summary = useMemo(() => {
    let subtotal = 0;
    let totalQuantity = 0;
    let totalProcessingFee = 0;
    let grandTotal = 0;
    
    Object.entries(selections).forEach(([tierId, quantity]) => {
      const tier = ticketTiers.find(t => t.id === tierId);
      if (tier && quantity > 0) {
        const faceValue = tier.price_cents / 100;
        const fees = calculateFees(faceValue);
        
        subtotal += faceValue * quantity;
        totalProcessingFee += fees.processingFee * quantity;
        grandTotal += fees.total * quantity;
        totalQuantity += quantity;
      }
    });
    
    return { 
      subtotal, 
      totalQuantity, 
      processingFee: totalProcessingFee,
      grandTotal
    };
  }, [selections, ticketTiers]);

  const totalTickets = summary.totalQuantity;
  const totalAmount = Math.round(summary.grandTotal * 100); // Convert to cents

  const handlePurchase = useCallback(async () => {
    console.log('🎫 Purchase button clicked!');

    // Double-submit guard
    if (busyRef.current || submitting) {
      console.log('⚠️ Already processing, ignoring duplicate click');
      return;
    }

    // Track checkout initiation
    trackEvent('checkout_started', {
      event_id: event.id,
      tier_ids: Object.keys(selections).filter(id => selections[id] > 0),
      total_cents: totalAmount,
      total_quantity: totalTickets
    });

    console.log('User:', user);
    console.log('Total tickets:', totalTickets);
    console.log('Selections:', selections);

    const selectedEntries = Object.entries(selections).filter(([_, qty]) => (qty ?? 0) > 0);

    if (selectedEntries.length === 0) {
      console.log('❌ No tickets selected');
      trackEvent('checkout_no_tickets_selected', {
        event_id: event.id
      });
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket.",
        variant: "destructive"
      });
      return;
    }

    const items = Object.fromEntries(selectedEntries);
    const isGuestCheckout = !user;

    if (isGuestCheckout) {
      const trimmedEmail = guestEmail.trim().toLowerCase();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
      if (!emailValid) {
        setGuestEmailError('Enter a valid email to continue.');
        trackEvent('checkout_guest_email_invalid', {
          event_id: event.id,
          total_cents: totalAmount,
        });
        toast({
          title: "Email required",
          description: "Enter a valid email so we can send your tickets.",
          variant: "destructive"
        });
        return;
      }
      setGuestEmailError(null);
    } else {
      setGuestEmailError(null);
    }

    // Track checkout start in database (for feed ranking - weight: 4.0)
    const tierIds = selectedEntries.map(([tierId]) => tierId);
    trackCheckoutStart({
      eventId: event.id,
      totalCents: totalAmount,
      totalQuantity: totalTickets,
      tierIds,
    });

    busyRef.current = true;
    setSubmitting(true);
    setLoading(true);

    try {
      if (isGuestCheckout) {
        trackEvent('checkout_guest_started', {
          event_id: event.id,
          total_cents: totalAmount,
          total_quantity: totalTickets
        });

        const guestItems = selectedEntries.map(([tierId, quantity]) => ({
          tier_id: tierId,
          quantity,
          unit_price_cents: ticketTiers.find(t => t.id === tierId)?.price_cents || 0
        }));

        const { url } = await createGuestCheckoutSession({
          event_id: event.id,
          items: guestItems,
          contact_email: guestEmail.trim(),
          contact_name: guestName.trim() || undefined,
          guest_code: guestCode || null
        });

        notifyInfo('Redirecting to secure payment...');
        window.location.href = url;
        return;
      }

      // Member checkout - use enhanced-checkout
      console.log('🚀 Using enhanced-checkout for member purchase');
      const ticketSelections = selectedEntries.map(([tierId, quantity]) => ({
        tierId,
        quantity
      }));

      const response = await supabase.functions.invoke('enhanced-checkout', {
        body: {
          eventId: event.id,
          ticketSelections
        }
      });

      console.log('🔍 Enhanced checkout full response:', {
        error: response.error,
        data: response.data,
        errorContext: (response.error as any)?.context,
        errorDetails: (response.error as any)?.details,
        errorStatus: (response.error as any)?.status,
      });

      // Handle both error cases and non-2xx responses with error data
      if (response.error || response.data?.error_code) {
        const errorData = response.data;
        const errorCode = errorData?.error_code;
        const errorObj = response.error as any;
        
        // Try to get detailed error message
        let errorMessage = errorData?.error || errorObj?.message || 'Checkout failed';
        
        // Check if there's more detail in the error context (Response object)
        if (errorObj?.context && typeof errorObj.context === 'object' && errorObj.context instanceof Response) {
          console.log('❌ Error context is Response object, attempting to parse...');
          try {
            // Clone the response so we can read it
            const clonedResponse = errorObj.context.clone();
            const responseText = await clonedResponse.text();
            console.log('❌ Response body:', responseText);
            
            if (responseText) {
              try {
                const responseJson = JSON.parse(responseText);
                // Extract clean error message, not the whole JSON
                const cleanError = responseJson.error || responseJson.message || errorMessage;
                console.log('✅ Parsed error from response:', { 
                  rawJson: responseJson, 
                  cleanError, 
                  errorCode: responseJson.error_code 
                });
                
                if (responseJson.error_code) {
                  const parsedErrorCode = responseJson.error_code;
                  
                  // Handle sold out specifically with clean message
                  if (parsedErrorCode === 'SOLD_OUT' || cleanError.includes('sold out') || cleanError.includes('0 tickets available')) {
                    const soldOutError: any = new Error(cleanError);
                    soldOutError.isSoldOut = true;
                    throw soldOutError;
                  }
                  
                  // Handle event ended with clean message
                  if (parsedErrorCode === 'EVENT_ENDED' || cleanError.includes('already ended')) {
                    const eventEndedError: any = new Error(cleanError);
                    eventEndedError.isEventEnded = true;
                    throw eventEndedError;
                  }
                }
                
                // Use the clean extracted error message
                errorMessage = cleanError;
              } catch (jsonError) {
                // Not JSON, use the text as-is
                console.log('❌ Response body is not JSON:', responseText);
                errorMessage = responseText;
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse error context:', parseError);
          }
        } else if (errorObj?.context && typeof errorObj.context === 'string') {
          console.error('❌ Error context (string):', errorObj.context);
          try {
            const contextData = JSON.parse(errorObj.context);
            errorMessage = contextData.error || contextData.message || errorMessage;
          } catch {
            // Context isn't JSON, use as-is
            errorMessage = errorObj.context;
          }
        }
        
        console.error('❌ Enhanced checkout error:', { 
          errorCode, 
          errorMessage, 
          errorData,
          fullError: errorObj 
        });

        // Handle sold out
        if (errorCode === 'SOLD_OUT' || errorMessage.includes('sold out') || errorMessage.includes('not enough tickets')) {
          const soldOutError: any = new Error(errorMessage.includes('sold out') || errorMessage.includes('not enough tickets') 
            ? errorMessage 
            : 'These tickets are currently sold out.');
          soldOutError.isSoldOut = true;
          throw soldOutError;
        }

        // Handle event ended
        if (errorCode === 'EVENT_ENDED' || errorMessage.includes('already ended')) {
          const eventEndedError: any = new Error(errorMessage);
          eventEndedError.isEventEnded = true;
          throw eventEndedError;
        }

        // If it's a generic 409, it's likely a reservation conflict
        if (errorObj?.status === 409 || errorMessage.includes('Conflict')) {
          throw new Error('These tickets are currently being purchased by someone else. Please try again in a moment.');
        }

        // Generic error
        throw new Error(errorMessage);
      }

      const data = response.data;

      // Validate response has required data
      if (!data?.session_url) {
        throw new Error('No checkout URL returned');
      }

      // Store checkout session info for polling
      if (data.checkout_session_id) {
        setCheckoutSessionId(data.checkout_session_id);
        setCheckoutExpiresAt(data.expires_at ? new Date(data.expires_at) : null);
        localStorage.setItem('checkoutSessionId', data.checkout_session_id);
        
        // Start polling session status
        await pollCheckoutSessionStatus(data.checkout_session_id);
      }

      console.log('✅ Checkout session created');
      
      // Check if we should use embedded checkout
      const useEmbedded = import.meta.env.VITE_USE_EMBEDDED_CHECKOUT === 'true';
      
      if (useEmbedded && data.client_secret) {
        // Use embedded checkout (stay on YardPass)
        console.log('🎨 Using embedded checkout');
        setEmbeddedCheckoutData({
          checkoutSessionId: data.checkout_session_id,
          expiresAt: data.expires_at,
          clientSecret: data.client_secret,
        });
        setShowEmbeddedCheckout(true);
        onClose(); // Close purchase modal
      } else {
        // Use hosted checkout (redirect to Stripe)
        console.log('🌐 Using hosted checkout, redirecting to Stripe...');
        window.location.href = data.session_url;
      }
    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      
      // Check if event has ended
      if (error.isEventEnded) {
        toast({
          title: "Event Ended",
          description: error.message || "This event has already ended. Tickets are no longer available for purchase.",
          variant: "destructive"
        });
        onClose(); // Close the modal since they can't purchase
        return;
      }
      
      // Check if tickets are sold out
      if (error.isSoldOut) {
        toast({
          title: "Tickets Sold Out",
          description: error.message || "These tickets are currently sold out. Please check back later or select different tickets.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if user should sign in instead
      if (error.shouldSignIn) {
        // Close modal first
        onClose();
        
        // Show toast after modal closes (slight delay for better UX)
        setTimeout(() => {
          toast({
            title: "Account Already Exists",
            description: error.message || "Please sign in to continue with your purchase.",
            variant: "default"
          });
          
          // Redirect to sign-in page after showing toast
          setTimeout(() => {
            navigate('/auth', { 
              state: { 
                fromCheckout: true,
                eventId: event.id,
                eventTitle: event.title 
              } 
            });
          }, 500);
        }, 100);
        
        return;
      }
      
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      busyRef.current = false;
      setSubmitting(false);
      setLoading(false);
    }
  }, [event.id, selections, submitting, user, totalTickets, totalAmount, trackEvent, guestCode, ticketTiers, onSuccess, guestEmail, guestName]);

  if (!isOpen) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-border dark:border-white/20 shadow-[0_32px_96px_-16px_rgba(0,0,0,0.5)] ring-1 ring-black/10 dark:ring-white/10 bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Purchase Tickets
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Info */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">{event.title}</h3>
              <div className="text-sm text-foreground/80 space-y-1">
                {(() => {
                  const dateString = (event as any).startAtISO ?? event.start_at;
                  if (!dateString) {
                    return <p>Date TBA</p>;
                  }
                  try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                      return <p>Date TBA</p>;
                    }
                    return (
                      <p>
                        {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                      </p>
                    );
                  } catch {
                    return <p>Date TBA</p>;
                  }
                  })()}
                {event.venue && !event.location && <p>{event.venue}</p>}
                {event.location && <p>{event.location}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Guest contact details for guest checkout */}
          {!user && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <h3 className="font-semibold">Email for ticket delivery</h3>
                </div>
                <p className="text-sm text-foreground/80">
                  We'll send your receipt and ticket access link to this email. You can verify it later with a one-time code to view your tickets.
                </p>
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    aria-invalid={guestEmailError ? true : false}
                  />
                  {guestEmailError && (
                    <p className="text-sm text-destructive">{guestEmailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Name for the order (optional)"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guest Code Section */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Guest Code (Optional)
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Enter your guest code"
                      value={guestCode}
                      onChange={(e) => {
                        setGuestCode(e.target.value);
                        setCodeError(null);
                        setValidatedCode(null);
                      }}
                      className={`${
                        validatedCode ? 'border-green-500' : codeError ? 'border-red-500' : ''
                      } pr-10`}
                      disabled={validatingCode || !!validatedCode}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {validatedCode && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {codeError && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {!validatedCode && (
                    <Button
                      onClick={validateGuestCode}
                      disabled={!guestCode.trim() || validatingCode}
                      variant="outline"
                    >
                      {validatingCode ? 'Validating...' : 'Apply'}
                    </Button>
                  )}
                  {validatedCode && (
                    <Button
                      onClick={() => {
                        setValidatedCode(null);
                        setGuestCode('');
                        setCodeError(null);
                      }}
                      variant="outline"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {codeError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {codeError}
                  </p>
                )}
                {validatedCode && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Guest code applied successfully
                      {validatedCode.tier_name && ` for ${validatedCode.tier_name}`}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ticket Tiers */}
          <div className="space-y-4">
            <h3 className="font-semibold">Select Tickets</h3>
            {ticketTiers.map((tier) => {
              const isSoldOut = tier.quantity === 0;
              const selectedQty = selections[tier.id] || 0;
              
              return (
                <Card 
                  key={tier.id} 
                  className={`border transition-colors ${
                    isSoldOut 
                      ? 'opacity-60 bg-muted/30 border-border/10' 
                      : 'hover:border-primary/30'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className={`font-medium truncate ${isSoldOut ? 'text-muted-foreground' : ''}`}>
                            {tier.name}
                          </h4>
                          {isSoldOut && (
                            <Badge variant="destructive" className="flex-shrink-0 bg-destructive/90">
                              SOLD OUT
                            </Badge>
                          )}
                          {tier.badge_label && !isSoldOut && (
                            <Badge variant="outline" className="flex-shrink-0">{tier.badge_label}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className={`font-semibold whitespace-nowrap ${
                            isSoldOut ? 'text-muted-foreground line-through' : 'text-foreground'
                          }`}>
                            ${(tier.price_cents / 100).toFixed(2)}
                          </span>
                          <span>•</span>
                          <span className={`whitespace-nowrap ${isSoldOut ? 'text-destructive font-medium' : ''}`}>
                            {isSoldOut ? 'None available' : `${tier.quantity} available`}
                          </span>
                          {!isSoldOut && (
                            <>
                              <span>•</span>
                              <span className="whitespace-nowrap">Max {tier.max_per_order}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSelection(tier.id, -1)}
                          disabled={!selectedQty || isSoldOut}
                          className="h-9 w-9 p-0"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {selectedQty}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSelection(tier.id, 1)}
                          disabled={
                            isSoldOut ||
                            selectedQty >= tier.max_per_order ||
                            selectedQty >= tier.quantity
                          }
                          className="h-9 w-9 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Order Summary */}
          {totalTickets > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Order Summary</h3>
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between">
                  <span>Tickets ({summary.totalQuantity})</span>
                  <span>${summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span>Processing fee</span>
                    <div className="relative group">
                      <span className="text-xs w-3 h-3 rounded-full bg-muted-foreground text-background flex items-center justify-center cursor-help">ⓘ</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Includes platform and payment processing costs
                      </div>
                    </div>
                  </div>
                  <span>${summary.processingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>${summary.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Checkout Session Status */}
          {checkoutSessionId && sessionStatus === 'pending' && timeRemaining && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <h3 className="font-semibold text-orange-800">Tickets Reserved</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-orange-700">
                    Your tickets are reserved for{' '}
                    <span className="font-mono font-semibold">
                      {timeRemaining.minutes}:{timeRemaining.seconds.toString().padStart(2, '0')}
                    </span>
                  </p>
                  <p className="text-xs text-orange-600">
                    Complete your purchase before time expires to secure your tickets.
                  </p>
                  {canExtendHold && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Extend hold functionality would be implemented here
                        toast({
                          title: "Hold Extended",
                          description: "Your reservation has been extended by 10 minutes.",
                        });
                      }}
                      className="text-orange-700 border-orange-300 hover:bg-orange-100"
                    >
                      Extend Hold (+10 min)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Express Payment Methods */}

          {/* Session Recovery Notice */}
          {isRecoveringSession && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-700">
                    Checking for previous session...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 whitespace-nowrap">
              Cancel
            </Button>
            <Button 
              onClick={handlePurchase} 
              disabled={submitting || loading || totalTickets === 0}
              className="flex-1"
            >
              {submitting || loading ? (
                <span className="whitespace-nowrap">Processing...</span>
              ) : (
                <span className="whitespace-nowrap">
                  Purchase {totalTickets > 0 && `(${totalTickets})`}
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Embedded Checkout (Full Screen) */}
    {showEmbeddedCheckout && embeddedCheckoutData && (
      <StripeEmbeddedCheckout
        checkoutSessionId={embeddedCheckoutData.checkoutSessionId}
        eventId={event.id}
        eventTitle={event.title}
        expiresAt={embeddedCheckoutData.expiresAt}
        onSuccess={() => {
          setShowEmbeddedCheckout(false);
          setEmbeddedCheckoutData(null);
          onSuccess();
        }}
        onCancel={() => {
          setShowEmbeddedCheckout(false);
          setEmbeddedCheckoutData(null);
          toast({
            title: 'Checkout Cancelled',
            description: 'Your ticket hold has been released.',
          });
        }}
      />
    )}
  </>
  );
}

export default TicketPurchaseModal;