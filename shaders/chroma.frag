precision mediump float;

varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform float threshold;
uniform float smoothness;

void main() {
  vec4 color = texture2D(tex0, vTexCoord);
  
  // Calculate distance from black (0,0,0)
  float dist = length(color.rgb);
  
  // Smoothstep for soft edges
  float alpha = smoothstep(threshold, threshold + smoothness, dist);
  
  gl_FragColor = vec4(color.rgb, color.a * alpha);
}
