"use client";

import { Environment, Grid, OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useMediaTexture } from "@/components/preview/useMediaTexture";
import { usePreviewStore } from "@/lib/preview-store";
import type {
  FitMode,
  Group,
  PlaybackState,
  Screen,
  TransformState
} from "@/lib/preview-types";
import {
  SCREEN_DEPTH,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  worldTransformForScreen
} from "@/lib/preview-utils";

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uTex;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  uniform float uMediaAspect;
  uniform float uContainerAspect;
  uniform int uFitMode;
  uniform float uHasTexture;
  varying vec2 vUv;

  vec4 fallbackColor() {
    float gx = step(0.96, fract(vUv.x * 12.0));
    float gy = step(0.96, fract(vUv.y * 8.0));
    float grid = max(gx, gy);
    vec3 base = vec3(0.03, 0.05, 0.08);
    vec3 line = vec3(0.19, 0.28, 0.38);
    return vec4(mix(base, line, grid), 1.0);
  }

  void main() {
    if (uHasTexture < 0.5) {
      gl_FragColor = fallbackColor();
      return;
    }

    vec2 uv = vUv * uUvScale + uUvOffset;
    vec2 mapped = uv;

    if (uFitMode == 0) {
      float sx = 1.0;
      float sy = 1.0;
      if (uContainerAspect > uMediaAspect) {
        sx = uMediaAspect / uContainerAspect;
      } else {
        sy = uContainerAspect / uMediaAspect;
      }
      mapped = (uv - 0.5) / vec2(sx, sy) + 0.5;
      if (mapped.x < 0.0 || mapped.x > 1.0 || mapped.y < 0.0 || mapped.y > 1.0) {
        gl_FragColor = vec4(0.02, 0.03, 0.06, 1.0);
        return;
      }
    } else if (uFitMode == 1) {
      float sx = 1.0;
      float sy = 1.0;
      if (uContainerAspect > uMediaAspect) {
        sy = uMediaAspect / uContainerAspect;
      } else {
        sx = uContainerAspect / uMediaAspect;
      }
      mapped = (uv - 0.5) * vec2(sx, sy) + 0.5;
    }

    vec4 color = texture2D(uTex, mapped);
    gl_FragColor = vec4(color.rgb, 1.0);
  }
