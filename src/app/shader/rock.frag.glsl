uniform vec2    uResolution;
uniform float   uTime;

in vec2 vUv;
in vec3 vNormal;
in vec3 vSurfaceToView;

out vec4 outColor;

#include "../../libs/lygia/lighting/specular/blinnPhong.glsl"

void main(void) {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vSurfaceToView);
    vec3 L = normalize(vSurfaceToView);

    float specular = specularBlinnPhong(L, N, V, 3000.);

    float mask = 1. - smoothstep(0.5, 0.6, length(vUv * 2. - 1. + vec2(0.3, 0.)));

    outColor = vec4(dot(N, L) * 0.05) + vec4(specular * 200.);
    outColor.a = 1.;
}