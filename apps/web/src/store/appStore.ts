/**
 * Lightweight client state: sidebar, current user/role, dashboard persona,
 * and the toast queue. Domain data lives in the data layer / TanStack Query.
 */
import { create } from 'zustand';
import type { AppRole } from '@engine';

export type Persona = 'resource_manager' | 'executive' | 'project_manager' | 'discipline_lead';

export interface ToastItem {
  id: number;
  message: string;
  kind: 'success' | 'warning' | 'danger' | 'info';
}

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Current signed-in user (frontend-first stand-in for real auth).
  currentUserId: string;
  currentUserName: string;
  role: AppRole;
  /** For Staff: the resource record this account maps to (drives "My Allocation"). */
  currentResourceId: string | null;
  setRole: (role: AppRole) => void;
  setCurrentResource: (resourceId: string | null) => void;
  setUser: (u: { id: string; name: string; role: AppRole; resourceId?: string | null }) => void;

  persona: Persona;
  setPersona: (p: Persona) => void;

  toasts: ToastItem[];
  toast: (message: string, kind?: ToastItem['kind']) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 1;

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  currentUserId: 'user-master',
  currentUserName: 'Master Admin',
  role: 'master_admin',
  currentResourceId: null,
  setRole: (role) => set({ role }),
  setCurrentResource: (currentResourceId) => set({ currentResourceId }),
  setUser: (u) => set({ currentUserId: u.id, currentUserName: u.name, role: u.role, currentResourceId: u.resourceId ?? null }),

  persona: 'resource_manager',
  setPersona: (persona) => set({ persona }),

  toasts: [],
  toast: (message, kind = 'success') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
