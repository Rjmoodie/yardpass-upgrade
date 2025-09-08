import type { Meta, StoryObj } from '@storybook/react';
import { AuthScreen } from './AuthScreen';

const meta: Meta<typeof AuthScreen> = {
  title: 'Components/AuthScreen',
  component: AuthScreen,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Authentication/guest access screen with phone/email toggle, OTP step, and optional name step.',
      },
    },
  },
  argTypes: {
    onAuth: { action: 'authenticated' },
    mode: {
      control: 'inline-radio',
      options: ['guest', 'full'],
    },
    allowEmail: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    mode: 'guest',
    allowEmail: true,
  },
};

export const Mobile: Story = {
  args: {
    mode: 'guest',
    allowEmail: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const FullAccountFlow: Story = {
  args: {
    mode: 'full',
    allowEmail: true,
  },
};

export const PhoneOnly: Story = {
  args: {
    mode: 'guest',
    allowEmail: false,
  },
};