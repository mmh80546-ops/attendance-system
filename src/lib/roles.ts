import type { AppRole } from './types';

/** Landing route per role after login. */
export const roleHome: Record<AppRole, string> = {
  admin: '/admin',
  hr_manager: '/hr',
  operations_manager: '/operations',
  project_manager: '/manager',
  site_engineer: '/team',
  supervisor: '/team',
  employee: '/me',
};

export const isApprover = (r: AppRole) =>
  ['admin', 'project_manager', 'site_engineer', 'supervisor'].includes(r);

export const isHrOrAdmin = (r: AppRole) => r === 'admin' || r === 'hr_manager';

export const isOrgWide = (r: AppRole) =>
  ['admin', 'hr_manager', 'operations_manager'].includes(r);

/** Nav items each role sees. */
export function navFor(role: AppRole): { href: string; key: string }[] {
  switch (role) {
    case 'admin':
      return [
        { href: '/admin', key: 'dashboard' },
        { href: '/admin/users', key: 'users' },
        { href: '/admin/projects', key: 'projects' },
        { href: '/admin/settings', key: 'settings' },
        { href: '/admin/audit', key: 'audit' },
        { href: '/reports', key: 'reports' },
      ];
    case 'hr_manager':
      return [
        { href: '/hr', key: 'dashboard' },
        { href: '/hr/employees', key: 'employees' },
        { href: '/hr/approvals', key: 'approvals' },
        { href: '/reports', key: 'reports' },
      ];
    case 'operations_manager':
      return [
        { href: '/operations', key: 'dashboard' },
        { href: '/reports', key: 'reports' },
      ];
    case 'project_manager':
      return [
        { href: '/manager', key: 'dashboard' },
        { href: '/manager/approvals', key: 'approvals' },
        { href: '/reports', key: 'reports' },
      ];
    case 'site_engineer':
    case 'supervisor':
      return [
        { href: '/team', key: 'team' },
        { href: '/team/approvals', key: 'approvals' },
        { href: '/me', key: 'attendance' },
      ];
    default:
      return [
        { href: '/me', key: 'home' },
        { href: '/me/attendance', key: 'attendance' },
        { href: '/me/leave', key: 'leave' },
      ];
  }
}
