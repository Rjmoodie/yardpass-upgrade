import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

type CampaignData = {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  budget: number;
  dailyBudget?: number | null;
};

type CampaignEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignData | null;
  onSave: (id: string, updates: {
    name?: string;
    description?: string | null;
    start_date?: string;
    end_date?: string | null;
    total_budget_credits?: number;
    daily_budget_credits?: number | null;
  }) => Promise<void>;
  isSaving?: boolean;
};

export function CampaignEditDialog({
  isOpen,
  onClose,
  campaign,
  onSave,
  isSaving = false,
}: CampaignEditDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setDescription(campaign.description || "");
      setStartDate(campaign.startDate);
      setEndDate(campaign.endDate || "");
      setBudget(campaign.budget.toString());
      setDailyBudget(campaign.dailyBudget?.toString() || "");
    }
  }, [campaign]);

  const handleSave = async () => {
    if (!campaign) return;

    const updates: any = {};
    
    if (name !== campaign.name) updates.name = name;
    if (description !== (campaign.description || "")) {
      updates.description = description || null;
    }
    if (startDate !== campaign.startDate) {
      updates.start_date = new Date(startDate).toISOString();
    }
    if (endDate !== (campaign.endDate || "")) {
      updates.end_date = endDate ? new Date(endDate).toISOString() : null;
    }
    if (budget !== campaign.budget.toString()) {
      updates.total_budget_credits = parseInt(budget);
    }
    if (dailyBudget !== (campaign.dailyBudget?.toString() || "")) {
      updates.daily_budget_credits = dailyBudget ? parseInt(dailyBudget) : null;
    }

    await onSave(campaign.id, updates);
    onClose();
  };

  if (!campaign) return null;

  const isExpiringSoon = campaign.endDate && 
    new Date(campaign.endDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  
  const hasExpired = campaign.endDate && new Date(campaign.endDate) < new Date();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Update your campaign details. Changes will take effect immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasExpired && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Campaign Expired</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This campaign ended on {format(new Date(campaign.endDate!), "MMM d, yyyy")}. 
                    Extend the end date to resume showing ads.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasExpired && isExpiringSoon && (
            <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-600">Campaign Expiring Soon</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This campaign ends on {format(new Date(campaign.endDate!), "MMM d, yyyy")}. 
                    Consider extending it to continue serving ads.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter campaign name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your campaign"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no end date
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Total Budget (Credits)</Label>
              <Input
                id="budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyBudget">
                Daily Budget <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="dailyBudget"
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

