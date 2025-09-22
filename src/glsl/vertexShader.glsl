// Vertex shader for reveal animation with sliding particles and time-based noise

uniform float uTime;
uniform float uTimeSpeed;
uniform float uSwayAmplitude;
uniform float uMouseSwayAmplitude;
uniform float uMouseThreshold;
uniform float uMouseNoiseScale;
uniform float uNoiseScale;
uniform float uPointSize;
uniform float uReveal;
uniform vec3 uMouseWorld;
uniform vec3 uBoundingMin;
uniform vec3 uBoundingMax;
uniform vec3 uBoundingSize;

// Simple random function using particle position as seed
float random(vec3 seed) {
  return fract(sin(dot(seed, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// 3D noise function for smooth animation
float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float n000 = random(i);
  float n001 = random(i + vec3(0.0, 0.0, 1.0));
  float n010 = random(i + vec3(0.0, 1.0, 0.0));
  float n011 = random(i + vec3(0.0, 1.0, 1.0));
  float n100 = random(i + vec3(1.0, 0.0, 0.0));
  float n101 = random(i + vec3(1.0, 0.0, 1.0));
  float n110 = random(i + vec3(1.0, 1.0, 0.0));
  float n111 = random(i + vec3(1.0, 1.0, 1.0));
  
  float nx00 = mix(n000, n100, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx11 = mix(n011, n111, f.x);
  
  float ny0 = mix(nx00, nx10, f.y);
  float ny1 = mix(nx01, nx11, f.y);
  
  return mix(ny0, ny1, f.z);
}

void main() {
  vec3 finalPos = position;
  
  // Calculate normalized Y position (0.0 = bottom, 1.0 = top) using pre-calculated bounds
  float normalizedY = (finalPos.y - uBoundingMin.y) / uBoundingSize.y;
  
  // Calculate reveal threshold based on Y position
  // Top particles appear first (higher Y values), bottom particles appear last
  float revealThreshold = 1.0 - normalizedY;
  
  // Generate consistent random starting position above the scooter
  float offsetHeight = 5.0; // Distance above scooter to start
  float spreadRange = 15.0;  // Random spread range
  
  vec3 startPos = finalPos;
  startPos.y = uBoundingMax.y + offsetHeight + random(finalPos) * 2.0; // Random height above
  startPos.x += (random(finalPos + vec3(1.0, 0.0, 0.0)) - 0.5) * spreadRange; // Random X offset
  startPos.z += (random(finalPos + vec3(0.0, 1.0, 0.0)) - 0.5) * spreadRange; // Random Z offset
  
  // Calculate animation progress for this particle
  // Use a different approach: map the full reveal range to animation phases
  float animationDuration = 0.3; // How much of the reveal range each particle uses
  
  // Map reveal threshold (0 to 1) to animation start (0 to 0.7)
  // This ensures all particles finish by reveal = 1.0
  float maxAnimationStart = 1.0 - animationDuration;
  float animationStart = revealThreshold * maxAnimationStart;
  float animationEnd = animationStart + animationDuration;
  
  // Calculate interpolation factor (0.0 = start position, 1.0 = final position)
  float progress = smoothstep(animationStart, animationEnd, uReveal);
  
  // Interpolate between start and final positions
  vec3 currentPos = mix(startPos, finalPos, progress);
  
  // Keep particles at start position if animation hasn't begun
  if (uReveal < animationStart) {
    currentPos = startPos;
  }
  
  // Add time-based noise animation
  float animatedTime = uTime * uTimeSpeed;
  
  // Calculate distance from mouse to current particle position (ignoring Z axis)
  // This creates a cylindrical interaction area instead of spherical
  vec2 mousePos2D = uMouseWorld.xy;
  vec2 particlePos2D = currentPos.xy;
  float mouseDistance = distance(particlePos2D, mousePos2D);
  
  // Calculate distance-based factors
  // Use smoothstep to create a smooth transition based on mouse proximity
  float mouseFactor = 1.0 - smoothstep(0.0, uMouseThreshold, mouseDistance);
  float currentSwayAmplitude = mix(uSwayAmplitude, uMouseSwayAmplitude, mouseFactor);
  float currentNoiseScale = mix(uNoiseScale, uMouseNoiseScale, mouseFactor);
  
  // Scale noise effect based on reveal progress
  // When reveal is close to 0, noise effect is minimal (particles stick to mesh)
  // When reveal approaches 1, noise effect reaches full strength
  float noiseRevealFactor = smoothstep(0.0, 1.0, uReveal);
  float finalSwayAmplitude = currentSwayAmplitude * noiseRevealFactor;
  
  // Create unique noise coordinates for each particle with distance-based scaling
  vec3 noiseCoord = finalPos * currentNoiseScale + vec3(animatedTime * 0.5);
  vec3 noiseCoord2 = finalPos * currentNoiseScale * 1.3 + vec3(animatedTime * 0.3);
  vec3 noiseCoord3 = finalPos * currentNoiseScale * 0.7 + vec3(animatedTime * 0.8);
  
  // Generate noise values for different motion types
  float noiseX = noise3D(noiseCoord) - 0.5;
  float noiseY = noise3D(noiseCoord2) - 0.5;
  float noiseZ = noise3D(noiseCoord3) - 0.5;
  
  // Apply swaying motion (horizontal) with reveal-scaled amplitude
  vec3 swayOffset = vec3(noiseX, 0.0, noiseZ) * finalSwayAmplitude;
  currentPos += swayOffset;
  
  // Add some vertical noise variation with the same reveal-scaled amplitude
  currentPos.y += noiseY * finalSwayAmplitude * 0.5;
  
  // Transform the vertex position to clip space
  gl_Position = projectionMatrix * modelViewMatrix * vec4(currentPos, 1.0);
  
  // Set the point size based on animation progress
  // When progress = 0 (at startPos), size = 0
  // When progress = 1 (at finalPos), size = uPointSize
  gl_PointSize = uPointSize * progress;
}
