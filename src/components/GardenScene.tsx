import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { SoundGarden, GardenPlant } from '../utils/GardenGenerator';

interface GardenSceneProps {
  garden: SoundGarden | null;
  isRecording?: boolean;
  currentVolume?: number;
  currentFrequency?: number;
}

// 蘑菇形态 - 低频
function Mushroom({ plant, index }: { plant: GardenPlant; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const capRef = useRef<THREE.Mesh>(null);
  const stemRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    return new THREE.Color().setHSL(plant.color.h / 360, plant.color.s, plant.color.l);
  }, [plant.color]);

  const glowColor = useMemo(() => {
    return new THREE.Color().setHSL(plant.color.h / 360, plant.color.s, plant.color.l + 0.2);
  }, [plant.color]);

  // 极坐标转直角坐标
  const x = Math.cos((plant.position.angle * Math.PI) / 180) * plant.position.radius;
  const z = Math.sin((plant.position.angle * Math.PI) / 180) * plant.position.radius;

  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const growProgress = Math.min(1, (time - plant.growDelay) / 2);

    if (growProgress > 0) {
      // 生长动画
      const scale = Math.min(1, growProgress * 1.2);
      groupRef.current.scale.setScalar(scale);

      // 脉动效果
      const pulse = 1 + Math.sin(time * plant.animation.pulseSpeed + index) * plant.animation.pulseIntensity;
      if (capRef.current) {
        capRef.current.scale.y = pulse;
      }

      // 缓慢旋转
      groupRef.current.rotation.y = time * plant.animation.rotationSpeed * 0.1;
    } else {
      groupRef.current.scale.setScalar(0);
    }
  });

  return (
    <group ref={groupRef} position={[x, 0, z]} scale={0}>
      {/* 蘑菇柄 */}
      <mesh ref={stemRef} position={[0, plant.size.height * 0.3, 0]}>
        <cylinderGeometry args={[plant.size.baseWidth * 0.3, plant.size.baseWidth * 0.4, plant.size.height * 0.6, 8]} />
        <meshStandardMaterial
          color={color}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* 蘑菇盖 */}
      <mesh ref={capRef} position={[0, plant.size.height * 0.7, 0]}>
        <sphereGeometry args={[plant.size.baseWidth, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.2}
          emissive={glowColor}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* 发光底部 */}
      <mesh position={[0, plant.size.height * 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[plant.size.baseWidth * 0.8, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

// 树木形态 - 中频
function Tree({ plant, index }: { plant: GardenPlant; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const trunkRef = useRef<THREE.Mesh>(null);
  const leavesRef = useRef<THREE.Group>(null);

  const color = useMemo(() => {
    return new THREE.Color().setHSL(plant.color.h / 360, plant.color.s, plant.color.l);
  }, [plant.color]);

  const leafColor = useMemo(() => {
    return new THREE.Color().setHSL(
      (plant.color.h + 30) / 360,
      Math.min(1, plant.color.s + 0.2),
      Math.min(1, plant.color.l + 0.1)
    );
  }, [plant.color]);

  const x = Math.cos((plant.position.angle * Math.PI) / 180) * plant.position.radius;
  const z = Math.sin((plant.position.angle * Math.PI) / 180) * plant.position.radius;

  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const growProgress = Math.min(1, (time - plant.growDelay) / 2);

    if (growProgress > 0) {
      // 生长动画 - 从地面向上
      const scale = Math.min(1, growProgress * 1.2);
      groupRef.current.scale.setScalar(scale);

      // 摇摆效果
      const sway = Math.sin(time * plant.animation.pulseSpeed + index) * plant.animation.pulseIntensity * 0.5;
      groupRef.current.rotation.z = sway;
      groupRef.current.rotation.x = sway * 0.5;
    } else {
      groupRef.current.scale.setScalar(0);
    }
  });

  // 生成树叶位置
  const leafPositions = useMemo(() => {
    const positions = [];
    const numLeaves = 5 + Math.floor(plant.size.height);
    for (let i = 0; i < numLeaves; i++) {
      const angle = (i / numLeaves) * Math.PI * 2;
      const height = plant.size.height * (0.4 + Math.random() * 0.5);
      const radius = plant.size.baseWidth * (0.5 + Math.random() * 0.5);
      positions.push({
        x: Math.cos(angle) * radius,
        y: height,
        z: Math.sin(angle) * radius,
        scale: 0.3 + Math.random() * 0.4,
      });
    }
    return positions;
  }, [plant.size]);

  return (
    <group ref={groupRef} position={[x, 0, z]} scale={0}>
      {/* 树干 */}
      <mesh ref={trunkRef} position={[0, plant.size.height * 0.4, 0]}>
        <cylinderGeometry args={[plant.size.baseWidth * 0.15, plant.size.baseWidth * 0.25, plant.size.height * 0.8, 6]} />
        <meshStandardMaterial
          color={color}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* 树叶 */}
      <group ref={leavesRef}>
        {leafPositions.map((pos, i) => (
          <Float key={i} speed={2} rotationIntensity={0.5} floatIntensity={0.3}>
            <mesh position={[pos.x, pos.y, pos.z]} scale={pos.scale}>
              <dodecahedronGeometry args={[plant.size.baseWidth * 0.4, 0]} />
              <meshStandardMaterial
                color={leafColor}
                roughness={0.4}
                metalness={0.3}
                emissive={leafColor}
                emissiveIntensity={0.3}
                transparent
                opacity={0.9}
              />
            </mesh>
          </Float>
        ))}
      </group>
    </group>
  );
}

// 尖塔形态 - 高频
function Spire({ plant, index }: { plant: GardenPlant; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const spireRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    return new THREE.Color().setHSL(plant.color.h / 360, plant.color.s, plant.color.l);
  }, [plant.color]);

  const glowColor = useMemo(() => {
    return new THREE.Color().setHSL(plant.color.h / 360, 1, 0.7);
  }, [plant.color]);

  const x = Math.cos((plant.position.angle * Math.PI) / 180) * plant.position.radius;
  const z = Math.sin((plant.position.angle * Math.PI) / 180) * plant.position.radius;

  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const growProgress = Math.min(1, (time - plant.growDelay) / 2);

    if (growProgress > 0) {
      // 生长动画
      const scale = Math.min(1, growProgress * 1.2);
      groupRef.current.scale.setScalar(scale);

      // 快速旋转
      groupRef.current.rotation.y = time * plant.animation.rotationSpeed;

      // 闪烁效果
      const flash = 0.5 + Math.sin(time * plant.animation.pulseSpeed * 2 + index) * 0.5;
      if (glowRef.current) {
        const material = glowRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.3 + flash * 0.4;
      }
    } else {
      groupRef.current.scale.setScalar(0);
    }
  });

  return (
    <group ref={groupRef} position={[x, 0, z]} scale={0}>
      {/* 尖塔主体 */}
      <mesh ref={spireRef} position={[0, plant.size.height / 2, 0]}>
        <coneGeometry args={[plant.size.baseWidth, plant.size.height, 8]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          emissive={glowColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* 发光外壳 */}
      <mesh ref={glowRef} position={[0, plant.size.height / 2, 0]} scale={1.2}>
        <coneGeometry args={[plant.size.baseWidth, plant.size.height, 8]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 顶部光点 */}
      <pointLight
        position={[0, plant.size.height, 0]}
        color={glowColor}
        intensity={2}
        distance={10}
      />
    </group>
  );
}

