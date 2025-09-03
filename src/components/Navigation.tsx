import { Home, Plus, BarChart3, User, Search } from 'lucide-react';

type Screen = 'feed' | 'search' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post' | 'event-management';
type UserRole = 'attendee' | 'organizer';

interface NavigationProps {
  currentScreen: Screen;
  userRole: UserRole;
  onNavigate: (screen: Screen) => void;
}

export default function Navigation({ currentScreen, userRole, onNavigate }: NavigationProps) {
  const navItems = [
    {
      id: 'feed' as Screen,
      icon: Home,
      label: 'Feed',
      show: true
    },
    {
      id: 'search' as Screen,
      icon: Search,
      label: 'Search',
      show: true
    },
    {
      id: 'create-event' as Screen,
      icon: Plus,
      label: 'Create',
      show: userRole === 'organizer'
    },
    {
      id: 'create-post' as Screen,
      icon: Plus,
      label: 'Post',
      show: userRole === 'attendee'
    },
    {
      id: 'dashboard' as Screen,
      icon: BarChart3,
      label: 'Dashboard',
      show: userRole === 'organizer'
    },
    {
      id: 'profile' as Screen,
      icon: User,
      label: 'Profile',
      show: true
    }
  ].filter(item => item.show);

  return (
    <div className="bg-card border-t border-border px-4 py-2 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              isActive 
                ? 'text-primary bg-primary/10' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}