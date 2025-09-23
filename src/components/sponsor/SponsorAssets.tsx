import { useState } from "react";
import { Upload, Image, FileText, Palette, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SponsorAssetsProps {
  sponsorId: string | null;
}

export function SponsorAssets({ sponsorId }: SponsorAssetsProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [brandColors, setBrandColors] = useState({
    primary: "#000000",
    secondary: "#666666",
    accent: "#0066cc"
  });
  const [brandGuidelines, setBrandGuidelines] = useState("");

  if (!sponsorId) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No Sponsor Selected</h3>
          <p className="text-muted-foreground">Please select a sponsor account to manage assets.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Brand Assets & Guidelines</h2>
        <p className="text-muted-foreground">
          Manage your brand assets and guidelines to ensure consistent representation across sponsorships.
        </p>
      </div>

      <Tabs defaultValue="logo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="logo" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Logo
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Guidelines
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logo Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="logo-upload">Primary Logo</Label>
                  <div className="mt-2 border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <div className="text-sm text-muted-foreground mb-2">
                      Drop your logo here or click to browse
                    </div>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <Button variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
                      Choose File
                    </Button>
                  </div>
                  {logoFile && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Selected: {logoFile.name}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Logo Variations</Label>
                  <div className="mt-2 space-y-2">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm font-medium mb-2">White Background Version</div>
                      <div className="text-xs text-muted-foreground">For light backgrounds</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm font-medium mb-2">Dark Background Version</div>
                      <div className="text-xs text-muted-foreground">For dark backgrounds</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm font-medium mb-2">Icon Only</div>
                      <div className="text-xs text-muted-foreground">For small spaces</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Logo Requirements</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Minimum resolution: 300 DPI</li>
                  <li>• Preferred formats: PNG (transparent), SVG</li>
                  <li>• Maximum file size: 5MB</li>
                  <li>• Provide versions for light and dark backgrounds</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={brandColors.primary}
                      onChange={(e) => setBrandColors({...brandColors, primary: e.target.value})}
                      className="w-16 h-10"
                    />
                    <Input
                      value={brandColors.primary}
                      onChange={(e) => setBrandColors({...brandColors, primary: e.target.value})}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={brandColors.secondary}
                      onChange={(e) => setBrandColors({...brandColors, secondary: e.target.value})}
                      className="w-16 h-10"
                    />
                    <Input
                      value={brandColors.secondary}
                      onChange={(e) => setBrandColors({...brandColors, secondary: e.target.value})}
                      placeholder="#666666"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="accent-color">Accent Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="accent-color"
                      type="color"
                      value={brandColors.accent}
                      onChange={(e) => setBrandColors({...brandColors, accent: e.target.value})}
                      className="w-16 h-10"
                    />
                    <Input
                      value={brandColors.accent}
                      onChange={(e) => setBrandColors({...brandColors, accent: e.target.value})}
                      placeholder="#0066cc"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Color Palette Preview</Label>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div 
                      className="h-20 rounded-lg border"
                      style={{ backgroundColor: brandColors.primary }}
                    ></div>
                    <div className="text-center text-sm font-medium">Primary</div>
                  </div>
                  <div className="space-y-2">
                    <div 
                      className="h-20 rounded-lg border"
                      style={{ backgroundColor: brandColors.secondary }}
                    ></div>
                    <div className="text-center text-sm font-medium">Secondary</div>
                  </div>
                  <div className="space-y-2">
                    <div 
                      className="h-20 rounded-lg border"
                      style={{ backgroundColor: brandColors.accent }}
                    ></div>
                    <div className="text-center text-sm font-medium">Accent</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidelines" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="brand-guidelines">Usage Guidelines</Label>
                <Textarea
                  id="brand-guidelines"
                  placeholder="Describe how your brand should be represented, including dos and don'ts, tone of voice, and any specific requirements for sponsorship placements..."
                  value={brandGuidelines}
                  onChange={(e) => setBrandGuidelines(e.target.value)}
                  rows={8}
                  className="mt-2"
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Common Guidelines to Include</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Logo placement and minimum clear space</li>
                  <li>• Approved color combinations</li>
                  <li>• Typography and font preferences</li>
                  <li>• Tone of voice and messaging style</li>
                  <li>• What NOT to do with your brand</li>
                  <li>• Contact information for brand questions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Kit Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-4">How your brand will appear to event organizers:</h4>
                
                <div className="border rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      {logoFile ? (
                        <img src={URL.createObjectURL(logoFile)} alt="Logo" className="max-w-full max-h-full" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">Your Brand Name</div>
                      <div className="text-sm text-muted-foreground">Sponsor Account</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-2">Brand Colors</div>
                    <div className="flex gap-2">
                      <div 
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: brandColors.primary }}
                        title="Primary"
                      ></div>
                      <div 
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: brandColors.secondary }}
                        title="Secondary"
                      ></div>
                      <div 
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: brandColors.accent }}
                        title="Accent"
                      ></div>
                    </div>
                  </div>

                  {brandGuidelines && (
                    <div>
                      <div className="text-sm font-medium mb-2">Brand Guidelines</div>
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded p-3 max-h-32 overflow-y-auto">
                        {brandGuidelines}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button>Save Brand Assets</Button>
      </div>
    </div>
  );
}