import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * Camera position configuration for different areas
 */
interface CameraPosition {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

/**
 * Utility class for managing camera animations and positioning
 */
export class CameraAnimator {
  /**
   * Auto-tour positions - only for all_in_one model auto-tour
   */
  static readonly AUTO_TOUR_POSITIONS: Record<string, CameraPosition> = {
    // Auto-tour positions within the all_in_one model
    'all_in_one': { x: 0.03, y: 7.2, z: 1.6, targetX: 0.03, targetY: 0.93, targetZ: -1.74 },
    'B': { x: 8.00, y: 3.81, z: -0.71, targetX: 6.85, targetY: -0.66, targetZ: -2.44 },
    'C': { x: 0.74, y: 3.47, z: 1.39, targetX: 0.76, targetY: 0.21, targetZ: -0.18 },
    'E': { x: -3.31, y: 2.83, z: -0.21, targetX: -4.32, targetY: 0.78, targetZ: -1.57 }
  };

  /**
   * Starting camera positions for each model when first loaded
   */
  static readonly STARTING_POSITIONS: Record<string, CameraPosition> = {
    'MainExhibitionHall': { x: 1.45, y: 14.72, z: 10.42, targetX: 1.45, targetY: -1.07, targetZ: 2.00 },
    'all_in_one': { x: 0.03, y: 7.2, z: 1.6, targetX: 0.03, targetY: 0.93, targetZ: -1.74 },
    'Hall_B_2': { x: -0.63, y: 10.49, z: 4.30, targetX: -0.63, targetY: 0.54, targetZ: -1.01 },
    'Hall_C': { x: 0.88, y: 8.59, z: 4.45, targetX: 0.88, targetY: 0.05, targetZ: -0.10 },
    'Hall_E_3': { x: -0.60, y: 11.04, z: 7.25, targetX: -0.6, targetY: -0.56, targetZ: 1.06 }
  };

  /**
   * Auto-tour hall sequence (circular)
   */
  static readonly AUTO_TOUR_HALLS = ['all_in_one', 'B', 'C', 'E'];

  /**
   * Animate camera to a specific position with smooth easing
   */
  static animateCameraToPosition(
    camera: THREE.Camera,
    controls: OrbitControls,
    areaId: string,
    duration: number = 1000,
    isAutoTour: boolean = false,
    onComplete?: () => void
  ): void {
    // Choose the correct position source based on context
    const positions = isAutoTour ? this.AUTO_TOUR_POSITIONS : this.STARTING_POSITIONS;
    const position = positions[areaId];
    
    if (!position) {
      console.warn(`No camera position defined for area: ${areaId} (${isAutoTour ? 'auto-tour' : 'starting'})`);
      return;
    }
    
    // Only allow auto-tour animations for halls in the auto-tour sequence
    if (isAutoTour && !this.AUTO_TOUR_HALLS.includes(areaId)) {
      console.log(`📹 Auto-tour animation only allowed for auto-tour halls: ${areaId}`);
      return;
    }

    const logPrefix = isAutoTour ? '🔄 Auto-tour' : '📹';
    console.log(`${logPrefix} Focusing camera on ${areaId} at position:`, position);
    
    // Create target vectors
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const targetPosition = new THREE.Vector3(position.x, position.y, position.z);
    const targetLookAt = new THREE.Vector3(position.targetX, position.targetY, position.targetZ);
    
    let animationProgress = 0;
    const startTime = Date.now();
    
    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      animationProgress = Math.min(elapsed / duration, 1);
      
      // Smooth easing function (cubic ease-out)
      const eased = 1 - Math.pow(1 - animationProgress, 3);
      
      // Interpolate camera position and target
      camera.position.lerpVectors(startPosition, targetPosition, eased);
      controls.target.lerpVectors(startTarget, targetLookAt, eased);
      controls.update();
      
      if (animationProgress < 1) {
        requestAnimationFrame(animateCamera);
      } else if (onComplete) {
        onComplete();
      }
    };
    
    animateCamera();
  }

