"use client"

import { Canvas } from "@react-three/fiber"
import { Environment, Html, OrbitControls } from "@react-three/drei"
import { Scooter } from "@/components/scooter"
import { Suspense, useRef, useState, useEffect, RefObject } from "react"
import { Bloom, EffectComposer } from "@react-three/postprocessing"

export default function Home() {
  const [introCompleted, setIntroCompleted] = useState<boolean>(false)
  const scrollDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to top when intro completed
    if (introCompleted) {
      window.scrollTo(0, 0)
    }
  }, [introCompleted])

  return (
    <>
      <div
        ref={scrollDivRef}
        // allow touch scrolling on mobile while still letting the canvas receive pointer events via eventSource
        className={`transition-opacity duration-800 ${
          introCompleted ? "opacity-100" : "opacity-0"
        }`}
        style={{ touchAction: "pan-y" }}
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
          <div className="h-screen flex items-end justify-center ">
            <h1 className="text-8xl  text-green-500 font-bold">Section END</h1>
          </div>
        </div>
      </div>

      <R3fCanvas setIntroCompleted={setIntroCompleted} />
    </>
  )
}

const R3fCanvas = ({
  setIntroCompleted,
}: {
  setIntroCompleted: (completed: boolean) => void
}) => {
  return (
    <div className="fixed inset-0 w-full h-screen">
      <Canvas
        dpr={[1, 1.5]}
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

        <Suspense fallback={<LoadingDisplay />}>
          <Scooter position={[0, 0, 0]} setIntroCompleted={setIntroCompleted} />
          <Environment preset="apartment" />
        </Suspense>

        {/* Shadow catcher ground  */}
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.001, -2.5]}
        >
          <planeGeometry args={[10, 10]} />
          <shadowMaterial opacity={0.9} />
        </mesh>
      </Canvas>
    </div>
  )
}

const LoadingDisplay = () => {
  return (
    <Html position={[0, 0.3, 0]} center>
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <h1 className="text-6xl font-bold">Loading</h1>
        </div>
      </div>
    </Html>
  )
}
