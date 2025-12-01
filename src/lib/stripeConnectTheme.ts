import { useTheme } from "next-themes";

/**
 * Stripe Connect embedded components appearance variables
 * These match your app's dark/light theme for consistent UI
 */

export const darkModeAppearanceVariables = {
  // Primary brand color (adjust to match your app)
  colorPrimary: "#0085FF",
  
  // Text colors
  colorText: "#C9CED8",
  colorSecondaryText: "#8C99AD",
  
  // Background colors
  colorBackground: "#14171D",
  formBackgroundColor: "#14171D",
  offsetBackgroundColor: "#1B1E25",
  
  // Button colors
  buttonSecondaryColorBackground: "#2B3039",
  buttonSecondaryColorText: "#C9CED8",
  
  // Action colors
  actionSecondaryColorText: "#C9CED8",
  actionSecondaryTextDecorationColor: "#C9CED8",
  
  // Border
  colorBorder: "#2B3039",
  
  // Danger/Error
  colorDanger: "#F23154",
  
  // Badge colors
  badgeNeutralColorBackground: "#1B1E25",
  badgeNeutralColorBorder: "#2B3039",
  badgeNeutralColorText: "#8C99AD",
  
  badgeSuccessColorBackground: "#152207",
  badgeSuccessColorBorder: "#20360C",
  badgeSuccessColorText: "#3EAE20",
  
  badgeWarningColorBackground: "#400A00",
  badgeWarningColorBorder: "#5F1400",
  badgeWarningColorText: "#F27400",
  
  badgeDangerColorBackground: "#420320",
  badgeDangerColorBorder: "#61092D",
  badgeDangerColorText: "#F46B7D",
  
  // Overlay
  overlayBackdropColor: "rgba(0,0,0,0.5)",
};

export const lightModeAppearanceVariables = {
  // Primary brand color (adjust to match your app)
  colorPrimary: "#0085FF",
  
  // Text colors - adjust based on your light theme
  colorText: "#1F2937",
  colorSecondaryText: "#6B7280",
  
  // Background colors - adjust based on your light theme
  colorBackground: "#FFFFFF",
  formBackgroundColor: "#FFFFFF",
  offsetBackgroundColor: "#F9FAFB",
  
  // Button colors
  buttonSecondaryColorBackground: "#F3F4F6",
  buttonSecondaryColorText: "#1F2937",
  
  // Action colors
  actionSecondaryColorText: "#1F2937",
  actionSecondaryTextDecorationColor: "#1F2937",
  
  // Border
  colorBorder: "#E5E7EB",
  
  // Danger/Error
  colorDanger: "#DC2626",
  
  // Badge colors - adjust based on your light theme
  badgeNeutralColorBackground: "#F9FAFB",
  badgeNeutralColorBorder: "#E5E7EB",
  badgeNeutralColorText: "#6B7280",
  
  badgeSuccessColorBackground: "#F0FDF4",
  badgeSuccessColorBorder: "#BBF7D0",
  badgeSuccessColorText: "#16A34A",
  
  badgeWarningColorBackground: "#FFFBEB",
  badgeWarningColorBorder: "#FDE68A",
  badgeWarningColorText: "#D97706",
  
  badgeDangerColorBackground: "#FEF2F2",
  badgeDangerColorBorder: "#FECACA",
  badgeDangerColorText: "#DC2626",
  
  // Overlay
  overlayBackdropColor: "rgba(0,0,0,0.3)",
};

/**
 * Hook to get Stripe Connect appearance variables based on current theme
 * Use this when initializing or updating Stripe Connect embedded components
 */
export function useStripeConnectAppearance() {
  const { theme, resolvedTheme } = useTheme();
  
  // Use resolvedTheme to handle system preference
  const isDarkMode = resolvedTheme === 'dark' || theme === 'dark';
  
  return {
    appearance: {
      variables: isDarkMode ? darkModeAppearanceVariables : lightModeAppearanceVariables,
    },
    isDarkMode,
  };
}

/**
 * Get appearance variables directly (for use outside React components)
 */
export function getStripeConnectAppearance(isDarkMode: boolean) {
  return {
    appearance: {
      variables: isDarkMode ? darkModeAppearanceVariables : lightModeAppearanceVariables,
    },
  };
}

