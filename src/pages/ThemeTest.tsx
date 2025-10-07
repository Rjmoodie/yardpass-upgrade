import React from 'react';
import { ThemeTest } from '@/components/debug/ThemeTest';

export default function ThemeTestPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Theme System Test</h1>
        <ThemeTest />
      </div>
    </div>
  );
}