`;

type UvRegion = {
  scale: [number, number];
  offset: [number, number];
  containerAspect: number;
};

function fitModeToInt(fitMode: FitMode): number {
  switch (fitMode) {
    case "contain":
      return 0;
    case "cover":
      return 1;
    default:
      return 2;
  }
}

function buildFallbackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 432;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#0b1427";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(120, 165, 220, 0.22)";
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    context.fillStyle = "rgba(210, 228, 255, 0.92)";
    context.font = "bold 42px sans-serif";
    context.textAlign = "center";
    context.fillText("NO MEDIA", canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function groupRegion(
  group: Group,
  screen: Screen,
  screens: Record<string, Screen>
): UvRegion {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const id of group.screenIds) {
    const current = screens[id];
    if (!current) {
      continue;
    }

    const width = SCREEN_WIDTH * current.transform.scale[0];
    const height = SCREEN_HEIGHT * current.transform.scale[1];
    const x = current.transform.position[0];
    const y = current.transform.position[1];

    minX = Math.min(minX, x - width / 2);
    maxX = Math.max(maxX, x + width / 2);
    minY = Math.min(minY, y - height / 2);
    maxY = Math.max(maxY, y + height / 2);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return {
      scale: [1, 1],
      offset: [0, 0],
      containerAspect: SCREEN_WIDTH / SCREEN_HEIGHT
    };
  }

  const totalWidth = Math.max(0.01, maxX - minX);
  const totalHeight = Math.max(0.01, maxY - minY);

  const screenWidth = SCREEN_WIDTH * screen.transform.scale[0];
  const screenHeight = SCREEN_HEIGHT * screen.transform.scale[1];
  const left = screen.transform.position[0] - screenWidth / 2;
  const bottom = screen.transform.position[1] - screenHeight / 2;

  return {
    scale: [screenWidth / totalWidth, screenHeight / totalHeight],
    offset: [(left - minX) / totalWidth, (bottom - minY) / totalHeight],
    containerAspect: totalWidth / totalHeight
  };
}

function groupBounds(group: Group, screens: Record<string, Screen>, groups: Record<string, Group>) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const id of group.screenIds) {
    const screen = screens[id];
    if (!screen) {
      continue;
    }

    const world = worldTransformForScreen(screen, groups);
    const width = SCREEN_WIDTH * screen.transform.scale[0];
    const height = SCREEN_HEIGHT * screen.transform.scale[1];
    const depth = SCREEN_DEPTH * screen.transform.scale[2] + 0.05;

    minX = Math.min(minX, world.position[0] - width / 2);
    maxX = Math.max(maxX, world.position[0] + width / 2);
    minY = Math.min(minY, world.position[1] - height / 2);
    maxY = Math.max(maxY, world.position[1] + height / 2);
    minZ = Math.min(minZ, world.position[2] - depth / 2);
    maxZ = Math.max(maxZ, world.position[2] + depth / 2);
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2] as [number, number, number],
    size: [maxX - minX + 0.2, maxY - minY + 0.2, maxZ - minZ + 0.2] as [number, number, number]
  };
}

function tupleFromObject(object: THREE.Object3D): TransformState {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z]
  };
}

function SurfaceMaterial(props: {
  media: Screen["media"];
  playback: PlaybackState;
  uvRegion: UvRegion;
  fallbackTexture: THREE.Texture;
}) {
  const { media, playback, uvRegion, fallbackTexture } = props;
  const { texture, mediaAspect } = useMediaTexture(media, playback);

  const uniforms = useMemo(
    () => ({
      uTex: { value: texture ?? fallbackTexture },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uMediaAspect: { value: mediaAspect },
      uContainerAspect: { value: uvRegion.containerAspect },
      uFitMode: { value: fitModeToInt(media?.fitMode ?? "contain") },
      uHasTexture: { value: texture ? 1 : 0 }
    }),
    [fallbackTexture, media?.fitMode, mediaAspect, texture, uvRegion.containerAspect]
  );

  useEffect(() => {
    uniforms.uTex.value = texture ?? fallbackTexture;
    uniforms.uUvScale.value.set(uvRegion.scale[0], uvRegion.scale[1]);
    uniforms.uUvOffset.value.set(uvRegion.offset[0], uvRegion.offset[1]);
    uniforms.uMediaAspect.value = mediaAspect;
    uniforms.uContainerAspect.value = uvRegion.containerAspect;
    uniforms.uFitMode.value = fitModeToInt(media?.fitMode ?? "contain");
    uniforms.uHasTexture.value = texture ? 1 : 0;
  }, [fallbackTexture, media?.fitMode, mediaAspect, texture, uniforms, uvRegion]);

  return (
    <shaderMaterial
      key={media?.id ?? "placeholder"}
      vertexShader={VERTEX_SHADER}
      fragmentShader={FRAGMENT_SHADER}
      uniforms={uniforms}
      toneMapped={false}
    />
  );
}

function ScreenObject(props: {
  screen: Screen;
  groups: Record<string, Group>;
  screens: Record<string, Screen>;
  fallbackTexture: THREE.Texture;
  isSelected: boolean;
  isHovered: boolean;
}) {
  const { screen, groups, screens, fallbackTexture, isSelected, isHovered } = props;

  const selectScreen = usePreviewStore((state) => state.selectScreen);
  const setHoveredScreen = usePreviewStore((state) => state.setHoveredScreen);

  const worldTransform = useMemo(
    () => worldTransformForScreen(screen, groups),
    [groups, screen]
  );

  const group = screen.groupId ? groups[screen.groupId] : null;
  const activeMedia = group?.media ?? screen.media;
  const activePlayback = group?.media ? group.playback : screen.playback;
  const uvRegion = group?.media
    ? groupRegion(group, screen, screens)
    : {
        scale: [1, 1] as [number, number],
        offset: [0, 0] as [number, number],
        containerAspect: SCREEN_WIDTH / SCREEN_HEIGHT
      };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectScreen(screen.id, {
      append: event.shiftKey,
      forceSingle: event.altKey
    });
  };

  const frameColor = isSelected ? "#35f6d9" : isHovered ? "#77c7ff" : "#1d2e4a";

  return (
    <group
      position={worldTransform.position}
      rotation={worldTransform.rotation}
      scale={worldTransform.scale}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHoveredScreen(screen.id);
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        setHoveredScreen(null);
      }}
      onClick={handleClick}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_DEPTH]} />
        <meshStandardMaterial color={frameColor} metalness={0.65} roughness={0.28} />
      </mesh>

      <mesh position={[0, 0, SCREEN_DEPTH / 2 + 0.004]}>
        <planeGeometry args={[SCREEN_WIDTH * 0.94, SCREEN_HEIGHT * 0.9]} />
        <SurfaceMaterial
          media={activeMedia}
          playback={activePlayback}
          uvRegion={uvRegion}
          fallbackTexture={fallbackTexture}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0, SCREEN_DEPTH / 2 + 0.012]}>
          <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
          <meshBasicMaterial color="#39ffe0" wireframe transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}

function SceneContent() {
  const screens = usePreviewStore((state) => state.screens);
  const groups = usePreviewStore((state) => state.groups);
  const selectedScreenIds = usePreviewStore((state) => state.selectedScreenIds);
  const selectedGroupId = usePreviewStore((state) => state.selectedGroupId);
  const activeScreenId = usePreviewStore((state) => state.activeScreenId);
  const hoveredScreenId = usePreviewStore((state) => state.hoveredScreenId);
  const transformMode = usePreviewStore((state) => state.transformMode);
  const cameraView = usePreviewStore((state) => state.cameraView);
  const cameraRevision = usePreviewStore((state) => state.cameraRevision);

  const clearSelection = usePreviewStore((state) => state.clearSelection);
  const setScreenTransform = usePreviewStore((state) => state.setScreenTransform);
  const setGroupTransform = usePreviewStore((state) => state.setGroupTransform);

  const orbitControlsRef = useRef<any>(null);
  const transformControlsRef = useRef<any>(null);
  const gizmoTargetRef = useRef<THREE.Group>(null);
  const desiredCameraPosition = useRef(new THREE.Vector3(6.4, 4.4, 7.2));
  const desiredCameraTarget = useRef(new THREE.Vector3(0, 1.2, 0));

  const fallbackTexture = useMemo(() => buildFallbackTexture(), []);

  useEffect(() => {
    return () => {
      fallbackTexture.dispose();
    };
  }, [fallbackTexture]);

  const transformTarget = useMemo(() => {
    if (selectedGroupId && groups[selectedGroupId]) {
      return {
        kind: "group" as const,
        id: selectedGroupId,
        transform: groups[selectedGroupId].transform
      };
    }

    if (activeScreenId) {
      const screen = screens[activeScreenId];
      if (!screen || screen.groupId) {
        return null;
      }

      return {
        kind: "screen" as const,
        id: activeScreenId,
        transform: screen.transform
      };
    }

    return null;
  }, [activeScreenId, groups, screens, selectedGroupId]);

  useEffect(() => {
    if (!gizmoTargetRef.current) {
      return;
    }

    if (!transformTarget) {
      gizmoTargetRef.current.visible = false;
      return;
    }

    const { position, rotation, scale } = transformTarget.transform;
    gizmoTargetRef.current.visible = true;
    gizmoTargetRef.current.position.set(position[0], position[1], position[2]);
    gizmoTargetRef.current.rotation.set(0, rotation[1], 0);
    gizmoTargetRef.current.scale.set(scale[0], scale[1], scale[2]);
  }, [transformTarget]);

  useEffect(() => {
    if (!transformControlsRef.current || !gizmoTargetRef.current) {
      return;
    }

    transformControlsRef.current.attach(gizmoTargetRef.current);
  }, []);

  useEffect(() => {
    const target = desiredCameraTarget.current;

    switch (cameraView) {
      case "front":
        desiredCameraPosition.current.set(0, 3.2, 9.2);
        target.set(0, 1.2, 0);
        break;
      case "left":
        desiredCameraPosition.current.set(-9.2, 3.2, 0);
        target.set(0, 1.2, 0);
        break;
      case "right":
        desiredCameraPosition.current.set(9.2, 3.2, 0);
        target.set(0, 1.2, 0);
        break;
      case "top":
        desiredCameraPosition.current.set(0.001, 13.2, 0.001);
        target.set(0, 0, 0);
        break;
      default:
        desiredCameraPosition.current.set(6.4, 4.4, 7.2);
        target.set(0, 1.2, 0);
        break;
    }
  }, [cameraRevision, cameraView]);

  useFrame((state, delta) => {
    const lerpFactor = 1 - Math.exp(-delta * 4.5);
    state.camera.position.lerp(desiredCameraPosition.current, lerpFactor);

    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.lerp(desiredCameraTarget.current, lerpFactor);
      orbitControlsRef.current.update();
    }
  });

  const selectedSet = useMemo(() => new Set(selectedScreenIds), [selectedScreenIds]);
  const selectedGroup = selectedGroupId ? groups[selectedGroupId] : null;
  const currentGroupBounds = selectedGroup ? groupBounds(selectedGroup, screens, groups) : null;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        intensity={1}
        position={[8, 10, 7]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight intensity={0.45} color="#ccdcff" groundColor="#0b1324" />

      <Environment preset="warehouse" />

      <Grid
        position={[0, 0, 0]}
        args={[200, 200]}
        infiniteGrid
        fadeDistance={80}
        fadeStrength={1.8}
        sectionColor="#31556e"
        cellColor="#24354f"
      />

      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.001, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#111e34" roughness={0.9} metalness={0.05} />
      </mesh>

      {Object.values(screens).map((screen) => {
        const isSelected =
          activeScreenId === screen.id ||
          selectedSet.has(screen.id) ||
          (selectedGroup ? selectedGroup.screenIds.includes(screen.id) : false);

        return (
          <ScreenObject
            key={screen.id}
            screen={screen}
            groups={groups}
            screens={screens}
            fallbackTexture={fallbackTexture}
            isSelected={isSelected}
            isHovered={hoveredScreenId === screen.id}
          />
        );
      })}

      {currentGroupBounds && (
        <mesh position={currentGroupBounds.center}>
          <boxGeometry args={currentGroupBounds.size} />
          <meshBasicMaterial color="#f4b942" wireframe transparent opacity={0.72} />
        </mesh>
      )}

      <group ref={gizmoTargetRef} visible={false} />

      <TransformControls
        ref={transformControlsRef}
        mode={transformMode}
        enabled={Boolean(transformTarget)}
        showY={transformMode !== "translate"}
        showX={transformMode !== "rotate"}
        showZ={transformMode !== "rotate"}
        rotationSnap={transformMode === "rotate" ? Math.PI / 24 : undefined}
        onMouseDown={() => {
          if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = false;
          }
        }}
        onMouseUp={() => {
          if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = true;
          }
        }}
        onObjectChange={() => {
          if (!transformTarget || !gizmoTargetRef.current) {
            return;
          }

          const nextTransform = tupleFromObject(gizmoTargetRef.current);

          if (transformTarget.kind === "group") {
            setGroupTransform(transformTarget.id, {
              position: [nextTransform.position[0], nextTransform.position[1], nextTransform.position[2]],
              rotation: [0, nextTransform.rotation[1], 0],
              scale: nextTransform.scale
            });
            return;
          }

          setScreenTransform(transformTarget.id, {
            position: [nextTransform.position[0], nextTransform.position[1], nextTransform.position[2]],
            rotation: [0, nextTransform.rotation[1], 0],
            scale: nextTransform.scale
          });
        }}
      />

      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2.5}
        maxDistance={36}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />

      <mesh
        visible={false}
        onClick={(event) => {
          event.stopPropagation();
          clearSelection();
        }}
      >
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial />
      </mesh>
    </>
  );
}

export default function PreviewCanvas() {
  const clearSelection = usePreviewStore((state) => state.clearSelection);

  return (
    <Canvas
      shadows
      camera={{ position: [6.4, 4.4, 7.2], fov: 48 }}
      gl={{ antialias: true }}
      onPointerMissed={() => clearSelection()}
    >
      <color attach="background" args={["#0a1529"]} />
      <fog attach="fog" args={["#0a1529", 18, 60]} />
      <SceneContent />
    </Canvas>
  );
}
