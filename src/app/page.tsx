"use client"

import { Canvas } from "@react-three/fiber"
import { Environment, Grid, OrbitControls } from "@react-three/drei"
import { Scooter } from "@/components/scooter"

export default function Home() {
  return (
    <div className="w-full h-screen">
      <Canvas shadows camera={{ position: [0, 0.5, 1.5], fov: 50 }}>
        <color attach="background" args={["#e0e0e0"]} />

        {/* Use OrbitControls and set a static target (import OrbitControls from "@react-three/drei") */}
        <OrbitControls
          makeDefault
          enableRotate={false}
          enablePan={false}
          enableZoom={false}
          target={[0, 0.3, 0]}
        />

        {/* The scooter model */}
        <Scooter position={[0, 0, 0]}></Scooter>

        <Grid args={[2, 2]} />

        {/* <AnimatedScooter /> */}

        {/* Shadow catcher ground  */}
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.001, -2.5]}
        >
          <planeGeometry args={[10, 10]} />
          <shadowMaterial opacity={0.9} />
          {/* <meshStandardMaterial color="#777777" /> */}
        </mesh>

        {/* Environment lighting */}
        <Environment preset="city" />
      </Canvas>
    </div>
  )
}
