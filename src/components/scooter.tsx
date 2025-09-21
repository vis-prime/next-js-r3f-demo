"use client"
import { useGLTF, MotionPathRef, Line, Grid } from "@react-three/drei"
import * as THREE from "three"
import { forwardRef, useRef, useEffect, useCallback, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { button, useControls } from "leva"
import { ScrollTrigger } from "gsap/all"
import { damp3 } from "maath/easing"

gsap.registerPlugin(ScrollTrigger)

type ScooterProps = React.ComponentProps<"group"> & {
  setIntroCompleted?: (completed: boolean) => void
  orbitControlsRef: React.RefObject<
    import("three/addons/controls/OrbitControls.js").OrbitControls | null
  >
}

const MESH_NAMES = ["steer", "wheels_front", "wheels_rear", "body"]

const tmp = {
  tangent: new THREE.Vector3(),
  lookAtTarget: new THREE.Vector3(),
  laggedPosition: new THREE.Vector3(),
  bodyWorldPosition: new THREE.Vector3(),
  directionVector: new THREE.Vector3(),
  bodyLookTarget: new THREE.Vector3(),

  cameraGoal: new THREE.Vector3(),
  targetGoal: new THREE.Vector3(),
}

export const Scooter = forwardRef<THREE.Group, ScooterProps>((props, ref) => {
  const { setIntroCompleted } = props
  console.log("Scooter render")
  const { scene } = useGLTF("/scooter_comp.glb")
  const scrubProgress = useRef(0)
  const lookBackDistance = useRef(0.03)
  const scooterRef = useRef<MotionPathRef>(null)
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const orbitControlsRef = props.orbitControlsRef

  const { invalidate, camera } = useThree()

  // Leva controls for curve points
  const {
    // Animation controls
    showHelpers,
  } = useControls("Scooter", {
    showHelpers: false,

    // Animation controls
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
    lookBehindDistance: {
      value: 0.03,
      min: 0,
      max: 0.1,
      step: 0.001,
      onChange: (v) => {
        lookBackDistance.current = v
        updateScooterPosition(scrubProgress.current)
      },
    },

    printCurvePoints: button(() => {
      console.log("Curve Points:")
      let str = ""
      entryPath.points.forEach(
        (p) => (str += `  new THREE.Vector3(${p.x}, ${p.y}, ${p.z}),\n`)
      )
      console.log(str)
    }),

    printCameraPos: button(() => {
      const p = camera.position
      const orbitControls = orbitControlsRef.current
      if (orbitControls) {
        const t = orbitControls.target
        console.log(
          `CAM new THREE.Vector3(${p.x.toFixed(2)}, ${p.y.toFixed(
            2
          )}, ${p.z.toFixed(2)}), TAR new THREE.Vector3(${t.x.toFixed(
            2
          )}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}) `
        )
      }
    }),
  })

  const entryPath = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(5, 0, -6),
        new THREE.Vector3(-2, 0, -2.08),
        new THREE.Vector3(-1.03, 0, -1.01),
        new THREE.Vector3(0.33, 0, -2.11),
        new THREE.Vector3(1.13, 0, -1.28),
        new THREE.Vector3(0, 0, 0),
      ],
      false,
      "catmullrom",
      0.5
    )
  }, [])

  const scrollCameraPath = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0.0, 0.5, 1.5),
        new THREE.Vector3(-0.0, 0.94, 0.71),
        new THREE.Vector3(1.14, 0.62, 0.18),
        new THREE.Vector3(0.91, 0.08, -0.94),
        new THREE.Vector3(-0.47, 0.53, -1.05),
        new THREE.Vector3(-0.94, 0.48, 0.08),
        new THREE.Vector3(-0.65, 0.27, 0.64),
      ],
      true
    )
  }, [])

  const scrollTargetPath = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0.0, 0.3, 0.0),
        new THREE.Vector3(0.01, 0.35, -0.04),
        new THREE.Vector3(0.14, 0.28, -0.16),
        new THREE.Vector3(0.14, 0.27, -0.16),
        new THREE.Vector3(0.13, 0.28, -0.15),
        new THREE.Vector3(0.13, 0.28, -0.15),
        new THREE.Vector3(0.12, 0.35, -0.16),
      ],
      true
    )
  }, [])

  type MeshName = (typeof MESH_NAMES)[number]

  type ScooterMeshes = Record<MeshName, THREE.Mesh | null>

  const scooterMeshes = useRef<ScooterMeshes>({
    steer: null,
    wheels_front: null,
    wheels_rear: null,
    body: null,
  })

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true

        if (MESH_NAMES.includes(child.name as MeshName)) {
          const meshName = child.name as MeshName
          scooterMeshes.current[meshName] = mesh
        }
      }
    })

    invalidate() // for lightRef related items to update
  }, [scene, invalidate])

  // Common animation function used by both Leva and GSAP
  const updateScooterPosition = useCallback(
    (t: number) => {
      if (!scooterRef.current) return

      // Update position along curve (handle follows curve exactly)
      entryPath.getPointAt(t, scooterRef.current.position)
      entryPath.getTangentAt(t, tmp.tangent)
      tmp.lookAtTarget.copy(scooterRef.current.position).add(tmp.tangent)
      scooterRef.current.lookAt(tmp.lookAtTarget)

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

  const introCompleted = useRef(false)

  const scrubCameraAlongPath = useCallback(
    (t: number) => {
      scrollCameraPath.getPointAt(t, tmp.cameraGoal)
      scrollTargetPath.getPointAt(t, tmp.targetGoal)
      invalidate()
    },
    [scrollCameraPath, scrollTargetPath, invalidate]
  )

  // in useFrame, smoothly move towards target
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
      orbitControlsRef.current?.target ?? new THREE.Vector3(),
      tmp.targetGoal,
      0.2,
      delta,
      undefined,
      undefined,
      1e-6
    )

    if (camUpdated || tarUpdated) {
      orbitControlsRef.current?.update()
      invalidate()
    }
  })

  // GSAP animation
  useGSAP(
    () => {
      const tl = gsap.timeline({
        onComplete: () => {
          console.log("Scooter entry animation complete")
          if (setIntroCompleted) setIntroCompleted(true)
          introCompleted.current = true
          tmp.cameraGoal.copy(camera.position)
          tmp.targetGoal.copy(
            orbitControlsRef.current?.target || new THREE.Vector3()
          )
          setTimeout(() => {
            gsap.timeline({
              scrollTrigger: {
                trigger: "#scroll-content",
                start: "top top",
                end: "bottom bottom",

                onUpdate: (self) => {
                  console.log("Scrub to", self.progress)
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
                  console.log("END progress:", self.progress)
                },
              },
            })
            console.log("scroll events added")
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

  return (
    <group {...props} ref={ref}>
      <directionalLight
        ref={lightRef}
        color={"#00ffff"}
        position={[2, 2, 2]}
        intensity={5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
        shadow-camera-far={50}
      />

      <primitive object={scene} ref={scooterRef}>
        {/* add light target as child of the scooter to follow it */}
        {lightRef.current && <primitive object={lightRef.current.target} />}
      </primitive>

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
    </group>
  )
})

Scooter.displayName = "Scooter"

// Preload the model
useGLTF.preload("/scooter_comp.glb")
