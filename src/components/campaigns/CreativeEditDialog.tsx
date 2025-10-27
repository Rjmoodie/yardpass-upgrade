import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreativeEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  creative: {
    id: string;
    headline: string;
    body_text?: string;
    cta_label: string;
    cta_url?: string;
  } | null;
  onSave: (id: string, updates: any) => Promise<void>;
};

export function CreativeEditDialog({ isOpen, onClose, creative, onSave }: CreativeEditDialogProps) {
  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when creative changes
  useEffect(() => {
    if (creative) {
      setHeadline(creative.headline || "");
      setBodyText(creative.body_text || "");
      setCtaLabel(creative.cta_label || "Learn More");
      setCtaUrl(creative.cta_url || "");
    }
  }, [creative]);

  const handleSave = async () => {
    if (!creative) return;
    
    setSaving(true);
    try {
      await onSave(creative.id, {
        headline,
        body_text: bodyText,
        cta_label: ctaLabel,
        cta_url: ctaUrl || null,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save creative:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!creative) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Creative</DialogTitle>
          <DialogDescription>
            Update your ad content and call-to-action
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="headline">Headline *</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Grab attention with a compelling headline"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{headline.length}/100 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyText">Body Text</Label>
            <Textarea
              id="bodyText"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Add more details about your offer"
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">{bodyText.length}/300 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ctaLabel">CTA Button Text *</Label>
            <Input
              id="ctaLabel"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Learn More"
              maxLength={24}
            />
            <p className="text-xs text-muted-foreground">{ctaLabel.length}/24 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ctaUrl">CTA URL</Label>
            <Input
              id="ctaUrl"
              type="url"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !headline || !ctaLabel}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


