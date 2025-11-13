# Contributing to Liventix Figma Design System

Thank you for your interest in contributing! This document provides guidelines for contributing to the Liventix design system.

## 🏗️ Development Setup

1. **Fork and clone** the repository
2. **Install dependencies**: `npm install`
3. **Start development**: `npm run dev`
4. **Launch Storybook**: `npm run storybook`

## 📋 Coding Standards

### TypeScript
- Use strict TypeScript configuration
- Define interfaces for all component props
- Use proper JSDoc comments for all exported functions
- Avoid `any` types - use proper typing

### React Components
- Use functional components with hooks
- Follow the single responsibility principle
- Use proper prop destructuring
- Implement proper error boundaries when needed

### Styling
- Use Tailwind CSS utility classes
- Follow the design system tokens (CSS custom properties)
- Use semantic color names, not direct colors
- Ensure responsive design for all components
- Support both light and dark themes

### File Organization
```
src/components/
├── ComponentName/
│   ├── ComponentName.tsx      # Main component
│   ├── ComponentName.stories.tsx  # Storybook stories
│   └── index.ts              # Re-export
```

## 🎨 Design System Guidelines

### Colors
- Use HSL color values only
- Define colors in `src/index.css` as CSS custom properties
- Use semantic naming (e.g., `--color-primary`, not `--color-blue`)
- Support automatic dark mode switching

### Typography
- Use the defined font scale in CSS custom properties
- Apply proper line heights for readability
- Use semantic heading hierarchy

### Components
- Follow the existing component patterns
- Use consistent prop naming across similar components
- Implement proper accessibility attributes
- Support keyboard navigation

## 📚 Documentation

### JSDoc Comments
Every exported component must have JSDoc documentation:

```tsx
/**
 * Button component for user interactions.
 * Supports multiple variants and sizes for different use cases.
 * 
 * @param variant - Visual style variant (primary, secondary, destructive)
 * @param size - Component size (sm, md, lg)
 * @param disabled - Whether the button is disabled
 * @param children - Button content
 * @param onClick - Click event handler
 */
export function Button({ 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  children, 
  onClick 
}: ButtonProps) {
  // Implementation
}
```

### Storybook Stories
Create comprehensive stories for each component:

```tsx
export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'A versatile button component supporting multiple variants and states.',
      },
    },
  },
} as Meta<typeof Button>;

// Default story
export const Default: Story = {
  args: {
    children: 'Click me',
  },
};

// Variant stories
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

// Interactive story with controls
export const Interactive: Story = {
  args: {
    children: 'Interactive Button',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'destructive'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
};
```

## 🔗 Figma Integration

### Code Connect Setup
When adding components that should appear in Figma:

1. **Add JSDoc documentation** with clear prop descriptions
2. **Create Storybook stories** with comprehensive examples
3. **Update `figma.config.json`** with component mapping:

```json
{
  "figmaNode": "https://figma.com/file/FILE_ID/NODE_ID",
  "source": "./src/components/Button.tsx",
  "component": "Button",
  "props": {
    "variant": {
      "type": "string",
      "description": "Visual style variant"
    }
  },
  "example": "<Button variant='primary'>Click me</Button>",
  "docs": "https://username.github.io/liventix-figma/?path=/docs/components-button--docs"
}
```

4. **Test in Figma Dev Mode** to ensure proper mapping

## 🧪 Testing Guidelines

### Component Testing
- Test all component variants and states
- Test responsive behavior
- Test accessibility features
- Test keyboard navigation
- Test with both light and dark themes

### Manual Testing Checklist
- [ ] Component renders correctly in Storybook
- [ ] All variants display properly
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Keyboard navigation functions correctly
- [ ] Screen reader accessibility is supported
- [ ] Dark mode theme is applied correctly
- [ ] Component integrates properly in the main app

## 📝 Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(button): add new size variants

Add small and large size options to the Button component
to provide more flexibility in different UI contexts.

- Add sm and lg size variants
- Update Storybook stories
- Add responsive size behavior
```

## 🔄 Pull Request Process

1. **Create a branch** from `main` with a descriptive name
2. **Make your changes** following the coding standards
3. **Add/update tests** for your changes
4. **Update documentation** (README, Storybook, JSDoc)
5. **Run quality checks**:
   ```bash
   npm run lint
   npm run format
   npm run build
   npm run build-storybook
   ```
6. **Submit PR** with clear description of changes
7. **Address review feedback** promptly
8. **Squash merge** once approved

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Tested in Storybook
- [ ] Tested responsive design
- [ ] Tested accessibility
- [ ] Tested in main application

## Figma Integration
- [ ] Updated figma.config.json
- [ ] Tested in Figma Dev Mode
- [ ] Updated component documentation

## Screenshots/GIFs
(If applicable)
```

## 🐛 Reporting Issues

When reporting bugs or requesting features:

1. **Search existing issues** first
2. **Use issue templates** when available
3. **Provide detailed reproduction steps**
4. **Include screenshots/GIFs** when helpful
5. **Specify browser/device** if relevant

## 🎯 Component Checklist

Before submitting a new component:

- [ ] TypeScript interfaces defined
- [ ] JSDoc documentation complete
- [ ] Storybook stories created
- [ ] Responsive design implemented
- [ ] Accessibility attributes added
- [ ] Dark mode support added
- [ ] Design system tokens used
- [ ] Error states handled
- [ ] Loading states implemented (if applicable)
- [ ] Figma mapping configured
- [ ] Tests written and passing

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Storybook**: For component documentation and examples

Thank you for contributing to the Liventix design system! 🎉