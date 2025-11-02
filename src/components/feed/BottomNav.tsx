import { Home, Search, Award, BarChart3 } from "lucide-react";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 px-2 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-around gap-1">
        <button className="flex flex-col items-center gap-1 rounded-2xl bg-primary/20 px-4 py-2 transition-all hover:bg-primary/30 active:scale-95 sm:px-6 sm:py-2.5">
          <Home className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          <span className="text-[10px] text-primary sm:text-xs">Feed</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all hover:bg-muted/20 active:scale-95 sm:px-4 sm:py-2.5">
          <Search className="h-5 w-5 text-foreground/60 sm:h-6 sm:w-6" />
          <span className="text-[10px] text-foreground/60 sm:text-xs">Search</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all hover:bg-muted/20 active:scale-95 sm:px-4 sm:py-2.5">
          <Award className="h-5 w-5 text-foreground/60 sm:h-6 sm:w-6" />
          <span className="text-[10px] text-foreground/60 sm:text-xs">Sponsor</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all hover:bg-muted/20 active:scale-95 sm:px-4 sm:py-2.5">
          <BarChart3 className="h-5 w-5 text-foreground/60 sm:h-6 sm:w-6" />
          <span className="text-[10px] text-foreground/60 sm:text-xs">Stats</span>
        </button>
      </div>
    </nav>
  );
}

