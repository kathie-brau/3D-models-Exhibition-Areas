import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { AreaData } from './types/booth';
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CanvasTextRenderer } from './utils/canvasUtils';
import { MeshManager } from './utils/meshUtils';
import { MaterialManager } from './utils/materialUtils';
import { CameraAnimator } from './utils/cameraUtils';
import { CalloutManager } from './utils/calloutUtils';
// CSS3D renderer no longer needed - using sprites instead

interface WebGLSceneProps {
  areaData: AreaData | null;
  currentArea: string;
  showExhibitorDetails: boolean;
}

const WebGLScene: React.FC<WebGLSceneProps> = ({ areaData, currentArea, showExhibitorDetails }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // CSS3D renderer refs removed - using sprites in WebGL scene instead
  const animationRef = useRef<number | null>(null);
  const calloutsRef = useRef<THREE.Sprite[]>([]);
  const nameCalloutsRef = useRef<THREE.Sprite[]>([]); // For name callouts
  const boothMeshMapRef = useRef<Map<THREE.Mesh, any>>(new Map()); // Map mesh to booth data
  const cameraRef = useRef<THREE.Camera | null>(null); // Reference to camera for billboard effect
  const controlsRef = useRef<OrbitControls | null>(null); // Reference to controls for camera positioning
  const currentModelRef = useRef<string | null>(null); // Track currently loaded model to avoid unnecessary reloads
  const lastInteractionTimeRef = useRef<number>(Date.now()); // Track last user interaction
  const autoTourTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Auto-tour timeout reference
  const autoTourActiveRef = useRef<boolean>(false); // Track if auto-tour is active
  const currentAutoTourIndexRef = useRef<number>(0); // Current hall index in auto-tour
  const autoTourAnimationRef = useRef<number | null>(null); // Auto-tour animation frame reference
  // const autoTourStartTimeRef = useRef<number>(0); // Auto-tour animation start time (currently unused)
  const lastClickedBoothRef = useRef<any>(null); // Track the last clicked booth for toggle functionality

  // Helper function to determine which model should be loaded
  const getModelPath = (areaId: string): string => {
    // Use process.env.PUBLIC_URL to handle both development and production paths
    const basePath = process.env.PUBLIC_URL || '';

    // Each hall loads its own individual model
    switch (areaId) {
      case 'Hall_B_2':
        return `${basePath}/models/Hall_B_2.glb`;
      case 'Hall_C':
        return `${basePath}/models/Hall_C.glb`;
      case 'Hall_E_3':
        return `${basePath}/models/Hall_E_3.glb`;
      case 'all_in_one':
        return `${basePath}/models/all_in_one.glb`;
      case 'MainExhibitionHall':
        return `${basePath}/models/MainExhibitionHall.glb`;
      default:
        return `${basePath}/models/${areaId}.glb`;
    }
  };




  useEffect(() => {
    if (!areaData) return;

    console.log(`🏗️ Main useEffect triggered - Area: ${areaData.areaId}`);

    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    lastInteractionTimeRef.current = Date.now();

    // WebGL Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // White background
    sceneRef.current = scene;

    // CSS3D scene no longer needed - callouts now use sprites in WebGL scene

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

    // CSS3D renderer no longer needed - callouts now use sprite system

    if (currentMount) {
      currentMount.appendChild(renderer.domElement);
    }

    // Auto-tour hall sequence from CameraAnimator
    const autoTourHalls = CameraAnimator.AUTO_TOUR_HALLS;

    // Function to focus camera on specific area using CameraAnimator (only for all_in_one auto-tour)
    const focusCameraOnArea = (areaId: string, controls: OrbitControls, camera: THREE.Camera, isAutoTour: boolean = false) => {
      const onAutoTourComplete = () => {
        if (autoTourActiveRef.current) {
          setTimeout(() => {
            console.warn('Starting the tour in line 111');
            startAutoTour();
          }, 200); // Small delay before moving to next hall
        }
      };

      CameraAnimator.focusCameraOnArea(areaId, controls, camera, isAutoTour, onAutoTourComplete, currentArea);
    };

    // Function to start auto-tour (only for all_in_one model)
    const startAutoTour = () => {
      if (!controlsRef.current || !cameraRef.current) return;

      // Only allow auto-tour on all_in_one model
      if (currentArea !== 'all_in_one') {
        console.log(`🎬 Auto-tour only available on all_in_one model, current model: ${currentArea}`);
        return;
      }

      autoTourActiveRef.current = true;
      const { hall: nextHall, nextIndex } = CameraAnimator.getNextAutoTourHall(currentAutoTourIndexRef.current);

      console.log(`🎬 Auto-tour: Moving to ${nextHall} (${currentAutoTourIndexRef.current + 1}/${autoTourHalls.length})`);

      focusCameraOnArea(nextHall, controlsRef.current, cameraRef.current, true);

      // Move to next hall (circular)
      currentAutoTourIndexRef.current = nextIndex;
    };

    // Function to stop auto-tour
    const stopAutoTour = () => {
      if (autoTourActiveRef.current) {
        console.log('✉️ Auto-tour stopped due to user interaction');
        autoTourActiveRef.current = false;
      }
      
      // Immediately stop any running auto-tour animations
      CameraAnimator.stopAutoTourAnimations(controlsRef.current || undefined);
      
      if (autoTourTimeoutRef.current) {
        clearTimeout(autoTourTimeoutRef.current);
        autoTourTimeoutRef.current = null;
      }
      if (autoTourAnimationRef.current) {
        cancelAnimationFrame(autoTourAnimationRef.current);
        autoTourAnimationRef.current = null;
      }
    };

    // Function to handle genuine user interaction that should interrupt auto-tour
    const handleGenuineUserInteraction = () => {
      lastInteractionTimeRef.current = Date.now();
      stopAutoTour();

      // Clear existing timeout
      if (autoTourTimeoutRef.current) {
        clearTimeout(autoTourTimeoutRef.current);
      }

      // Only set auto-tour timeout for all_in_one model
      if (currentArea === 'all_in_one') {
        // Set new timeout for auto-tour
        autoTourTimeoutRef.current = setTimeout(() => {
          if (Date.now() - lastInteractionTimeRef.current >= 500) {
            console.log('💤 User inactive for 4 minutes, starting auto-tour...');
            console.warn('Starting the tour in line 178');
            startAutoTour();
          }
        }, 240000);
      }
    };
    
    // Function to handle camera changes (could be from user or auto-tour)
    const handleCameraChange = () => {
      // Don't interrupt auto-tour if camera changes are from auto-tour animations
      if (!autoTourActiveRef.current) {
        // Only update interaction time and start auto-tour timer if not during auto-tour
        lastInteractionTimeRef.current = Date.now();
        
        // Clear existing timeout
        if (autoTourTimeoutRef.current) {
          clearTimeout(autoTourTimeoutRef.current);
        }

        // Only set auto-tour timeout for all_in_one model
        if (currentArea === 'all_in_one') {
          // Set new timeout for auto-tour
          autoTourTimeoutRef.current = setTimeout(() => {
            if (Date.now() - lastInteractionTimeRef.current >= 500) {
              console.log('💤 User inactive for 500ms, starting auto-tour...');
              console.warn('Starting the tour in line 203');
              startAutoTour();
            }
          }, 240000);
        }
      }
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;      // smoothness
    controls.enableZoom = true;         // incl. zoom
    controls.zoomSpeed = 1.0;           // zoom speed
    controls.minDistance = 2;           // min. distance
    controls.maxDistance = 50;          // max. distance
    controls.enablePan = true;          // panoramic view, if necessary
    controlsRef.current = controls;     // Store controls reference

    // Add interaction listeners to controls
    controls.addEventListener('start', handleGenuineUserInteraction); // When user starts interacting with controls
    controls.addEventListener('change', handleCameraChange); // When controls change (could be user or auto-tour)

    // Function to map booth meshes to their data (for click handling)
    const mapBoothMeshes = () => {
      if (!areaData || !scene) return;
      MeshManager.mapBoothMeshes(scene, areaData.booths, boothMeshMapRef.current, areaData.areaName);
    };

    // Function to show info callout for a specific booth (on click)
    const showBoothInfoCallout = (booth: any, mesh: THREE.Mesh) => {
      console.log(`📝 showBoothInfoCallout called for booth:`, booth);

      if (!scene) {
        console.error('❌ scene not available');
        return;
      }

      // Clear only info callouts (keep name callouts visible)
      clearCallouts();

      // Create callout position using CalloutManager
      const infoCalloutPosition = CalloutManager.createCalloutPosition(mesh, currentArea, 'info');

      console.log(`📏 Callout position:`, infoCalloutPosition);
      console.log(`📏 Using height offset ${CalloutManager.getHeightOffset(currentArea, 'info')} for area ${currentArea}`);

      const infoCallout = createBoothCallout(booth, infoCalloutPosition);
      CalloutManager.addCalloutToScene(scene, infoCallout, calloutsRef.current);

      console.log(`✅ Info callout sprite created and added for booth ${booth.id}`);
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

        const markInteractives = (root: THREE.Object3D) => {
          let interactiveCount = 0;
          root.traverse((o) => {
            if (isMesh(o)) {
              const isInteractive = MeshManager.isInteractiveMesh(o, allowedNames);
              o.userData._interactive = isInteractive;
              if (isInteractive) {
                interactiveCount++;
              }
              // preserve the original color
              MaterialManager.storeOriginalColor(o);
            }
          });
          console.log(`🎯 Total interactive meshes marked: ${interactiveCount}`);
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
            MaterialManager.storeOriginalColor(mesh);
          }
        });

        // Centering/scale
        const box = new THREE.Box3().setFromObject(rootModel);
        const size = box.getSize(new THREE.Vector3());

        box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        let scale = (10 / (maxDim || 1)) * 2;

        // Make MainExhibitionHall model 1.5x larger
        if (currentArea === 'MainExhibitionHall') {
          scale = scale * 1.5;
          console.log(`🏗️ Applying 1.5x scale to MainExhibitionHall model (final scale: ${scale.toFixed(3)})`);
        }

        rootModel.scale.setScalar(scale);
        rootModel.position.y = 0.01;
        scene.add(rootModel);

        // Update all matrix transforms after scaling and positioning
        rootModel.updateMatrixWorld(true);

        // Map booth meshes after model is loaded, scaled, and positioned
        // Wait a bit for the scene to fully render before mapping meshes
        if (cameraRef.current && controlsRef.current) {
          CameraAnimator.setStartingCameraPosition(cameraRef.current, controlsRef.current, currentArea);
        }
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
            // Set starting camera position for this model


            // Start auto-tour timer after everything is initialized (only for all_in_one)
            setTimeout(() => {
              handleCameraChange();
            }, 500);
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
        if (isMesh(o) && o.userData._interactive) {
          // All interactive booth meshes are now clickable (including sold/reserved)
          list.push(o);
        }
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
      handleGenuineUserInteraction(); // Reset idle timer on mouse movement
      setMouseFromEvent(e, renderer);
      const hits = pickInteractive(camera);

      if (hits.length) {
        const m = hits[0].object as THREE.Mesh;
        if (hovered !== m) {
          // restore the previous color
          if (hovered) {
            MaterialManager.removeHoverEffect(hovered);
          }

          // Get the booth's status to determine glow color
          const boothData = boothMeshMapRef.current.get(m);
          const status = boothData?.status?.toLowerCase() || 'available';
          const glowColor = MaterialManager.getHoverGlowColor(status);

          // Apply hover effect using MaterialManager
          MaterialManager.applyHoverEffect(m, glowColor, 0.3);
          hovered = m;
        }
      } else {
        // Turn off the glow effect
        if (hovered) {
          MaterialManager.removeHoverEffect(hovered);
        }
        hovered = null;
      }
    };

    const onClick = (e: MouseEvent, renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
      handleGenuineUserInteraction(); // Reset idle timer on click
      setMouseFromEvent(e, renderer);
      const hits = pickInteractive(camera);

      if (!hits.length) {
        // Clicked on empty space - hide only info callouts (keep name callouts)
        clearCallouts();
        lastClickedBoothRef.current = null; // Reset last clicked booth
        return;
      }

      const clickedMesh = hits[0].object as THREE.Mesh;

      // Check if this mesh has booth data
      const boothData = boothMeshMapRef.current.get(clickedMesh);

      if (boothData) {
        // Check if this is the same booth that was clicked before
        const isSameBooth = lastClickedBoothRef.current &&
          lastClickedBoothRef.current.id === boothData.id;

        if (isSameBooth && calloutsRef.current.length > 0) {
          // Second click on same booth - hide callout (toggle off)
          console.log(`🔄 Toggling OFF callout for booth ${boothData.id}`);
          clearCallouts();
          lastClickedBoothRef.current = null;
        } else {
          // First click on this booth or different booth - show callout (toggle on)
          console.log(`🔄 Toggling ON callout for booth ${boothData.id}`);
          showBoothInfoCallout(boothData, clickedMesh);
          lastClickedBoothRef.current = boothData;
        }
      }
    };

    renderer.domElement.addEventListener("mousemove", e => onPointerMove(e, renderer, camera));
    renderer.domElement.addEventListener("click", e => onClick(e, renderer, camera));

    // Load the appropriate model based on current area
    const modelPath = getModelPath(currentArea);

    // Debug model loading
    console.log(`🏗️ Loading model: ${modelPath} for area: ${currentArea}`);
    console.log(`📁 PUBLIC_URL: ${process.env.PUBLIC_URL || 'undefined'}`);
    console.log(`🌐 Full model URL will be: ${window.location.origin}${modelPath}`);

    // Check if file exists by making a HEAD request
    fetch(modelPath, { method: 'HEAD' })
      .then(response => {
        console.log(`📦 Model file status: ${response.status} - ${response.ok ? 'OK' : 'NOT FOUND'}`);
        if (!response.ok) {
          console.error(`❌ Model file not found at: ${modelPath}`);
        }
      })
      .catch(error => {
        console.error(`❌ Error checking model file: ${error.message}`);
      });
    console.log(`🌍 Will show ${areaData.booths.length} booths on this model`);
    currentModelRef.current = modelPath;
    initModel(modelPath);

    // Initial camera positioning will be handled by the separate useEffect


    // Sprite callouts automatically face camera - no manual orientation needed
    const updateCalloutOrientations = () => {
      // Sprites automatically face camera - this function is now simplified
      // Keep it for potential future billboard adjustments if needed
    };

    // Animation loop
    let lastLogTime = 0;
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      controls.update();

      // Log camera position and target every 1 second
      const now = Date.now();
      if (now - lastLogTime > 1000) {
        const pos = camera.position;
        const target = controls.target;
        console.log(`📹 Camera Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        console.log(`🎯 Camera Look-At: (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`);
        lastLogTime = now;
      }

      // Update callout orientations (sprites auto-face camera)
      updateCalloutOrientations();

      // Render WebGL scene with sprites
      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = (): void => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      // Clean up auto-tour
      stopAutoTour();

      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener("mousemove", e => onPointerMove(e, renderer, camera));
      renderer.domElement.removeEventListener("click", e => onClick(e, renderer, camera));

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }

      renderer.dispose();
      controls.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaData, currentArea]); // React to areaData and currentArea changes

  // Effect to handle area-specific updates without reloading the model
  useEffect(() => {
    if (!areaData || !sceneRef.current || currentModelRef.current !== getModelPath(areaData.areaId)) {
      // Skip if no area data, no scene, or if model needs to be reloaded (handled by main effect)
      return;
    }

    // Model is already loaded, just update booth mappings and colors
    console.log(`🔄 Area changed to ${areaData.areaId}, updating booth data without reloading model`);

    const mapBoothMeshes = () => {
      if (!areaData || !sceneRef.current) return;
      MeshManager.mapBoothMeshes(sceneRef.current, areaData.booths, boothMeshMapRef.current, areaData.areaName);
    };

    // Apply booth status colors
    const applyBoothStatusColors = () => {
      if (!areaData) return;
      MaterialManager.applyBoothStatusColors(boothMeshMapRef.current, areaData.booths, areaData.areaName);
    };

    // Execute the updates with proper timing
    setTimeout(() => {
      mapBoothMeshes();
      setTimeout(() => {
        applyBoothStatusColors();
      }, 50);
    }, 50);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaData?.areaId, areaData?.booths]); // React to area ID and booth changes

  // Effect to handle initial camera positioning when area changes
  useEffect(() => {
    if (!areaData || !cameraRef.current || !controlsRef.current) return;

    // Set starting camera position for the current area (no animation)
    const timer = setTimeout(() => {
      CameraAnimator.setStartingCameraPosition(cameraRef.current!, controlsRef.current!, currentArea);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentArea, areaData]); // React to current area changes

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExhibitorDetails, areaData?.areaId]); // React to toggle changes and area changes

  // Effect to update booth colors when booth data changes
  useEffect(() => {
    if (!areaData || boothMeshMapRef.current.size === 0) return;

    // Apply status colors whenever booth data changes
    applyBoothStatusColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaData?.booths]); // React to booth data changes

  // Function to create a booth callout sprite with canvas texture
  const createBoothCallout = (booth: any, position: THREE.Vector3): THREE.Sprite => {
    // Determine content based on booth status
    const isSoldOrReserved = CalloutManager.isSoldOrReserved(booth.status);
    const isAvailable = CalloutManager.isAvailable(booth.status);

    // Get size multiplier using CalloutManager
    const sizeMultiplier = CalloutManager.getSizeMultiplier(currentArea, {
      isTechDays2026: currentArea === 'MainExhibitionHall',
      isIndividualHall: ['Hall_B_2', 'Hall_C', 'Hall_E_3'].includes(currentArea),
      isAllInOneOverview: currentArea === 'all_in_one',
      isAvailable: isAvailable
    });

    let canvas: HTMLCanvasElement;

    if (isSoldOrReserved) {
      // Show status (Sold/Reserved) and company name for sold or reserved booths using original format
      const statusText = CalloutManager.getFormattedStatusText(booth.status);
      let formattedText = booth.id; // First line: booth ID (bold)
      if (booth.name && booth.name.trim() !== '') {
        formattedText += `\n\n${statusText}\n\n${booth.name}`; // Status and company name
      } else {
        formattedText += `\n\n${statusText}`; // Just status
      }

      canvas = CanvasTextRenderer.createMultiLineTextCanvas({
        lines: formattedText.split('\n'),
        titleFontSize: 22 * sizeMultiplier,
        contentFontSize: 18 * sizeMultiplier,
        fontFamily: 'Arial, sans-serif',
        titleColor: 'white',
        contentColor: 'rgba(255,255,255,0.9)',
        backgroundColor: 'transparent',
        padding: 12 * sizeMultiplier,
        borderRadius: 8 * sizeMultiplier,
        borderColor: '#ffffff',
        borderWidth: 1 * sizeMultiplier,
        maxWidth: 200 * sizeMultiplier,
        gradient: {
          colors: ['rgba(43, 179, 43, 0.95)', 'rgba(34, 139, 34, 0.95)'],
          direction: 'vertical'
        },
        shadow: {
          color: 'rgba(43, 179, 43, 0.4)',
          blur: 8 * sizeMultiplier,
          offsetX: 0,
          offsetY: 4 * sizeMultiplier
        }
      });
    } else {
      // Use new custom format: ID first row, area in lighter box + dimensions second row
      canvas = CanvasTextRenderer.createBoothCalloutCanvas({
        boothId: booth.id,
        area: `Area: ${booth.area}m²`,
        dimensions: `${booth.width}m × ${booth.height}m`,
        titleFontSize: 22 * sizeMultiplier,
        contentFontSize: 18 * sizeMultiplier,
        fontFamily: 'Arial, sans-serif',
        titleColor: 'white',
        contentColor: 'white',
        areaBoxColor: 'rgba(255, 255, 255, 0.25)', // Lighter box for area
        backgroundColor: 'transparent',
        padding: 12 * sizeMultiplier,
        borderRadius: 8 * sizeMultiplier,
        borderColor: '#ffffff',
        borderWidth: 1 * sizeMultiplier,
        maxWidth: 200 * sizeMultiplier,
        gradient: {
          colors: ['rgba(43, 179, 43, 0.95)', 'rgba(34, 139, 34, 0.95)'],
          direction: 'vertical'
        },
        shadow: {
          color: 'rgba(43, 179, 43, 0.4)',
          blur: 8 * sizeMultiplier,
          offsetX: 0,
          offsetY: 4 * sizeMultiplier
        }
      });
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      sizeAttenuation: true
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);

    // Scale the sprite appropriately - increased by 2x
    // Adjust scale based on canvas aspect ratio to maintain proper proportions
    const baseScale = 0.8 * sizeMultiplier; // Increased from 0.4 to 0.8 (2x larger)
    const aspectRatio = canvas.height / canvas.width;
    sprite.scale.set(baseScale, baseScale * aspectRatio, 1);

    // Store booth data for reference
    sprite.userData.booth = booth;
    sprite.userData.isTechDays2026 = currentArea === 'MainExhibitionHall';

    // Log creation using CalloutManager
    CalloutManager.logCalloutCreation(booth.id, 'info', currentArea, sizeMultiplier, isAvailable);

    return sprite;
  };

  // Function to create a booth name callout sprite
  const createBoothNameCallout = (booth: any, position: THREE.Vector3): THREE.Sprite => {
    // Get sprite size multiplier using CalloutManager
    const spriteSizeMultiplier = CalloutManager.getNameCalloutSizeMultiplier(currentArea);

    // For names longer than 10 characters, enable multi-line wrapping
    const shouldWrap = booth.name.length > 10;
    const displayName = booth.name; // Don't truncate, let it wrap instead

    // Create canvas texture for name callout with flexible width
    const canvas = CanvasTextRenderer.createTextCanvas({
      text: displayName,
      fontSize: 16.8, // 20% larger than 14px (14 * 1.2 = 16.8)
      fontFamily: 'Arial, sans-serif',
      color: '#66aaff',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      padding: 4,
      borderRadius: 2,
      borderColor: '#66aaff',
      borderWidth: 0.5,
      maxWidth: shouldWrap ? 80 : 200, // Narrower width for wrapping, wider for single line
      textAlign: 'center',
      lineHeight: 1.3 // Slightly more spacing for multi-line text
    });

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      sizeAttenuation: true
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);

    // Scale the sprite - increased by 2x overall
    // Maintain proper aspect ratio for text readability
    const baseScale = 0.5 * spriteSizeMultiplier; // Increased from 0.25 to 0.5 (2x larger)
    const aspectRatio = canvas.height / canvas.width;
    sprite.scale.set(baseScale, baseScale * aspectRatio, 1);

    // Store booth data for reference
    sprite.userData.booth = booth;
    sprite.userData.isNameCallout = true;
    sprite.userData.isMainExhibitionHall = currentArea === 'MainExhibitionHall';

    // Log creation using CalloutManager
    CalloutManager.logCalloutCreation(booth.id, 'name', currentArea, spriteSizeMultiplier, undefined, displayName);

    return sprite;
  };

  // Function to clear existing callouts
  const clearCallouts = () => {
    if (sceneRef.current) {
      CalloutManager.clearCalloutsAndResetState(sceneRef.current, calloutsRef.current, lastClickedBoothRef);
    }
  };

  // Function to clear existing name callouts
  const clearNameCallouts = () => {
    if (sceneRef.current) {
      CalloutManager.clearCallouts(sceneRef.current, nameCalloutsRef.current);
    }
  };



  // Function to apply status colors to booth meshes
  const applyBoothStatusColors = () => {
    if (!areaData) return;

    MaterialManager.applyBoothStatusColors(boothMeshMapRef.current, areaData.booths, areaData.areaName);

    // Color any unmapped meshes that match booth patterns as available (green)
    if (sceneRef.current) {
      MaterialManager.applyDefaultColorsToUnmappedMeshes(sceneRef.current, boothMeshMapRef.current);
    }
  };

  // Function to create name callouts for all booths with names
  const createAllNameCallouts = () => {
    if (!areaData || !sceneRef.current) return;

    console.log(`🏢 Creating name callouts for ${areaData.areaName}`);

    // Clear existing name callouts
    clearNameCallouts();

    // Create name callouts for all booths that have names and matching meshes
    boothMeshMapRef.current.forEach((booth, mesh) => {
      // Only create name callout if booth has a name
      if (booth.name && booth.name.trim() !== '') {
        // Create name callout position using CalloutManager
        const nameCalloutPosition = CalloutManager.createCalloutPosition(mesh, currentArea, 'name');
        const nameCallout = createBoothNameCallout(booth, nameCalloutPosition);

        if (sceneRef.current) {
          CalloutManager.addCalloutToScene(sceneRef.current, nameCallout, nameCalloutsRef.current);
        }

        console.log(`    Added name callout for ${booth.id}: ${booth.name} (height offset: ${CalloutManager.getHeightOffset(currentArea, 'name')})`);
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