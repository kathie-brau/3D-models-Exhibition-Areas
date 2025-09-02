import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import floorLayout from './floorLayout.json';

const WebGLScene = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);
  const polyplaneRef = useRef(null);
  const boxesRef = useRef([]);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());
  const hoveredBoxRef = useRef(null);

  // Helper function to parse meter values
  const parseMeters = (value) => {
    return parseFloat(value.replace('m', ''));
  };

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const currentMount = mountRef.current;

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

    currentMount.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Get floor dimensions from JSON
    const floorWidth = parseMeters(floorLayout.rootDimensions.width);
    const floorHeight = parseMeters(floorLayout.rootDimensions.height);

    // Create polyplane as floor using JSON dimensions
    const polyplaneGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
    const polyplaneMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x333333,
      transparent: true,
      opacity: 0.9
    });
    const polyplane = new THREE.Mesh(polyplaneGeometry, polyplaneMaterial);
    polyplane.receiveShadow = true;
    // Rotate to be horizontal (floor)
    polyplane.rotation.x = -Math.PI / 2;
    polyplane.position.y = -1;
    polyplaneRef.current = polyplane;
    scene.add(polyplane);

    // Create booths and stages from JSON layout
    const boxes = [];
    const hoverMaterial = new THREE.MeshLambertMaterial({ color: 0xff6666 });
    
    // Create booths
    floorLayout.booths.forEach((booth, index) => {
      const width = parseMeters(booth.width);
      const depth = parseMeters(booth.height);  
      const height = 0.3; // Fixed booth height (vertical dimension)
      const x = parseMeters(booth.x) - floorWidth/2 + width/2; // Center coordinates
      const y = parseMeters(booth.y) - floorHeight/2 + depth/2;
      
      const boxGeometry = new THREE.BoxGeometry(width, depth, height); // width, depth, height
      const boxMaterial = new THREE.MeshLambertMaterial({ color: booth.color });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      
      // Position on floor surface (relative to polyplane's local coordinates)
      // Since polyplane is rotated -90° around X, its local Z points up
      box.position.set(x, y, height/2);
      box.castShadow = true;
      box.userData = { 
        id: booth.id,
        name: booth.name,
        type: 'booth',
        originalMaterial: boxMaterial.clone(),
        hoverMaterial: hoverMaterial.clone()
      };
      boxes.push(box);
      polyplane.add(box);
    });

    // Create stages
    floorLayout.stages.forEach((stage, index) => {
      const width = parseMeters(stage.width);
      const depth = parseMeters(stage.height);
      const height = 0.2; // Stages are lower (vertical dimension)
      const x = parseMeters(stage.x) - floorWidth/2 + width/2;
      const y = parseMeters(stage.y) - floorHeight/2 + depth/2;
      
      const stageGeometry = new THREE.BoxGeometry(width, depth, height); // width, depth, height
      const stageMaterial = new THREE.MeshLambertMaterial({ color: stage.color });
      const stageBox = new THREE.Mesh(stageGeometry, stageMaterial);
      
      stageBox.position.set(x, y, height/2);
      stageBox.castShadow = true;
      stageBox.userData = { 
        id: stage.id,
        name: stage.name,
        type: 'stage',
        originalMaterial: stageMaterial.clone(),
        hoverMaterial: hoverMaterial.clone()
      };
      boxes.push(stageBox);
      polyplane.add(stageBox);
    });
    
    boxesRef.current = boxes;

    // Mouse interaction
    const handleMouseMove = (event) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      // Need to check intersections with boxes in world space, not just the array
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);

      // Reset previous hover
      if (hoveredBoxRef.current) {
        hoveredBoxRef.current.material = hoveredBoxRef.current.userData.originalMaterial;
        hoveredBoxRef.current = null;
      }

      // Set new hover - filter for booths and stages only
      const boxIntersects = intersects.filter(intersect => 
        intersect.object.userData && (intersect.object.userData.type === 'booth' || intersect.object.userData.type === 'stage')
      );
      
      if (boxIntersects.length > 0) {
        const intersectedBox = boxIntersects[0].object;
        intersectedBox.material = intersectedBox.userData.hoverMaterial;
        hoveredBoxRef.current = intersectedBox;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // Rotate the polyplane slowly (1 rotation per 60 seconds)
      // 2π radians per 60 seconds = 0.105 radians per second
      // At 60fps: 0.105/60 ≈ 0.00175 radians per frame
      if (polyplaneRef.current) {
        polyplaneRef.current.rotation.z += 0.00175;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default WebGLScene;