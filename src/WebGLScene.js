import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

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

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const currentMount = mountRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 8;

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

    // Create polyplane as floor
    const polyplaneGeometry = new THREE.PlaneGeometry(8, 8);
    const polyplaneMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x444444,
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

    // Create 6 boxes with randomized sizes on the floor
    const boxMaterial = new THREE.MeshLambertMaterial({ color: 0x66aaff });
    const boxHoverMaterial = new THREE.MeshLambertMaterial({ color: 0xff6666 });
    
    const boxes = [];
    const positions = [
      [-2, 1], [0, 1], [2, 1],
      [-2, -1], [0, -1], [2, -1]
    ];

    positions.forEach((pos, index) => {
      // Randomize box dimensions
      const width = 0.3 + Math.random() * 0.6; // 0.3 to 0.9
      const height = 0.4 + Math.random() * 0.8; // 0.4 to 1.2
      const depth = 0.3 + Math.random() * 0.6; // 0.3 to 0.9
      
      const boxGeometry = new THREE.BoxGeometry(width, height, depth);
      const box = new THREE.Mesh(boxGeometry, boxMaterial.clone());
      
      // Position on floor surface (relative to polyplane's local coordinates)
      // Since polyplane is rotated -90° around X, its local Z points up
      box.position.set(pos[0], pos[1], height/2);
      box.castShadow = true;
      box.userData = { 
        index, 
        originalMaterial: box.material.clone(),
        hoverMaterial: boxHoverMaterial.clone()
      };
      boxes.push(box);
      polyplane.add(box); // Add to polyplane so they rotate together
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

      // Set new hover - filter for boxes only
      const boxIntersects = intersects.filter(intersect => 
        intersect.object.userData && intersect.object.userData.index !== undefined
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
      
      // Rotate the polyplane slowly (1 rotation per 30 seconds)
      // 2π radians per 30 seconds = 0.209 radians per second
      // At 60fps: 0.209/60 ≈ 0.0035 radians per frame
      if (polyplaneRef.current) {
        polyplaneRef.current.rotation.z += 0.0035;
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