// 连接线组件
function ConnectionLines({ garden }: { garden: SoundGarden }) {
  const linesRef = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    return garden.connections.map((conn) => {
      const from = garden.plants[conn.from];
      const to = garden.plants[conn.to];

      const fromX = Math.cos((from.position.angle * Math.PI) / 180) * from.position.radius;
      const fromZ = Math.sin((from.position.angle * Math.PI) / 180) * from.position.radius;
      const fromY = from.size.height * 0.8;

      const toX = Math.cos((to.position.angle * Math.PI) / 180) * to.position.radius;
      const toZ = Math.sin((to.position.angle * Math.PI) / 180) * to.position.radius;
      const toY = to.size.height * 0.8;

      return {
        start: new THREE.Vector3(fromX, fromY, fromZ),
        end: new THREE.Vector3(toX, toY, toZ),
        color: conn.type === 'harmony' ? 0xffd700 : 0x88ccff,
      };
    });
  }, [garden]);

  useFrame((state) => {
    if (linesRef.current) {
      const time = state.clock.getElapsedTime();
      linesRef.current.children.forEach((child, i) => {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity = 0.3 + Math.sin(time * 2 + i) * 0.2;
      });
    }
  });

  return (
    <group ref={linesRef}>
      {lines.map((line, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([line.start.x, line.start.y, line.start.z, line.end.x, line.end.y, line.end.z])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={line.color} transparent opacity={0.5} />
        </line>
      ))}
    </group>
  );
}

