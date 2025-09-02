import type { Meta, StoryObj } from '@storybook/react';
import { ImageWithFallback } from './ImageWithFallback';

const meta: Meta<typeof ImageWithFallback> = {
  title: 'Components/ImageWithFallback',
  component: ImageWithFallback,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'An image component that gracefully handles loading errors by showing a fallback placeholder.',
      },
    },
  },
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?w=400&h=300&fit=crop',
    alt: 'Sample image',
    className: 'w-64 h-48 object-cover rounded-lg',
  },
};

export const WithBrokenURL: Story = {
  args: {
    src: 'https://invalid-url.com/broken-image.jpg',
    alt: 'Broken image that will show fallback',
    className: 'w-64 h-48 object-cover rounded-lg',
  },
};