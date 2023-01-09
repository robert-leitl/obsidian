uniform vec2    uResolution;
uniform float   uTime;

in vec2 vUv;

out vec4 outColor;

#include "../../libs/lygia/space/ratio.glsl"
#include "../../libs/lygia/math/decimation.glsl"
#include "../../libs/lygia/draw/circle.glsl"

void main(void) {
    vec3 color = vec3(0.0);
    vec2 st = gl_FragCoord.xy/uResolution.xy;
    st = vUv;
    
    color = vec3(st.x,st.y,abs(sin(uTime * 0.001)));
    color = decimation(color, 30.);
    color += circle(st, .5, .1);
    
    outColor = vec4(color, 1.0);
}