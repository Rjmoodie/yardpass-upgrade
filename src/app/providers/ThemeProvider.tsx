// Re-export next-themes ThemeProvider with app-specific configuration
export { ThemeProvider } from 'next-themes';

// You can add custom theme configuration here if needed
export const themeConfig = {
  attribute: 'class',
  defaultTheme: 'system',
  enableSystem: true,
  disableTransitionOnChange: false,
};

