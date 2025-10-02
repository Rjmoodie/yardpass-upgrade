import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export const CampaignCreator = ({ orgId }: { orgId?: string }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "ticket_sales",
    pacing: "even",
    totalBudget: "",
    dailyBudget: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);

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

    const payload = {
      org_id: orgId, // optional; add if you route by org
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
      setSubmitting(true);
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Campaign created" });
      setForm({ name: "", description: "", objective: "ticket_sales", pacing: "even", totalBudget: "", dailyBudget: "" });
      setStartDate(undefined); setEndDate(undefined);
    } catch (e: any) {
      toast({ title: "Failed to create", description: e?.message ?? "Please try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
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
                  onValueChange={(v) => setForm((f) => ({ ...f, objective: v }))}
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
                <Select value={form.pacing} onValueChange={(v) => setForm((f) => ({ ...f, pacing: v }))}>
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
            <Button variant="outline" type="button">Cancel</Button>
            <Button type="button" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create Campaign"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};