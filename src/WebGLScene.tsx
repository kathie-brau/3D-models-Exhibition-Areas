import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { AreaData, BoothStatus, StatusColors } from './types/booth';
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {Area } from './components/AreaSelector'


interface WebGLSceneProps {
  areaData: AreaData | null;
}

const areas: Area[] = [
  { id: 'Hall_B_2', name: 'Main Exhibition Hall' },
  { id: 'Hall_C', name: 'Technology Pavilion' },
  { id: 'Hall_E_3', name: 'Innovation Zone' }
];


const WebGLScene: React.FC<WebGLSceneProps> = ({ areaData }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationRef = useRef<number | null>(null);
  const polyplaneRef = useRef<THREE.Mesh | null>(null);
  const boxesRef = useRef<THREE.Mesh[]>([]);
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const hoveredBoxRef = useRef<THREE.Mesh | null>(null);

  // Helper function to parse meter values
  const parseMeters = (value: string): number => {
    return parseFloat(value.replace('m', ''));
  };

  useEffect(() => {
    if (!areaData) return;

    console.log("!!!!!!!!!!!!!!!!!!!!Area name is ",areaData.areaName);

    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    // Camera setup - position to see the full 20x10m floor
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 15, 8); // Higher up and angled down to see full floor
    camera.lookAt(0, -1, 0); // Look at the floor

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    if (currentMount) {
      currentMount.appendChild(renderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;      // плавність
    controls.enableZoom = true;         // вкл. зум
    controls.zoomSpeed = 1.0;           // швидкість зуму
    controls.minDistance = 2;           // мін. відстань до моделі
    controls.maxDistance = 50;          // макс. відстань
    controls.enablePan = true;          // за потреби — панорамування


    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Завантаження моделі (TypeScript-friendly)
    const loader = new GLTFLoader();

    // Група/сцена з GLTF (Object3D теж ок)
    let rootModel: THREE.Group | null = null;

    // Зручний type guard
    const isMesh = (o: THREE.Object3D): o is THREE.Mesh =>
      (o as THREE.Mesh).isMesh === true;

    // Отримати всі меші (частини моделі)
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
            // gltf.scene — це THREE.Group
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
              // збережемо оригінальний колір
              const mat = Array.isArray(o.material) ? o.material[0] : o.material;
              if ((mat as THREE.MeshStandardMaterial)?.color) {
                o.userData._origColor = (mat as THREE.MeshStandardMaterial).color.getHex();
              }
            }
          });
        };
        markInteractives(rootModel);

        // Типізуємо параметр traverse (Object3D)
        rootModel.traverse((o: THREE.Object3D) => {
          // оскільки потрібні поля Mesh — робимо type guard
          if ((o as THREE.Mesh).isMesh) {
            const mesh = o as THREE.Mesh;

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // захист від відсутності color + збереження початкового кольору
            const mat = mesh.material as THREE.Material | THREE.Material[];
            const single = Array.isArray(mat) ? mat[0] : mat;

            if ((single as THREE.MeshStandardMaterial)?.color) {
              mesh.userData._origColor = (single as THREE.MeshStandardMaterial).color.getHex();
            }
          }
        });

        // Центрування/масштаб
        const box = new THREE.Box3().setFromObject(rootModel);
        const size = box.getSize(new THREE.Vector3());
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Model size:", size);
        const center = box.getCenter(new THREE.Vector3());
        // rootModel.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10 / (maxDim || 1);
        rootModel.scale.setScalar(scale);

        scene.add(rootModel);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert('Не вдалося завантажити модель: ' + msg);
      }
    }


    // // Get floor dimensions from JSON
    // const floorWidth = parseMeters(areaData.rootDimensions.width);
    // const floorHeight = parseMeters(areaData.rootDimensions.height);

    // // Create polyplane as floor using JSON dimensions
    // const polyplaneGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
    // const polyplaneMaterial = new THREE.MeshLambertMaterial({ 
    //   color: 0x333333,
    //   transparent: true,
    //   opacity: 0.9
    // });
    // const polyplane = new THREE.Mesh(polyplaneGeometry, polyplaneMaterial);
    // polyplane.receiveShadow = true;
    // // Rotate to be horizontal (floor)
    // polyplane.rotation.x = -Math.PI / 2;
    // polyplane.position.y = -1;
    // polyplaneRef.current = polyplane;
    // scene.add(polyplane);

    // // Create booths and stages from JSON layout
    // const boxes: THREE.Mesh[] = [];
    // const hoverMaterial = new THREE.MeshLambertMaterial({ color: 0xff6666 });

    // // Status color mapping
    // const statusColors: StatusColors = {
    //   'sold': 0x66aaff,      // Blue (matches UI)
    //   'reserved': 0xffaa66,  // Orange (matches UI)
    //   'available': 0xcccccc, // Gray (matches UI)
    //   'nil': 0xff69b4        // Pink - missing data indicator
    // };

    // // Helper function to create text texture
    // const createTextTexture = (text: string, status: BoothStatus): THREE.CanvasTexture => {
    //   const canvas = document.createElement('canvas');
    //   const context = canvas.getContext('2d')!;

    //   // Set canvas size
    //   canvas.width = 512;
    //   canvas.height = 256;

    //   // Clear canvas
    //   context.fillStyle = 'rgba(0,0,0,0.8)';
    //   context.fillRect(0, 0, canvas.width, canvas.height);

    //   // Status indicator (top)
    //   const statusTextColors = {
    //     'sold': '#66aaff',
    //     'reserved': '#ffaa66', 
    //     'available': '#cccccc',
    //     'nil': '#ff69b4'
    //   };

    //   context.fillStyle = statusTextColors[status] || '#cccccc';
    //   context.fillRect(10, 10, canvas.width - 20, 40);

    //   // Status text
    //   context.fillStyle = 'black';
    //   context.font = 'bold 24px Arial';
    //   context.textAlign = 'center';
    //   context.fillText(status.toUpperCase(), canvas.width/2, 35);

    //   // Company name (bottom)
    //   context.fillStyle = 'white';
    //   context.font = '20px Arial';
    //   context.textAlign = 'center';

    //   // Wrap text if too long
    //   const maxWidth = canvas.width - 20;
    //   const words = text.split(' ');
    //   let line = '';
    //   let y = 100;

    //   for (let n = 0; n < words.length; n++) {
    //     const testLine = line + words[n] + ' ';
    //     const metrics = context.measureText(testLine);
    //     const testWidth = metrics.width;

    //     if (testWidth > maxWidth && n > 0) {
    //       context.fillText(line, canvas.width/2, y);
    //       line = words[n] + ' ';
    //       y += 30;
    //     } else {
    //       line = testLine;
    //     }
    //   }
    //   context.fillText(line, canvas.width/2, y);

    //   const texture = new THREE.CanvasTexture(canvas);
    //   texture.needsUpdate = true;
    //   return texture;
    // };

    // // Create booths
    // areaData.booths.forEach((booth, index) => {
    //   const width = parseMeters(booth.width);
    //   const depth = parseMeters(booth.height);  
    //   const height = 0.3; // Fixed booth height (vertical dimension)
    //   const x = parseMeters(booth.x) - floorWidth/2 + width/2; // Center coordinates
    //   const y = parseMeters(booth.y) - floorHeight/2 + depth/2;

    //   const boxGeometry = new THREE.BoxGeometry(width, depth, height);
    //   const boothColor = statusColors[booth.status] || 0xcccccc;
    //   const boxMaterial = new THREE.MeshLambertMaterial({ color: boothColor });
    //   const box = new THREE.Mesh(boxGeometry, boxMaterial);

    //   // Position on floor surface
    //   box.position.set(x, y, height/2);
    //   box.castShadow = true;
    //   box.userData = { 
    //     id: booth.id,
    //     name: booth.name,
    //     status: booth.status,
    //     type: 'booth',
    //     originalMaterial: boxMaterial.clone(),
    //     hoverMaterial: hoverMaterial.clone()
    //   };

    //   // Create text label on top of booth
    //   const textTexture = createTextTexture(booth.name, booth.status);
    //   const labelGeometry = new THREE.PlaneGeometry(width * 0.9, depth * 0.9);
    //   const labelMaterial = new THREE.MeshBasicMaterial({ 
    //     map: textTexture, 
    //     transparent: true,
    //     alphaTest: 0.1
    //   });
    //   const label = new THREE.Mesh(labelGeometry, labelMaterial);

    //   // Position label on top of box
    //   label.position.set(0, 0, height/2 + 0.01);
    //   label.rotation.x = -Math.PI / 2; // Rotate to face up
    //   box.add(label);

    //   boxes.push(box);
    //   polyplane.add(box);
    // });

    // // Create stages
    // areaData.stages.forEach((stage, index) => {
    //   const width = parseMeters(stage.width);
    //   const depth = parseMeters(stage.height);
    //   const height = 0.2; // Stages are lower (vertical dimension)
    //   const x = parseMeters(stage.x) - floorWidth/2 + width/2;
    //   const y = parseMeters(stage.y) - floorHeight/2 + depth/2;

    //   const stageGeometry = new THREE.BoxGeometry(width, depth, height); // width, depth, height
    //   const stageMaterial = new THREE.MeshLambertMaterial({ color: stage.color });
    //   const stageBox = new THREE.Mesh(stageGeometry, stageMaterial);

    //   stageBox.position.set(x, y, height/2);
    //   stageBox.castShadow = true;
    //   stageBox.userData = { 
    //     id: stage.id,
    //     name: stage.name,
    //     type: 'stage',
    //     originalMaterial: stageMaterial.clone(),
    //     hoverMaterial: hoverMaterial.clone()
    //   };
    //   boxes.push(stageBox);
    //   polyplane.add(stageBox);
    // });

    // boxesRef.current = boxes;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersectors = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      rootModel?.traverse(o => {
        if (isMesh(o) && o.userData._interactive) list.push(o);
      });
      return list;
    };

    // У подіях:
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
          // повернути колір попереднього
          if (hovered && hovered.material && hovered.userData._hoverColor !== undefined) {
            const mat = Array.isArray(hovered.material) ? hovered.material[0] : hovered.material;
            (mat as THREE.MeshStandardMaterial).color.setHex(hovered.userData._hoverColor);
          }
          // зберегти і підсвітити жовтим
          const mat = Array.isArray(m.material) ? m.material[0] : m.material;
          if ((mat as THREE.MeshStandardMaterial)?.color) {
            m.userData._hoverColor = (mat as THREE.MeshStandardMaterial).color.getHex();
            // клон, щоб не зачепити спільні матеріали
            if (!Array.isArray(m.material)) m.material = mat.clone();
            ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial)
              .color.set("#ffff00");
          }
          hovered = m;
        }
      } else {
        // прибрати підсвітку
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
      if (!hits.length) return;

      const m = hits[0].object as THREE.Mesh;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!(mat as THREE.MeshStandardMaterial)?.color) return;

      // клон матеріалу
      if (!Array.isArray(m.material)) m.material = mat.clone();

      const ms = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;

      if (!m.userData._isRed) {
        if (m.userData._origColor === undefined) {
          m.userData._origColor = ms.color.getHex();
        }
        ms.color.set("#ff0000");
        m.userData._isRed = true;
      } else {
        if (m.userData._origColor !== undefined) {
          ms.color.setHex(m.userData._origColor);
        }
        m.userData._isRed = false;
      }
      ms.needsUpdate = true;
    };

    renderer.domElement.addEventListener("mousemove", e => onPointerMove(e, renderer, camera));
    renderer.domElement.addEventListener("click", e => onClick(e, renderer, camera));
    // у cleanup – removeEventListener
    
    // // Mouse interaction
    // const handleMouseMove = (event: MouseEvent): void => {
    //   mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    //   mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

    //   raycasterRef.current.setFromCamera(mouseRef.current, camera);
    //   // Need to check intersections with boxes in world space, not just the array
    //   const intersects = raycasterRef.current.intersectObjects(scene.children, true);

    //   // Reset previous hover
    //   if (hoveredBoxRef.current) {
    //     (hoveredBoxRef.current as THREE.Mesh).material = hoveredBoxRef.current.userData.originalMaterial;
    //     hoveredBoxRef.current = null;
    //   }

    //   // Set new hover - filter for booths and stages only
    //   const boxIntersects = intersects.filter(intersect =>
    //     intersect.object.userData && (intersect.object.userData.type === 'booth' || intersect.object.userData.type === 'stage')
    //   );

    //   if (boxIntersects.length > 0) {
    //     const intersectedBox = boxIntersects[0].object as THREE.Mesh;
    //     intersectedBox.material = intersectedBox.userData.hoverMaterial;
    //     hoveredBoxRef.current = intersectedBox;
    //   }
    // };

    let areaId = areas.find(a => a.name === areaData.areaName)?.id;

    initModel('/models/'+areaId+'.glb');

    // window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      // Rotate the polyplane slowly (1 rotation per 60 seconds)
      // 2π radians per 60 seconds = 0.105 radians per second
      // At 60fps: 0.105/60 ≈ 0.00175 radians per frame
      // if (polyplaneRef.current) {
      //   polyplaneRef.current.rotation.z += 0.00175;
      // }
      controls.update();                 // <-- додай це
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

      // window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener("mousemove", e => onPointerMove(e, renderer, camera));
      renderer.domElement.removeEventListener("click", e => onClick(e, renderer, camera));
      // у cleanup – removeEventListener
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }

      renderer.dispose();
      controls.dispose();
    };
  }, [areaData]);

  if (!areaData) {
    return <div>Loading scene...</div>;
  }

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default WebGLScene;