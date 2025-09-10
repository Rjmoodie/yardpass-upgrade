export type RoleType = 'organizer' | 'scanner' | 'staff' | 'volunteer' | 'vendor' | 'guest';

export const ROLE_MATRIX: Record<RoleType, { 
  canScan: boolean; 
  canViewSales: boolean; 
  canMessage: boolean; 
  canManageRoles: boolean; 
  label: string;
  description: string;
}> = {
  organizer: { 
    canScan: true, 
    canViewSales: true, 
    canMessage: true, 
    canManageRoles: true,
    label: "Organizer",
    description: "Full access to event management"
  },
  scanner: { 
    canScan: true, 
    canViewSales: false, 
    canMessage: false, 
    canManageRoles: false,
    label: "Scanner",
    description: "Can scan and validate tickets"
  },
  staff: { 
    canScan: true, 
    canViewSales: false, 
    canMessage: false, 
    canManageRoles: false,
    label: "Staff",
    description: "Event staff with scanning privileges"
  },
  volunteer: { 
    canScan: false, 
    canViewSales: false, 
    canMessage: false, 
    canManageRoles: false,
    label: "Volunteer",
    description: "Event volunteer"
  },
  vendor: { 
    canScan: false, 
    canViewSales: false, 
    canMessage: false, 
    canManageRoles: false,
    label: "Vendor",
    description: "Event vendor or supplier"
  },
  guest: { 
    canScan: false, 
    canViewSales: false, 
    canMessage: false, 
    canManageRoles: false,
    label: "Guest",
    description: "Event guest"
  },
};

export const ROLES = Object.keys(ROLE_MATRIX) as RoleType[];

export type MessageChannel = 'email' | 'sms';

export interface RoleInvite {
  id: string;
  event_id: string;
  role: RoleType;
  email?: string;
  phone?: string;
  token: string;
  expires_at: string;
  invited_by: string;
  accepted_user_id?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
}

export interface EventRole {
  id: string;
  event_id: string;
  user_id: string;
  role: RoleType;
  status: string;
  created_by: string;
  created_at: string;
}

export interface MessageJob {
  id: string;
  event_id: string;
  channel: MessageChannel;
  template_id?: string;
  subject?: string;
  body?: string;
  sms_body?: string;
  from_name?: string;
  from_email?: string;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
  batch_size: number;
  scheduled_at?: string;
  created_by: string;
  created_at: string;
}