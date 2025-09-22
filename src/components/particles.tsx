import { useMemo, useRef, useEffect } from "react"
import * as THREE from "three"

import vertexShader from "@/glsl/vertexShader.glsl"
import fragmentShader from "@/glsl/fragmentShader.glsl"

import { invalidate, useFrame } from "@react-three/fiber"
import { damp3 } from "maath/easing"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

type ParticlesProps = {
  scooterRef?: React.RefObject<THREE.Group | null>
  showParticles?: boolean
}

const mouseWorldPos = new THREE.Vector3(-10, -10, -10) // start offscreen
const mouseWorldSmooth = new THREE.Vector3(-10, -10, -10)

const MESH_NAMES = ["steer", "wheels_front", "wheels_rear", "body"]

// Static mesh particle counts
const MESH_COUNTS = {
  steer: 1500,
  wheels_front: 500,
  wheels_rear: 200,
  body: 800,
}

export const Particles = (props: ParticlesProps) => {
  const { scooterRef, showParticles } = props
  console.log("Particles rendered")

  // This reference gives us direct access to our points
  const points = useRef<THREE.Points>(null)

  // Uniforms as single source of truth
  const uniforms = useRef({
    uTime: { value: 0.0 },
    uTimeSpeed: { value: 1.0 },
    uSwayAmplitude: { value: 0.05 },

    uMouseSwayAmplitude: { value: 2.0 },
    uMouseThreshold: { value: 0.2 },
    uMouseNoiseScale: { value: 10.0 },

    uNoiseScale: { value: 2.0 },
    uPointSize: { value: 10.0 },
    color: { value: new THREE.Color("#0fff00") },
    uMouseWorld: { value: new THREE.Vector3(0, 0, 0) },
    uReveal: { value: 0.0 },

    uBoundingMin: { value: new THREE.Vector3(0, 0, 0) },
    uBoundingMax: { value: new THREE.Vector3(1, 1, 1) },
    uBoundingSize: { value: new THREE.Vector3(1, 1, 1) },
  })

  // Generate our positions attributes array by sampling random points on triangle faces
  const particlesPosition = useMemo(() => {
    const scene = scooterRef?.current
    if (!scene) {
      console.warn("Scooter scene not found")
      return new Float32Array(3 * 10)
    } else {
      console.warn("Scooter scene found", scene)
    }
    // Direct mesh lookup - find each specific mesh by name
    const meshes: { [key: string]: THREE.Mesh | null } = {
      steer: null,
      wheels_front: null,
      wheels_rear: null,
      body: null,
    }

    // Update the scene's world matrix to ensure it reflects all transforms
    scene.updateMatrixWorld(true)

    // Find each mesh directly
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const meshName = mesh.name.toLowerCase()

        // Direct name matching for each category
        if (meshName.includes("steer")) {
          meshes.steer = mesh
        } else if (meshName.includes("wheel") && meshName.includes("front")) {
          meshes.wheels_front = mesh
        } else if (meshName.includes("wheel") && meshName.includes("rear")) {
          meshes.wheels_rear = mesh
        } else if (meshName.includes("body")) {
          meshes.body = mesh
        }
      }
    })

    // Log what we found
    MESH_NAMES.forEach((category) => {
      const mesh = meshes[category]
      console.log(`${category}: ${mesh ? `"${mesh.name}"` : "NOT FOUND"}`)
    })

    // Collect triangles from each mesh
    const meshTriangles: {
      [key: string]: Array<{
        vertices: THREE.Vector3[]
        area: number
      }>
    } = {}

    MESH_NAMES.forEach((meshName) => {
      meshTriangles[meshName] = []
      const mesh = meshes[meshName]

      if (!mesh) {
        console.warn(`Mesh not found: ${meshName}`)
        return
      }

      const geometry = mesh.geometry as THREE.BufferGeometry
      const posAttr = geometry.getAttribute("position")
      const indexAttr = geometry.getIndex()!

      // Since meshes are children of scene, mesh.matrixWorld already includes scene transforms
      // Use mesh.matrix (local) combined with scene.matrixWorld to avoid double transformation
      const combinedMatrix = new THREE.Matrix4()
      combinedMatrix.multiplyMatrices(scene.matrixWorld, mesh.matrix)

      // Process indexed geometry (guaranteed to be indexed)
      for (let i = 0; i < indexAttr.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(
          posAttr,
          indexAttr.getX(i)
        )
        const b = new THREE.Vector3().fromBufferAttribute(
          posAttr,
          indexAttr.getX(i + 1)
        )
        const c = new THREE.Vector3().fromBufferAttribute(
          posAttr,
          indexAttr.getX(i + 2)
        )

        // Transform to world space with correct hierarchy
        a.applyMatrix4(combinedMatrix)
        b.applyMatrix4(combinedMatrix)
        c.applyMatrix4(combinedMatrix)

        // Calculate triangle area using cross product
        const ab = new THREE.Vector3().subVectors(b, a)
        const ac = new THREE.Vector3().subVectors(c, a)
        const area = ab.cross(ac).length() * 0.5

        meshTriangles[meshName].push({ vertices: [a, b, c], area })
      }

      console.log(`${meshName}: ${meshTriangles[meshName].length} triangles`)
    })

    // Calculate total particle count
    const totalCount = Object.values(MESH_COUNTS).reduce(
      (sum: number, count: number) => sum + count,
      0
    )
    const result = new Float32Array(totalCount * 3)
    let particleIndex = 0

    // Generate particles for each mesh type
    MESH_NAMES.forEach((meshName) => {
      const meshCount = MESH_COUNTS[meshName as keyof typeof MESH_COUNTS]
      const triangles = meshTriangles[meshName]

      if (triangles.length === 0) {
        // Skip if no triangles found for this mesh
        return
      }

      // Calculate total area for this mesh type
      const totalArea = triangles.reduce(
        (sum, triangle) => sum + triangle.area,
        0
      )

      // Generate particles for this specific mesh
      for (let i = 0; i < meshCount; i++) {
        // Area-weighted triangle selection
        let random = THREE.MathUtils.randFloat(0, totalArea)
        let selectedTriangle = triangles[0]

        for (const triangle of triangles) {
          random -= triangle.area
          if (random <= 0) {
            selectedTriangle = triangle
            break
          }
        }

        // Generate random barycentric coordinates
        const r1 = Math.random()
        const r2 = Math.random()
        const u = Math.sqrt(r1)
        const v = r2 * (1 - u)
        const w = 1 - u - v

        // Calculate random point on triangle using barycentric coordinates
        const [a, b, c] = selectedTriangle.vertices
        const randomPoint = new THREE.Vector3()
          .addScaledVector(a, u)
          .addScaledVector(b, v)
          .addScaledVector(c, w)

        // Apply noise to the position
        const noiseOffset = new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(2),
          THREE.MathUtils.randFloatSpread(2),
          THREE.MathUtils.randFloatSpread(2)
        ).multiplyScalar(0.01) // noiseMultiplier = 0.01

        randomPoint.add(noiseOffset)
        result.set(
          [randomPoint.x, randomPoint.y, randomPoint.z],
          particleIndex * 3
        )
        particleIndex++
      }
    })

    return result
  }, [scooterRef])

  // Calculate bounding box for reveal animation using THREE.Box3
  const boundingBox = useMemo(() => {
    if (particlesPosition.length === 0) {
      return {
        min: new THREE.Vector3(0, 0, 0),
        max: new THREE.Vector3(1, 1, 1),
        size: new THREE.Vector3(1, 1, 1),
        center: new THREE.Vector3(0.5, 0.5, 0.5),
      }
    }

    const box = new THREE.Box3()

    // Add all particle positions to the bounding box
    for (let i = 0; i < particlesPosition.length; i += 3) {
      const point = new THREE.Vector3(
        particlesPosition[i],
        particlesPosition[i + 1],
        particlesPosition[i + 2]
      )
      box.expandByPoint(point)
    }

    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    return {
      min: box.min.clone(),
      max: box.max.clone(),
      size,
      center,
    }
  }, [particlesPosition])

  // Update bounding box uniforms when boundingBox changes
  useEffect(() => {
    uniforms.current.uBoundingMin.value.copy(boundingBox.min)
    uniforms.current.uBoundingMax.value.copy(boundingBox.max)
    uniforms.current.uBoundingSize.value.copy(boundingBox.size)
  }, [boundingBox])

  const mouseDebugRef = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    if (!points.current || uniforms.current.uReveal.value === 0) return

    damp3(mouseWorldSmooth, mouseWorldPos, 0.1, delta)

    const material = points.current.material as THREE.ShaderMaterial
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMouseWorld.value.copy(mouseWorldSmooth)

    if (mouseDebugRef.current) {
      mouseDebugRef.current.position.copy(mouseWorldSmooth)
    }

    invalidate() // Request a on-demand frame render
  })

  useGSAP(() => {
    if (!uniforms.current) return

    const target = showParticles ? 1 : 0
    if (uniforms.current.uReveal.value === target) return

    gsap.fromTo(
      uniforms.current.uReveal,
      { value: uniforms.current.uReveal.value },
      {
        value: target,
        duration: 4,
        ease: showParticles ? "power2.out" : "power2.inOut",
        onUpdate: invalidate,
      }
    )
  }, [showParticles])

  return (
    <>
      <points ref={points} renderOrder={10}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesPosition.length / 3}
            array={particlesPosition}
            itemSize={3}
            args={[particlesPosition, 3]}
          />
        </bufferGeometry>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={fragmentShader}
          vertexShader={vertexShader}
          uniforms={uniforms.current}
        />
      </points>
      {/* plane to and get world space mouse coordinates for particles mouse interaction */}
      <mesh
        visible={false}
        position={[0, 1, 0]}
        onPointerMove={(e) => {
          e.stopPropagation()
          mouseWorldPos.copy(e.point)
        }}
      >
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial color="orange" transparent opacity={0.1} />
      </mesh>

      {/* mouse debug sphere */}
      {/* <mesh ref={mouseDebugRef}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshBasicMaterial color="red" transparent opacity={0.5} />
      </mesh> */}
    </>
  )
}
