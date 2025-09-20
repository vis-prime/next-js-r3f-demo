import {
  useGLTF,
  MotionPathRef,
  Line,
  TransformControls,
  Grid,
} from "@react-three/drei"

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
import { button, useControls } from "leva"

type ScooterProps = React.ComponentProps<"group">

export const Scooter = forwardRef<THREE.Group, ScooterProps>((props, ref) => {
  const { scene } = useGLTF("/scooter_comp.glb")
  const scrubProgress = useRef(0)
  const lookBackDistance = useRef(0.03)
  const scooterRef = useRef<MotionPathRef>(null)
  const lightRef = useRef<THREE.DirectionalLight>(null)

  const { invalidate } = useThree()

  // Leva controls for curve points
  const {
    // Animation controls
    showPath,
  } = useControls("Scooter", {
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
    showPath: true,
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

  const scooterHandle = useRef<THREE.Mesh | undefined>(undefined)
  const wheelsFront = useRef<THREE.Mesh | undefined>(undefined)
  const wheelsRear = useRef<THREE.Mesh | undefined>(undefined)
  const scooterBody = useRef<THREE.Mesh | undefined>(undefined)

  // Reusable vectors - create once, reuse everywhere
  const tangent = new THREE.Vector3()
  const lookAtTarget = new THREE.Vector3()
  const laggedPosition = new THREE.Vector3()
  const bodyWorldPosition = new THREE.Vector3()
  const directionVector = new THREE.Vector3()
  const bodyLookTarget = new THREE.Vector3()

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true

        if (child.name === "steer") {
          scooterHandle.current = child as THREE.Mesh
        }
        if (child.name === "wheels_front") {
          wheelsFront.current = child as THREE.Mesh
        }
        if (child.name === "wheels_rear") {
          wheelsRear.current = child as THREE.Mesh
        }
        if (child.name === "body") {
          scooterBody.current = child as THREE.Mesh
        }
      }
    })

    invalidate() // for lightRef related items to update
  }, [scene, invalidate])

  // Common animation function used by both Leva and GSAP
  const updateScooterPosition = useCallback((t: number) => {
    if (!scooterRef.current) return

    // Update position along curve (handle follows curve exactly)
    entryPath.getPointAt(t, scooterRef.current.position)
    entryPath.getTangentAt(t, tangent)
    lookAtTarget.copy(scooterRef.current.position).add(tangent)
    scooterRef.current.lookAt(lookAtTarget)

    // Make the body lag behind when turning (simulate rear wheels following)
    if (scooterBody.current && lookBackDistance.current > 0) {
      const lagT = Math.max(0, t - lookBackDistance.current) // Ensure no negative values

      entryPath.getPointAt(lagT, laggedPosition)
      scooterBody.current.getWorldPosition(bodyWorldPosition)
      directionVector.copy(bodyWorldPosition).sub(laggedPosition)
      if (directionVector.length() > 0.001) {
        directionVector.normalize()
        // Apply rotation to body based on this direction
        bodyLookTarget.copy(bodyWorldPosition).add(directionVector)
        scooterBody.current.lookAt(bodyLookTarget)
      }
    }

    // Wheel rotation
    if (wheelsFront.current && wheelsRear.current) {
      const rad = 0.111663 / 2
      const pathLength = entryPath.getLength()
      const traveled = t * pathLength
      const rotationAngle = traveled / rad
      wheelsFront.current.rotation.x = rotationAngle
      wheelsRear.current.rotation.x = rotationAngle
    }
  }, [])

  // GSAP animation
  useGSAP(
    () => {
      if (
        !scooterRef.current ||
        !wheelsFront.current ||
        !wheelsRear.current ||
        !scooterHandle.current
      )
        return

      scrubProgress.current = 0

      const tl = gsap.timeline({
        onComplete: () => {
          console.log("Scooter entry animation complete")
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

  const [controlPositions] = useState(() =>
    entryPath.points.map((vec) => vec.clone())
  )

  const [tconTarget, setTconTarget] = useState<{
    index: number
    object: THREE.Object3D
  } | null>(null)

  const lineRef = useRef<React.ComponentRef<typeof Line>>(null)

  return (
    <group {...props} ref={ref}>
      <directionalLight
        ref={lightRef}
        color={"red"}
        position={[2, 2, 2]}
        intensity={5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-far={50}
      />

      <primitive object={scene} ref={scooterRef}>
        {/* add light target as child of the scooter to follow it */}
        {lightRef.current && <primitive object={lightRef.current.target} />}
      </primitive>

      {showPath && (
        <>
          <Grid args={[2, 2]} />

          {lightRef.current && (
            <cameraHelper args={[lightRef.current?.shadow.camera]} />
          )}
          <Line
            ref={lineRef}
            points={entryPath.getPoints(50)}
            color="green"
            lineWidth={2}
          />

          {tconTarget && (
            <TransformControls
              object={tconTarget.object}
              mode="translate"
              onMouseUp={(e) => {
                console.log("Control point moved", tconTarget.object.position)
                entryPath.points[tconTarget.index].copy(
                  tconTarget.object.position
                )

                // update line
                lineRef.current?.geometry.setPositions(
                  entryPath.getPoints(50).flatMap((v) => v.toArray())
                )
              }}
            />
          )}

          {controlPositions.map((vec, i) => (
            <mesh
              key={i}
              position={vec.clone()}
              onClick={(e) => {
                e.stopPropagation()
                setTconTarget({ index: i, object: e.object })
                console.log("Set control target", e.object)
              }}
            >
              <boxGeometry args={[0.1, 0.1, 0.1]} />
              <meshStandardMaterial color="hotpink" />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
})

Scooter.displayName = "Scooter"

// Preload the model
useGLTF.preload("/scooter_comp.glb")
