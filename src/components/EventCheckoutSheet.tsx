import { useEffect, useMemo, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { AlertCircle, AlertTriangle, ArrowLeft, Clock, CreditCard, Minus, Plus, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createGuestCheckoutSession } from "@/lib/ticketApi";
import { useTicketDetailTracking } from "@/hooks/usePurchaseIntentTracking";

/*****
 * Single-screen purchase flow that merges:
 *  - Event info + live inventory
 *  - Ticket selection
 *  - Contact (optional) + Inline review
 *  - Stripe Embedded Checkout
 *
 * Notes:
 *  - Creates a hold + Stripe Session via `enhanced-checkout` function
 *  - Then fetches/uses the Checkout `client_secret` directly from the same response
 *  - Sticky timer bar appears once a session is created
 *****/

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

// Animation presets
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const slideUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 } };
const springy = { type: "spring", stiffness: 380, damping: 30, mass: 0.6 } as const;

export interface Event {
  id: string;
  title: string;
  start_at?: string;
  startAtISO?: string;
  venue?: string;
  address?: string;
  description?: string;
}

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  badge_label?: string;
  quantity: number; // remaining availability after reserved/issued deduction
  max_per_order: number;
  // internal, computed for UI
  totalCapacity?: number;
  reserved?: number;
  issued?: number;
}

interface Props {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "select" | "pay";

export default function EventCheckoutSheet({ event, isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { trackTicketView } = useTicketDetailTracking();
  const [step, setStep] = useState<Step>("select");
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selections, setSelections] = useState<Record<string, number>>({});

  // Guest checkout fields
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Stripe embedded session
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Stable onComplete handler (not used due to redirect_on_completion: always)
  const handleComplete = useCallback(() => {
    onSuccess();
    toast({ title: "Payment complete" });
  }, [onSuccess]);

  // Memoize checkout options - don't include onComplete since Stripe redirects automatically
  const checkoutOptions = useMemo(() => {
    if (!clientSecret) return null;
    return { clientSecret };
  }, [clientSecret]);

  const [now, setNow] = useState<number>(Date.now());

  const dateStr = event?.startAtISO ?? event?.start_at ?? null;
  const isPast = useMemo(() => {
    if (!dateStr) return false;
    const t = Date.parse(dateStr);
    return Number.isFinite(t) ? t < Date.now() : false;
  }, [dateStr]);

  // Tick the timer every second once a session exists
  useEffect(() => {
    if (!clientSecret) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [clientSecret]);

  // Fetch tiers whenever dialog opens for an event
  useEffect(() => {
    if (!event?.id || !isOpen) return;
    
    // 🎯 Track ticket detail view (high purchase intent signal)
    trackTicketView(event.id);
    console.log('[Purchase Intent] 🎫 Tracked ticket view for:', event.id);
    
    void fetchTiers();
    setStep("select");
    setSelections({});
    setClientSecret(null);
    setCheckoutSessionId(null);
    setExpiresAt(null);
  }, [event?.id, isOpen, trackTicketView]);

  const fetchTiers = async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ticket_tiers")
        .select("id, name, price_cents, badge_label, quantity, max_per_order, reserved_quantity, issued_quantity")
        .eq("event_id", event.id)
        .order("price_cents", { ascending: true });

      if (error) throw error;

      const mapped: TicketTier[] = (data || []).map((t: any) => {
        const total = t.quantity || 0;
        const reserved = t.reserved_quantity || 0;
        const issued = t.issued_quantity || 0;
        const available = Math.max(0, total - reserved - issued);
        return {
          id: t.id,
          name: t.name,
          price_cents: t.price_cents,
          badge_label: t.badge_label ?? undefined,
          quantity: available,
          max_per_order: t.max_per_order,
          totalCapacity: total,
          reserved,
          issued,
        };
      });

      setTiers(mapped);
    } catch (e) {
      console.error("tiers load error", e);
      toast({ title: "Couldn't load tickets", description: "Please try again in a moment.", variant: "destructive" });
      setTiers([]);
    } finally {
      setLoading(false);
    }
  };

  const totalQty = useMemo(() => Object.values(selections).reduce((a, b) => a + b, 0), [selections]);
  const subtotalCents = useMemo(() => {
    return tiers.reduce((sum, t) => sum + (selections[t.id] || 0) * t.price_cents, 0);
  }, [tiers, selections]);

