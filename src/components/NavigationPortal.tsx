import { createPortal } from 'react-dom';
import Navigation from './Navigation';

interface NavigationPortalProps {
  currentScreen: string;
  userRole: string;
  onNavigate: (screen: string) => void;
}

export function NavigationPortal({ currentScreen, userRole, onNavigate }: NavigationPortalProps) {
  // Safety check for document.body availability
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(
    <div className="navigation-portal">
      <Navigation 
        currentScreen={currentScreen} 
        userRole={userRole} 
        onNavigate={onNavigate} 
      />
    </div>, 
    document.body
  );
}
