import type { Meta, StoryObj } from '@storybook/react';
import { AuthScreen } from './AuthScreen';

const meta: Meta<typeof AuthScreen> = {
  title: 'Components/AuthScreen',
  component: AuthScreen,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Authentication screen component that handles user login with phone and name verification.',
      },
    },
  },
  argTypes: {
    onAuth: { action: 'authenticated' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};