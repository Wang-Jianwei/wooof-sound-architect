import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, MeshDistortMaterial, Float } from '@react-three/drei';
import * as THREE from 'three';
import { BuildingStructure, BuildingModule } from '../utils/BuildingGenerator';

interface BuildingSceneProps {
  building: BuildingStructure | null;
  isRecording?: boolean;
  currentVolume?: number;
  currentFrequency?: number;
}

// 单个建筑模块组件 - 增强版
function BuildingBlock({ module, index }: { 
  module: BuildingModule; 
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // 入场动画和浮动效果
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      
      // 建造动画 - 从上方落下
      const buildProgress = Math.min(1, (time * 2) - index * 0.1);
      if (buildProgress > 0 && buildProgress < 1) {
        const dropHeight = 20 * (1 - buildProgress);
        meshRef.current.position.y = module.position.y + dropHeight;
        meshRef.current.scale.setScalar(buildProgress);
      } else {
        // 正常浮动
        meshRef.current.position.y = module.position.y + Math.sin(time * 2 + index * 0.3) * 0.08;
        meshRef.current.scale.setScalar(1);
      }
      
      // 根据类型添加特殊动画
      if (module.type === 'spire') {
        meshRef.current.rotation.y = time * 0.5;
      } else if (module.type === 'foundation') {
        meshRef.current.rotation.y = Math.sin(time * 0.5) * 0.02;
      }
    }
    
    // 发光效果动画
    if (glowRef.current) {
      const time = state.clock.getElapsedTime();
      glowRef.current.scale.setScalar(1 + Math.sin(time * 3 + index * 0.5) * 0.05);
    }
  });

  const color = useMemo(() => {
    return new THREE.Color(module.color.r, module.color.g, module.color.b);
  }, [module.color]);

  // 根据类型确定材质属性
  const materialProps = useMemo(() => {
    switch (module.type) {
      case 'foundation':
        return { roughness: 0.8, metalness: 0.2, emissiveIntensity: 0.1 };
      case 'body':
        return { roughness: 0.5, metalness: 0.4, emissiveIntensity: 0.2 };
      case 'spire':
        return { roughness: 0.2, metalness: 0.8, emissiveIntensity: 0.4 };
    }
  }, [module.type]);

  return (
    <group>
      {/* 主体 */}
      <mesh
        ref={meshRef}
        position={[module.position.x, module.position.y + 20, module.position.z]}
        castShadow
        receiveShadow
      >
        {module.type === 'spire' ? (
          <coneGeometry
            args={[module.size.width / 2, module.size.height, 8]}
          />
        ) : module.type === 'foundation' ? (
          <boxGeometry
            args={[module.size.width, module.size.height, module.size.depth]}
          />
        ) : (
          <cylinderGeometry
            args={[module.size.width / 2, module.size.width / 2, module.size.height, 8]}
          />
        )}
        <MeshDistortMaterial
          color={color}
          roughness={materialProps.roughness}
          metalness={materialProps.metalness}
          emissive={color}
          emissiveIntensity={materialProps.emissiveIntensity}
          distort={0.1}
          speed={2}
        />
      </mesh>
      
      {/* 发光外壳 */}
      <mesh
        ref={glowRef}
        position={[module.position.x, module.position.y, module.position.z]}
        scale={1.1}
      >
        {module.type === 'spire' ? (
          <coneGeometry
            args={[module.size.width / 2 * 1.1, module.size.height * 1.1, 8]}
          />
        ) : module.type === 'foundation' ? (
          <boxGeometry
            args={[module.size.width * 1.05, module.size.height * 1.05, module.size.depth * 1.05]}
          />
        ) : (
          <cylinderGeometry
            args={[module.size.width / 2 * 1.1, module.size.width / 2 * 1.1, module.size.height * 1.05, 8]}
          />
        )}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* 粒子效果 - 尖顶部添加 */}
      {module.type === 'spire' && (
        <ParticleEffect 
          position={{ x: module.position.x, y: module.position.y + module.size.height / 2, z: module.position.z }} 
          color={color} 
        />
      )}
    </group>
  );
}

