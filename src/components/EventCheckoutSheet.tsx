import { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { AnimatePresence, motion } from "framer-motion";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  CreditCard,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createGuestCheckoutSession } from "@/lib/ticketApi";
import { useTicketDetailTracking } from "@/hooks/usePurchaseIntentTracking";
import { calculateFees, getFeeDescription } from "@/lib/pricing";
import { getUserFriendlyError, shouldPromptSignIn, isRetryableError } from "@/lib/errorMessages";

/**
 * Single-screen purchase flow that merges:
 *  - Event info + live inventory
 *  - Ticket selection
 *  - Contact (optional) + Inline review
 *  - Stripe Payment Element (custom checkout UI)
 *
 * Notes:
 *  - Creates a hold + Stripe Session via `enhanced-checkout` or `guest-checkout`
 *  - Uses PaymentIntent client_secret to render PaymentElement
 *  - Sticky timer bar appears once a session is created
 */

// Disable Stripe Assistant (developer tool) in a supported way
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
  {
    developerTools: {
      assistant: { enabled: false },
    },
  } as Parameters<typeof loadStripe>[1]
);

// Animation presets
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const slideUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
};
const springy = { type: "spring", stiffness: 380, damping: 30, mass: 0.6 } as const;


// -------------------- Types --------------------

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

// -------------------- PaymentForm (Payment Element) --------------------

