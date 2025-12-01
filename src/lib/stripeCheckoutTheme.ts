import { useTheme } from "next-themes";

/**
 * Stripe Checkout appearance configuration
 * Supports both Embedded Checkout and Stripe Elements
 */

export const darkModeAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#0085FF',
    colorBackground: '#0f0f0f',
    colorText: '#ffffff',
    colorDanger: '#F23154',
    colorSuccess: '#3EAE20',
    colorWarning: '#F27400',
    borderRadius: '8px',
    fontFamily: 'system-ui, sans-serif',
    spacingUnit: '4px',
  },
};

export const lightModeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#0085FF',
    colorBackground: '#ffffff',
    colorText: '#1F2937',
    colorDanger: '#DC2626',
    colorSuccess: '#16A34A',
    colorWarning: '#D97706',
    borderRadius: '8px',
    fontFamily: 'system-ui, sans-serif',
    spacingUnit: '4px',
  },
};

/**
 * Hook to get Stripe Checkout appearance based on current theme
 * Use this with EmbeddedCheckoutProvider or Elements
 */
export function useStripeCheckoutAppearance() {
  const { theme, resolvedTheme } = useTheme();
  
  // Use resolvedTheme to handle system preference
  const isDarkMode = resolvedTheme === 'dark' || theme === 'dark';
  
  return {
    appearance: isDarkMode ? darkModeAppearance : lightModeAppearance,
    isDarkMode,
  };
}

/**
 * Get appearance directly (for use outside React components)
 */
export function getStripeCheckoutAppearance(isDarkMode: boolean) {
  return {
    appearance: isDarkMode ? darkModeAppearance : lightModeAppearance,
  };
}

