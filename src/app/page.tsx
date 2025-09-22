"use client"

import { Canvas } from "@react-three/fiber"
import { Environment, OrbitControls } from "@react-three/drei"
import { Scooter } from "@/components/scooter"
import { useRef, useState } from "react"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { Particles } from "@/components/particles"

export default function Home() {
  const [introCompleted, setIntroCompleted] = useState(false)
  const orbitConRef = useRef(null)
  return (
    <>
      <div
        className={`transition-opacity duration-300 ${
          introCompleted ? "opacity-100" : " opacity-0 hidden"
        }`}
      >
        <div id="scroll-content">
          <div className="h-screen flex items-center justify-items-start">
            <h1 className="text-8xl text-blue-700 font-bold">Section A</h1>
          </div>
          <div className="h-screen flex items-center justify-end">
            <h1 className="text-8xl text-blue-700 font-bold">Section B</h1>
          </div>
          <div className="h-screen flex items-center justify-start">
            <h1 className="text-8xl  text-blue-500 font-bold">Section C</h1>
          </div>
        </div>
        <div id="end-content">
          <div className="h-screen flex items-center justify-center">
            <h1 className="text-8xl  text-blue-500 font-bold">Section END</h1>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 w-full h-screen ">
        <Canvas
          frameloop="demand"
          shadows
          camera={{ position: [0, 0.5, 1.5], fov: 50 }}
        >
          <EffectComposer>
            <Bloom
              luminanceThreshold={1}
              luminanceSmoothing={0.8}
              resolutionScale={0.5}
            />
          </EffectComposer>
          {/* <color attach="background" args={["#e0e0e0"]} /> */}

          {/* Use OrbitControls and set a static target (import OrbitControls from "@react-three/drei") */}
          <OrbitControls
            ref={orbitConRef}
            makeDefault
            // enableRotate={false}
            // enablePan={false}
            // enableZoom={false}
            target={[0, 0.3, 0]}
          />

          {/* The scooter model */}
          <Scooter
            position={[0, 0, 0]}
            orbitControlsRef={orbitConRef}
            setIntroCompleted={setIntroCompleted}
          />

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
          <Environment preset="apartment" />
        </Canvas>
      </div>
    </>
  )
}