  // Calculate fees upfront (6.6% + $2.19 per transaction - matches edge function)
  const pricing = useMemo(() => {
    const subtotal = subtotalCents;
    const faceValue = subtotal / 100; // Convert to dollars
    const fee = faceValue * 0.066 + 2.19; // 6.6% + $2.19
    const fees = Math.round(fee * 100); // Convert back to cents
    const total = subtotal + fees;
    return { subtotalCents: subtotal, feesCents: fees, totalCents: total };
  }, [subtotalCents]);

  const canProceed = totalQty > 0 && !isPast && !loading;

  const updateQty = (tierId: string, next: number, tier: TicketTier) => {
    const clamped = Math.max(0, Math.min(next, Math.min(tier.max_per_order, tier.quantity)));
    setSelections((prev) => ({ ...prev, [tierId]: clamped }));
  };

  const startCheckout = async () => {
    if (!event?.id) return;
    
    // Validate guest email if not authenticated
    if (!user) {
      setEmailError(null);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!guestEmail || !emailRegex.test(guestEmail)) {
        setEmailError("Please enter a valid email address");
        toast({ title: "Email required", description: "Please provide your email to continue", variant: "destructive" });
        return;
      }
      if (!guestName || guestName.trim().length < 2) {
        toast({ title: "Name required", description: "Please provide your name to continue", variant: "destructive" });
        return;
      }
    }

    console.log("🎫 Starting checkout...", { event: event.id, selections, isGuest: !user });
    
    // Build selections -> API payload
    const ticketSelections = Object.entries(selections)
      .filter(([_, q]) => q > 0)
      .map(([tierId, quantity]) => {
        const tier = tiers.find((t) => t.id === tierId)!;
        return { tierId, quantity, faceValue: tier.price_cents / 100 };
      });

    if (!ticketSelections.length) {
      console.warn("❌ No tickets selected");
      toast({ title: "Select tickets", description: "Choose at least 1 ticket to continue", variant: "destructive" });
      return;
    }

    // Switch to pay step immediately for faster perceived speed
    setStep("pay");
    setCreating(true);
    