// 粒子效果组件
function ParticleEffect({ position, color }: { position: { x: number; y: number; z: number }; color: THREE.Color }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 20;
  
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = [];
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = position.x;
      pos[i * 3 + 1] = position.y;
      pos[i * 3 + 2] = position.z;
      vel.push({
        x: (Math.random() - 0.5) * 0.02,
        y: Math.random() * 0.03,
        z: (Math.random() - 0.5) * 0.02,
      });
    }
    return [pos, vel];
  }, [position]);
  
  useFrame(() => {
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] += velocities[i].x;
        pos[i * 3 + 1] += velocities[i].y;
        pos[i * 3 + 2] += velocities[i].z;
        
        // 重置粒子
        if (pos[i * 3 + 1] > position.y + 2) {
          pos[i * 3] = position.x;
          pos[i * 3 + 1] = position.y;
          pos[i * 3 + 2] = position.z;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color={color}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// 建筑主体组件
function Building({ building }: { building: BuildingStructure }) {
  const groupRef = useRef<THREE.Group>(null);

  // 整体缓慢旋转
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {building.modules.map((module, index) => (
        <BuildingBlock 
          key={index} 
          module={module} 
          index={index}
        />
      ))}
      
      {/* 稳定性指示光环 */}
      <StabilityRing stability={building.stabilityScore} height={building.totalHeight} />
      
      {/* 建筑名称悬浮标签 */}
      <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
        <group position={[0, building.totalHeight + 2, 0]}>
          {/* 这里可以添加文字标签 */}
        </group>
      </Float>
    </group>
  );
}

// 稳定性指示器
function StabilityRing({ stability, height }: { stability: number; height: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  
  const color = useMemo(() => {
    if (stability >= 80) return new THREE.Color(0.2, 0.9, 0.2); // 绿色 - 稳定
    if (stability >= 50) return new THREE.Color(0.9, 0.9, 0.2); // 黄色 - 一般
    return new THREE.Color(0.9, 0.2, 0.2); // 红色 - 不稳定
  }, [stability]);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = -state.clock.getElapsedTime() * 0.5;
      ringRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.1;
    }
  });

  const radius = 4 + (100 - stability) * 0.05;

  return (
    <group position={[0, height / 2, 0]}>
      {/* 外环 */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.05, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      
      {/* 内环 - 反向旋转 */}
      <InnerStabilityRing radius={radius * 0.8} color={color} />
      
      {/* 稳定性粒子 */}
      <StabilityParticles radius={radius} color={color} />
    </group>
  );
}

// 内环
function InnerStabilityRing({ radius, color }: { radius: number; color: THREE.Color }) {
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = state.clock.getElapsedTime() * 0.8;
      ringRef.current.rotation.z = Math.cos(state.clock.getElapsedTime() * 0.3) * 0.1;
    }
  });
  
  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.03, 6, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}

// 稳定性粒子
function StabilityParticles({ radius, color }: { radius: number; color: THREE.Color }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 30;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * 0.5;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return pos;
  }, [radius]);
  
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.3;
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color={color}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// 录音中的可视化效果 - 增强版
function RecordingVisualizer({ volume, frequency }: { volume: number; frequency?: number }) {
  const barsRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const barCount = 24;
  
  // 根据频率调整颜色
  const baseColor = useMemo(() => {
    const freq = frequency ?? 500;
    if (freq < 250) return new THREE.Color(0.8, 0.2, 0.2); // 红 - 低频
    if (freq < 1000) return new THREE.Color(1.0, 0.6, 0.0); // 橙 - 中频
    return new THREE.Color(0.2, 0.5, 0.9); // 蓝 - 高频
  }, [frequency]);
  
  useFrame((state) => {
    if (barsRef.current) {
      const time = state.clock.getElapsedTime();
      barsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const scale = 1 + volume * 3 + Math.sin(time * 8 + i * 0.5) * 0.2 * volume;
        mesh.scale.y = Math.max(0.1, scale);
        mesh.position.y = mesh.scale.y / 2;
        
        // 动态颜色
        const material = mesh.material as THREE.MeshStandardMaterial;
        const hue = (i / barCount + time * 0.1) % 1;
        material.emissive.setHSL(hue, 0.8, 0.3 + volume * 0.3);
      });
    }
    
    if (ringRef.current) {
      const time = state.clock.getElapsedTime();
      ringRef.current.rotation.z = time * 2;
      ringRef.current.scale.setScalar(1 + volume * 0.5);
    }
  });

  return (
    <group>
      {/* 音柱 */}
      <group ref={barsRef} position={[0, 0, 0]}>
        {Array.from({ length: barCount }).map((_, i) => {
          const angle = (i / barCount) * Math.PI * 2;
          const radius = 3;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          
          return (
            <mesh key={i} position={[x, 0.5, z]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[0.25, 1, 0.25]} />
              <meshStandardMaterial
                color={baseColor}
                emissive={baseColor}
                emissiveIntensity={0.5}
              />
            </mesh>
          );
        })}
      </group>
      
      {/* 中心圆环 */}
      <mesh ref={ringRef} rotation={[0, 0, 0]}>
        <torusGeometry args={[1.5, 0.1, 16, 64]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={0.8}
        />
      </mesh>
      
      {/* 脉冲球 */}
      <PulseSphere volume={volume} color={baseColor} />
    </group>
  );
}

