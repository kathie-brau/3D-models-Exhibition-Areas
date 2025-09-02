# CLAUDE.md – OTD Energy Booth Viewer Development Guidelines

**Document Version**: 1.2  
**Last Updated**: 2025-09-02  
**Target System**: OTD Energy 2026 Booth Visualization System  
**Framework**: React 19+ with Three.js 0.179+ and TypeScript

## Project Purpose

Interactive booth visualization system for **OTD Energy 2026** exhibition sales. Displays booth availability status for salespeople and runs on projectors at **OTD 2025** events. Shows real-time booth sales status across multiple exhibition areas to help sales teams and provide guests with visual overview of available spaces.

---

## Architecture

### Tech Stack
- **React 19+** with functional components and hooks
- **TypeScript 5+** with strict type checking
- **Three.js 0.179+** for WebGL rendering with type definitions
- **Create React App** build system with TypeScript support

### Project Structure
```
src/
├── App.tsx             # Main app with routing
├── WebGLScene.tsx      # Three.js booth renderer
├── index.tsx           # Application entry point
├── types/
│   └── booth.ts        # TypeScript type definitions
├── components/
│   ├── AreaSelector.tsx # Navigation between areas
│   └── BoothStatus.tsx  # Booth status indicators
└── hooks/
    └── useAreaData.ts   # Area configuration loader
public/
└── data/
    ├── area1.json       # Area 1 booth configuration
    ├── area2.json       # Area 2 booth configuration
    └── area3.json       # Area 3 booth configuration
tsconfig.json           # TypeScript configuration
```

---

## Development Standards

### Component Guidelines
- **MUST** use functional components with hooks
- **MUST** follow React 19 patterns (no class components)
- **SHOULD** create reusable Three.js components when possible
- **MUST** handle cleanup in useEffect for Three.js objects

### Three.js Best Practices
- **MUST** dispose of geometries, materials, and textures in cleanup
- **SHOULD** use `useRef` for Three.js objects that persist across renders
- **MUST** use `useEffect` for scene initialization and cleanup
- **SHOULD** separate Three.js logic into custom hooks when reusable

### Code Style
- **MUST** use camelCase for variables and functions
- **MUST** use PascalCase for React components and TypeScript interfaces
- **SHOULD** keep components under 200 lines (DRY principle)
- **MUST** use destructuring for props and state
- **SHOULD** prefer arrow functions for inline handlers

### TypeScript Guidelines
- **MUST** use strict TypeScript configuration
- **MUST** define interfaces for all props, state, and API responses
- **SHOULD** use type unions for status enums ('sold' | 'reserved' | 'available')
- **MUST** type all function parameters and return values
- **SHOULD** use generic types for reusable components and hooks
- **MUST** avoid `any` type - use specific types or `unknown`

### Performance
- **MUST** use `useCallback` and `useMemo` for expensive operations
- **SHOULD** implement proper frame rate management
- **MUST** avoid creating Three.js objects in render functions
- **SHOULD** use object pooling for frequently created/destroyed objects

### Animation Guidelines
- **MUST** use `requestAnimationFrame` for render loops, not setInterval
- **SHOULD** create custom `useFrame` hook for animation management
- **MUST** sync animations with React state via controlled props when needed
- **SHOULD** use refs for uncontrolled animations (performance-critical)
- **MUST** pause animation loops when component unmounts or tab inactive

### Hot Reload Guidelines
- **SHOULD** enable hot reloading for JSON data files in development
- **MUST** use polling with `last-modified` headers to detect changes
- **SHOULD** provide visual feedback when data reloads
- **MUST** disable hot reload polling in production builds

---

## Scripts & Commands

```bash
npm start      # Development server
npm run build  # Production build
npm test       # Run tests
```

---

## File Organization

### Component Pattern
```typescript
// ThreeComponent.tsx
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface ThreeComponentProps {
  prop1: string;
  prop2: number;
}

const ThreeComponent: React.FC<ThreeComponentProps> = ({ prop1, prop2 }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  
  const initScene = useCallback((): void => {
    // Three.js setup
  }, []);
  
  const cleanup = useCallback((): void => {
    // Dispose resources
  }, []);
  
  useEffect(() => {
    initScene();
    return cleanup;
  }, [initScene, cleanup]);
  
  return <div ref={mountRef} />;
};

export default ThreeComponent;
```

### Custom Hook Pattern
```typescript
// hooks/useThreeScene.ts
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SceneConfig {
  width: number;
  height: number;
  background?: number;
}

interface UseThreeSceneReturn {
  scene: THREE.Scene | null;
  renderer: THREE.WebGLRenderer | null;
}

export function useThreeScene(config: SceneConfig): UseThreeSceneReturn {
  const scene = useRef<THREE.Scene | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  
  useEffect(() => {
    // Setup and cleanup
    return (): void => {
      // Dispose
    };
  }, []);
  
  return { scene: scene.current, renderer: renderer.current };
}
```

### Animation Hook Pattern
```typescript
// hooks/useFrame.ts
import { useEffect, useRef, useCallback, DependencyList } from 'react';

type FrameCallback = () => void;

export function useFrame(callback: FrameCallback, deps: DependencyList = []): void {
  const frameId = useRef<number | null>(null);
  const isActive = useRef<boolean>(true);
  
  const animate = useCallback((): void => {
    if (isActive.current) {
      callback();
      frameId.current = requestAnimationFrame(animate);
    }
  }, [callback]);
  
  useEffect(() => {
    frameId.current = requestAnimationFrame(animate);
    return (): void => {
      isActive.current = false;
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [animate, ...deps]);
}
```

---

## Key Principles

1. **DRY**: Extract common Three.js patterns into hooks or utilities
2. **Separation**: Keep React and Three.js concerns separate
3. **Cleanup**: Always dispose of Three.js resources
4. **Performance**: Optimize render loops and memory usage
5. **Maintainability**: Keep components focused and under 200 lines

---

## Dependencies

Core packages are managed in `package.json`. When adding new Three.js addons:
- **MUST** verify compatibility with current Three.js version
- **SHOULD** prefer official Three.js examples over third-party packages
- **MUST** update this document when adding major dependencies