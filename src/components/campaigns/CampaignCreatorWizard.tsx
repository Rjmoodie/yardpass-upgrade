import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Check, Target, DollarSign, Image as ImageIcon, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { CreativeUploaderModal } from "./CreativeUploaderModal";

import type { CampaignObjective, PacingStrategy } from "@/types/campaigns";

type CampaignCreatorWizardProps = {
  orgId?: string;
  availableCredits?: number;
  creditUsdRate?: number;
  baselineCpm?: number;
  walletFrozen?: boolean;
  onSuccess?: () => void;
};

type WizardStep = "basics" | "budget" | "creatives" | "review";

type Creative = {
  id?: string;
  type: "image" | "video" | "existing_post";
  headline?: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  mediaUrls?: string[];
  postId?: string;
};

export const CampaignCreatorWizard = ({
  orgId,
  availableCredits,
  creditUsdRate = 1,
  baselineCpm = 65,
  walletFrozen = false,
  onSuccess,
}: CampaignCreatorWizardProps) => {
  const { toast } = useToast();
  const { createCampaign, isCreating } = useCampaigns(orgId);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>("basics");
  const [showCreativeModal, setShowCreativeModal] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "ticket_sales" as CampaignObjective,
    pacing: "even" as PacingStrategy,
    totalBudget: "",
    dailyBudget: "",
    pricingModel: "cpm" as "cpm" | "cpc" | "cpa",
    categories: [] as string[],
    locations: [] as string[],
    keywords: [] as string[],
  });
  
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [creatives, setCreatives] = useState<Creative[]>([]);

  const totalBudgetNumber = Number(form.totalBudget);
  const hasBudget = Number.isFinite(totalBudgetNumber) && totalBudgetNumber > 0;
  const estimatedReach = useMemo(() => {
    if (!hasBudget) return 0;
    return Math.max(0, Math.round((totalBudgetNumber / baselineCpm) * 1000));
  }, [totalBudgetNumber, baselineCpm, hasBudget]);
  
  const insufficientCredits =
    availableCredits !== undefined && Number.isFinite(totalBudgetNumber) && totalBudgetNumber > (availableCredits ?? 0);

  const usdFormatter = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }), []);

  // Step validation
  const canProceedFromBasics = () => {
    return form.name.trim().length > 0 && startDate !== undefined;
  };

  const canProceedFromBudget = () => {
    const total = Number(form.totalBudget);
    const daily = form.dailyBudget ? Number(form.dailyBudget) : undefined;
    
    if (!Number.isFinite(total) || total <= 0) return false;
    if (daily !== undefined && (!Number.isFinite(daily) || daily <= 0 || daily > total)) return false;
    if (insufficientCredits) return false;
    if (endDate && endDate <= startDate!) return false;
    
    return true;
  };

  const canProceedFromCreatives = () => {
    return creatives.length > 0;
  };

  const handleNext = () => {
    if (currentStep === "basics" && canProceedFromBasics()) {
      setCurrentStep("budget");
    } else if (currentStep === "budget" && canProceedFromBudget()) {
      setCurrentStep("creatives");
    } else if (currentStep === "creatives" && canProceedFromCreatives()) {
      setCurrentStep("review");
    }
  };

  const handleBack = () => {
    if (currentStep === "budget") setCurrentStep("basics");
    else if (currentStep === "creatives") setCurrentStep("budget");
    else if (currentStep === "review") setCurrentStep("creatives");
  };

  const handleCreativeCreated = (creative: Creative) => {
    setCreatives([...creatives, creative]);
    setShowCreativeModal(false);
    toast({ title: "Creative added", description: "Your ad creative has been added to the campaign" });
  };

  const removeCreative = (index: number) => {
    setCreatives(creatives.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!orgId) {
      toast({
        title: "Organization required",
        description: "Select an organization with an active wallet before creating campaigns.",
        variant: "destructive",
      });
      return;
    }

    if (walletFrozen) {
      toast({
        title: "Wallet frozen",
        description: "Resolve billing issues before scheduling new spend.",
        variant: "destructive",
      });
      return;
    }

    const total = Number(form.totalBudget);
    const daily = form.dailyBudget ? Number(form.dailyBudget) : undefined;

    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      objective: form.objective,
      pacing_strategy: form.pacing,
      total_budget_credits: total,
      daily_budget_credits: daily ?? null,
      start_date: startDate!.toISOString(),
      end_date: endDate ? endDate.toISOString() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      pricing_model: form.pricingModel,
      targeting: {
        categories: form.categories,
        locations: form.locations,
        keywords: form.keywords,
      },
      creatives: creatives,
    };

    try {
      await createCampaign(payload);
      toast({ 
        title: "Campaign created successfully!", 
        description: `${form.name} is now live with ${creatives.length} creative${creatives.length > 1 ? 's' : ''}.`
      });
      
      // Reset form
      setForm({ 
        name: "", 
        description: "", 
        objective: "ticket_sales", 
        pacing: "even", 
        totalBudget: "", 
        dailyBudget: "",
        pricingModel: "cpm",
        categories: [],
        locations: [],
        keywords: [],
      });
      setStartDate(undefined);
      setEndDate(undefined);
      setCreatives([]);
      setCurrentStep("basics");
      
      onSuccess?.();
    } catch (e: any) {
      toast({ 
        title: "Failed to create campaign", 
        description: e?.message ?? "Please try again", 
        variant: "destructive" 
      });
    }
  };

  const steps: { id: WizardStep; label: string; icon: any }[] = [
    { id: "basics", label: "Basics", icon: Target },
    { id: "budget", label: "Budget & Targeting", icon: DollarSign },
    { id: "creatives", label: "Creatives", icon: ImageIcon },
    { id: "review", label: "Review", icon: Eye },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = index < currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                      isComplete && "bg-green-500 text-white",
                      !isActive && !isComplete && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 font-medium",
                    isActive && "text-primary",
                    isComplete && "text-green-600"
                  )}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-4 transition-all",
                    index < currentStepIndex ? "bg-green-500" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === "basics" && "Campaign Basics"}
            {currentStep === "budget" && "Budget & Targeting"}
            {currentStep === "creatives" && "Add Creatives"}
            {currentStep === "review" && "Review & Launch"}
          </CardTitle>
          <CardDescription>
            {currentStep === "basics" && "Set up your campaign name, objective, and schedule"}
            {currentStep === "budget" && "Configure budget, targeting, and pricing model"}
            {currentStep === "creatives" && "Add images, videos, or import existing posts"}
            {currentStep === "review" && "Review your campaign details before launching"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* STEP 1: BASICS */}
          {currentStep === "basics" && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input
                    id="name"
                    placeholder="Summer Festival 2025"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your campaign goals and target audience"
                    className="min-h-[100px]"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="objective">Campaign Objective</Label>
                    <Select
                      value={form.objective}
                      onValueChange={(v) => setForm((f) => ({ ...f, objective: v as CampaignObjective }))}
                    >
                      <SelectTrigger id="objective">
                        <SelectValue placeholder="Select objective" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="awareness">Awareness</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="ticket_sales">Ticket Sales</SelectItem>
                        <SelectItem value="conversions">Conversions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pacing">Pacing Strategy</Label>
                    <Select
                      value={form.pacing}
                      onValueChange={(v) => setForm((f) => ({ ...f, pacing: v as PacingStrategy }))}
                    >
                      <SelectTrigger id="pacing">
                        <SelectValue placeholder="Select pacing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="even">Even (Recommended)</SelectItem>
                        <SelectItem value="accelerated">Accelerated</SelectItem>
                        <SelectItem value="front_loaded">Front Loaded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "No end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => !startDate || date <= startDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: BUDGET & TARGETING */}
          {currentStep === "budget" && (
            <>
              <Alert>
                <AlertTitle>Funding overview</AlertTitle>
                <AlertDescription>
                  {availableCredits !== undefined
                    ? `${availableCredits.toLocaleString()} credits available (${usdFormatter.format((availableCredits ?? 0) * creditUsdRate)} equivalent).`
                    : "Credits fund delivery in this beta. Connect an organization wallet to unlock creation."}
                  {hasBudget && ` • Estimated reach ${estimatedReach.toLocaleString()} impressions at ${baselineCpm} credits per 1k.`}
                </AlertDescription>
              </Alert>

              {walletFrozen && (
                <Alert variant="destructive">
                  <AlertTitle>Wallet frozen</AlertTitle>
                  <AlertDescription>Campaign creation is disabled until billing issues are resolved.</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <h3 className="font-semibold">Budget</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="totalBudget">Total Budget (credits) *</Label>
                    <Input
                      id="totalBudget"
                      type="number"
                      placeholder="10000"
                      value={form.totalBudget}
                      onChange={(e) => setForm((f) => ({ ...f, totalBudget: e.target.value }))}
                    />
                    {insufficientCredits && (
                      <p className="text-sm text-destructive">
                        Insufficient credits. You only have {(availableCredits ?? 0).toLocaleString()} available.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dailyBudget">Daily Budget (credits)</Label>
                    <Input
                      id="dailyBudget"
                      type="number"
                      placeholder="Optional - leave blank for even pacing"
                      value={form.dailyBudget}
                      onChange={(e) => setForm((f) => ({ ...f, dailyBudget: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricingModel">Pricing Model</Label>
                  <Select
                    value={form.pricingModel}
                    onValueChange={(v) => setForm((f) => ({ ...f, pricingModel: v as "cpm" | "cpc" | "cpa" }))}
                  >
                    <SelectTrigger id="pricingModel">
                      <SelectValue placeholder="Select pricing model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpm">CPM (Cost Per 1k Impressions)</SelectItem>
                      <SelectItem value="cpc">CPC (Cost Per Click)</SelectItem>
                      <SelectItem value="cpa">CPA (Cost Per Acquisition)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Targeting (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Target specific categories, locations, or keywords to reach your ideal audience
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="categories">Categories</Label>
                  <Input
                    id="categories"
                    placeholder="e.g., Music, Sports, Comedy (comma-separated)"
                    value={form.categories.join(", ")}
                    onChange={(e) => setForm((f) => ({ 
                      ...f, 
                      categories: e.target.value.split(",").map(c => c.trim()).filter(Boolean)
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locations">Locations</Label>
                  <Input
                    id="locations"
                    placeholder="e.g., New York, Los Angeles (comma-separated)"
                    value={form.locations.join(", ")}
                    onChange={(e) => setForm((f) => ({ 
                      ...f, 
                      locations: e.target.value.split(",").map(l => l.trim()).filter(Boolean)
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords</Label>
                  <Input
                    id="keywords"
                    placeholder="e.g., concert, festival, live (comma-separated)"
                    value={form.keywords.join(", ")}
                    onChange={(e) => setForm((f) => ({ 
                      ...f, 
                      keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean)
                    }))}
                  />
                </div>
              </div>
            </>
          )}

          {/* STEP 3: CREATIVES */}
          {currentStep === "creatives" && (
            <>
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Add your ad creatives</AlertTitle>
                <AlertDescription>
                  Upload images/videos, import existing event posts, or create new content. You need at least one creative to launch your campaign.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {creatives.length === 0 ? (
                  <Card className="p-12 text-center border-dashed">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No creatives yet</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Add your first creative to get started
                    </p>
                    <Button onClick={() => setShowCreativeModal(true)}>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Add Creative
                    </Button>
                  </Card>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">
                        Creatives ({creatives.length})
                      </h3>
                      <Button onClick={() => setShowCreativeModal(true)} size="sm">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Add Another
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {creatives.map((creative, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="outline">{creative.type}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCreative(index)}
                              className="h-6 w-6 p-0"
                            >
                              ✕
                            </Button>
                          </div>
                          <h4 className="font-semibold text-sm mb-1">
                            {creative.headline || "Untitled Creative"}
                          </h4>
                          {creative.bodyText && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {creative.bodyText}
                            </p>
                          )}
                          {creative.ctaLabel && (
                            <Badge variant="secondary" className="text-xs">
                              CTA: {creative.ctaLabel}
                            </Badge>
                          )}
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* STEP 4: REVIEW */}
          {currentStep === "review" && (
            <>
              <Alert className="bg-primary/5 border-primary/20">
                <Eye className="h-4 w-4" />
                <AlertTitle>Ready to launch</AlertTitle>
                <AlertDescription>
                  Review your campaign details below and click "Launch Campaign" to go live.
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Campaign Details</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="font-medium">{form.name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Objective</dt>
                      <dd className="font-medium capitalize">{form.objective.replace("_", " ")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Start Date</dt>
                      <dd className="font-medium">{startDate ? format(startDate, "PPP") : "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">End Date</dt>
                      <dd className="font-medium">{endDate ? format(endDate, "PPP") : "No end date"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Total Budget</dt>
                      <dd className="font-medium">{Number(form.totalBudget).toLocaleString()} credits</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Pricing Model</dt>
                      <dd className="font-medium">{form.pricingModel.toUpperCase()}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Est. Reach</dt>
                      <dd className="font-medium">{estimatedReach.toLocaleString()} impressions</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Creatives</dt>
                      <dd className="font-medium">{creatives.length} ad{creatives.length > 1 ? "s" : ""}</dd>
                    </div>
                  </dl>
                </div>

                {(form.categories.length > 0 || form.locations.length > 0 || form.keywords.length > 0) && (
                  <div>
                    <h3 className="font-semibold mb-3">Targeting</h3>
                    <div className="space-y-2 text-sm">
                      {form.categories.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Categories: </span>
                          {form.categories.join(", ")}
                        </div>
                      )}
                      {form.locations.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Locations: </span>
                          {form.locations.join(", ")}
                        </div>
                      )}
                      {form.keywords.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Keywords: </span>
                          {form.keywords.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {form.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">{form.description}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navigation Buttons */}
          <Separator />
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === "basics"}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep !== "review" ? (
              <Button
                onClick={handleNext}
                disabled={
                  (currentStep === "basics" && !canProceedFromBasics()) ||
                  (currentStep === "budget" && !canProceedFromBudget()) ||
                  (currentStep === "creatives" && !canProceedFromCreatives())
                }
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isCreating || walletFrozen}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCreating ? "Creating..." : "Launch Campaign"}
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Creative Uploader Modal */}
      {showCreativeModal && orgId && (
        <CreativeUploaderModal
          isOpen={showCreativeModal}
          onClose={() => setShowCreativeModal(false)}
          campaignId={null} // We'll link after campaign creation
          organizationId={orgId}
          onSuccess={handleCreativeCreated}
        />
      )}
    </div>
  );
};