  /**
   * Perform circular camera motion around the current target
   */
  static performCircularMotion(
    camera: THREE.Camera,
    controls: OrbitControls,
    duration: number = 3000,
    onComplete?: () => void
  ): void {
    console.log('🔄 Starting circular motion at hall');
    
    const basePosition = camera.position.clone();
    const lookAtTarget = controls.target.clone();
    const radius = basePosition.distanceTo(lookAtTarget);
    
    console.log('📍 Circular motion setup:', {
      basePosition: basePosition,
      lookAtTarget: lookAtTarget,
      radius: radius
    });
    
    // Calculate the initial angle
    const direction = basePosition.clone().sub(lookAtTarget).normalize();
    const initialAngle = Math.atan2(direction.x, direction.z);
    
    // Temporarily disable controls during circular motion
    const controlsWereEnabled = controls.enabled;
    controls.enabled = false;
    
    const startTime = Date.now();
    
    const circularMotion = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1) {
        // Calculate circular motion angle (full circle)
        const angle = initialAngle + (Math.PI * 2 * progress);
        
        // Calculate new camera position in a circle around the target
        const newX = lookAtTarget.x + Math.sin(angle) * radius;
        const newZ = lookAtTarget.z + Math.cos(angle) * radius;
        
        // Keep the same Y position (height) and update camera
        camera.position.set(newX, basePosition.y, newZ);
        camera.lookAt(lookAtTarget);
        
        // Log progress every 10%
        if (Math.floor(progress * 10) !== Math.floor((progress - 0.1) * 10)) {
          console.log(`🔄 Circular motion progress: ${Math.floor(progress * 100)}%`);
        }
        
        requestAnimationFrame(circularMotion);
      } else {
        console.log('✅ Circular motion complete');
        
        // Re-enable controls and restore them
        controls.enabled = controlsWereEnabled;
        controls.target.copy(lookAtTarget);
        controls.update();
        
        if (onComplete) {
          setTimeout(onComplete, 100); // Small delay before callback
        }
      }
    };
    
    circularMotion();
  }

  /**
   * Focus camera on area - only for all_in_one model auto-tour
   */
  static focusCameraOnArea(
    areaId: string,
    controls: OrbitControls,
    camera: THREE.Camera,
    isAutoTour: boolean = false,
    onAutoTourComplete?: () => void,
    currentModelArea?: string
  ): void {
    // Only allow camera positioning for auto-tour on all_in_one model
    if (!isAutoTour) {
      console.log(`📹 Camera positioning disabled for non-auto-tour: ${areaId}`);
      return;
    }
    
    if (currentModelArea !== 'all_in_one') {
      console.log(`📹 Auto-tour only available on all_in_one model, current model: ${currentModelArea}`);
      return;
    }
    
    const duration = isAutoTour ? 2000 : 1000; // Slower animation for auto-tour
    
    const onAnimationComplete = () => {
      if (isAutoTour && onAutoTourComplete) {
        // Skip circular motion - move directly to next position after a pause
        setTimeout(onAutoTourComplete, 1000); // 1 second pause at each position
      }
    };
    
    this.animateCameraToPosition(camera, controls, areaId, duration, isAutoTour, onAnimationComplete);
  }

  /**
   * Get the next hall in the auto-tour sequence
   */
  static getNextAutoTourHall(currentIndex: number): { hall: string; nextIndex: number } {
    const nextIndex = (currentIndex + 1) % this.AUTO_TOUR_HALLS.length;
    return {
      hall: this.AUTO_TOUR_HALLS[currentIndex],
      nextIndex: nextIndex
    };
  }

  /**
   * Set starting camera position without animation for model initialization
   */
  static setStartingCameraPosition(
    camera: THREE.Camera,
    controls: OrbitControls,
    areaId: string
  ): boolean {
    const position = this.STARTING_POSITIONS[areaId];
    
    if (!position) {
      console.warn(`No starting position defined for area: ${areaId}`);
      return false;
    }
    
    console.log(`📹 Setting starting camera position for ${areaId}:`, position);
    
    // Set camera position and target immediately without animation
    camera.position.set(position.x, position.y, position.z);
    controls.target.set(position.targetX, position.targetY, position.targetZ);
    controls.update();
    
    return true;
  }

  /**
   * Check if camera positioning should be skipped for an area - now skips everything except auto-tour
   */
  static shouldSkipCameraPositioning(areaId: string, isAutoTour: boolean): boolean {
    return !isAutoTour; // Skip all camera animations except auto-tour
  }
}
