import * as THREE from 'three';
import { Booth } from '../types/booth';

/**
 * Utility class for managing THREE.js mesh operations, particularly booth mesh mapping
 */
export class MeshManager {
  /**
   * Generate all possible mesh name patterns for a booth ID
   */
  static generateMeshNamePatterns(boothId: string): string[] {
    return [
      `BOOTHLAYER_curve_.${boothId}`,
      `BOOTHLAYER_curve_${boothId}`,
      `${boothId}`,
      `Booth_${boothId}`,
      `booth_${boothId}`,
      `${boothId.replace('-', '_')}`,
      `${boothId.toLowerCase()}`,
      `${boothId.toUpperCase()}`
    ];
  }

  /**
   * Find a mesh by exact name match in the scene
   */
  static findMeshByName(scene: THREE.Scene, nameToFind: string): THREE.Mesh | null {
    let mesh: THREE.Mesh | null = null;
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name === nameToFind) {
        mesh = object;
      }
    });
    return mesh;
  }

  /**
   * Find a mesh by partial name match for a booth ID
   */
  static findMeshByPartialMatch(scene: THREE.Scene, boothId: string): THREE.Mesh | null {
    let foundMesh: THREE.Mesh | null = null;
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name) {
        if (object.name.includes(boothId) || 
            object.name.includes(boothId.replace('-', '_')) ||
            object.name.includes(boothId.replace('-', ''))) {
          foundMesh = object;
        }
      }
    });
    return foundMesh;
  }

  /**
   * Map all booths to their corresponding meshes in the scene
   */
  static mapBoothMeshes(
    scene: THREE.Scene, 
    booths: Booth[], 
    meshMap: Map<THREE.Mesh, Booth>,
    areaName?: string
  ): void {
    console.log(`🏢 Mapping booth meshes for ${areaName || 'area'}`);
    console.log(`  Booths: ${booths.length}`);
    
    // Clear existing mesh map
    meshMap.clear();
    
    // Log booth data for debugging
    console.log('  Booth IDs:', booths.map(b => b.id).slice(0, 10));
    
    // Map each booth to its corresponding mesh
    booths.forEach((booth) => {
      const possibleMeshNames = this.generateMeshNamePatterns(booth.id);
      
      console.log(`  Looking for mesh for booth ${booth.id}, trying patterns:`, possibleMeshNames.slice(0, 3));
      
      let foundMesh: THREE.Mesh | null = null;
      
      // Try exact matches first
      for (const meshName of possibleMeshNames) {
        foundMesh = this.findMeshByName(scene, meshName);
        if (foundMesh) {
          console.log(`    Found mesh: ${meshName}`);
          break;
        }
      }
      
      // Try partial matches if no exact match
      if (!foundMesh) {
        foundMesh = this.findMeshByPartialMatch(scene, booth.id);
        if (foundMesh) {
          console.log(`    Found mesh by partial match: ${foundMesh.name}`);
        }
      }
      
      if (foundMesh) {
        // Map this mesh to its booth data
        meshMap.set(foundMesh, booth);
        console.log(`    Mapped mesh ${foundMesh.name} to booth ${booth.id}`);
      } else {
        console.log(`    No mesh found for ${booth.id}`);
      }
    });
    
    console.log(`  Mapped ${meshMap.size} booth meshes`);
    
    // List all mesh names for debugging
    console.log('  All mesh names in scene:');
    const allMeshNames: string[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name) {
        allMeshNames.push(object.name);
      }
    });
    console.log('   ', allMeshNames.slice(0, 20)); // Show first 20 to avoid console spam
  }

  /**
   * Get all mesh names in a scene for debugging
   */
  static getAllMeshNames(scene: THREE.Scene): string[] {
    const meshNames: string[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name) {
        meshNames.push(object.name);
      }
    });
    return meshNames;
  }

  /**
   * Check if a mesh is interactive (matches booth patterns)
   */
  static isInteractiveMesh(mesh: THREE.Mesh, allowedPatterns: string[] = ["BOOTHLAYER_curve_*"]): boolean {
    if (!mesh.name) return false;
    
    return allowedPatterns.some(pattern => {
      if (pattern.endsWith("*")) {
        return mesh.name.startsWith(pattern.slice(0, -1));
      }
      return mesh.name === pattern;
    });
  }
}