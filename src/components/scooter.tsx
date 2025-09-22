"use client"
import { useGLTF, Line, Grid } from "@react-three/drei"
import * as THREE from "three"
import {
  forwardRef,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react"
import { useFrame, useThree } from "@react-three/fiber"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { useControls } from "leva"
import { ScrollTrigger } from "gsap/all"
import { damp3 } from "maath/easing"
import { Particles } from "./particles"

gsap.registerPlugin(ScrollTrigger)

type ScooterProps = React.ComponentProps<"group"> & {
  setIntroCompleted?: (completed: boolean) => void
}

const MESH_NAMES = ["steer", "wheels_front", "wheels_rear", "body"]

const initialCameraPosition = new THREE.Vector3(0, 0.5, 1.5)
const initialCameraLookAt = new THREE.Vector3(0, 0.3, 0)

const tmp = {
  tangent: new THREE.Vector3(),
  scooterLookAt: new THREE.Vector3(),
  laggedPosition: new THREE.Vector3(),
  bodyWorldPosition: new THREE.Vector3(),
  directionVector: new THREE.Vector3(),
  bodyLookTarget: new THREE.Vector3(),

  cameraGoal: new THREE.Vector3().copy(initialCameraPosition),

  rawLookAt: new THREE.Vector3().copy(initialCameraLookAt),
  smoothLookAt: new THREE.Vector3().copy(initialCameraLookAt),
}

const PATH_COORDS = {
  entry: [
    [5, 0, -6],
    [-2, 0, -2.08],
    [-1.03, 0, -1.01],
    [0.33, 0, -2.11],
    [1.13, 0, -1.28],
    [0, 0, 0],
  ],
  camera: [
    [0.0, 0.5, 1.5],
    [-0.0, 0.94, 0.71],
    [1.14, 0.62, 0.18],
    [0.91, 0.08, -0.94],
    [-0.47, 0.53, -1.05],
    [-0.94, 0.48, 0.08],
    [-0.65, 0.27, 0.64],
  ],
  target: [
    [0.0, 0.3, 0.0],
    [0.01, 0.35, -0.04],
    [0.14, 0.28, -0.16],
    [0.14, 0.27, -0.16],
    [0.13, 0.28, -0.15],
    [0.13, 0.28, -0.15],
    [0.12, 0.35, -0.16],
  ],
}

export const Scooter = forwardRef<THREE.Group, ScooterProps>((props, ref) => {
  const { setIntroCompleted } = props
  const { scene } = useGLTF("/scooter_comp.glb")
  const scrubProgress = useRef(0)
  const lookBackDistance = useRef(0.03)
  const scooterRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.DirectionalLight>(null)

  const { invalidate, camera } = useThree()

  // set default camera position
  useEffect(() => {
    camera.position.copy(initialCameraPosition)
    camera.lookAt(initialCameraLookAt)
    invalidate()
  }, [camera, invalidate])

  // Leva controls for curve points
  const {
    // Animation controls
    showHelpers,
  } = useControls("Scooter", {
    showHelpers: false,

    // Direct Animation controls
    directProgress: {
      value: 0,
      min: 0,
      max: 1,
      step: 0.001,
      onChange: (v) => {
        scrubProgress.current = v
        updateScooterPosition(v)
      },
    },
  })

  // Define the curves for scooter entry path
  const entryPath = useMemo(() => {
    const vecArray = PATH_COORDS.entry.map((a) => new THREE.Vector3(...a))
    return new THREE.CatmullRomCurve3(vecArray, false)
  }, [])

  // Define the curves for camera during scroll
  const scrollCameraPath = useMemo(() => {
    const vecArray = PATH_COORDS.camera.map((a) => new THREE.Vector3(...a))
    return new THREE.CatmullRomCurve3(vecArray, true)
  }, [])

  // Define the curves for target during scroll
  const scrollTargetPath = useMemo(() => {
    const vecArray = PATH_COORDS.target.map((a) => new THREE.Vector3(...a))
    return new THREE.CatmullRomCurve3(vecArray, true)
  }, [])

  // Store references to key meshes for animation
  const scooterMeshes = useRef({
    steer: null as THREE.Mesh | null,
    wheels_front: null as THREE.Mesh | null,
    wheels_rear: null as THREE.Mesh | null,
    body: null as THREE.Mesh | null,
  })

  // On model load, traverse , find relevant meshes and enable shadows
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true

        if (MESH_NAMES.includes(child.name)) {
          const meshName = child.name
          scooterMeshes.current[
            meshName as keyof typeof scooterMeshes.current
          ] = mesh
        }
      }
    })

    // add light.target as child of the 'scene
    if (lightRef.current) {
      scene.add(lightRef.current.target)
      console.log("LIGHT TARGET ADDed")
    }

    invalidate() // for lightRef related items to update
  }, [scene, lightRef, invalidate])

  // Function to update scooter position along entry path
  const updateScooterPosition = useCallback(
    (t: number) => {
      if (!scooterRef.current) return

      // Update position along curve (handle follows curve exactly)
      entryPath.getPointAt(t, scooterRef.current.position)
      entryPath.getTangentAt(t, tmp.tangent)
      tmp.scooterLookAt.copy(scooterRef.current.position).add(tmp.tangent)
      scooterRef.current.lookAt(tmp.scooterLookAt)

      const scooterBody = scooterMeshes.current.body
      const wheelsFront = scooterMeshes.current.wheels_front
      const wheelsRear = scooterMeshes.current.wheels_rear

      // Make the body lag behind when turning (simulate rear wheels following)
      if (scooterBody && lookBackDistance.current > 0) {
        const lagT = Math.max(0, t - lookBackDistance.current) // Ensure no negative values

        entryPath.getPointAt(lagT, tmp.laggedPosition)
        scooterBody.getWorldPosition(tmp.bodyWorldPosition)
        tmp.directionVector.copy(tmp.bodyWorldPosition).sub(tmp.laggedPosition)
        if (tmp.directionVector.length() > 0.001) {
          tmp.directionVector.normalize()
          // Apply rotation to body based on this direction
          tmp.bodyLookTarget
            .copy(tmp.bodyWorldPosition)
            .add(tmp.directionVector)
          scooterBody.lookAt(tmp.bodyLookTarget)
        }
      }

      // Wheel rotation
      if (wheelsFront && wheelsRear) {
        const rad = 0.111663 / 2
        const pathLength = entryPath.getLength()
        const traveled = t * pathLength
        const rotationAngle = traveled / rad
        wheelsFront.rotation.x = rotationAngle
        wheelsRear.rotation.x = rotationAngle
      }
      invalidate()
    },
    [entryPath, invalidate]
  )

  const introCompleted = useRef(false) // no need to trigger re-renders

  // Function to scrub camera and target along their paths
  const scrubCameraAlongPath = useCallback(
    (t: number) => {
      scrollCameraPath.getPointAt(t, tmp.cameraGoal)
      scrollTargetPath.getPointAt(t, tmp.rawLookAt)
      invalidate()
    },
    [scrollCameraPath, scrollTargetPath, invalidate]
  )

  // in useFrame, smoothly move camera and target to their goal positions
  useFrame((state, delta) => {
    if (!introCompleted.current) return

    const camUpdated = damp3(
      camera.position,
      tmp.cameraGoal,
      0.2,
      delta,
      undefined,
      undefined,
      1e-6
    )

    const tarUpdated = damp3(
      tmp.rawLookAt,
      tmp.smoothLookAt,
      0.2,
      delta,
      undefined,
      undefined,
      1e-6
    )

    if (camUpdated || tarUpdated) {
      camera.lookAt(tmp.smoothLookAt)
      invalidate()
    }
  })

  // GSAP intro animation + scrollTrigger setup
  const [showParticles, setShowParticles] = useState(false)

  useGSAP(
    () => {
      const tl = gsap.timeline({
        onComplete: () => {
          // console.log("Scooter entry animation complete")
          if (setIntroCompleted) setIntroCompleted(true) // reveals the scroll content on main page
          introCompleted.current = true

          setTimeout(() => {
            gsap.timeline({
              scrollTrigger: {
                trigger: "#scroll-content",
                start: "top top",
                end: "bottom bottom",

                onUpdate: (self) => {
                  // console.log("Scrub to", self.progress.toFixed(2))
                  scrubCameraAlongPath(self.progress)
                },
              },
            })

            gsap.timeline({
              scrollTrigger: {
                trigger: "#end-content",
                start: "top top",
                end: "bottom bottom",

                onUpdate: (self) => {
                  // console.log("END progress:", self.progress)

                  if (self.progress > 0) {
                    setShowParticles(true)
                  } else {
                    setShowParticles(false)
                  }
                },
              },
            })
            // console.log("scroll events added")
          }, 500)
        },
      })

      // Main path animation
      tl.to(scrubProgress, {
        current: 1,
        duration: 10,
        ease: "power2.out",
        onUpdate: () => {
          updateScooterPosition(scrubProgress.current)
        },
      })
    },
    {
      dependencies: [updateScooterPosition],
      scope: scooterRef,
    }
  )

  useGSAP(() => {
    if (!scooterMeshes.current.body) return
    // hide the model with the same timing as the particles reveal

    // there's just one material in the model, so we can grab it from any mesh
    const material = scooterMeshes.current.body
      .material as THREE.MeshStandardMaterial

    // make material transparent and animate opacity to 0
    const endOpacity = showParticles ? 0 : 1
    const endEmissiveIntensity = showParticles ? 5 : 0

    //return early if already at target opacity
    if (material.opacity === endOpacity) return

    gsap.fromTo(
      material,
      {
        opacity: material.opacity,
        emissiveIntensity: endOpacity === 0 ? 0 : 5,
      },
      {
        opacity: endOpacity,
        emissiveIntensity: endEmissiveIntensity,
        duration: 3,
        ease: "power2.inOut",
        onUpdate: invalidate,
        onStart: () => {
          if (endOpacity === 0) {
            material.alphaHash = true // the hashing dots improve the transition look
            material.transparent = true // ensure transparency is on when fading out
            material.needsUpdate = true // ensure material updates
            material.emissive.set("#00ff00") // slight emissive when fading out
          }
        },
        onComplete: () => {
          if (material.opacity === 1) {
            material.transparent = false // turn off transparency when fully opaque
            material.needsUpdate = true // ensure material updates
          }
        },
      }
    )
  }, [scooterMeshes, showParticles])

  return (
    <group {...props} ref={ref}>
      <directionalLight
        ref={lightRef}
        color={"#00ffff"}
        position={[2, 2, 2]}
        intensity={5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
        shadow-camera-far={50}
      />

      <primitive object={scene} ref={scooterRef} />

      {showHelpers && (
        <>
          <Grid args={[2, 2]} />

          {lightRef.current && (
            <cameraHelper args={[lightRef.current?.shadow.camera]} />
          )}
          <Line points={entryPath.getPoints(50)} color="green" lineWidth={2} />

          <Line points={scrollCameraPath.getPoints(50)} color="blue" />
          <Line points={scrollTargetPath.getPoints(50)} color="yellow" />
        </>
      )}
      {introCompleted.current && (
        <Particles showParticles={showParticles} scooterRef={scooterRef} />
      )}
    </group>
  )
})

Scooter.displayName = "Scooter"

// Preload the model
useGLTF.preload("/scooter_comp.glb")
