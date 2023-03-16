uniform vec2        uResolution;
uniform float       uTime;
uniform sampler2D   uEnvTexture;

in vec2 vUv;
in vec3 vPosition;
in vec3 vModelPosition;
in vec3 vNormal;
in vec3 vSurfaceToView;
flat in int vInstanceId;

out vec4 outColor;

#include "../../libs/lygia/lighting/specular/blinnPhong.glsl"
#include "../../libs/lygia/space/xyz2equirect.glsl"

void main(void) {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vSurfaceToView);
    //vec3 L = normalize(vec3(0., 1., .1));
    vec3 L = V;
    vec3 R = reflect(V, N);

    float specular = specularBlinnPhong(L, N, V, 1500.);

    float mask = 1. - smoothstep(0.5, 0.6, length(vUv * 2. - 1. + vec2(0.3, 0.)));

    vec4 envReflection = texture(uEnvTexture, xyz2equirect(R));

    float dist = 1. - smoothstep(0.1, .7 + float(vInstanceId) * 0.0001, length(vPosition));
    dist *= dist;

    float modelRadiusAttenuation = smoothstep(0.7, 1., length(vModelPosition.yx) * 125.);
    float modelLengthAttenuation = smoothstep(0.1, 1., (0.05 + vModelPosition.z) * 10.);
    modelRadiusAttenuation = mix(1., modelRadiusAttenuation * modelLengthAttenuation, 1. - modelLengthAttenuation) * 0.5 + 0.5;
    dist *= modelRadiusAttenuation * .5;

    outColor = envReflection * 0.001 + vec4(dot(N, L) * 0.006) + vec4(specular * .1) + dist * vec4(0.9, .6, 1., 1.);
    outColor.a = 1.;
}