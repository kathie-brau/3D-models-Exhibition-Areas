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
  // Track active auto-tour animations for interruption
  private static activeAutoTourAnimationId: number | null = null;
  private static activeAutoTourMotionId: number | null = null;
  /**
   * Auto-tour positions - only for all_in_one model auto-tour
   */
  static readonly AUTO_TOUR_POSITIONS: Record<string, CameraPosition> = {
    // Auto-tour positions within the all_in_one model
    'all_in_one': { x: 0.03, y: 7.2, z: 1.6, targetX: 0.03, targetY: 0.93, targetZ: -1.74 },
    'B': { x: 8.00, y: 3.81, z: -0.71, targetX: 6.85, targetY: -0.66, targetZ: -2.44 },
    'C': { x: 0.74, y: 3.47, z: 1.39, targetX: 0.76, targetY: 0.21, targetZ: -0.18 },
    'E': { x: -4.56, y: 3.51, z: -1.8, targetX: -4.81, targetY: 1.47, targetZ: -2.26 }
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
   * Stop active auto-tour animations immediately
   */
  static stopAutoTourAnimations(controls?: OrbitControls): void {
    if (this.activeAutoTourAnimationId !== null) {
      cancelAnimationFrame(this.activeAutoTourAnimationId);
      this.activeAutoTourAnimationId = null;
      console.log('🛑 Auto-tour camera animation stopped');
    }
    if (this.activeAutoTourMotionId !== null) {
      cancelAnimationFrame(this.activeAutoTourMotionId);
      this.activeAutoTourMotionId = null;
      console.log('🛑 Auto-tour circular motion stopped');
      
      // Re-enable controls if they were disabled by circular motion
      if (controls) {
        controls.enabled = true;
        controls.update();
        console.log('🔐 Controls re-enabled after stopping circular motion');
      }
    }
  }

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
      // Check if auto-tour animation was stopped (only for auto-tour)
      if (isAutoTour && this.activeAutoTourAnimationId === null) {
        console.log('📹 Auto-tour camera animation was stopped');
        return;
      }
      
      const elapsed = Date.now() - startTime;
      animationProgress = Math.min(elapsed / duration, 1);
      
      // Smooth easing function (cubic ease-out)
      const eased = 1 - Math.pow(1 - animationProgress, 3);
      
      // Interpolate camera position and target
      camera.position.lerpVectors(startPosition, targetPosition, eased);
      controls.target.lerpVectors(startTarget, targetLookAt, eased);
      controls.update();
      
      if (animationProgress < 1) {
        if (isAutoTour) {
          this.activeAutoTourAnimationId = requestAnimationFrame(animateCamera);
        } else {
          requestAnimationFrame(animateCamera);
        }
      } else {
        if (isAutoTour) {
          this.activeAutoTourAnimationId = null;
        }
        if (onComplete) {
          onComplete();
        }
      }
    };
    
    if (isAutoTour) {
      // Only stop camera animations, not circular motion, before starting new camera animation
      if (this.activeAutoTourAnimationId !== null) {
        cancelAnimationFrame(this.activeAutoTourAnimationId);
        this.activeAutoTourAnimationId = null;
      }
      this.activeAutoTourAnimationId = requestAnimationFrame(animateCamera);
    } else {
      animateCamera();
    }
  }

  /**
   * Perform circular camera motion around Y-axis using AUTO_TOUR_POSITIONS
   * Rotates around the point where camera-to-target vector intersects y=0 plane
   */
  static performCircularMotion(
    camera: THREE.Camera,
    controls: OrbitControls,
    duration: number = 3000,
    onComplete?: () => void,
    areaId?: string
  ): void {
    console.log(`🔄 Starting Y-axis circular motion for area: ${areaId}`);
    
    // Get the original AUTO_TOUR_POSITIONS for this area
    const originalPosition = areaId ? this.AUTO_TOUR_POSITIONS[areaId] : null;
    if (!originalPosition) {
      console.error(`No AUTO_TOUR_POSITIONS found for area: ${areaId}`);
      if (onComplete) onComplete();
      return;
    }
    
    // Use original camera and target positions from AUTO_TOUR_POSITIONS
    const cameraPos = new THREE.Vector3(originalPosition.x, originalPosition.y, originalPosition.z);
    const targetPos = new THREE.Vector3(originalPosition.targetX, originalPosition.targetY, originalPosition.targetZ);
    
    // Calculate where the camera-to-target vector intersects the y=0 plane
    const direction = targetPos.clone().sub(cameraPos).normalize();
    const t = -cameraPos.y / direction.y; // Solve for intersection with y=0 plane
    const rotationCenter = cameraPos.clone().add(direction.multiplyScalar(t));
    rotationCenter.y = 0; // Ensure it's on the ground plane
    
    // Calculate radius from camera position to rotation center (only X and Z)
    const centerToCameraVector = cameraPos.clone().sub(rotationCenter);
    const radius = Math.sqrt(centerToCameraVector.x * centerToCameraVector.x + centerToCameraVector.z * centerToCameraVector.z);
    const cameraHeight = cameraPos.y;
    
    // Calculate initial angle
    const initialAngle = Math.atan2(centerToCameraVector.x, centerToCameraVector.z);
    
    console.log('📍 Y-axis rotation setup:', {
      originalCamera: cameraPos,
      originalTarget: targetPos,
      rotationCenter: rotationCenter,
      radius: radius.toFixed(2),
      cameraHeight: cameraHeight.toFixed(2),
      initialAngle: (initialAngle * 180 / Math.PI).toFixed(1) + '°'
    });
    
    // Temporarily disable controls during circular motion
    const controlsWereEnabled = controls.enabled;
    controls.enabled = false;
    
    const startTime = Date.now();
    
    const circularMotion = () => {
      // Check if auto-tour circular motion was stopped
      if (this.activeAutoTourMotionId === null) {
        console.log('🌀 Auto-tour circular motion was stopped');
        // Re-enable controls if they were disabled
        controls.enabled = controlsWereEnabled;
        controls.update();
        return;
      }
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1) {
        // Calculate current angle for 360-degree Y-axis rotation with constant velocity
        const currentAngle = initialAngle + (Math.PI * 2 * progress);
        
        // Calculate new camera position rotating around Y-axis
        const newCameraX = rotationCenter.x + Math.sin(currentAngle) * radius;
        const newCameraZ = rotationCenter.z + Math.cos(currentAngle) * radius;
        
        // Update camera position (maintain original height)
        camera.position.set(newCameraX, cameraHeight, newCameraZ);
        
        // Always look at the original target position
        camera.lookAt(targetPos);
        controls.target.copy(targetPos);
        
        // // Log progress every 10%
        // if (Math.floor(progress * 10) !== Math.floor((progress - 0.1) * 10)) {
        //   console.log(`🔄 Y-axis rotation progress: ${Math.floor(progress * 100)}%`);
        // }
        
        this.activeAutoTourMotionId = requestAnimationFrame(circularMotion);
      } else {
        console.log('✅ Y-axis rotation complete');
        
        this.activeAutoTourMotionId = null;
        
        // Re-enable controls and ensure target is set correctly
        controls.enabled = controlsWereEnabled;
        controls.target.copy(targetPos);
        controls.update();
        
        if (onComplete) {
          setTimeout(onComplete, 50); // Reduced delay before next transition
        }
      }
    };
    
    // Only stop camera animations, not circular motion, before starting circular motion
    if (this.activeAutoTourAnimationId !== null) {
      cancelAnimationFrame(this.activeAutoTourAnimationId);
      this.activeAutoTourAnimationId = null;
    }
    this.activeAutoTourMotionId = requestAnimationFrame(circularMotion);
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
    
    const duration = isAutoTour ? 4000 : 1000; // Twice slower animation for auto-tour
    
    const onAnimationComplete = () => {
      if (isAutoTour && onAutoTourComplete) {
        // Add 360-degree rotation for hall positions B, C, E (not for overview)
        if (areaId === 'B' || areaId === 'C' || areaId === 'E') {
          this.performCircularMotion(camera, controls, 10000, onAutoTourComplete, areaId); // 10 seconds for full rotation
        } else {
          // For 'all_in_one' overview, just pause briefly before next transition
          setTimeout(onAutoTourComplete, 100); // Brief pause at overview
        }
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
