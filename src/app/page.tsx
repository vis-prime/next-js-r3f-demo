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
          <FullScreenDiv
            text="Section A"
            vertical="center"
            horizontal="start"
          />
          <FullScreenDiv text="Section B" vertical="center" horizontal="end" />
          <FullScreenDiv
            text="Section C"
            vertical="center"
            horizontal="start"
          />
        </div>
        <div id="end-content">
          <FullScreenDiv
            text="Section END"
            vertical="end"
            horizontal="center"
          />
        </div>
      </div>

      <R3fCanvas setIntroCompleted={setIntroCompleted} />
    </>
  )
}

// Reusable full-screen wrapper for scrolling sections
const FullScreenDiv = ({
  text,
  vertical = "center",
  horizontal = "center",
}: {
  text: string
  vertical?: "start" | "center" | "end"
  horizontal?: "start" | "center" | "end"
}) => {
  // base classes for consistent full-screen layout
  const base = "h-screen flex"

  // Map direction -> tailwind alignment classes
  const justifyMap: Record<string, string> = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
  }

  const alignMap: Record<string, string> = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
  }

  const justifyClass = justifyMap[horizontal] ?? "justify-center"
  const itemsClass = alignMap[vertical] ?? "items-center"

  return (
    <div className={`${base} ${itemsClass} ${justifyClass}`}>
      <h1 className="text-6xl text-green-700 text-shadow-sm font-bold">
        {text}
      </h1>
    </div>
  )
}

// Fullscreen R3F Canvas with scooter model
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

// Simple loading display while the model loads
const LoadingDisplay = () => {
  return (
    <Html position={[0, 0, 0]} center>
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <h1 className="text-6xl text-green-700 font-bold">Loading</h1>
        </div>
      </div>
    </Html>
  )
}
