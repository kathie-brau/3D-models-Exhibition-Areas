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
   * Predefined camera positions for different areas
   */
  static readonly CAMERA_POSITIONS: Record<string, CameraPosition> = {
    // Auto-tour positions (with special handling for individual halls)
    'Hall_B_2': { x: 7.55, y: 3.51, z: -0.48, targetX: 6.62, targetY: -0.15, targetZ: -1.81 },
    'Hall_C': { x: -2.05, y: 7.87, z: 5.73, targetX: -0.27, targetY: -0.41, targetZ: 0.4 },
    'Hall_E_3': { x: -3.58, y: 3.06, z: -0.68, targetX: -4.20, targetY: 0.40, targetZ: -1.85 },
    
    // Regular area positions
    'Hall_B_2_regular': { x: -0.30, y: 11.52, z: 4.96, targetX: -0.30, targetY: 0.49, targetZ: -0.92 },
    'Hall_C_regular': { x: -2.05, y: 7.87, z: 5.73, targetX: -0.27, targetY: -0.41, targetZ: 0.4 },
    'Hall_E_3_regular': { x: 0.38, y: 10.70, z: 9.78, targetX: -1.02, targetY: -1.20, targetZ: 1.38 },
    
    // Overview positions
    'all_in_one': { x: 0, y: 6.25, z: 3.75, targetX: 0, targetY: 0, targetZ: 0 },
    'MainExhibitionHall': { x: 0.0, y: 19.38, z: 10.33, targetX: 0.0, targetY: 0.0, targetZ: 0.0 }
  };

  /**
   * Auto-tour hall sequence (circular)
   */
  static readonly AUTO_TOUR_HALLS = ['Hall_B_2', 'Hall_C', 'Hall_E_3', 'all_in_one'];

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
    // Determine which position to use based on context
    let positionKey = areaId;
    
    // For auto-tour, use special positions for individual halls
    if (!isAutoTour && (areaId === 'Hall_B_2' || areaId === 'Hall_C' || areaId === 'Hall_E_3')) {
      positionKey = `${areaId}_regular`;
    }
    
    const position = this.CAMERA_POSITIONS[positionKey];
    if (!position) {
      console.warn(`No camera position defined for area: ${areaId}`);
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
   * Focus camera on area with optional auto-tour behavior
   */
  static focusCameraOnArea(
    areaId: string,
    controls: OrbitControls,
    camera: THREE.Camera,
    isAutoTour: boolean = false,
    onAutoTourComplete?: () => void
  ): void {
    // Skip camera positioning for individual halls unless it's auto-tour
    if (!isAutoTour && (areaId === 'Hall_B_2' || areaId === 'Hall_C' || areaId === 'Hall_E_3')) {
      console.log(`📹 Skipping camera positioning for individual hall: ${areaId} (not auto-tour)`);
      return;
    }
    
    const duration = isAutoTour ? 2000 : 1000; // Slower animation for auto-tour
    
    const onAnimationComplete = () => {
      if (isAutoTour && onAutoTourComplete) {
        // Start circular motion after reaching the position
        this.performCircularMotion(camera, controls, 3000, onAutoTourComplete);
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
   * Check if camera positioning should be skipped for an area
   */
  static shouldSkipCameraPositioning(areaId: string, isAutoTour: boolean): boolean {
    return !isAutoTour && (areaId === 'Hall_B_2' || areaId === 'Hall_C' || areaId === 'Hall_E_3');
  }
}