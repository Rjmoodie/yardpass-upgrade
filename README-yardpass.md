# Liventix Figma Design System

A comprehensive React/TypeScript component library built from Figma designs, featuring Storybook documentation and Figma Code Connect integration.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/liventix-figma.git
cd liventix-figma

# Install dependencies
npm install

# Start development server
npm run dev

# Launch Storybook
npm run storybook
```

## 📚 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build Storybook for deployment

## 🎨 Figma Code Connect Integration

This repository is configured for Figma Code Connect, allowing designers to:

1. **View live code examples** directly in Figma Dev Mode
2. **Access component documentation** via Storybook links
3. **Understand props and usage** through JSDoc comments

### Setting up Figma Code Connect

1. In Figma, enable **Dev Mode** for your design file
2. In Dev Mode, click **Code Connect** in the right panel
3. Add this repository as a source:
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/liventix-figma/main/figma.config.json
   ```
4. Map your Figma components to code components in the config

### Updating Component Mappings

Edit `figma.config.json` to:
- Map Figma node IDs to React components
- Update Storybook documentation links
- Add component examples and prop descriptions

## 📖 Documentation

- **[Storybook Documentation](https://YOUR_USERNAME.github.io/liventix-figma/)** - Interactive component documentation
- **[Design Guidelines](./liventix%20figma/Guidelines.md)** - Design system principles
- **[Attributions](./liventix%20figma/Attributions.md)** - Third-party licenses

## 🏗️ Project Structure

```
liventix-figma/
├── src/
│   ├── components/          # React components
│   │   ├── figma/          # Figma-specific utilities
│   │   └── ui/             # UI library components
│   ├── server/             # Edge functions & utilities
│   └── index.css           # Global styles & design tokens
├── supabase/               # Database functions & migrations
├── .storybook/             # Storybook configuration
├── figma.config.json       # Figma Code Connect manifest
└── LICENSE                 # MIT License
```

## 🧩 Adding New Components

To add a new component that appears in Figma Code Connect:

1. **Create the component** with JSDoc documentation:
   ```tsx
   /**
    * Button component for user interactions.
    * 
    * @param variant - Button style variant
    * @param size - Button size
    * @param children - Button content
    */
   export function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
     // Component implementation
   }
   ```

2. **Create a Storybook story**:
   ```tsx
   // Button.stories.tsx
   export default {
     title: 'Components/Button',
     component: Button,
   };
   ```

3. **Update `figma.config.json`** with the new component mapping

4. **Map in Figma Dev Mode** to connect the design to code

## 🎯 Design System

The design system uses:
- **CSS Custom Properties** for theming
- **Tailwind CSS** for utility classes  
- **Semantic tokens** for consistent design
- **Component variants** for different states

### Color System
All colors use HSL values and support light/dark modes automatically.

### Typography
Typography scales are defined in CSS custom properties and applied consistently.

## 🔧 Development Workflow

1. **Design in Figma** - Create or update component designs
2. **Code in React** - Implement components with proper TypeScript types
3. **Document in Storybook** - Create interactive examples and documentation
4. **Connect via Code Connect** - Map Figma designs to code components
5. **Deploy** - GitHub Actions automatically deploys Storybook to GitHub Pages

## 🚀 Deployment

### Storybook Deployment
Storybook automatically deploys to GitHub Pages on push to `main`:
- **URL**: `https://YOUR_USERNAME.github.io/liventix-figma/`
- **Trigger**: Push to main branch
- **Action**: `.github/workflows/deploy-storybook.yml`

### Application Deployment
The main application can be deployed to any static hosting service:
- Build command: `npm run build`
- Output directory: `dist/`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and coding standards.

---

For questions or support, please create an issue in this repository.