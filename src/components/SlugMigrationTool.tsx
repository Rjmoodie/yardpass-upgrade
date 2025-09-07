/**
 * Admin utility component for migrating existing events to use slugs
 */

import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { backfillEventSlugs } from '@/lib/backfillSlugs';
import { toast } from '@/hooks/use-toast';

export function SlugMigrationTool() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const runMigration = async () => {
    setIsRunning(true);
    try {
      const result = await backfillEventSlugs();
      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "Migration Complete",
          description: `Successfully updated ${result.updated} events with SEO-friendly URLs`,
        });
      } else {
        toast({
          title: "Migration Failed", 
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Migration Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          SEO URL Migration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This tool will update existing events to use SEO-friendly URLs instead of UUIDs.
          Events like <code>/events/uuid-123</code> will become <code>/events/event-title-abc123</code>.
        </p>
        
        {lastResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            lastResult.success 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {lastResult.success ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">
              {lastResult.success 
                ? `✅ Updated ${lastResult.updated} events`
                : `❌ ${lastResult.error}`
              }
            </span>
          </div>
        )}

        <Button 
          onClick={runMigration} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Running Migration...
            </>
          ) : (
            'Run URL Migration'
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          ⚠️ This is safe to run multiple times. Events that already have slugs will be skipped.
        </p>
      </CardContent>
    </Card>
  );
}