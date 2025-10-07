import * as THREE from 'three';
import { Booth } from '../types/booth';

/**
 * Utility class for managing THREE.js material operations, particularly for booth coloring
 */
export class MaterialManager {
  /**
   * Clone material if it hasn't been cloned yet to avoid affecting shared materials
   */
  static cloneMaterialIfNeeded(mesh: THREE.Mesh): void {
    if (!mesh.userData._materialCloned) {
      mesh.material = Array.isArray(mesh.material) 
        ? mesh.material.map(mat => mat.clone())
        : mesh.material.clone();
      mesh.userData._materialCloned = true;
    }
  }

  /**
   * Apply a color to a mesh material, cloning the material if necessary
   */
  static applyColorToMesh(mesh: THREE.Mesh, color: number): void {
    this.cloneMaterialIfNeeded(mesh);
    
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material && 'color' in material) {
      (material as THREE.MeshStandardMaterial).color.setHex(color);
      mesh.userData._statusColor = color;
    }
  }

  /**
   * Get the standard color for a booth status
   */
  static getStatusColor(status: string): number {
    switch (status?.toLowerCase()) {
      case 'sold':
        return 0x659C3E; // Green (#659C3E)
      case 'reserved':
        return 0x659C3E; // Green (#659C3E) - same as sold
      case 'available':
        return 0x0430A9; // Blue (#0430A9)
      case 'nil':
      default:
        return 0x0430A9; // Blue (#0430A9) - default for booths without entry
    }
  }

  /**
   * Apply booth status colors to all mapped meshes
   */
  static applyBoothStatusColors(
    meshMap: Map<THREE.Mesh, Booth>,
    booths: Booth[],
    areaName?: string
  ): void {
    console.log(`🎨 Applying booth status colors for ${areaName || 'area'}`);
    
    // Create a map of booth IDs to their status for quick lookup
    const boothStatusMap = new Map<string, string>();
    booths.forEach(booth => {
      boothStatusMap.set(booth.id, booth.status);
    });
    
    // Apply colors to mapped booth meshes
    meshMap.forEach((booth, mesh) => {
      const status = boothStatusMap.get(booth.id) || 'available'; // Default to available
      const color = this.getStatusColor(status);
      
      this.applyColorToMesh(mesh, color);
      mesh.userData._status = status;
      
      console.log(`    Applied ${status} color (${color.toString(16)}) to booth ${booth.id}`);
    });
    
    console.log(`  Applied colors to ${meshMap.size} mapped booths`);
  }

  /**
   * Apply default colors to unmapped meshes that match booth patterns
   */
  static applyDefaultColorsToUnmappedMeshes(
    scene: THREE.Scene,
    meshMap: Map<THREE.Mesh, Booth>,
    defaultColor: number = 0x0430A9 // Blue for available
  ): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name) {
        // Check if this mesh looks like a booth but isn't mapped
        if (object.name.includes('BOOTHLAYER_curve_') && !meshMap.has(object)) {
          const material = Array.isArray(object.material) ? object.material[0] : object.material;
          if (material && 'color' in material) {
            this.applyColorToMesh(object, defaultColor);
            object.userData._status = 'available';
            
            console.log(`    Applied available blue color to unmapped booth mesh ${object.name}`);
          }
        }
      }
    });
  }

  /**
   * Store original material color for hover effects
   */
  static storeOriginalColor(mesh: THREE.Mesh): void {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material && 'color' in material) {
      mesh.userData._origColor = (material as THREE.MeshStandardMaterial).color.getHex();
    }
  }

  /**
   * Apply hover effect to a mesh
   */
  static applyHoverEffect(
    mesh: THREE.Mesh, 
    glowColor: number, 
    intensity: number = 0.3
  ): void {
    // Save current color for restoration
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material && 'color' in material) {
      mesh.userData._hoverColor = (material as THREE.MeshStandardMaterial).color.getHex();
      
      // Clone material to avoid affecting shared materials
      if (!Array.isArray(mesh.material)) {
        mesh.material = material.clone();
      }
      
      const materialToUpdate = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      
      // Create glowing effect with emissive color
      materialToUpdate.emissive.setHex(glowColor);
      materialToUpdate.emissiveIntensity = intensity;
      
      // Slightly brighten the base color for additional glow
      const brighterColor = new THREE.Color(glowColor).multiplyScalar(1.5);
      materialToUpdate.color.copy(brighterColor);
    }
  }

  /**
   * Remove hover effect from a mesh
   */
  static removeHoverEffect(mesh: THREE.Mesh): void {
    if (mesh.material && mesh.userData._hoverColor !== undefined) {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      // Restore original color
      (material as THREE.MeshStandardMaterial).color.setHex(mesh.userData._hoverColor);
      // Remove glow effect
      (material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      (material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
  }

  /**
   * Get hover glow color based on booth status
   */
  static getHoverGlowColor(status: string): number {
    if (status === 'sold' || status === 'reserved') {
      return 0x659C3E; // Green glow for sold/reserved
    } else {
      return 0x0430A9; // Blue glow for available
    }
  }
}