// 脉冲球
function PulseSphere({ volume, color }: { volume: number; color: THREE.Color }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (sphereRef.current) {
      const time = state.clock.getElapsedTime();
      const scale = 0.5 + volume * 1.5 + Math.sin(time * 10) * 0.1 * volume;
      sphereRef.current.scale.setScalar(scale);
      
      const material = sphereRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + volume * 0.7;
    }
  });
  
  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[0.8, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// 空状态提示 - 增强版
function EmptyState() {
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.2;
      ringRef.current.rotation.y = state.clock.getElapsedTime() * 0.2;
    }
  });
  
  return (
    <group>
      {/* 地面网格 */}
      <Grid
        position={[0, -0.1, 0]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#444466"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#6666aa"
        fadeDistance={40}
        fadeStrength={1}
        infiniteGrid
      />
      
      {/* 悬浮圆环 */}
      <mesh ref={ringRef} position={[0, 3, 0]}>
        <torusGeometry args={[2, 0.05, 8, 64]} />
        <meshBasicMaterial color="#667eea" transparent opacity={0.5} />
      </mesh>
      
      {/* 提示粒子 */}
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh position={[0, 2, 0]}>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial
            color="#764ba2"
            emissive="#764ba2"
            emissiveIntensity={0.5}
            wireframe
          />
        </mesh>
      </Float>
    </group>
  );
}

// 主场景组件
export function BuildingScene({ 
  building, 
  isRecording, 
  currentVolume = 0,
  currentFrequency = 500
}: BuildingSceneProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [12, 12, 12], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 背景色 */}
        <color attach="background" args={['#050510']} />
        
        {/* 雾效 */}
        <fog attach="fog" args={['#050510', 15, 80]} />
        
        {/* 环境光 */}
        <ambientLight intensity={0.2} />
        
        {/* 主光源 */}
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        
        {/* 彩色补光 */}
        <pointLight position={[-10, 10, -10]} intensity={0.8} color="#4444ff" />
        <pointLight position={[10, 5, -10]} intensity={0.5} color="#ff4444" />
        <pointLight position={[0, 15, 10]} intensity={0.6} color="#44ff44" />
        
        {/* 星空背景 */}
        <Stars radius={150} depth={80} count={8000} factor={6} saturation={0.5} fade speed={0.5} />
        
        {/* 地面 */}
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial 
            color="#0a0a1a" 
            roughness={0.9} 
            metalness={0.1}
          />
        </mesh>
        
        {/* 发光地面网格 */}
        <Grid
          position={[0, -0.49, 0]}
          args={[100, 100]}
          cellSize={2}
          cellThickness={0.3}
          cellColor="#222244"
          sectionSize={10}
          sectionThickness={0.5}
          sectionColor="#333366"
          fadeDistance={60}
          fadeStrength={1.5}
          infiniteGrid
        />
        
        {/* 渲染内容 */}
        {building ? (
          <Building building={building} />
        ) : isRecording ? (
          <RecordingVisualizer volume={currentVolume} frequency={currentFrequency} />
        ) : (
          <EmptyState />
        )}
        
        {/* 轨道控制器 */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={60}
          target={[0, building ? building.totalHeight / 2 : 2, 0]}
        />
      </Canvas>
    </div>
  );
}

export default BuildingScene;
