import { useGLTF, MotionPathRef, Line } from "@react-three/drei"
import {
  Group,
  Mesh,
  CatmullRomCurve3,
  Vector3,
  AxesHelper,
  MathUtils,
  DirectionalLight,
} from "three"
import { forwardRef, useRef, useEffect, useCallback, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { useControls } from "leva"

type ScooterProps = React.ComponentProps<"group">

export const Scooter = forwardRef<Group, ScooterProps>((props, ref) => {
  const { scene } = useGLTF("/scooter_comp.glb")
  const scrubProgress = useRef(0)
  const scooterRef = useRef<MotionPathRef>(null)
  const lightRef = useRef<DirectionalLight>(null)

  // Leva controls for curve points
  const {
    // Animation controls
    showPath,
    lookAheadDistance,
    animationSpeed,
  } = useControls("Scooter", {
    // // Curve Points
    // point1X: { value: 1.5, min: -10, max: 10, step: 0.1 },
    // point1Z: { value: -6, min: -10, max: 10, step: 0.1 },
    // point2X: { value: -4, min: -10, max: 10, step: 0.1 },
    // point2Z: { value: -3.5, min: -10, max: 10, step: 0.1 },
    // point3X: { value: -3.5, min: -10, max: 10, step: 0.1 },
    // point3Z: { value: -1.1, min: -10, max: 10, step: 0.1 },
    // point4X: { value: 0.3, min: -10, max: 10, step: 0.1 },
    // point4Z: { value: -3.2, min: -10, max: 10, step: 0.1 },
    // point5X: { value: 1.5, min: -10, max: 10, step: 0.1 },
    // point5Z: { value: -1.8, min: -10, max: 10, step: 0.1 },
    // point6X: { value: 0, min: -10, max: 10, step: 0.1 },
    // point6Z: { value: 0, min: -10, max: 10, step: 0.1 },

    // Animation controls
    showPath: true,
    lookAheadDistance: { value: 0.03, min: 0.001, max: 0.03, step: 0.001 },
    animationSpeed: { value: 15, min: 1, max: 30, step: 1 },
  })

  // Create curve from Leva controls
  const entryPath = useMemo(() => {
    return new CatmullRomCurve3(
      [
        new Vector3(1.5, 0, -6),
        new Vector3(-4, 0, -3.5),
        new Vector3(-3.5, 0, -1.1),
        new Vector3(0.3, 0, -3.2),
        new Vector3(1.5, 0, -1.8),
        new Vector3(0, 0, 0),
      ],
      false,
      "catmullrom",
      0.6
    )
  }, [])

  const scooterHandle = useRef<Mesh | undefined>(undefined)
  const wheelsFront = useRef<Mesh | undefined>(undefined)
  const wheelsRear = useRef<Mesh | undefined>(undefined)

  // Reusable vectors
  const tangent = new Vector3()
  const lookAtTarget = new Vector3()
  const nextTangent = new Vector3()

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        console.log(child.name, child.type)
        child.castShadow = true
        child.receiveShadow = true

        if (child.name === "steer") {
          scooterHandle.current = child as Mesh
        }
        if (child.name === "wheels_front") {
          wheelsFront.current = child as Mesh
          child.add(new AxesHelper(0.5))
        }
        if (child.name === "wheels_rear") {
          wheelsRear.current = child as Mesh
          child.add(new AxesHelper(0.5))
        }
      }
    })
  }, [scene])

  // Common animation function used by both Leva and GSAP
  const updateScooterPosition = useCallback(
    (t: number) => {
      if (!scooterRef.current) return

      // Update position along curve
      entryPath.getPointAt(t, scooterRef.current.position)
      entryPath.getTangentAt(t, tangent)
      lookAtTarget.copy(scooterRef.current.position).add(tangent)
      scooterRef.current.lookAt(lookAtTarget)

      // Handle steering
      if (scooterHandle.current) {
        const nextT = Math.min(t + lookAheadDistance, 1)

        entryPath.getTangentAt(t, tangent)
        entryPath.getTangentAt(nextT, nextTangent)

        const currentAngle = Math.atan2(tangent.z, tangent.x)
        const nextAngle = Math.atan2(nextTangent.z, nextTangent.x)
        let angleDiff = nextAngle - currentAngle

        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

        const steerAngle = angleDiff
        scooterHandle.current.rotation.y = -steerAngle
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
    },
    [entryPath, lookAheadDistance, lookAtTarget, nextTangent, tangent]
  )

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
        duration: animationSpeed,
        ease: "power2.out",
        onUpdate: () => {
          updateScooterPosition(scrubProgress.current)
        },
      })

      // Additional steering animations after path completion
      tl.to(scooterHandle.current.rotation, {
        y: MathUtils.degToRad(-25),
        duration: 1,
        ease: "back.out",
      })
      tl.to(scooterHandle.current.rotation, {
        y: MathUtils.degToRad(25),
        duration: 2,
        ease: "power1.inOut",
      })

      tl.to(scooterHandle.current.rotation, {
        y: 0,
        delay: 1,
        duration: 3,
        ease: "power1.inOut",
      })
    },
    {
      dependencies: [animationSpeed, updateScooterPosition],
      scope: scooterRef,
    }
  )

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
      />

      {lightRef.current && (
        <>
          {/* <directionalLightHelper args={[lightRef.current, 2, 0xff0000]} /> */}
          <cameraHelper args={[lightRef.current.shadow.camera]} />
        </>
      )}

      <primitive object={scene} ref={scooterRef}>
        {/* add light target as child of the scooter to follow it */}
        {lightRef.current && <primitive object={lightRef.current.target} />}
      </primitive>

      {showPath && (
        <>
          <Line points={entryPath.getPoints(50)} color="green" lineWidth={2} />
        </>
      )}
    </group>
  )
})

Scooter.displayName = "Scooter"

// Preload the model
useGLTF.preload("/scooter_comp.glb")
