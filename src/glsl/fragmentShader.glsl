uniform vec3 color;

// Simple random function
float random(vec2 seed) {
  return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Calculate distance from center of point (gl_PointCoord ranges from 0.0 to 1.0)
  vec2 center = vec2(0.5, 0.5);
  float distance = length(gl_PointCoord - center);
  
  // Discard fragments outside the circle (radius 0.5)
  if (distance > 0.5) {
    discard;
  }

  // Create variation based on point coordinate for consistent per-particle variation
  vec2 seed = gl_PointCoord * 1000.0;
  float variation = (random(seed) - 0.5) * 0.3; // ±0.15 variation
  
  // Add random variation to each RGB component
  vec3 variedColor = color + vec3(variation);
  
  // Clamp to valid RGB range [0, 1]
  variedColor = clamp(variedColor, 0.0, 1.0);
  
  gl_FragColor = vec4(variedColor, 1.0);
}
