'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============ Role Hierarchy ============
// dev < lead < admin  (higher = more access)
// client is separate (only sees client-specific content)

const ROLE_LEVEL: Record<UserRole, number> = {
  dev: 0,
  lead: 1,
  admin: 2,
  client: -1, // separate track — does not participate in dev/lead/admin hierarchy
};

/**
 * Check whether `userRole` satisfies the `requiredRole`.
 *
 * - For dev/lead/admin: user must be at the same level or higher in the hierarchy.
 * - For client: only an exact client match grants access.
 * - Cross-boundary checks (e.g. client → dev, admin → client) always fail.
 */
function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_LEVEL[userRole];
  const requiredLevel = ROLE_LEVEL[requiredRole];

  // client is on a separate track — exact match only
  if (requiredRole === 'client' || userRole === 'client') {
    return userRole === requiredRole;
  }

  // dev/lead/admin hierarchy: user level must be >= required level
  return userLevel >= requiredLevel;
}

/**
 * Resolve the effective required role string from the prop.
 * When `role` is an array we join with " / " for display.
 */
function formatRequiredRole(role: UserRole | UserRole[]): string {
  if (Array.isArray(role)) {
    return role.join(' / ');
  }
  return role;
}

// ============ Component ============

interface PermissionGuardProps {
  /** Required role(s) — if an array, ANY match grants access */
  role: UserRole | UserRole[];
  /** What to render when the user lacks permission: 'hide' | 'disable' | custom node. Default 'hide'. */
  fallback?: 'hide' | 'disable' | React.ReactNode;
  children: React.ReactNode;
  /** Tooltip shown on the disabled state. Default: "Permission requise : {role}" */
  tooltip?: string;
}

export function PermissionGuard({
  role,
  fallback = 'hide',
  children,
  tooltip,
}: PermissionGuardProps) {
  const userRole = useAppStore((s) => s.userRole);

  // Normalise to array for uniform processing
  const requiredRoles = Array.isArray(role) ? role : [role];

  // User has access if they satisfy ANY of the required roles
  const permitted = requiredRoles.some((r) => hasPermission(userRole, r));

  // ---- Permitted → render children as-is ----
  if (permitted) {
    return <>{children}</>;
  }

  // ---- Not permitted ----

  const requiredLabel = formatRequiredRole(role);

  // Custom ReactNode fallback
  if (typeof fallback !== 'string') {
    return <>{fallback}</>;
  }

  // 'hide' fallback → render nothing
  if (fallback === 'hide') {
    return null;
  }

  // 'disable' fallback → visually disabled + tooltip
  const tooltipText = tooltip ?? `Permission requise : ${requiredLabel}`;

  // Log access denial
  console.log(
    `Access denied: user role "${userRole}" requires "${requiredLabel}"`
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="pointer-events-none opacity-50 cursor-not-allowed inline-flex">
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

export default PermissionGuard;
