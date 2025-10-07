import * as THREE from 'three';

/**
 * Utility class for managing callout sprites and their lifecycle
 */
export class CalloutManager {
  /**
   * Clear callouts from scene and properly dispose of resources
   */
  static clearCallouts<T extends THREE.Sprite>(
    scene: THREE.Scene,
    callouts: T[]
  ): void {
    callouts.forEach(callout => {
      scene.remove(callout);
      // Dispose of texture and material to prevent memory leaks
      if (callout.material && callout.material.map) {
        callout.material.map.dispose();
      }
      if (callout.material) {
        callout.material.dispose();
      }
    });
    callouts.length = 0; // Clear the array
  }

  /**
   * Get height offset for callouts based on area and callout type
   */
  static getHeightOffset(currentArea: string, calloutType: 'info' | 'name'): number {
    const offsets = {
      info: {
        'all_in_one': 0.6,
        'MainExhibitionHall': 1.2,
        default: 1.0
      } as Record<string, number>,
      name: {
        'MainExhibitionHall': 0.8,
        default: 0.41
      } as Record<string, number>
    };

    return offsets[calloutType][currentArea] || offsets[calloutType].default;
  }

  /**
   * Get size multiplier based on area and callout context
   */
  static getSizeMultiplier(currentArea: string, calloutContext: {
    isTechDays2026?: boolean;
    isIndividualHall?: boolean;
    isAllInOneOverview?: boolean;
    isAvailable?: boolean;
  } = {}): number {
    const { isTechDays2026, isIndividualHall, isAllInOneOverview, isAvailable } = calloutContext;
    
    if (isTechDays2026 && isAvailable) {
      return 4; // 4x size for available booths in MainExhibitionHall
    } else if (isTechDays2026) {
      return 2; // 2x size for sold/reserved booths in MainExhibitionHall
    } else if (isIndividualHall) {
      return 2.5; // 2.5x size for individual halls
    } else if (isAllInOneOverview) {
      return 0.7; // Smaller size for overview
    } else {
      return 1; // Default size
    }
  }

  /**
   * Get sprite size multiplier for name callouts specifically
   */
  static getNameCalloutSizeMultiplier(currentArea: string): number {
    const isMainExhibitionHall = currentArea === 'MainExhibitionHall';
    const isIndividualHall = ['Hall_B_2', 'Hall_C', 'Hall_E_3'].includes(currentArea);
    const isAllInOneOverview = currentArea === 'all_in_one';
    
    if (isMainExhibitionHall) {
      return 2;
    } else if (isIndividualHall) {
      return 1.8;
    } else if (isAllInOneOverview) {
      return 0.7;
    } else {
      return 1;
    }
  }

  /**
   * Calculate mesh center position for callout placement
   */
  static getMeshCenterPosition(mesh: THREE.Mesh): THREE.Vector3 {
    // Update mesh world matrix to ensure accurate positioning
    mesh.updateMatrixWorld(true);
    
    // Calculate mesh center position in world coordinates
    const box = new THREE.Box3().setFromObject(mesh);
    return box.getCenter(new THREE.Vector3());
  }

  /**
   * Create a callout position with height offset
   */
  static createCalloutPosition(
    mesh: THREE.Mesh,
    currentArea: string,
    calloutType: 'info' | 'name'
  ): THREE.Vector3 {
    const center = this.getMeshCenterPosition(mesh);
    const heightOffset = this.getHeightOffset(currentArea, calloutType);
    
    const position = center.clone();
    position.y += heightOffset;
    
    return position;
  }

  /**
   * Add callout to scene and track it
   */
  static addCalloutToScene(
    scene: THREE.Scene,
    callout: THREE.Sprite,
    calloutArray: THREE.Sprite[]
  ): void {
    scene.add(callout);
    calloutArray.push(callout);
  }

  /**
   * Log callout creation for debugging
   */
  static logCalloutCreation(
    boothId: string,
    calloutType: 'info' | 'name',
    area: string,
    sizeMultiplier?: number,
    isAvailable?: boolean,
    displayName?: string
  ): void {
    if (calloutType === 'info') {
      const areaLabel = area === 'MainExhibitionHall' ? 'TechDays 2026' : area;
      const availabilityLabel = isAvailable ? 'AVAILABLE' : 'SOLD/RESERVED';
      
      if (sizeMultiplier && sizeMultiplier > 1) {
        console.log(`🎯 Created ${sizeMultiplier}x larger sprite callout for ${availabilityLabel} ${areaLabel} booth ${boothId}`);
      }
    } else if (calloutType === 'name') {
      const shouldWrap = displayName && displayName.length > 10;
      const wrapLabel = shouldWrap ? 'multi-line' : 'single-line';
      
      if (area === 'MainExhibitionHall') {
        console.log(`🏢 Created 2x larger name callout for MainExhibitionHall booth ${boothId}: ${displayName} (${wrapLabel})`);
      } else if (['Hall_B_2', 'Hall_C', 'Hall_E_3'].includes(area)) {
        console.log(`🏢 Created 1.8x larger name callout for individual hall ${area} booth ${boothId}: ${displayName} (${wrapLabel})`);
      } else if (area === 'all_in_one') {
        console.log(`🏢 Created 0.7x smaller name callout for all_in_one overview booth ${boothId}: ${displayName} (${wrapLabel})`);
      }
    }
  }

  /**
   * Check if booth status is sold or reserved
   */
  static isSoldOrReserved(status: string): boolean {
    return Boolean(status && (status.toLowerCase() === 'sold' || status.toLowerCase() === 'reserved'));
  }

  /**
   * Check if booth is available
   */
  static isAvailable(status: string): boolean {
    return !this.isSoldOrReserved(status);
  }

  /**
   * Get formatted status text
   */
  static getFormattedStatusText(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  /**
   * Clear callouts of specific type and reset related state
   */
  static clearCalloutsAndResetState(
    scene: THREE.Scene,
    callouts: THREE.Sprite[],
    stateRef?: { current: any }
  ): void {
    this.clearCallouts(scene, callouts);
    if (stateRef) {
      stateRef.current = null;
    }
  }
}