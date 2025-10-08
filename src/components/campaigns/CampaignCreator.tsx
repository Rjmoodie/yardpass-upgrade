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
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";

import type { CampaignObjective, PacingStrategy } from "@/types/campaigns";

type CampaignCreatorProps = {
  orgId?: string;
  availableCredits?: number;
  creditUsdRate?: number;
  baselineCpm?: number;
  walletFrozen?: boolean;
};

export const CampaignCreator = ({
  orgId,
  availableCredits,
  creditUsdRate = 1,
  baselineCpm = 65,
  walletFrozen = false,
}: CampaignCreatorProps) => {
  const { toast } = useToast();
  const { createCampaign, isCreating } = useCampaigns(orgId);
  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "ticket_sales" as CampaignObjective,
    pacing: "even" as PacingStrategy,
    totalBudget: "",
    dailyBudget: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const totalBudgetNumber = Number(form.totalBudget);
  const hasBudget = Number.isFinite(totalBudgetNumber) && totalBudgetNumber > 0;
  const estimatedReach = useMemo(() => {
    if (!hasBudget) return 0;
    return Math.max(0, Math.round((totalBudgetNumber / baselineCpm) * 1000));
  }, [totalBudgetNumber, baselineCpm, hasBudget]);
  const insufficientCredits =
    availableCredits !== undefined && Number.isFinite(totalBudgetNumber) && totalBudgetNumber > (availableCredits ?? 0);

  const usdFormatter = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }), []);

  const onSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const total = Number(form.totalBudget);
    const daily = form.dailyBudget ? Number(form.dailyBudget) : undefined;
    if (!Number.isFinite(total) || total <= 0) {
      toast({ title: "Enter a valid total budget", variant: "destructive" });
      return;
    }
    if (daily !== undefined && (!Number.isFinite(daily) || daily <= 0 || daily > total)) {
      toast({ title: "Daily budget must be > 0 and ≤ total", variant: "destructive" });
      return;
    }
    if (!startDate) {
      toast({ title: "Start date required", variant: "destructive" });
      return;
    }
    if (endDate && endDate <= startDate) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }

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

    if (insufficientCredits) {
      toast({
        title: "Not enough credits",
        description: `You only have ${(availableCredits ?? 0).toLocaleString()} credits available. Reduce the budget or top up first.`,
        variant: "destructive",
      });
      return;
    }

    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      objective: form.objective,
      pacing_strategy: form.pacing,
      total_budget_credits: total,
      daily_budget_credits: daily ?? null,
      start_date: startDate.toISOString(),
      end_date: endDate ? endDate.toISOString() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    try {
      await createCampaign(payload);
      toast({ title: "Campaign created" });
      setForm({ name: "", description: "", objective: "ticket_sales", pacing: "even", totalBudget: "", dailyBudget: "" });
      setStartDate(undefined);
      setEndDate(undefined);
    } catch (e: any) {
      toast({ title: "Failed to create", description: e?.message ?? "Please try again", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
          <CardDescription>Set up a new advertising campaign for your event or organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Basic Information</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
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
            </div>
          </div>

          <Separator />

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Campaign Settings</h3>
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
                    <SelectItem value="ticket_sales">Ticket Sales</SelectItem>
                    <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="event_promotion">Event Promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pacing">Pacing Strategy</Label>
                <Select value={form.pacing} onValueChange={(v) => setForm((f) => ({ ...f, pacing: v as PacingStrategy }))}>
                  <SelectTrigger id="pacing">
                    <SelectValue placeholder="Select pacing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Even Distribution</SelectItem>
                    <SelectItem value="accelerated">Accelerated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Budget & Schedule */}
          <div className="space-y-4">
            <h3 className="font-semibold">Budget & Schedule</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget (credits)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="5000"
                  value={form.totalBudget}
                  onChange={(e) => setForm((f) => ({ ...f, totalBudget: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-budget">Daily Budget (credits)</Label>
                <Input
                  id="daily-budget"
                  type="number"
                  placeholder="500"
                  value={form.dailyBudget}
                  onChange={(e) => setForm((f) => ({ ...f, dailyBudget: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date (optional)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" disabled={isCreating}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isCreating || walletFrozen || insufficientCredits}
              title={walletFrozen ? "Wallet frozen" : insufficientCredits ? "Not enough credits" : undefined}
            >
              {isCreating ? "Creating…" : "Create Campaign"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
