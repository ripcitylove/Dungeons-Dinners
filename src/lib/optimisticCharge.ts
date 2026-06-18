// A spell or class ability used via a BUTTON click spends the resource optimistically,
// before the DM confirms. If the DM then REJECTS the action ([NO-TURN]) the charge
// must be reversed — resources are only truly spent on a SUCCESSFUL cast/use.
// computeRefund() is the pure reversal: it undoes exactly what the click spent.

export type OptimisticCharge = {
  charId?: string;
  spellLevel?: number;   // a spell slot of this level was spent
  abilityKey?: string;   // a class resource (e.g. second_wind, rage) was spent
  abilityCost?: number;  // by this many uses
  rageApplied?: boolean; // the click also added the Raging status
};

type ResourceState = {
  spell_slots_used?: Record<string, number>;
  class_resources?: Record<string, number>;
  status_effects?: string[];
};

/**
 * Returns the resource state with `charge` reversed. Never goes negative; removes a
 * key once it returns to 0. `changed` is false when there was nothing to refund (so
 * callers can skip a needless write/broadcast).
 */
export function computeRefund(state: ResourceState, charge: OptimisticCharge): {
  spell_slots_used: Record<string, number>;
  class_resources: Record<string, number>;
  status_effects: string[];
  changed: boolean;
} {
  const spell_slots_used = { ...(state.spell_slots_used ?? {}) };
  const class_resources  = { ...(state.class_resources ?? {}) };
  let status_effects     = [...(state.status_effects ?? [])];
  let changed = false;

  if (charge.spellLevel != null) {
    const lvl = String(charge.spellLevel);
    if ((spell_slots_used[lvl] ?? 0) > 0) {
      const v = spell_slots_used[lvl] - 1;
      if (v <= 0) delete spell_slots_used[lvl]; else spell_slots_used[lvl] = v;
      changed = true;
    }
  }

  if (charge.abilityKey && charge.abilityCost) {
    const key = charge.abilityKey;
    if ((class_resources[key] ?? 0) > 0) {
      const v = Math.max(0, (class_resources[key] ?? 0) - charge.abilityCost);
      if (v === 0) delete class_resources[key]; else class_resources[key] = v;
      changed = true;
    }
  }

  if (charge.rageApplied && status_effects.includes("Raging")) {
    status_effects = status_effects.filter(s => s !== "Raging");
    changed = true;
  }

  return { spell_slots_used, class_resources, status_effects, changed };
}