function PaymentForm({
  onSuccess,
  totalCents,
  eventId,
  paymentIntentId,
}: {
  onSuccess: () => void;
  totalCents: number;
  eventId: string | null;
  paymentIntentId: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Track interaction with the PaymentElement so we can suppress its internal
  // inline errors until the user actually touches the fields
  useEffect(() => {
    if (!elements) return;

    const paymentElement = elements.getElement("payment");
    if (!paymentElement) return;

    const handleChange = (event: any) => {
      // Any value / completeness counts as interaction
      if (event.complete || event.value) {
        setHasInteracted(true);
      }
      // We do NOT pipe event.error into submitError here.
      // PaymentElement will show its own inline error once hasInteracted=true.
    };

    const handleFocus = () => {
      setHasInteracted(true);
    };

    paymentElement.on("change", handleChange);
    paymentElement.on("focus", handleFocus);

    return () => {
      paymentElement.off("change", handleChange);
      paymentElement.off("focus", handleFocus);
    };
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // User definitely interacted (clicked Pay)
    setHasInteracted(true);
    setIsProcessing(true);
    setSubmitError(null);

    try {
      // Extract payment intent ID from client secret if not provided
      let actualPaymentIntentId = paymentIntentId;
      if (!actualPaymentIntentId && stripe) {
        // Extract from client secret format: pi_xxx_secret_yyy
        const secretMatch = elements?.getElement("payment")?.clientSecret?.match(/^pi_[^_]+/);
        if (secretMatch) {
          actualPaymentIntentId = secretMatch[0];
        }
      }

      if (!actualPaymentIntentId) {
        setSubmitError("Something went wrong. Please try again.");
        setIsProcessing(false);
        return;
      }

      const params = new URLSearchParams({
        payment_intent: actualPaymentIntentId,
      });
      if (eventId) params.set("event_id", eventId);

      const returnUrl = `${siteUrl}/purchase-success?${params.toString()}`;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      });

      if (error) {
        // Show user-friendly error message for payment errors
        const friendlyError = getUserFriendlyError(error);
        setSubmitError(friendlyError.message);
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        // Payment succeeded - manually redirect since redirect: "if_required" 
        // only redirects for payment methods that require it (like 3D Secure)
        window.location.href = returnUrl;
      }
    } catch (err: any) {
      const friendlyError = getUserFriendlyError(err);
      setSubmitError(friendlyError.message);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Wrap the PaymentElement so we can hide its inline errors until interaction */}
      <div className={hasInteracted ? "" : "pe-hide-errors"}>
        <PaymentElement
          options={{
            // Let Stripe handle billing details automatically
            // It will collect them if required by the payment method
          }}
        />
      </div>

      {/* Scoped CSS: hide Stripe's inline error text until hasInteracted === true */}
      <style>{`
        .pe-hide-errors [role="alert"],
        .pe-hide-errors [class*="Error"],
        .pe-hide-errors [class*="error"],
        .pe-hide-errors [id*="error"],
        .pe-hide-errors .FieldError,
        .pe-hide-errors .FieldError--visible,
        .pe-hide-errors [data-testid*="error"],
        .pe-hide-errors .ErrorMessage {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          top: -9999px !important;
        }
      `}</style>

      {/* BIG red banner: only for submit/confirm errors, never on initial mount */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {(totalCents / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

// -------------------- Main sheet --------------------

export default function EventCheckoutSheet({
  event,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const { theme, resolvedTheme } = useTheme();
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

  // Stripe session
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [now, setNow] = useState<number>(Date.now());

  const dateStr = event?.startAtISO ?? event?.start_at ?? null;
  const isPast = useMemo(() => {
    if (!dateStr) return false;
    const t = Date.parse(dateStr);
    return Number.isFinite(t) ? t < Date.now() : false;
  }, [dateStr]);

  const handleComplete = useCallback(() => {
    onSuccess();
    toast({ title: "Payment complete" });
  }, [onSuccess]);

  // Theme for Stripe Elements (night / stripe)
  const effectiveThemeName = useMemo(
    () => ((resolvedTheme || theme) === "dark" ? "night" : "stripe"),
    [theme, resolvedTheme]
  );

  const elementsOptions: StripeElementsOptions = useMemo(() => {
    if (!clientSecret) return {};
    return {
      clientSecret,
      appearance: {
        theme: effectiveThemeName,
        variables:
          effectiveThemeName === "night"
            ? {
                colorPrimary: "#0085FF",
                colorBackground: "#0f0f0f",
                colorText: "#ffffff",
                colorDanger: "#F23154",
                colorTextSecondary: "#8C99AD",
                colorTextPlaceholder: "#5A6474",
                colorIcon: "#C9CED8",
                colorIconHover: "#ffffff",
                colorSeparator: "#2B3039",
                colorInputBackground: "#1B1E25",
                colorInputBorder: "#2B3039",
                colorSuccess: "#3EAE20",
                colorWarning: "#F27400",
                colorInfo: "#0085FF",
              }
            : {
                colorPrimary: "#0085FF",
              },
      },
    };
  }, [clientSecret, effectiveThemeName]);

  // Update countdown once clientSecret exists
  useEffect(() => {
    if (!clientSecret) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [clientSecret]);

  // Load ticket tiers when opened
  useEffect(() => {
    if (!event?.id || !isOpen) return;

    trackTicketView(event.id);

    void fetchTiers();
    setStep("select");
    setSelections({});
    setClientSecret(null);
    setPaymentIntentId(null);
    setCheckoutSessionId(null);
    setExpiresAt(null);
  }, [event?.id, isOpen, trackTicketView]);

  const fetchTiers = async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ticket_tiers")
        .select(
          "id, name, price_cents, badge_label, quantity, max_per_order, reserved_quantity, issued_quantity"
        )
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
      toast({
        title: "Couldn't load tickets",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      setTiers([]);
    } finally {
      setLoading(false);
    }
  };

  const totalQty = useMemo(
    () => Object.values(selections).reduce((a, b) => a + b, 0),
    [selections]
  );

  const subtotalCents = useMemo(
    () =>
      tiers.reduce(
        (sum, t) => sum + (selections[t.id] || 0) * t.price_cents,
        0
      ),
    [tiers, selections]
  );

  // Calculate fees with Stripe gross-up (organizer gets 100% of faceValue)
  const pricing = useMemo(() => {
    const faceValue = subtotalCents / 100;
    const fees = calculateFees(faceValue);
    
    return {
      subtotalCents: subtotalCents,
      feesCents: Math.round(fees.processingFee * 100),
      totalCents: Math.round(fees.total * 100),
    };
  }, [subtotalCents]);

  const canProceed = totalQty > 0 && !isPast && !loading;

  const updateQty = (tierId: string, next: number, tier: TicketTier) => {
    const clamped = Math.max(
      0,
      Math.min(next, Math.min(tier.max_per_order, tier.quantity))
    );
    setSelections((prev) => ({ ...prev, [tierId]: clamped }));
  };

  const startCheckout = async () => {
    if (!event?.id) return;

    // Validate guest info
    if (!user) {
      setEmailError(null);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!guestEmail || !emailRegex.test(guestEmail)) {
        setEmailError("Please enter a valid email address");
        toast({
          title: "Email required",
          description: "Please provide your email to continue",
          variant: "destructive",
        });
        return;
      }

      if (!guestName || guestName.trim().length < 2) {
        toast({
          title: "Name required",
          description: "Please provide your name to continue",
          variant: "destructive",
        });
        return;
      }
    }

    // Starting checkout

    const ticketSelections = Object.entries(selections)
      .filter(([_, q]) => q > 0)
      .map(([tierId, quantity]) => {
        const tier = tiers.find((t) => t.id === tierId)!;
        return { tierId, quantity, faceValue: tier.price_cents / 100 };
      });

    if (!ticketSelections.length) {
      toast({
        title: "Select tickets",
        description: "Choose at least 1 ticket to continue",
        variant: "destructive",
      });
      return;
    }

    const themeForApi =
      (resolvedTheme || theme) === "dark" ? "dark" : "light";

    setStep("pay");
    setCreating(true);

    try {
      let data: any;
      let error: any;

      if (user) {
        const response = await supabase.functions.invoke("enhanced-checkout", {
          body: {
            eventId: event.id,
            ticketSelections,
            theme: themeForApi,
          },
        });
        data = response.data;
        error = response.error;
      } else {
        try {
          const items = ticketSelections.map((sel) => ({
            tier_id: sel.tierId,
            quantity: sel.quantity,
            unit_price_cents: Math.round(sel.faceValue * 100),
          }));

          data = await createGuestCheckoutSession({
            event_id: event.id,
            items,
            contact_email: guestEmail,
            contact_name: guestName,
            theme: themeForApi,
          });
        } catch (e: any) {
          error = e;
        }
      }

      if (error) throw error;

      // ✅ Handle FREE TICKETS - no payment needed, just close modal
      if (data?.free_order) {
        toast({
          title: "Tickets Claimed! 🎉",
          description: `${data.tickets_issued || 'Your'} free ticket${(data.tickets_issued || 0) > 1 ? 's have' : ' has'} been added to your account.`,
        });
        // Don't call onSuccess() - no checkout redirect needed for free tickets
        onClose();
        return;
      }

      let clientSecretValue = data?.client_secret || data?.clientSecret;
      if (!clientSecretValue) {
        throw new Error("No client secret returned");
      }

      if (clientSecretValue.includes("%")) {
        try {
          clientSecretValue = decodeURIComponent(clientSecretValue);
        } catch (e) {
          // Failed to decode, using as-is
        }
      }

      setClientSecret(clientSecretValue);
      setPaymentIntentId(data.payment_intent_id || data.paymentIntentId || null);
      setCheckoutSessionId(
        data.checkout_session_id || data.checkoutSessionId || null
      );
      setExpiresAt(data.expires_at || data.expiresAt || null);
    } catch (e: any) {
      // Checkout error - show user-friendly message
      setStep("select");

      // Check if user should sign in
      if (e?.shouldSignIn || shouldPromptSignIn(e)) {
        toast({
          title: "Account Exists",
          description: "An account with this email already exists. Please sign in.",
          variant: "destructive",
        });
        return;
      }

      // Get user-friendly error message (never show raw errors)
      const { title, message } = getUserFriendlyError(e);
      
      toast({
        title,
        description: message,
        variant: "destructive",
      });

      // Refresh ticket availability if error might be availability-related
      if (isRetryableError(e)) {
        void fetchTiers();
      }
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

    return {
      minutes,
      seconds,
      totalMs: diff,
      isExpiring: diff < 60_000,
      isUrgent: diff < 30_000,
    };
  }, [expiresAt, now]);

  // Auto-reset when session expires
  useEffect(() => {
    if (clientSecret && timeRemaining === null) {
      toast({
        title: "Checkout expired",
        description: "Your ticket hold expired. Please select tickets again.",
        variant: "destructive",
      });
      setClientSecret(null);
      setCheckoutSessionId(null);
      setExpiresAt(null);
      setStep("select");
      void fetchTiers();
    }
  }, [clientSecret, timeRemaining]);

  const Price = ({ cents }: { cents: number }) => (
    <span className="font-semibold">${(cents / 100).toFixed(2)}</span>
  );

  if (!event) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-full max-h-[100vh] h-[100vh] sm:h-auto sm:w-[98vw] sm:max-w-4xl sm:max-h-[calc(100vh-72px)] p-0 overflow-hidden rounded-none sm:rounded-3xl border border-border/70 bg-gradient-to-b from-background via-background to-background/95 shadow-[0_28px_80px_rgba(15,23,42,0.45)] dark:border-white/15 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-[48%] data-[state=open]:slide-in-from-bottom-[48%] data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-300"
        style={{
          maxHeight: "calc(100vh - var(--bottom-nav-safe, 4.5rem))",
          height: "calc(100vh - var(--bottom-nav-safe, 4.5rem))",
        }}
        aria-describedby="checkout-description"
      >
        <DialogTitle className="sr-only">
          Purchase tickets for {event.title}
        </DialogTitle>
        <DialogDescription
          id="checkout-description"
          className="sr-only"
        >
          Secure checkout for {event.title || "event tickets"}. Select your
          tickets and complete payment.
        </DialogDescription>

        {/* Sticky header with timer */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className={`sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-3 lg:px-6 backdrop-blur-xl ${
            timeRemaining?.isUrgent
              ? "bg-destructive/95 border-destructive text-destructive-foreground"
              : timeRemaining?.isExpiring
              ? "bg-amber-500/95 border-amber-600 text-amber-50"
              : "bg-background/95 border-border/60"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{event.title}</div>
              {dateStr && !isNaN(new Date(dateStr).getTime()) && (
                <div className="truncate text-xs text-muted-foreground/80">
                  {new Date(dateStr).toLocaleDateString()} •{" "}
                  {new Date(dateStr).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>

          {clientSecret ? (
            <div className="flex items-center gap-3">
              {timeRemaining ? (
                <div className="flex items-center gap-2">
                  {timeRemaining.isExpiring ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  <div
                    className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                      timeRemaining.isUrgent
                        ? "bg-white/20 text-white animate-pulse"
                        : "bg-primary/10 text-foreground"
                    }`}
                  >
                    {timeRemaining.minutes}:
                    {String(timeRemaining.seconds).padStart(2, "0")}
                  </div>
                </div>
              ) : (
                <span className="text-xs opacity-80">Session ended</span>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep("select")}
                className={
                  timeRemaining?.isExpiring
                    ? "text-inherit hover:bg-white/10"
                    : ""
                }
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:h-auto">
          <div
            className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(var(--bottom-nav-safe,4.5rem)+2rem)] sm:pb-6"
            style={{ scrollPaddingBottom: "var(--bottom-nav-safe, 4.5rem)" }}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {/* Left column */}
              <div className="space-y-4 lg:space-y-5">
                {/* Guest info */}
                {!user && step === "select" && (
                  <Card className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                    <div>
                      <h3 className="mb-2 font-semibold">Your Information</h3>
                      <p className="mb-3 text-sm text-muted-foreground sm:text-base">
                        Enter your details to continue with checkout
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label
                          htmlFor="guest-email"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Email *
                        </Label>
                        <Input
                          id="guest-email"
                          type="email"
                          placeholder="your@email.com"
                          value={guestEmail}
                          onChange={(e) => {
                            setGuestEmail(e.target.value);
                            setEmailError(null);
                          }}
                          className={`mt-1 h-10 text-sm ${
                            emailError ? "border-destructive" : ""
                          }`}
                        />
                        {emailError && (
                          <p className="mt-1 text-sm text-destructive">
                            {emailError}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label
                          htmlFor="guest-name"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Full Name *
                        </Label>
                        <Input
                          id="guest-name"
                          type="text"
                          placeholder="Your full name"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="mt-1 h-10 text-sm"
                        />
                      </div>
                    </div>
                  </Card>
                )}

                {isPast && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    Sales ended — this event has already started or ended.
                  </div>
                )}

                {/* Step: select tickets */}
                <AnimatePresence mode="wait">
                  {step === "select" && (
                    <div className="space-y-4 pb-32 lg:pb-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Select Tickets</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={fetchTiers}
                          disabled={loading}
                        >
                          Refresh
                        </Button>
                      </div>

                      {loading ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="animate-pulse rounded-lg border bg-muted/30 p-4"
                            >
                              <div className="mb-3 h-5 w-1/3 rounded bg-muted" />
                              <div className="h-4 w-1/2 rounded bg-muted" />
                            </div>
                          ))}
                        </div>
                      ) : tiers.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground">
                          No tickets available for this event.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tiers.every((t) => t.quantity === 0) && !isPast && (
                            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                              <div>
                                <h4 className="mb-1 font-semibold text-destructive">
                                  All Tickets Sold Out
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  All tickets are currently sold out. More may
                                  be released later.
                                </p>
                              </div>
                            </div>
                          )}

                          {tiers.map((tier, idx) => {
                            const isSoldOut = tier.quantity === 0;
                            const qty = selections[tier.id] || 0;

                            return (
                              <motion.div
                                key={tier.id}
                                variants={slideUp}
                                initial="initial"
                                animate="animate"
                                transition={{ ...springy, delay: idx * 0.03 }}
                              >
                                <Card
                                  className={`group rounded-2xl border p-4 transition-all duration-150 ${
                                    qty > 0
                                      ? "border-primary/60 bg-primary/5"
                                      : isPast || isSoldOut
                                        ? "bg-muted/30 opacity-60"
                                        : "bg-card/95 hover:border-primary/50 hover:bg-card/100"
                                  }`}
                                >
                                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                    <div className="min-w-0">
                                      <div className="mb-1 flex items-center gap-2">
                                        <div
                                          className={`font-medium ${
                                            isSoldOut
                                              ? "line-through text-muted-foreground"
                                              : ""
                                          }`}
                                        >
                                          {tier.name}
                                        </div>
                                        {isSoldOut && (
                                          <Badge
                                            variant="danger"
                                            className="text-[10px] uppercase tracking-wide"
                                          >
                                            Sold out
                                          </Badge>
                                        )}
                                        {tier.badge_label && !isSoldOut && (
                                          <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary">
                                            {tier.badge_label}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:text-sm">
                                        <span
                                          className={
                                            isSoldOut
                                              ? "line-through"
                                              : "font-semibold text-foreground"
                                          }
                                        >
                                          <Price cents={tier.price_cents} />
                                        </span>
                                        <span>
                                          {isSoldOut
                                            ? "None available"
                                            : `${tier.quantity} left`}
                                        </span>
                                        {!isSoldOut && (
                                          <span className="text-xs text-muted-foreground/80">
                                            Max {tier.max_per_order} per order
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="rounded-full"
                                        disabled={
                                          qty <= 0 || isSoldOut || isPast
                                        }
                                        onClick={() =>
                                          updateQty(
                                            tier.id,
                                            qty - 1,
                                            tier
                                          )
                                        }
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <div className="min-w-[3rem] rounded-full bg-muted/60 px-3 py-1 text-center font-mono text-sm">
                                        {qty}
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="rounded-full"
                                        disabled={
                                          isSoldOut ||
                                          isPast ||
                                          qty >=
                                            Math.min(
                                              tier.max_per_order,
                                              tier.quantity
                                            )
                                        }
                                        onClick={() =>
                                          updateQty(
                                            tier.id,
                                            qty + 1,
                                            tier
                                          )
                                        }
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Order summary - inline on mobile */}
                      {totalQty > 0 && (
                        <Card className="mt-4 rounded-2xl border bg-card/95 p-4 lg:hidden">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Tickets ({totalQty})</span>
                              <span>${(pricing.subtotalCents / 100).toFixed(2)}</span>
                            </div>
                            {pricing.feesCents > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Processing fee</span>
                                <span>${(pricing.feesCents / 100).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>
                  )}
                </AnimatePresence>

                {/* Step: pay (Payment Element) */}
                <AnimatePresence mode="wait">
                  {step === "pay" && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <h3 className="font-semibold">Secure Checkout</h3>

                      {/* Mobile summary */}
                      {totalQty > 0 && (
                        <Card className="mb-3 rounded-2xl border bg-card/90 p-4 lg:hidden">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Tickets</span>
                              <span>${(pricing.subtotalCents / 100).toFixed(2)}</span>
                            </div>
                            {pricing.feesCents > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Processing fee</span>
                                <span>${(pricing.feesCents / 100).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-border/50 pt-2">
                              <span className="font-semibold">Total</span>
                              <span className="text-base font-bold">${(pricing.totalCents / 100).toFixed(2)}</span>
                            </div>
                          </div>
                        </Card>
                      )}

                      {creating || !clientSecret ? (
                        <div className="space-y-4 animate-pulse">
                          <div className="h-12 rounded bg-muted" />
                          <div className="h-64 rounded bg-muted" />
                          <div className="h-12 rounded bg-muted" />
                          <div className="flex justify-center py-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                              <span className="text-sm">
                                Preparing secure checkout...
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full space-y-4">
                          <Elements
                            stripe={stripePromise}
                            options={elementsOptions}
                          >
                            <PaymentForm
                              onSuccess={handleComplete}
                              totalCents={pricing.totalCents}
                              eventId={event?.id || null}
                              paymentIntentId={paymentIntentId}
                            />
                          </Elements>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile sticky bar */}
                {totalQty > 0 && step === "select" && (
                  <MobileStickyBar
                    step={step}
                    creating={creating}
                    canProceed={
                      canProceed && !tiers.every((t) => t.quantity === 0)
                    }
                    totalCents={pricing.totalCents}
                    onPrimaryClick={startCheckout}
                  />
                )}
              </div>

              {/* Right column: Order summary (desktop) */}
              <div className="hidden space-y-4 lg:block">
                <Card className="space-y-4 rounded-2xl border bg-card/95 p-4 shadow-sm lg:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        Order summary
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Review your tickets before checkout
                      </p>
                    </div>
                    {totalQty > 0 && (
                      <Badge className="border-primary/20 bg-primary/10 text-xs text-primary">
                        {totalQty} ticket{totalQty > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    {Object.entries(selections).filter(
                      ([_, q]) => q > 0
                    ).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No tickets selected yet.
                      </div>
                    ) : (
                      Object.entries(selections)
                        .filter(([_, q]) => q > 0)
                        .map(([tierId, q]) => {
                          const t = tiers.find((x) => x.id === tierId)!;
                          return (
                            <div
                              key={tierId}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate">
                                {t.name} × {q}
                              </span>
                              <span className="font-medium">
                                <Price cents={t.price_cents * q} />
                              </span>
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
                          <span className="text-muted-foreground">
                            Subtotal
                          </span>
                          <Price cents={pricing.subtotalCents} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Processing fee
                          </span>
                          <Price cents={pricing.feesCents} />
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-base">
                        <span className="font-semibold">Total</span>
                        <div className="inline-flex items-baseline gap-1 rounded-xl bg-primary/5 px-2.5 py-1">
                          <span className="text-lg font-bold">
                            <Price cents={pricing.totalCents} />
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {step === "select" && (
                    <Button
                      className="mt-2 w-full"
                      size="lg"
                      onClick={startCheckout}
                      disabled={
                        !canProceed ||
                        creating ||
                        tiers.every((t) => t.quantity === 0)
                      }
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {creating ? "Starting checkout…" : "Proceed to payment"}
                    </Button>
                  )}

                  {step === "pay" && (
                    <Button
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => setStep("select")}
                    >
                      Edit selection
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                </Card>

                {timeRemaining?.isExpiring && (
                  <Card className="border-destructive bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      <div>
                        <h4 className="mb-1 font-semibold text-destructive">
                          {timeRemaining.isUrgent
                            ? "Checkout Expiring!"
                            : "Time Running Out"}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {timeRemaining.isUrgent
                            ? "Complete payment in the next 30 seconds to secure your tickets!"
                            : "Less than 1 minute remaining. Complete your payment now!"}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Mobile sticky bar --------------------

function MobileStickyBar({
  step,
  creating,
  canProceed,
  totalCents,
  onPrimaryClick,
}: {
  step: Step;
  creating: boolean;
  canProceed: boolean;
  totalCents: number;
  onPrimaryClick: () => void;
}) {
  if (step !== "select") return null;

  // Floating pill style - matches EventTicketCta
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none lg:hidden">
      <div className="mx-auto max-w-2xl px-4 mb-[calc(var(--bottom-nav-safe,4.5rem)+0.75rem)] pointer-events-auto">
        <div className="flex items-center justify-between gap-3 rounded-full bg-card/95 dark:bg-card/90 border border-border/70 dark:border-white/15 shadow-[0_18px_45px_rgba(15,23,42,0.35)] px-4 py-2.5 backdrop-blur-xl">
          {/* Left: Total */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-muted-foreground/80">Total</span>
                <span className="text-base font-semibold tabular-nums">
                  ${(totalCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: CTA button */}
          <Button
            size="sm"
            className="rounded-full px-5 py-2 text-sm font-semibold shadow-sm"
            onClick={onPrimaryClick}
            disabled={!canProceed || creating}
          >
            {creating ? (
              <>
                <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Processing
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
