// Simple component to test theme functionality
import React from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeTest: React.FC = () => {
  const { theme, setTheme, systemTheme } = useTheme();

  const themes = [
    { id: 'light', name: 'Light', icon: <Sun className="w-4 h-4" /> },
    { id: 'dark', name: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { id: 'system', name: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Theme Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Current Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Theme:</span>
            <Badge variant="outline">{theme}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">System Theme:</span>
            <Badge variant="outline">{systemTheme}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">HTML Class:</span>
            <Badge variant="outline">
              {document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
            </Badge>
          </div>
        </div>

        {/* Theme Buttons */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Switch Theme:</h4>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <Button
                key={t.id}
                variant={theme === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(t.id)}
                className="flex items-center gap-2"
              >
                {t.icon}
                {t.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Visual Test */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Visual Test:</h4>
          <div className="p-4 bg-background border border-border rounded-lg">
            <p className="text-foreground">Background: bg-background</p>
            <p className="text-foreground">Text: text-foreground</p>
            <p className="text-muted-foreground">Muted: text-muted-foreground</p>
            <div className="mt-2 p-2 bg-primary text-primary-foreground rounded">
              Primary: bg-primary
            </div>
            <div className="mt-2 p-2 bg-secondary text-secondary-foreground rounded">
              Secondary: bg-secondary
            </div>
          </div>
        </div>

        {/* CSS Variables Test */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">CSS Variables:</h4>
          <div className="text-xs space-y-1 font-mono">
            <div>--background: <span className="text-blue-600">{getComputedStyle(document.documentElement).getPropertyValue('--background')}</span></div>
            <div>--foreground: <span className="text-blue-600">{getComputedStyle(document.documentElement).getPropertyValue('--foreground')}</span></div>
            <div>--primary: <span className="text-blue-600">{getComputedStyle(document.documentElement).getPropertyValue('--primary')}</span></div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};
