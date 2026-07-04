// Copyright 2023 Im-Beast. MIT license.

export interface WorkbenchThreeOverlayPressureGateDecision {
  resetCadence: boolean;
  resetPressureCounters: boolean;
  updatePressure: boolean;
}

/**
 * Suppresses Three terminal-pressure adaptation while overlays are visible and
 * for a short cooldown after they close. Overlay redraws can be much heavier
 * than steady-state scene output, so including them in the pressure meter makes
 * the live Three pane collapse even though the renderer itself is healthy.
 */
export class WorkbenchThreeOverlayPressureGate {
  #wasOpen = false;
  #cooldownFrames = 0;
  #decision: WorkbenchThreeOverlayPressureGateDecision = {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: true,
  };

  constructor(private readonly cooldownFrames: number) {}

  inspect(): { wasOpen: boolean; cooldownFrames: number } {
    return { wasOpen: this.#wasOpen, cooldownFrames: this.#cooldownFrames };
  }

  reset(): void {
    this.#wasOpen = false;
    this.#cooldownFrames = 0;
  }

  resolve(overlayOpen: boolean): WorkbenchThreeOverlayPressureGateDecision {
    this.#decision.resetCadence = false;
    this.#decision.resetPressureCounters = false;
    this.#decision.updatePressure = true;

    if (overlayOpen) {
      this.#wasOpen = true;
      this.#cooldownFrames = this.#normalizedCooldownFrames();
      this.#decision.resetCadence = true;
      this.#decision.resetPressureCounters = true;
      this.#decision.updatePressure = false;
      return this.#decision;
    }

    if (this.#wasOpen) {
      this.#wasOpen = false;
      this.#cooldownFrames = this.#normalizedCooldownFrames();
      this.#decision.resetCadence = true;
      this.#decision.resetPressureCounters = true;
    }

    if (this.#cooldownFrames > 0) {
      this.#cooldownFrames -= 1;
      this.#decision.updatePressure = false;
      return this.#decision;
    }

    return this.#decision;
  }

  #normalizedCooldownFrames(): number {
    return Math.max(0, Math.floor(this.cooldownFrames));
  }
}