// 地面花园
function GardenGround() {
  return (
    <group>
      {/* 主地面 */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[25, 64]} />
        <meshStandardMaterial
          color={0x0a0a15}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* 网格环 */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5 + i * 4, 5 + i * 4 + 0.1, 64]} />
          <meshBasicMaterial color={0x222244} transparent opacity={0.3} />
        </mesh>
      ))}

      {/* 径向线 */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 12,
              -0.4,
              Math.sin(angle) * 12
            ]}
            rotation={[-Math.PI / 2, 0, angle + Math.PI / 2]}
          >
            <planeGeometry args={[0.05, 24]} />
            <meshBasicMaterial color={0x222244} transparent opacity={0.2} />
          </mesh>
        );
      })}
    </group>
  );
}

// 录音可视化
function RecordingVisualizer({ volume, frequency }: { volume: number; frequency?: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const barsRef = useRef<THREE.Group>(null);

  const color = useMemo(() => {
    const freq = frequency ?? 500;
    const hue = (freq / 5000) * 270;
    return new THREE.Color().setHSL(hue / 360, 0.8, 0.5);
  }, [frequency]);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.getElapsedTime();
      ringRef.current.scale.setScalar(1 + volume * 0.5);
    }

    if (barsRef.current) {
      barsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const scale = 1 + volume * 3 + Math.sin(state.clock.getElapsedTime() * 8 + i * 0.5) * 0.3;
        mesh.scale.y = Math.max(0.1, scale);
      });
    }
  });

  return (
    <group>
      {/* 中心圆环 */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2, 0.1, 16, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>

      {/* 音柱 */}
      <group ref={barsRef}>
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const x = Math.cos(angle) * 4;
          const z = Math.sin(angle) * 4;
          return (
            <mesh key={i} position={[x, 0.5, z]} rotation={[0, -angle, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// 主场景
export function GardenScene({
  garden,
  isRecording,
  currentVolume = 0,
  currentFrequency = 500,
}: GardenSceneProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [0, 20, 30], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#050510']} />
        <fog attach="fog" args={['#050510', 20, 80]} />

        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 30, 10]} intensity={1} castShadow />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4444ff" />
        <pointLight position={[10, 5, -10]} intensity={0.3} color="#ff4444" />

        <Stars radius={150} depth={80} count={5000} factor={6} saturation={0.5} fade />

        <GardenGround />

        {garden ? (
          <>
            {garden.plants.map((plant, index) => {
              if (plant.type === 'mushroom') {
                return <Mushroom key={index} plant={plant} index={index} />;
              } else if (plant.type === 'tree') {
                return <Tree key={index} plant={plant} index={index} />;
              } else {
                return <Spire key={index} plant={plant} index={index} />;
              }
            })}
            <ConnectionLines garden={garden} />
          </>
        ) : isRecording ? (
          <RecordingVisualizer volume={currentVolume} frequency={currentFrequency} />
        ) : null}

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.1}
          autoRotate={!!garden}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}

export default GardenScene;