    try {
      let data: any;
      let error: any;

      if (user) {
        // Authenticated checkout
        console.log("📞 Calling enhanced-checkout (authenticated)...", { eventId: event.id, ticketSelections });
        const response = await supabase.functions.invoke("enhanced-checkout", {
          body: {
            eventId: event.id,
            ticketSelections,
          },
        });
        data = response.data;
        error = response.error;
      } else {
        // Guest checkout
        console.log("📞 Calling guest-checkout...", { event_id: event.id, contact_email: guestEmail });
        try {
          const items = ticketSelections.map(sel => ({
            tier_id: sel.tierId,
            quantity: sel.quantity,
            unit_price_cents: Math.round(sel.faceValue * 100)
          }));
          
          data = await createGuestCheckoutSession({
            event_id: event.id,
            items,
            contact_email: guestEmail,
            contact_name: guestName,
          });
        } catch (e: any) {
          error = e;
        }
      }

      console.log("📦 Checkout response:", { data, error });

      if (error) throw error;

      // The edge function returns client_secret, checkout_session_id, expires_at, etc.
      if (!data?.client_secret) {
        console.error("❌ No client_secret in response:", data);
        throw new Error("No client secret returned");
      }

      console.log("✅ Setting session data:", {
        clientSecret: data.client_secret ? "present" : "missing",
        checkoutSessionId: data.checkout_session_id,
        expiresAt: data.expires_at,
      });

      setClientSecret(data.client_secret);
      setCheckoutSessionId(data.checkout_session_id ?? null);
      setExpiresAt(data.expires_at ?? null);

      console.log("✅ Checkout session ready");

      toast({ title: "Tickets held", description: "Your tickets are reserved while you complete checkout." });
    } catch (e: any) {
      console.error("❌ startCheckout error:", e);
      setStep("select"); // Go back to select on error
      
      // ✅ Handle specific error cases
      // Note: With updated guest-checkout, "user exists" should no longer block purchases
      if (e?.shouldSignIn) {
        toast({ 
          title: "Account exists", 
          description: "An account with this email exists. Please sign in to continue.",
          variant: "destructive" 
        });
        return;
      }
      
      const msg = e?.message || "Failed to start checkout";
      toast({ title: "Checkout unavailable", description: msg, variant: "destructive" });
      
      // If sold out or event ended, refresh tiers to reflect reality
      void fetchTiers();
    } finally {
      setCreating(false);
    }
  };

  const timeRemaining = useMemo(() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds, totalMs: diff, isExpiring: diff < 60_000, isUrgent: diff < 30_000 };
  }, [expiresAt, now]);

  // Auto-cancel back to selection if session expires
  useEffect(() => {
    if (clientSecret && timeRemaining === null) {
      toast({ title: "Checkout expired", description: "Your ticket hold expired. Please select tickets again.", variant: "destructive" });
      setClientSecret(null);
      setCheckoutSessionId(null);
      setExpiresAt(null);
      setStep("select");
      void fetchTiers();
    }
  }, [clientSecret, timeRemaining]);

  const Price = ({ cents }: { cents: number }) => <span className="font-semibold">${(cents / 100).toFixed(2)}</span>;

  if (!event) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] sm:max-w-4xl max-h-[calc(100vh-80px)] overflow-y-auto p-0 rounded-2xl shadow-[0_32px_96px_-16px_rgba(0,0,0,0.5)] border-2 border-border dark:border-white/20 ring-1 ring-black/10 dark:ring-white/10 mb-20 bg-background">
        <DialogTitle className="sr-only">
          Purchase tickets for {event.title}
        </DialogTitle>
        {/* Sticky header (with timer once a checkout exists) */}
        <motion.div
          variants={fade}
          initial="initial"
          animate="animate"
          className={`sticky top-0 z-50 border-b px-4 py-3 backdrop-blur-md flex items-center justify-between gap-3 ${
            timeRemaining?.isUrgent
              ? "bg-destructive/95 border-destructive text-white"
              : timeRemaining?.isExpiring
              ? "bg-amber-500/95 border-amber-600 text-white"
              : "bg-card/95 border-border"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Ticket className="w-4 h-4 shrink-0" />
            <div className="truncate">
              <div className="font-semibold truncate">{event.title}</div>
              {dateStr && !isNaN(new Date(dateStr).getTime()) && (
                <div className="text-xs opacity-70 truncate">
                  {new Date(dateStr).toLocaleDateString()} • {new Date(dateStr).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {clientSecret ? (
            <div className="flex items-center gap-2">
              {timeRemaining ? (
                <div className="flex items-center gap-2">
                  {timeRemaining.isExpiring ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  <div className={`px-3 py-1 rounded-lg font-mono font-bold ${timeRemaining.isUrgent ? "bg-white/20 animate-pulse" : "bg-primary/10"}`}>
                    {timeRemaining.minutes}:{String(timeRemaining.seconds).padStart(2, "0")}
                  </div>
                </div>
              ) : (
                <span className="text-xs">Session ended</span>
              )}

              <Button size="sm" variant="ghost" onClick={() => setStep("select")} className={timeRemaining?.isExpiring ? "text-white hover:bg-white/10" : ""}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </motion.div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 pb-24">
          {/* Left: content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Event card */}
            <Card className="p-4">
              <div className="text-sm text-muted-foreground space-y-1">
                {event.venue && !event.address && <p>{event.venue}</p>}
                {event.address && <p>{event.address}</p>}
              </div>
              {event.description && <p className="text-sm text-muted-foreground mt-2">{event.description}</p>}
            </Card>

            {/* Guest checkout fields */}
            {!user && step === "select" && (
              <Card className="p-4 space-y-4 border-primary/30 bg-primary/5">
                <div>
                  <h3 className="font-semibold mb-2">Your Information</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter your details to continue with checkout
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="guest-email">Email *</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      placeholder="your@email.com"
                      value={guestEmail}
                      onChange={(e) => {
                        setGuestEmail(e.target.value);
                        setEmailError(null);
                      }}
                      className={emailError ? "border-destructive" : ""}
                    />
                    {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
                  </div>
                  <div>
                    <Label htmlFor="guest-name">Full Name *</Label>
                    <Input
                      id="guest-name"
                      type="text"
                      placeholder="Your full name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                  </div>
                </div>
              </Card>
            )}

            {isPast && (
              <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
                Sales ended — this event has already started or ended.
              </div>
            )}

            {/* Step: select tickets */}
            <AnimatePresence mode="wait">
              {step === "select" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Select Tickets</h3>
                  <Button variant="ghost" size="sm" onClick={fetchTiers} disabled={loading}>
                    Refresh
                  </Button>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="p-4 border rounded-lg bg-muted/30 animate-pulse">
                        <div className="h-5 w-1/3 bg-muted rounded mb-3" />
                        <div className="h-4 w-1/2 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : tiers.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">No tickets available for this event.</div>
                ) : (
                  <div className="space-y-3">
                    {/* Global sold-out notice */}
                    {tiers.every((t) => t.quantity === 0) && !isPast && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-destructive mb-1">All Tickets Sold Out</h4>
                          <p className="text-sm text-muted-foreground">All tickets are currently sold out. More may be released later.</p>
                        </div>
                      </div>
                    )}

                    {tiers.map((tier, idx) => {
                      const isSoldOut = tier.quantity === 0;
                      const qty = selections[tier.id] || 0;

                      return (
                        <motion.div key={tier.id} variants={slideUp} initial="initial" animate="animate" transition={{ ...springy, delay: idx * 0.03 }}>
                          <Card className={`p-4 border transition-colors ${isPast || isSoldOut ? "opacity-60 bg-muted/30" : "hover:border-primary/50"}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`font-medium ${isSoldOut ? "text-muted-foreground" : ""}`}>{tier.name}</div>
                                  {isSoldOut && <Badge variant="danger" className="bg-destructive/90">SOLD OUT</Badge>}
                                  {tier.badge_label && !isSoldOut && <Badge variant="neutral">{tier.badge_label}</Badge>}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className={`${isSoldOut ? "line-through" : "text-foreground"}`}><Price cents={tier.price_cents} /></span>
                                  <span className={isSoldOut ? "text-destructive font-medium" : ""}>{isSoldOut ? "None available" : `${tier.quantity} available`}</span>
                                  {!isSoldOut && <span>Max {tier.max_per_order} / order</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button size="icon" variant="outline" disabled={qty <= 0 || isSoldOut || isPast} onClick={() => updateQty(tier.id, qty - 1, tier)}>
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <Input readOnly value={qty} className="w-12 text-center" />
                                <Button size="icon" variant="outline" disabled={isSoldOut || isPast || qty >= Math.min(tier.max_per_order, tier.quantity)} onClick={() => updateQty(tier.id, qty + 1, tier)}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </AnimatePresence>

            {/* Step: pay (embedded checkout) */}
            <AnimatePresence mode="wait">
              {step === "pay" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold">Secure Checkout</h3>
                  
                  {creating || !checkoutOptions ? (
                    // Loading skeleton while creating session
                    <div className="space-y-4 animate-pulse">
                      <div className="h-12 bg-muted rounded" />
                      <div className="h-64 bg-muted rounded" />
                      <div className="h-12 bg-muted rounded" />
                      <div className="flex justify-center py-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                          <span className="text-sm">Preparing secure checkout...</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: order summary + actions */}
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="font-semibold">Order Summary</div>
              <Separator />

              <div className="space-y-2 text-sm">
                {Object.entries(selections).filter(([_, q]) => q > 0).length === 0 ? (
                  <div className="text-muted-foreground">No tickets selected yet.</div>
                ) : (
                  Object.entries(selections)
                    .filter(([_, q]) => q > 0)
                    .map(([tierId, q]) => {
                      const t = tiers.find((x) => x.id === tierId)!;
                      return (
                        <div key={tierId} className="flex items-center justify-between">
                          <span className="truncate">{t.name} × {q}</span>
                          <span><Price cents={t.price_cents * q} /></span>
                        </div>
                      );
                    })
                )}
              </div>

              {totalQty > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <Price cents={pricing.subtotalCents} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Processing Fee</span>
                      <Price cents={pricing.feesCents} />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-semibold text-base">
                    <span>Total</span>
                    <Price cents={pricing.totalCents} />
                  </div>
                </>
              )}

              {step === "select" && (
                <Button className="w-full" onClick={startCheckout} disabled={!canProceed || creating || tiers.every((t) => t.quantity === 0)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {creating ? "Starting checkout…" : "Proceed to payment"}
                </Button>
              )}

              {step === "pay" && (
                <Button variant="outline" className="w-full" onClick={() => setStep("select")}>Edit selection</Button>
              )}

              <Button variant="ghost" className="w-full" onClick={onClose}>Cancel</Button>
            </Card>

            {timeRemaining?.isExpiring && (
              <Card className="border-destructive bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-destructive mb-1">{timeRemaining.isUrgent ? "Checkout Expiring!" : "Time Running Out"}</h4>
                    <p className="text-sm text-muted-foreground">{timeRemaining.isUrgent ? "Complete payment in the next 30 seconds to secure your tickets!" : "Less than 1 minute remaining. Complete your payment now!"}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
