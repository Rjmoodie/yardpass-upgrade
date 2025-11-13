# Figma Code Connect Usage Guide

This guide walks you through connecting your Figma design file to this React component library using Figma's Code Connect feature.

## 🎯 What is Figma Code Connect?

Figma Code Connect bridges the gap between design and development by:
- Displaying live React component code directly in Figma Dev Mode
- Linking component props to design properties
- Providing documentation links from design to Storybook
- Showing real usage examples and TypeScript interfaces

## 🛠️ Setup Instructions

### Step 1: Enable Dev Mode in Figma

1. Open your Figma design file
2. Click the **Dev Mode** toggle in the top toolbar
3. Dev Mode interface will appear with code inspection tools

### Step 2: Connect Your Repository

1. In Dev Mode, locate the **Code Connect** panel on the right
2. Click **"Add Code Connect source"**
3. Choose **"GitHub Repository"** as your source type
4. Enter this repository URL:
   ```
   https://github.com/YOUR_USERNAME/liventix-figma
   ```
5. Click **"Connect"** to authenticate with GitHub

### Step 3: Configure Component Mapping

The repository includes a `figma.config.json` file that maps Figma components to React code:

```json
{
  "codeConnect": {
    "include": ["src/components/**/*.tsx"],
    "exclude": ["**/*.stories.tsx", "**/*.test.tsx"],
    "parser": "react"
  },
  "components": [
    {
      "figmaNode": "FIGMA_NODE_ID",
      "source": "./src/components/AuthScreen.tsx",
      "component": "AuthScreen",
      "docs": "https://username.github.io/liventix-figma/?path=/docs/components-authscreen--docs"
    }
  ]
}
```

### Step 4: Map Individual Components

For each component you want to connect:

1. **Select the component** in your Figma design
2. In the Code Connect panel, click **"Map to code"**
3. **Choose the React component** from the dropdown
4. **Configure property mappings** between Figma and React props
5. **Save the mapping**

## 🔍 Using Code Connect Features

### Viewing Component Code

Once connected, selecting any mapped component in Dev Mode will show:

- **React component code** with proper imports
- **TypeScript prop interfaces** with descriptions
- **Usage examples** showing how to implement the component
- **Direct links** to Storybook documentation

### Understanding Props

Component props are documented with JSDoc comments that appear in Figma:

```tsx
/**
 * AuthScreen component handles user authentication.
 * 
 * @param onAuth - Callback when authentication succeeds
 */
interface AuthScreenProps {
  /** Callback function called with phone and name when authentication is successful */
  onAuth: (phone: string, name: string) => void;
}
```

### Accessing Documentation

Each mapped component includes a direct link to its Storybook documentation where you can:
- See live interactive examples
- Test different prop combinations
- Copy code snippets
- View accessibility information

## 📋 Component Mapping Checklist

When mapping a new component:

- [ ] Component has JSDoc documentation
- [ ] Props are clearly defined with TypeScript
- [ ] Storybook story exists with examples
- [ ] Component is added to `figma.config.json`
- [ ] Figma node ID is correctly specified
- [ ] Documentation URL points to Storybook
- [ ] Property mappings are configured in Figma

## 🚀 Best Practices

### For Designers

1. **Use consistent naming** between Figma and React components
2. **Map design properties** to React props when possible
3. **Reference Storybook** for implementation guidance
4. **Communicate changes** to developers when design updates affect props

### For Developers

1. **Keep JSDoc updated** as it appears in Figma
2. **Maintain Storybook stories** for all mapped components
3. **Update `figma.config.json`** when adding new components
4. **Use semantic prop names** that match design terminology

## 🔧 Troubleshooting

### Component Not Appearing in Figma

- Verify the component is exported in the source file
- Check that `figma.config.json` includes the correct file path
- Ensure the GitHub repository connection is active
- Confirm the Figma node ID is correct

### Props Not Showing

- Add JSDoc comments to prop interfaces
- Verify TypeScript types are properly defined
- Check that the component export matches the config file
- Refresh the Code Connect connection

### Documentation Links Broken

- Verify Storybook is deployed and accessible
- Check that documentation URLs in `figma.config.json` are correct
- Ensure Storybook stories exist for mapped components

## 📚 Additional Resources

- **[Figma Code Connect Documentation](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Code-Connect)**
- **[Storybook Documentation](https://storybook.js.org/docs)**
- **[Project Storybook](https://YOUR_USERNAME.github.io/liventix-figma/)**

## 🆘 Getting Help

If you encounter issues:

1. Check this troubleshooting guide first
2. Review the [Figma Code Connect documentation](https://help.figma.com/hc/en-us/sections/15023120390423-Code-Connect)
3. Create an issue in this repository with detailed information
4. Include screenshots of error messages or unexpected behavior

---

Happy designing and developing! 🎨👩‍💻