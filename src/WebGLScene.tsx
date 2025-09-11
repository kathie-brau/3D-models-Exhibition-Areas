import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { AreaData, BoothStatus, StatusColors } from './types/booth';
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer';

interface WebGLSceneProps {
  areaData: AreaData | null;
  showExhibitorDetails: boolean;
}

const WebGLScene: React.FC<WebGLSceneProps> = ({ areaData, showExhibitorDetails }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const css3dRendererRef = useRef<CSS3DRenderer | null>(null);
  const css3dSceneRef = useRef<THREE.Scene | null>(null);
  const animationRef = useRef<number | null>(null);
  const calloutsRef = useRef<CSS3DObject[]>([]);
  const nameCalloutsRef = useRef<CSS3DObject[]>([]); // For name callouts
  const boothMeshMapRef = useRef<Map<THREE.Mesh, any>>(new Map()); // Map mesh to booth data
  const cameraRef = useRef<THREE.Camera | null>(null); // Reference to camera for billboard effect


  useEffect(() => {
    if (!areaData) return;

    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // WebGL Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;
    
    // CSS3D Scene setup for callouts
    const css3dScene = new THREE.Scene();
    css3dSceneRef.current = css3dScene;

    // Camera setup - position to see the full 20x10m floor
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    camera.position.set(0, 15, 8); // Higher up and angled down to see full floor
    camera.lookAt(0, -1, 0); // Look at the floor
    cameraRef.current = camera; // Store camera reference for billboard effect

    // WebGL Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // CSS3D Renderer setup for callouts
    const css3dRenderer = new CSS3DRenderer();
    css3dRenderer.setSize(width, height);
    css3dRenderer.domElement.style.position = 'absolute';
    css3dRenderer.domElement.style.top = '0';
    css3dRenderer.domElement.style.left = '0';
    css3dRenderer.domElement.style.pointerEvents = 'none';
    css3dRenderer.domElement.style.zIndex = '100';
    css3dRendererRef.current = css3dRenderer;

    if (currentMount) {
      currentMount.appendChild(renderer.domElement);
      currentMount.appendChild(css3dRenderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;      // smoothness
    controls.enableZoom = true;         // incl. zoom
    controls.zoomSpeed = 1.0;           // zoom speed
    controls.minDistance = 2;           // min. distance
    controls.maxDistance = 50;          // max. distance
    controls.enablePan = true;          // panoramic view, if necessary

    // Function to map booth meshes to their data (for click handling)
    const mapBoothMeshes = () => {
      if (!areaData || !scene) return;

      console.log(`🏢 Mapping booth meshes for ${areaData.areaName}`);
      console.log(`  Booths: ${areaData.booths.length}`);
      
      // Clear existing mesh map
      boothMeshMapRef.current.clear();
      
      // Log booth data for debugging
      console.log('  Booth IDs:', areaData.booths.map(b => b.id).slice(0, 10));
      
      // Map each booth to its corresponding mesh
      areaData.booths.forEach((booth) => {
        // Try multiple mesh name patterns
        const possibleMeshNames = [
          `BOOTHLAYER_curve_.${booth.id}`,
          `BOOTHLAYER_curve_${booth.id}`,
          `${booth.id}`,
          `Booth_${booth.id}`,
          `booth_${booth.id}`,
          `${booth.id.replace('-', '_')}`,
          `${booth.id.toLowerCase()}`,
          `${booth.id.toUpperCase()}`
        ];
        
        console.log(`  Looking for mesh for booth ${booth.id}, trying patterns:`, possibleMeshNames.slice(0, 3));
        
        let foundMesh: THREE.Mesh | null = null;
        
        // Search through all meshes in the scene with different naming patterns
        for (const meshName of possibleMeshNames) {
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name === meshName) {
              foundMesh = object;
              console.log(`    Found mesh: ${meshName}`);
            }
          });
          if (foundMesh) break;
        }
        
        // Also try partial matches
        if (!foundMesh) {
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name) {
              if (object.name.includes(booth.id) || 
                  object.name.includes(booth.id.replace('-', '_')) ||
                  object.name.includes(booth.id.replace('-', ''))) {
                foundMesh = object;
                console.log(`    Found mesh by partial match: ${object.name}`);
              }
            }
          });
        }
        
        if (foundMesh !== null) {
          // Map this mesh to its booth data
          boothMeshMapRef.current.set(foundMesh as THREE.Mesh, booth);
          console.log(`    Mapped mesh ${(foundMesh as THREE.Mesh).name} to booth ${booth.id}`);
        } else {
          console.log(`    No mesh found for ${booth.id}`);
        }
      });
      
      console.log(`  Mapped ${boothMeshMapRef.current.size} booth meshes`);
      
      // List all mesh names for debugging
      console.log('  All mesh names in scene:');
      const allMeshNames: string[] = [];
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.name) {
          allMeshNames.push(object.name);
        }
      });
      console.log('   ', allMeshNames.slice(0, 20)); // Show first 20 to avoid console spam
    };

    // Function to show info callout for a specific booth (on click)
    const showBoothInfoCallout = (booth: any, mesh: THREE.Mesh) => {
      if (!css3dScene) return;
      
      // Clear only info callouts (keep name callouts visible)
      clearCallouts();
      
      // Update mesh world matrix to ensure accurate positioning
      mesh.updateMatrixWorld(true);
      
      // Calculate mesh center position in world coordinates
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      
      // Create info callout (ID, dimensions, area) - positioned higher above the mesh
      const infoCalloutPosition = center.clone();
      infoCalloutPosition.y += 1.2; // Higher position for info callouts
      const infoCallout = createBoothCallout(booth, infoCalloutPosition);
      css3dScene.add(infoCallout);
      calloutsRef.current.push(infoCallout);
      
      console.log(`Showing info callout for booth ${booth.id}`);
    };



    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);

    // Sky light (sky/ground) for more natural shadows and highlights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222233, 0.65);
    hemiLight.position.set(0, 1, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(12, 18, 10);
    dirLight.target.position.set(0, 0, 0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // Loading the model (TypeScript-friendly)
    const loader = new GLTFLoader();

    // Group/scene GLTF 
    let rootModel: THREE.Group | null = null;

    //  type guard
    const isMesh = (o: THREE.Object3D): o is THREE.Mesh =>
      (o as THREE.Mesh).isMesh === true;

    // Get all meshes (parts of the model)
    const collectMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
      const list: THREE.Mesh[] = [];
      root.traverse((o: THREE.Object3D) => {
        if (isMesh(o)) list.push(o);
      });
      return list;
    };


    function loadModel(url: string): Promise<THREE.Group> {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf: GLTF) => {
            // gltf.scene — THREE.Group
            resolve(gltf.scene);
          },
          undefined,
          reject
        );
      });
    }

    async function initModel(url: string): Promise<void> {
      try {
        const sceneRoot: THREE.Group = await loadModel(url);

        if (rootModel) scene.remove(rootModel);
        rootModel = sceneRoot;

        const meshes = collectMeshes(rootModel);
        console.log("Знайдено мешів:", meshes.map(m => m.name || m.uuid));
        const allowedNames = ["BOOTHLAYER_curve_*"];

        const matchesAllowed = (name?: string) => {
          if (!name) return false;
          return allowedNames.some(p => {
            if (p.endsWith("*")) return name.startsWith(p.slice(0, -1));
            return name === p;
          });
        };

        const markInteractives = (root: THREE.Object3D) => {
          root.traverse((o) => {
            if (isMesh(o)) {
              o.userData._interactive = matchesAllowed(o.name);
              // preserve the original color
              const mat = Array.isArray(o.material) ? o.material[0] : o.material;
              if ((mat as THREE.MeshStandardMaterial)?.color) {
                o.userData._origColor = (mat as THREE.MeshStandardMaterial).color.getHex();
              }
            }
          });
        };
        markInteractives(rootModel);

        // Let's type the traverse parameter (Object3D)
        rootModel.traverse((o: THREE.Object3D) => {
          // since the required fields are Mesh — we create a type guard
          if ((o as THREE.Mesh).isMesh) {
            const mesh = o as THREE.Mesh;

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // protection against color loss + preservation of original color
            const mat = mesh.material as THREE.Material | THREE.Material[];
            const single = Array.isArray(mat) ? mat[0] : mat;

            if ((single as THREE.MeshStandardMaterial)?.color) {
              mesh.userData._origColor = (single as THREE.MeshStandardMaterial).color.getHex();
            }
          }
        });

        // Centering/scale
        const box = new THREE.Box3().setFromObject(rootModel);
        const size = box.getSize(new THREE.Vector3());
        
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = (10 / (maxDim || 1))* 2;
        rootModel.scale.setScalar(scale);
        rootModel.position.y = 0.01;
        scene.add(rootModel);

        // Update all matrix transforms after scaling and positioning
        rootModel.updateMatrixWorld(true);
        
        // Map booth meshes after model is loaded, scaled, and positioned
        // Wait a bit for the scene to fully render before mapping meshes
        setTimeout(() => {
          mapBoothMeshes();
          // Apply booth status colors after mapping is complete
          setTimeout(() => {
            applyBoothStatusColors();
            // Create name callouts after coloring (if enabled)
            if (showExhibitorDetails) {
              setTimeout(() => {
                createAllNameCallouts();
              }, 100);
            }
          }, 100);
        }, 200); // Increased timeout to ensure transforms are applied
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert('Failed to load model: ' + msg);
      }
    }


    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersectors = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      rootModel?.traverse(o => {
        if (isMesh(o) && o.userData._interactive) list.push(o);
      });
      return list;
    };

    // In events:
    function setMouseFromEvent(e: MouseEvent, renderer: THREE.WebGLRenderer) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickInteractive(camera: THREE.Camera): THREE.Intersection[] {
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects(getIntersectors(), true);
    }

    let hovered: THREE.Mesh | null = null;

    const onPointerMove = (e: MouseEvent, renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
      console.log("On pointer move");
      setMouseFromEvent(e, renderer);
      const hits = pickInteractive(camera);

      if (hits.length) {
        const m = hits[0].object as THREE.Mesh;
        if (hovered !== m) {
          // restore the previous color
          if (hovered && hovered.material && hovered.userData._hoverColor !== undefined) {
            const mat = Array.isArray(hovered.material) ? hovered.material[0] : hovered.material;
            (mat as THREE.MeshStandardMaterial).color.setHex(hovered.userData._hoverColor);
          }
          // save and highlight in yellow
          const mat = Array.isArray(m.material) ? m.material[0] : m.material;
          if ((mat as THREE.MeshStandardMaterial)?.color) {
            m.userData._hoverColor = (mat as THREE.MeshStandardMaterial).color.getHex();
            // Clone to avoid affecting shared materials
            if (!Array.isArray(m.material)) m.material = mat.clone();
            ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial)
              .color.set("#ffff00");
          }
          hovered = m;
        }
      } else {
        // Turn off the backlight
        if (hovered && hovered.material && hovered.userData._hoverColor !== undefined) {
          const mat = Array.isArray(hovered.material) ? hovered.material[0] : hovered.material;
          (mat as THREE.MeshStandardMaterial).color.setHex(hovered.userData._hoverColor);
        }
        hovered = null;
      }
    };

    const onClick = (e: MouseEvent, renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
      setMouseFromEvent(e, renderer);
      const hits = pickInteractive(camera);
      if (!hits.length) {
        // Clicked on empty space - hide only info callouts (keep name callouts)
        clearCallouts();
        return;
      }

      const clickedMesh = hits[0].object as THREE.Mesh;
      
      // Check if this mesh has booth data
      const boothData = boothMeshMapRef.current.get(clickedMesh);
      if (boothData) {
        // Only show info callout if exhibitor details is not enabled
        // When exhibitor details is enabled, we only want to show names
        if (boothData.status != 'sold') {
          // Show info callout for this booth
          showBoothInfoCallout(boothData, clickedMesh);
        }
      }
    };

    renderer.domElement.addEventListener("mousemove", e => onPointerMove(e, renderer, camera));
    renderer.domElement.addEventListener("click", e => onClick(e, renderer, camera));
    
    // Use areaId directly from areaData
    initModel('/3D-models-Exhibition-Areas/models/'+areaData.areaId+'.glb');


    // Function to update callout orientations to face camera
    const updateCalloutOrientations = () => {
      if (!cameraRef.current) return;
      
      // Update info callouts to face camera
      calloutsRef.current.forEach(callout => {
        callout.lookAt(cameraRef.current!.position);
      });
      
      // Update name callouts to face camera
      nameCalloutsRef.current.forEach(callout => {
        callout.lookAt(cameraRef.current!.position);
      });
      
    };

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      controls.update();
      
      // Update callout orientations to face camera
      updateCalloutOrientations();
      
      // Ensure CSS3D renderer uses the same camera matrix as WebGL renderer
      camera.updateMatrixWorld();
      
      // Render both WebGL and CSS3D scenes with synchronized camera
      renderer.render(scene, camera);
      css3dRenderer.render(css3dScene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = (): void => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      css3dRenderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {

      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener("mousemove", e => onPointerMove(e, renderer, camera));
      renderer.domElement.removeEventListener("click", e => onClick(e, renderer, camera));
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      if (currentMount && css3dRenderer.domElement) {
        currentMount.removeChild(css3dRenderer.domElement);
      }

      renderer.dispose();
      controls.dispose();
    };
  }, [areaData]);

  // Effect to handle exhibitor details toggle
  useEffect(() => {
    if (!areaData || boothMeshMapRef.current.size === 0) return;
    
    // Clear all info callouts first
    clearCallouts();
    
    if (showExhibitorDetails) {
      // Show only name callouts
      createAllNameCallouts();
    } else {
      // Hide name callouts
      clearNameCallouts();
    }
  }, [showExhibitorDetails, areaData?.areaId]); // React to toggle changes and area changes

  // Effect to update booth colors when booth data changes
  useEffect(() => {
    if (!areaData || boothMeshMapRef.current.size === 0) return;
    
    // Apply status colors whenever booth data changes
    applyBoothStatusColors();
  }, [areaData?.booths]); // React to booth data changes

  // Function to create a booth callout (ID, dimensions, area) - Now larger and higher
  const createBoothCallout = (booth: any, position: THREE.Vector3): CSS3DObject => {
    const calloutDiv = document.createElement('div');
    // Add unique class for CSS targeting
    const uniqueId = `callout-${Math.random().toString(36).substr(2, 9)}`;
    calloutDiv.className = `info-callout ${uniqueId}`;
    
    calloutDiv.style.cssText = `
      background: linear-gradient(135deg, rgba(102, 170, 255, 0.95), rgba(51, 102, 204, 0.95));
      color: white;
      padding: 2.25px 4.5px;
      border-radius: 3px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 3.75px;
      text-align: center;
      pointer-events: none;
      border: 1px solid #ffffff;
      box-shadow: 0 2.25px 4.5px rgba(102,170,255,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
      min-width: 18px;
      z-index: 1001;
      position: relative;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      white-space: nowrap;
      text-shadow: 0 1px 1px rgba(0,0,0,0.5);
    `;
    
    
    calloutDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 0.75px; color: white; font-size: 4.5px; text-shadow: 0 1px 1px rgba(0,0,0,0.7);">${booth.id}</div>
      <div style="font-size: 3px; color: rgba(255,255,255,0.9); line-height: 1.2;">
        ${booth.width}m × ${booth.height}m<br>
        Area: ${booth.area}m²
      </div>
    `;
    
    const css3dObject = new CSS3DObject(calloutDiv);
    css3dObject.position.copy(position);
    // Position is already set correctly with offset in the calling function
    
    // Scale increased to 1.5x from 0.04
    css3dObject.scale.setScalar(0.06); // 0.04 * 1.5 = 0.06
    
    return css3dObject;
  };

  // Function to create a booth name callout - Now smaller and closer
  const createBoothNameCallout = (booth: any, position: THREE.Vector3): CSS3DObject => {
    const calloutDiv = document.createElement('div');
    // Add unique class for CSS targeting
    const uniqueId = `callout-${Math.random().toString(36).substr(2, 9)}`;
    calloutDiv.className = `name-callout ${uniqueId}`;
    
    calloutDiv.style.cssText = `
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 1px 3px;
      border-radius: 2px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 3px;
      text-align: center;
      pointer-events: none;
      border: 1px solid #66aaff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      min-width: 18px;
      z-index: 1000;
      position: relative;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      white-space: nowrap;
    `;
    
    
    // Truncate long names for better display
    const displayName = booth.name.length > 18 ? booth.name.substring(0, 18) + '...' : booth.name;
    
    calloutDiv.innerHTML = `
      <div style="font-weight: bold; color: #66aaff; font-size: 3px;">${displayName}</div>
    `;
    
    const css3dObject = new CSS3DObject(calloutDiv);
    css3dObject.position.copy(position);
    // Position is already set correctly with offset in the calling function
    
    // Scale smaller and closer to booth
    css3dObject.scale.setScalar(0.05); // Smaller scale for name callouts
    
    return css3dObject;
  };
  
  // Function to clear existing callouts and their tails
  const clearCallouts = () => {
    if (css3dSceneRef.current) {
      calloutsRef.current.forEach(callout => {
        css3dSceneRef.current?.remove(callout);
      });
      calloutsRef.current = [];
      
    }
  };

  // Function to clear existing name callouts
  const clearNameCallouts = () => {
    if (css3dSceneRef.current) {
      nameCalloutsRef.current.forEach(callout => {
        css3dSceneRef.current?.remove(callout);
      });
      nameCalloutsRef.current = [];
    }
  };


  // Function to clear all callouts (both types)
  const clearAllCallouts = () => {
    clearCallouts(); // This now also clears tails
    clearNameCallouts();
  };
  // Function to get color based on booth status
  const getStatusColor = (status: string): number => {
    switch (status.toLowerCase()) {
      case 'sold':
        return 0x888888; // Grey
      case 'reserved':
        return 0x87CEEB; // Light blue
      case 'available':
        return 0x00FF00; // Green
      case 'nil':
      default:
        return 0x00FF00; // Green (default for booths without entry)
    }
  };

  // Function to apply status colors to booth meshes
  const applyBoothStatusColors = () => {
    if (!areaData) return;

    console.log(`🎨 Applying booth status colors for ${areaData.areaName}`);
    
    // Create a map of booth IDs to their status for quick lookup
    const boothStatusMap = new Map<string, string>();
    areaData.booths.forEach(booth => {
      boothStatusMap.set(booth.id, booth.status);
    });
    
    // Apply colors to mapped booth meshes
    boothMeshMapRef.current.forEach((booth, mesh) => {
      const status = boothStatusMap.get(booth.id) || 'available'; // Default to available
      const color = getStatusColor(status);
      
      // Apply color to the mesh material
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (material && 'color' in material) {
        // Clone material if it's shared to avoid affecting other meshes
        if (!mesh.userData._materialCloned) {
          mesh.material = Array.isArray(mesh.material) 
            ? mesh.material.map(mat => mat.clone())
            : mesh.material.clone();
          mesh.userData._materialCloned = true;
        }
        
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        (mat as THREE.MeshStandardMaterial).color.setHex(color);
        mesh.userData._statusColor = color;
        mesh.userData._status = status;
        
        console.log(`    Applied ${status} color (${color.toString(16)}) to booth ${booth.id}`);
      }
    });
    
    // Also color any unmapped meshes that match booth patterns as available (green)
    if (sceneRef.current) {
      sceneRef.current.traverse((object) => {
        if (object instanceof THREE.Mesh && object.name) {
          // Check if this mesh looks like a booth but isn't mapped
          if (object.name.includes('BOOTHLAYER_curve_') && !boothMeshMapRef.current.has(object)) {
            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            if (material && 'color' in material) {
              // Clone material if needed
              if (!object.userData._materialCloned) {
                object.material = Array.isArray(object.material) 
                  ? object.material.map(mat => mat.clone())
                  : object.material.clone();
                object.userData._materialCloned = true;
              }
              
              const mat = Array.isArray(object.material) ? object.material[0] : object.material;
              (mat as THREE.MeshStandardMaterial).color.setHex(0x00FF00); // Green for available
              object.userData._statusColor = 0x00FF00;
              object.userData._status = 'available';
              
              console.log(`    Applied available color to unmapped booth mesh ${object.name}`);
            }
          }
        }
      });
    }
    
    console.log(`  Applied colors to ${boothMeshMapRef.current.size} mapped booths`);
  };

  // Function to create name callouts for all booths with names
  const createAllNameCallouts = () => {
    if (!areaData || !css3dSceneRef.current) return;

    console.log(`🏢 Creating name callouts for ${areaData.areaName}`);
    
    // Clear existing name callouts
    clearNameCallouts();
    
    // Create name callouts for all booths that have names and matching meshes
    boothMeshMapRef.current.forEach((booth, mesh) => {
      // Only create name callout if booth has a name
      if (booth.name && booth.name.trim() !== '') {
        // Update mesh world matrix to ensure accurate positioning
        mesh.updateMatrixWorld(true);
        
        // Calculate mesh center position in world coordinates
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        
        // Create name callout - positioned closer to the mesh
        const nameCalloutPosition = center.clone();
        nameCalloutPosition.y += 0.4; // Closer position for name callouts
        const nameCallout = createBoothNameCallout(booth, nameCalloutPosition);
        css3dSceneRef.current?.add(nameCallout);
        nameCalloutsRef.current.push(nameCallout);
        
        console.log(`    Added name callout for ${booth.id}: ${booth.name}`);
      }
    });
    
    console.log(`  Created ${nameCalloutsRef.current.length} name callouts`);
  };



  if (!areaData) {
    return <div>Loading scene...</div>;
  }

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default WebGLScene;