/**
 * TanStack Query hooks over the DataProvider. All mutations enforce role
 * permissions (spec §5) and write to the activity log (spec §5/§14).
 */
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { AppSettings } from '@engine';
import { provider } from '../data';
import type { Repo, CreateInput, UpdateInput } from '../data/provider';
import { qk } from '../lib/queryClient';
import { useAppStore } from '../store/appStore';
import { can, roleLabel, type Capability } from '../lib/permissions';

/** Throw (and toast) if the current role lacks a capability. */
export function enforce(capability: Capability): void {
  const { role, toast } = useAppStore.getState();
  if (!can(role, capability)) {
    toast(`Your role (${roleLabel(role)}) cannot perform this action`, 'danger');
    throw new Error(`Permission denied: ${capability}`);
  }
}

async function logActivity(action: string, entity: string, entityId: string | null, details?: Record<string, unknown>) {
  const { currentUserId } = useAppStore.getState();
  try {
    await provider.activity.log({ user_id: currentUserId, action, entity, entity_id: entityId, details: details ?? null });
  } catch {
    /* non-fatal */
  }
}

interface CrudOptions {
  capCreate?: Capability;
  capUpdate?: Capability;
  capDelete?: Capability;
}

function makeCrudHooks<T extends { id: string }>(
  key: QueryKey,
  repo: Repo<T>,
  entity: string,
  caps: CrudOptions = {},
) {
  const useList = () => useQuery({ queryKey: key, queryFn: () => repo.list() });

  const useItem = (id: string | undefined) =>
    useQuery({ queryKey: [...(key as unknown[]), id], queryFn: () => repo.get(id!), enabled: !!id });

  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (input: CreateInput<T>) => {
        if (caps.capCreate) enforce(caps.capCreate);
        const row = await repo.create(input);
        await logActivity('create', entity, row.id);
        return row;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    });
  };

  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: UpdateInput<T> }) => {
        if (caps.capUpdate) enforce(caps.capUpdate);
        const row = await repo.update(id, patch);
        await logActivity('update', entity, id);
        return row;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    });
  };

  const useRemove = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        if (caps.capDelete) enforce(caps.capDelete);
        await repo.remove(id);
        await logActivity('delete', entity, id);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    });
  };

  return { useList, useItem, useCreate, useUpdate, useRemove };
}

// ── Entity hook sets ──
export const resourcesH = makeCrudHooks(qk.resources, provider.resources, 'resource', {
  capCreate: 'edit_employees', capUpdate: 'edit_employees', capDelete: 'delete_employees',
});
export const projectsH = makeCrudHooks(qk.projects, provider.projects, 'project', {
  capCreate: 'edit_projects', capUpdate: 'edit_projects', capDelete: 'delete_projects',
});
export const stagesH = makeCrudHooks(qk.stages, provider.stages, 'stage', {
  capCreate: 'edit_projects', capUpdate: 'edit_projects', capDelete: 'edit_projects',
});
export const locationsH = makeCrudHooks(qk.locations, provider.locations, 'location', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});
export const disciplinesH = makeCrudHooks(qk.disciplines, provider.disciplines, 'discipline', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});
export const gradesH = makeCrudHooks(qk.grades, provider.grades, 'grade', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});
export const teamsH = makeCrudHooks(qk.teams, provider.teams, 'team', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});
export const stageTypesH = makeCrudHooks(qk.stageTypes, provider.stageTypes, 'stage_type', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});
export const holidaysH = makeCrudHooks(qk.holidays, provider.holidays, 'holiday', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});
export const usersH = makeCrudHooks(qk.users, provider.users, 'user', {
  capCreate: 'manage_master_data', capUpdate: 'manage_master_data', capDelete: 'manage_master_data',
});

// ── Settings ──
export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: () => provider.getSettings() });
}
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      enforce('system_settings');
      const next = await provider.saveSettings(patch);
      await logActivity('update', 'settings', null, patch);
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings }),
  });
}

// ── Allocations ──
export function useAllocations() {
  return useQuery({ queryKey: qk.allocations, queryFn: () => provider.allocations.list() });
}
export function useActivity(limit = 50) {
  return useQuery({ queryKey: [...qk.activity, limit], queryFn: () => provider.activity.list(limit) });
}
