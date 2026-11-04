import { BriefcaseBusiness, Building2, UsersRound } from 'lucide-react';
import type { AuthUser } from './api';

export type UserRole = AuthUser['role'];

// The role choice in the sign-up dialog and in the account settings.
export const ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    value: 'CLIENT',
    label: 'Tražim izvođače',
    description: 'Želim objavljivati poslove.',
    icon: Building2,
  },
  {
    value: 'EXECUTOR',
    label: 'Tražim poslove',
    description: 'Želim se prijavljivati na oglase.',
    icon: BriefcaseBusiness,
  },
  {
    value: 'BOTH',
    label: 'Oboje',
    description: 'Želim objavljivati i raditi.',
    icon: UsersRound,
  },
];
