precision mediump float;

varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec3 keyColor;
uniform float threshold;
uniform float smoothness;

void main() {
  vec4 color = texture2D(tex0, vTexCoord);
  
  // Calculate distance from key color
  float dist = length(color.rgb - keyColor);
  
  // Smoothstep for soft edges
  float alpha = smoothstep(threshold, threshold + smoothness, dist);
  
  // Spill suppression
  // If the blue channel is dominant (typical for blue screen spill), 
  // clamp it to the max of the other two channels.
  // This turns the blue tint into a neutral gray/white highlight.
  float maxRG = max(color.r, color.g);
  if (color.b > maxRG) {
      color.b = maxRG;
  }
  
  gl_FragColor = vec4(color.rgb, color.a * alpha);
}
