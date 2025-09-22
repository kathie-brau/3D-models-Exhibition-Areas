import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { AreaData } from './types/booth';
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
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

  // Helper function to determine which model should be loaded
  const getModelPath = (areaId: string): string => {
    // All energy areas use the combined model
    if (areaId === 'Hall_B_2' || areaId === 'Hall_C' || areaId === 'Hall_E_3' || areaId === 'all_in_one') {
      return '/3D-models-Exhibition-Areas/models/all_in_one.glb';
    }
    // Other areas use their individual models
    return '/3D-models-Exhibition-Areas/models/' + areaId + '.glb';
  };

  // Canvas texture generation for high-quality text rendering
  const createTextCanvas = (config: {
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    padding: number;
    borderRadius: number;
    borderColor?: string;
    borderWidth?: number;
    maxWidth?: number;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    gradient?: { colors: string[]; direction?: 'horizontal' | 'vertical' };
    shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  }): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Set default values
    const {
      text,
      fontSize,
      fontFamily,
      color,
      backgroundColor,
      padding,
      borderRadius,
      borderColor,
      borderWidth = 0,
      maxWidth = 400,
      textAlign = 'center',
      lineHeight = 1.2,
      gradient,
      shadow
    } = config;
    
    // Configure high DPI canvas
    const scaledFontSize = fontSize * pixelRatio;
    const scaledPadding = padding * pixelRatio;
    const scaledBorderWidth = borderWidth * pixelRatio;
    
    // Set font for measuring
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    
    // Split text into lines if needed
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';
    
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth * pixelRatio - scaledPadding * 2) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    // Calculate canvas dimensions
    let maxTextWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line);
      maxTextWidth = Math.max(maxTextWidth, metrics.width);
    });
    
    const textHeight = scaledFontSize * lineHeight;
    const totalTextHeight = textHeight * lines.length;
    
    const canvasWidth = Math.max(maxTextWidth + scaledPadding * 2 + scaledBorderWidth * 2, 64);
    const canvasHeight = Math.max(totalTextHeight + scaledPadding * 2 + scaledBorderWidth * 2, 32);
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Re-set font after canvas resize
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    
    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw background
    ctx.save();
    
    if (gradient) {
      const gradientObj = gradient.direction === 'vertical' 
        ? ctx.createLinearGradient(0, 0, 0, canvasHeight)
        : ctx.createLinearGradient(0, 0, canvasWidth, 0);
      
      gradient.colors.forEach((color, index) => {
        gradientObj.addColorStop(index / (gradient.colors.length - 1), color);
      });
      
      ctx.fillStyle = gradientObj;
    } else {
      ctx.fillStyle = backgroundColor;
    }
    
    // Draw rounded rectangle background
    const radius = borderRadius * pixelRatio;
    ctx.beginPath();
    ctx.roundRect(scaledBorderWidth / 2, scaledBorderWidth / 2, 
                  canvasWidth - scaledBorderWidth, canvasHeight - scaledBorderWidth, radius);
    ctx.fill();
    
    // Draw border
    if (borderColor && borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = scaledBorderWidth;
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Draw shadow if specified
    if (shadow) {
      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur * pixelRatio;
      ctx.shadowOffsetX = shadow.offsetX * pixelRatio;
      ctx.shadowOffsetY = shadow.offsetY * pixelRatio;
    }
    
    // Draw text
    ctx.fillStyle = color;
    
    const startY = canvasHeight / 2 - (totalTextHeight / 2) + (textHeight / 2);
    
    lines.forEach((line, index) => {
      const x = textAlign === 'center' ? canvasWidth / 2 : 
               textAlign === 'right' ? canvasWidth - scaledPadding : scaledPadding;
      const y = startY + (index * textHeight);
      
      ctx.fillText(line, x, y);
    });
    
    if (shadow) {
      ctx.restore();
    }
    
    return canvas;
  };

  // Multi-line text canvas for callouts with different font sizes for title and content
  const createMultiLineTextCanvas = (config: {
    lines: string[];
    titleFontSize: number;
    contentFontSize: number;
    fontFamily: string;
    titleColor: string;
    contentColor: string;
    backgroundColor: string;
    padding: number;
    borderRadius: number;
    borderColor?: string;
    borderWidth?: number;
    maxWidth?: number;
    gradient?: { colors: string[]; direction?: 'horizontal' | 'vertical' };
    shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  }): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const pixelRatio = window.devicePixelRatio || 1;
    
    const {
      lines,
      titleFontSize,
      contentFontSize,
      fontFamily,
      titleColor,
      contentColor,
      backgroundColor,
      padding,
      borderRadius,
      borderColor,
      borderWidth = 0,
      gradient,
      shadow
    } = config;
    
    // Configure high DPI canvas
    const scaledTitleFontSize = titleFontSize * pixelRatio;
    const scaledContentFontSize = contentFontSize * pixelRatio;
    const scaledPadding = padding * pixelRatio;
    const scaledBorderWidth = borderWidth * pixelRatio;
    
    // Calculate text dimensions
    let maxTextWidth = 0;
    let totalHeight = 0;
    const lineHeights: number[] = [];
    const lineFontSizes: number[] = [];
    
    lines.forEach((line, index) => {
      const isTitle = index === 0; // First line is title
      const fontSize = isTitle ? scaledTitleFontSize : scaledContentFontSize;
      const lineHeight = fontSize * 1.3;
      
      ctx.font = `${isTitle ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      
      if (line.trim() !== '') {
        const metrics = ctx.measureText(line);
        maxTextWidth = Math.max(maxTextWidth, metrics.width);
        lineHeights.push(lineHeight);
        totalHeight += lineHeight;
      } else {
        // Empty lines for spacing
        lineHeights.push(lineHeight * 0.5);
        totalHeight += lineHeight * 0.5;
      }
      
      lineFontSizes.push(fontSize);
    });
    
    // Canvas dimensions
    const canvasWidth = Math.max(maxTextWidth + scaledPadding * 2 + scaledBorderWidth * 2, 64);
    const canvasHeight = Math.max(totalHeight + scaledPadding * 2 + scaledBorderWidth * 2, 32);
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw background
    ctx.save();
    
    if (gradient) {
      const gradientObj = gradient.direction === 'vertical' 
        ? ctx.createLinearGradient(0, 0, 0, canvasHeight)
        : ctx.createLinearGradient(0, 0, canvasWidth, 0);
      
      gradient.colors.forEach((color, index) => {
        gradientObj.addColorStop(index / (gradient.colors.length - 1), color);
      });
      
      ctx.fillStyle = gradientObj;
    } else {
      ctx.fillStyle = backgroundColor;
    }
    
    // Draw rounded rectangle background
    const radius = borderRadius * pixelRatio;
    ctx.beginPath();
    ctx.roundRect(scaledBorderWidth / 2, scaledBorderWidth / 2, 
                  canvasWidth - scaledBorderWidth, canvasHeight - scaledBorderWidth, radius);
    ctx.fill();
    
    // Draw border
    if (borderColor && borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = scaledBorderWidth;
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Draw shadow if specified
    if (shadow) {
      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur * pixelRatio;
      ctx.shadowOffsetX = shadow.offsetX * pixelRatio;
      ctx.shadowOffsetY = shadow.offsetY * pixelRatio;
    }
    
    // Draw text lines
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let currentY = scaledPadding + lineHeights[0] / 2;
    
    lines.forEach((line, index) => {
      if (line.trim() !== '') {
        const isTitle = index === 0;
        const fontSize = lineFontSizes[index];
        
        ctx.font = `${isTitle ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
        ctx.fillStyle = isTitle ? titleColor : contentColor;
        
        const x = canvasWidth / 2;
        ctx.fillText(line, x, currentY);
      }
      
      if (index < lineHeights.length - 1) {
        currentY += lineHeights[index] / 2 + lineHeights[index + 1] / 2;
      }
    });
    
    if (shadow) {
      ctx.restore();
    }
    
    return canvas;
  };

  useEffect(() => {
    if (!areaData) return;
    
    console.log(`🏗️ Main useEffect triggered - Area: ${areaData.areaId}`);

    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // WebGL Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
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

    // Auto-tour hall sequence (circular)
    const autoTourHalls = ['Hall_B_2', 'Hall_C', 'Hall_E_3', 'all_in_one'];
    
    // Function to focus camera on specific area within the combined model
    const focusCameraOnArea = (areaId: string, controls: OrbitControls, camera: THREE.Camera, isAutoTour: boolean = false) => {
      const cameraPositions = {
        'Hall_B_2': { x: 7.55, y: 3.51, z: -0.48, targetX: 6.62, targetY: -0.15, targetZ: -1.81 }, // Hall B at custom position
        'Hall_C': { x: 0, y: 3.05, z: 1.63, targetX: 0, targetY: 0, targetZ: 0 },     // Hall C at X=0 (4x zoom: 15/4=3.75, 8/4=2)
        'Hall_E_3': { x: -3.58, y: 3.06, z: -0.68, targetX: -4.20, targetY: 0.40, targetZ: -1.85 }, // Hall E at X=-5 (4x zoom: 15/4=3.75, 8/4=2)
        'all_in_one': { x: 0, y: 6.25, z: 3.75, targetX: 0, targetY: 0, targetZ: 0 }, // Full overview (4x zoom: 25/4=6.25, 15/4=3.75)
        'MainExhibitionHall': { x: 0.00, y: 9.45, z: 5.04, targetX: 0.00, targetY: 0.00, targetZ: 0.00 } // OTD TechDays 2026 Main Exhibition Hall
      };
      
      const position = cameraPositions[areaId as keyof typeof cameraPositions];
      if (position) {
        const logPrefix = isAutoTour ? '🔄 Auto-tour' : '📹';
        console.log(`${logPrefix} Focusing camera on ${areaId} at position:`, position);
        
        // Animate camera to new position
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        const targetPosition = new THREE.Vector3(position.x, position.y, position.z);
        const targetLookAt = new THREE.Vector3(position.targetX, position.targetY, position.targetZ);
        
        let animationProgress = 0;
        const animationDuration = isAutoTour ? 2000 : 1000; // Slower animation for auto-tour
        const startTime = Date.now();
        
        const animateCamera = () => {
          const elapsed = Date.now() - startTime;
          animationProgress = Math.min(elapsed / animationDuration, 1);
          
          // Smooth easing function
          const eased = 1 - Math.pow(1 - animationProgress, 3);
          
          // Interpolate camera position
          camera.position.lerpVectors(startPosition, targetPosition, eased);
          
          // Interpolate controls target
          controls.target.lerpVectors(startTarget, targetLookAt, eased);
          controls.update();
          
          if (animationProgress < 1) {
            requestAnimationFrame(animateCamera);
          } else if (isAutoTour && autoTourActiveRef.current) {
            console.log('🔄 Starting circular motion at hall');
            
            // Start circular camera movement around the hall for 3 seconds
            const circularMotionDuration = 3000; // 3 seconds
            const circularMotionStartTime = Date.now();
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
            controls.enabled = false;
            
            const circularMotion = () => {
              const elapsed = Date.now() - circularMotionStartTime;
              const progress = Math.min(elapsed / circularMotionDuration, 1);
              
              if (progress < 1 && autoTourActiveRef.current) {
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
                controls.enabled = true;
                controls.target.copy(lookAtTarget);
                controls.update();
                
                // Circular motion complete, schedule next hall
                setTimeout(() => {
                  if (autoTourActiveRef.current) {
                    startAutoTour();
                  }
                }, 100); // Small delay before moving to next hall
              }
            };
            
            circularMotion();
          }
        };
        
        animateCamera();
      }
    };
    
    // Function to start auto-tour
    const startAutoTour = () => {
      if (!controlsRef.current || !cameraRef.current) return;
      
      autoTourActiveRef.current = true;
      const nextHall = autoTourHalls[currentAutoTourIndexRef.current];
      
      console.log(`🎬 Auto-tour: Moving to ${nextHall} (${currentAutoTourIndexRef.current + 1}/${autoTourHalls.length})`);
      
      focusCameraOnArea(nextHall, controlsRef.current, cameraRef.current, true);
      
      // Move to next hall (circular)
      currentAutoTourIndexRef.current = (currentAutoTourIndexRef.current + 1) % autoTourHalls.length;
    };
    
    // Function to stop auto-tour
    const stopAutoTour = () => {
      if (autoTourActiveRef.current) {
        console.log('⏹️ Auto-tour stopped due to user interaction');
        autoTourActiveRef.current = false;
      }
      if (autoTourTimeoutRef.current) {
        clearTimeout(autoTourTimeoutRef.current);
        autoTourTimeoutRef.current = null;
      }
      if (autoTourAnimationRef.current) {
        cancelAnimationFrame(autoTourAnimationRef.current);
        autoTourAnimationRef.current = null;
      }
    };
    
    // Function to handle user interaction (resets idle timer)
    const handleUserInteraction = () => {
      lastInteractionTimeRef.current = Date.now();
      stopAutoTour();
      
      // Clear existing timeout
      if (autoTourTimeoutRef.current) {
        clearTimeout(autoTourTimeoutRef.current);
      }
      
      // Set new timeout for auto-tour
      autoTourTimeoutRef.current = setTimeout(() => {
        if (Date.now() - lastInteractionTimeRef.current >= 5000) {
          console.log('💤 User inactive for 5 seconds, starting auto-tour...');
          startAutoTour();
        }
      }, 5000);
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
    controls.addEventListener('start', handleUserInteraction); // When user starts interacting with controls
    controls.addEventListener('change', handleUserInteraction); // When controls change

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
        const findMeshByName = (nameToFind: string): THREE.Mesh | null => {
          let mesh: THREE.Mesh | null = null;
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name === nameToFind) {
              mesh = object;
              console.log(`    Found mesh: ${nameToFind}`);
            }
          });
          return mesh;
        };
        
        for (const meshName of possibleMeshNames) {
          foundMesh = findMeshByName(meshName);
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
      console.log(`📝 showBoothInfoCallout called for booth:`, booth);
      
      if (!scene) {
        console.error('❌ scene not available');
        return;
      }
      
      // Clear only info callouts (keep name callouts visible)
      clearCallouts();
      
      // Update mesh world matrix to ensure accurate positioning
      mesh.updateMatrixWorld(true);
      
      // Calculate mesh center position in world coordinates
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      
      console.log(`📏 Callout position:`, center);
      
      // Create info callout (ID, dimensions, area) - positioned higher above the mesh
      const infoCalloutPosition = center.clone();
      infoCalloutPosition.y += 1.2; // Higher position for info callouts
      const infoCallout = createBoothCallout(booth, infoCalloutPosition);
      scene.add(infoCallout);
      calloutsRef.current.push(infoCallout);
      
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

        const matchesAllowed = (name?: string) => {
          if (!name) return false;
          return allowedNames.some(p => {
            if (p.endsWith("*")) return name.startsWith(p.slice(0, -1));
            return name === p;
          });
        };

        const markInteractives = (root: THREE.Object3D) => {
          let interactiveCount = 0;
          root.traverse((o) => {
            if (isMesh(o)) {
              const isInteractive = matchesAllowed(o.name);
              o.userData._interactive = isInteractive;
              if (isInteractive) {
                interactiveCount++;
              }
              // preserve the original color
              const mat = Array.isArray(o.material) ? o.material[0] : o.material;
              if ((mat as THREE.MeshStandardMaterial)?.color) {
                o.userData._origColor = (mat as THREE.MeshStandardMaterial).color.getHex();
              }
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
        
        box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        let scale = (10 / (maxDim || 1))* 2;
        
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
            // Start auto-tour timer after everything is initialized
            setTimeout(() => {
              handleUserInteraction();
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
      handleUserInteraction(); // Reset idle timer on mouse movement
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
      handleUserInteraction(); // Reset idle timer on click
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
        // Show info callout for any booth (including sold/reserved)
        showBoothInfoCallout(boothData, clickedMesh);
      }
    };

    renderer.domElement.addEventListener("mousemove", e => onPointerMove(e, renderer, camera));
    renderer.domElement.addEventListener("click", e => onClick(e, renderer, camera));
    
    // Load the appropriate model based on current area
    const modelPath = getModelPath(currentArea);
    
    // For now, always load the model to ensure it displays properly
    console.log(`🏗️ Loading model: ${modelPath} for area: ${currentArea}`);
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
  }, [areaData]); // React to areaData changes

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

      console.log(`🏢 Mapping booth meshes for ${areaData.areaName}`);
      console.log(`  Booths: ${areaData.booths.length}`);
      
      // Clear existing mesh map
      boothMeshMapRef.current.clear();
      
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
        
        let foundMesh: THREE.Mesh | null = null;
        
        // Search through all meshes in the scene with different naming patterns
        const findMeshByName = (nameToFind: string): THREE.Mesh | null => {
          let mesh: THREE.Mesh | null = null;
          sceneRef.current?.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name === nameToFind) {
              mesh = object;
            }
          });
          return mesh;
        };
        
        for (const meshName of possibleMeshNames) {
          foundMesh = findMeshByName(meshName);
          if (foundMesh) break;
        }
        
        // Also try partial matches
        if (!foundMesh) {
          sceneRef.current?.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name) {
              if (object.name.includes(booth.id) || 
                  object.name.includes(booth.id.replace('-', '_')) ||
                  object.name.includes(booth.id.replace('-', ''))) {
                foundMesh = object;
              }
            }
          });
        }
        
        if (foundMesh !== null) {
          // Map this mesh to its booth data
          boothMeshMapRef.current.set(foundMesh as THREE.Mesh, booth);
        }
      });
      
      console.log(`  Mapped ${boothMeshMapRef.current.size} booth meshes`);
    };

    // Apply booth status colors
    const applyBoothStatusColors = () => {
      boothMeshMapRef.current.forEach((booth, mesh) => {
        if (mesh.material && booth.color) {
          // Clone material to avoid affecting shared materials
          if (!Array.isArray(mesh.material)) {
            mesh.material = mesh.material.clone();
          }
          const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if ((material as THREE.MeshStandardMaterial)?.color) {
            (material as THREE.MeshStandardMaterial).color.setHex(parseInt(booth.color.replace('#', '0x')));
          }
        }
      });
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

  // Effect to handle camera positioning when area changes
  useEffect(() => {
    if (!areaData || !cameraRef.current || !controlsRef.current) return;

    // Function to focus camera on specific area within the combined model (simplified version for regular camera positioning)
    const focusCameraOnArea = (areaId: string, controls: OrbitControls, camera: THREE.Camera) => {
      const cameraPositions = {
        'Hall_B_2': { x: 7.55, y: 3.51, z: -0.48, targetX: 6.62, targetY: -0.15, targetZ: -1.81 }, // Hall B at custom position
        'Hall_C': { x: 0, y: 3.05, z: 1.63, targetX: 0, targetY: 0, targetZ: 0 },     // Hall C at X=0 (4x zoom: 15/4=3.75, 8/4=2)
        'Hall_E_3': { x: -3.58, y: 3.06, z: -0.68, targetX: -4.20, targetY: 0.40, targetZ: -1.85 }, // Hall E at X=-5 (4x zoom: 15/4=3.75, 8/4=2)
        'all_in_one': { x: 0, y: 6.25, z: 3.75, targetX: 0, targetY: 0, targetZ: 0 }, // Full overview (4x zoom: 25/4=6.25, 15/4=3.75)
        'MainExhibitionHall': { x: 0.00, y: 9.45, z: 5.04, targetX: 0.00, targetY: 0.00, targetZ: 0.00 } // OTD TechDays 2026 Main Exhibition Hall
      };
      
      const position = cameraPositions[areaId as keyof typeof cameraPositions];
      if (position) {
        console.log(`📹 Focusing camera on ${areaId} at position:`, position);
        
        // Animate camera to new position
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        const targetPosition = new THREE.Vector3(position.x, position.y, position.z);
        const targetLookAt = new THREE.Vector3(position.targetX, position.targetY, position.targetZ);
        
        let animationProgress = 0;
        const animationDuration = 1000; // 1 second
        const startTime = Date.now();
        
        const animateCamera = () => {
          const elapsed = Date.now() - startTime;
          animationProgress = Math.min(elapsed / animationDuration, 1);
          
          // Smooth easing function
          const eased = 1 - Math.pow(1 - animationProgress, 3);
          
          // Interpolate camera position
          camera.position.lerpVectors(startPosition, targetPosition, eased);
          
          // Interpolate controls target
          controls.target.lerpVectors(startTarget, targetLookAt, eased);
          controls.update();
          
          if (animationProgress < 1) {
            requestAnimationFrame(animateCamera);
          }
        };
        
        animateCamera();
      }
    };

    // Focus camera after a short delay to ensure model is loaded
    const timer = setTimeout(() => {
      focusCameraOnArea(currentArea, controlsRef.current!, cameraRef.current!);
    }, 500);

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
    // Check if we're in OTD TechDays 2026 Main Exhibition Hall for 3.5x larger sizing
    const isTechDays2026 = currentArea === 'MainExhibitionHall';
    const sizeMultiplier = isTechDays2026 ? 3.5 : 1;
    
    // Determine content based on booth status
    const hasStatusRecord = booth.status && booth.status !== 'nil';
    const isSoldOrReserved = booth.status && (booth.status.toLowerCase() === 'sold' || booth.status.toLowerCase() === 'reserved');
    const isAvailable = booth.status && booth.status.toLowerCase() === 'available';
    
    // Format text exactly like the original CSS3D version
    let formattedText = '';
    
    if (isSoldOrReserved) {
      // Show status (Sold/Reserved) and company name for sold or reserved booths
      const statusText = booth.status.charAt(0).toUpperCase() + booth.status.slice(1).toLowerCase();
      formattedText = booth.id; // First line: booth ID (bold)
      if (booth.name && booth.name.trim() !== '') {
        formattedText += `\n\n${statusText}\n\n${booth.name}`; // Status and company name
      } else {
        formattedText += `\n\n${statusText}`; // Just status
      }
    } else if (isAvailable) {
      // Show dimensions and area for available booths - THREE LINES
      formattedText = `${booth.id}\n\n${booth.width}m × ${booth.height}m\n\nArea: ${booth.area}m²`;
    } else if (hasStatusRecord && booth.name) {
      // Show company name if there's a status record and it's not sold/reserved/available
      formattedText = `${booth.id}\n\n${booth.name}`;
    } else {
      // Show dimensions if no status record or no company name - THREE LINES
      formattedText = `${booth.id}\n\n${booth.width}m × ${booth.height}m\n\nArea: ${booth.area}m²`;
    }
    
    // Create canvas texture with proper multi-line rendering
    const canvas = createMultiLineTextCanvas({
      lines: formattedText.split('\n'),
      titleFontSize: 22 * sizeMultiplier, // Larger font for booth ID
      contentFontSize: 18 * sizeMultiplier, // Smaller font for content
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif',
      titleColor: 'white',
      contentColor: 'rgba(255,255,255,0.9)',
      backgroundColor: 'transparent',
      padding: 12 * sizeMultiplier,
      borderRadius: 8 * sizeMultiplier,
      borderColor: '#ffffff',
      borderWidth: 1 * sizeMultiplier,
      maxWidth: 200 * sizeMultiplier,
      gradient: {
        colors: ['rgba(102, 170, 255, 0.95)', 'rgba(51, 102, 204, 0.95)'],
        direction: 'vertical'
      },
      shadow: {
        color: 'rgba(102, 170, 255, 0.4)',
        blur: 8 * sizeMultiplier,
        offsetX: 0,
        offsetY: 4 * sizeMultiplier
      }
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
    
    // Scale the sprite appropriately - reduced by half
    // Adjust scale based on canvas aspect ratio to maintain proper proportions
    const baseScale = 0.4 * sizeMultiplier; // Reduced from 0.8 to 0.4 (50% smaller)
    const aspectRatio = canvas.height / canvas.width;
    sprite.scale.set(baseScale, baseScale * aspectRatio, 1);
    
    // Store booth data for reference
    sprite.userData.booth = booth;
    sprite.userData.isTechDays2026 = isTechDays2026;
    
    if (isTechDays2026) {
      console.log(`🎯 Created 3.5x larger sprite callout for TechDays 2026 booth ${booth.id}`);
    }
    
    return sprite;
  };

  // Function to create a booth name callout sprite
  const createBoothNameCallout = (booth: any, position: THREE.Vector3): THREE.Sprite => {
    // Check if we're in MainExhibitionHall for larger name callouts
    const isMainExhibitionHall = currentArea === 'MainExhibitionHall';
    const spriteSizeMultiplier = isMainExhibitionHall ? 2 : 1;
    
    // For names longer than 10 characters, enable multi-line wrapping
    const shouldWrap = booth.name.length > 10;
    const displayName = booth.name; // Don't truncate, let it wrap instead
    
    // Create canvas texture for name callout with flexible width
    const canvas = createTextCanvas({
      text: displayName,
      fontSize: 16.8, // 20% larger than 14px (14 * 1.2 = 16.8)
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif',
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
    
    // Scale the sprite - larger for MainExhibitionHall but font size stays same
    // Maintain proper aspect ratio for text readability
    const baseScale = 0.25 * spriteSizeMultiplier; // 2x larger sprite for MainExhibitionHall
    const aspectRatio = canvas.height / canvas.width;
    sprite.scale.set(baseScale, baseScale * aspectRatio, 1);
    
    // Store booth data for reference
    sprite.userData.booth = booth;
    sprite.userData.isNameCallout = true;
    sprite.userData.isMainExhibitionHall = isMainExhibitionHall;
    
    if (isMainExhibitionHall) {
      console.log(`🏢 Created 2x larger name callout for MainExhibitionHall booth ${booth.id}: ${booth.name} (${shouldWrap ? 'multi-line' : 'single-line'})`);
    }
    
    return sprite;
  };
  
  // Function to clear existing callouts
  const clearCallouts = () => {
    if (sceneRef.current) {
      calloutsRef.current.forEach(callout => {
        sceneRef.current?.remove(callout);
        // Dispose of texture and material to prevent memory leaks
        if (callout.material && callout.material.map) {
          callout.material.map.dispose();
        }
        if (callout.material) {
          callout.material.dispose();
        }
      });
      calloutsRef.current = [];
    }
  };

  // Function to clear existing name callouts
  const clearNameCallouts = () => {
    if (sceneRef.current) {
      nameCalloutsRef.current.forEach(callout => {
        sceneRef.current?.remove(callout);
        // Dispose of texture and material to prevent memory leaks
        if (callout.material && callout.material.map) {
          callout.material.map.dispose();
        }
        if (callout.material) {
          callout.material.dispose();
        }
      });
      nameCalloutsRef.current = [];
    }
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
    if (!areaData || !sceneRef.current) return;

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
        sceneRef.current?.add(nameCallout);
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