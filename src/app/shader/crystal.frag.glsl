uniform vec2          uResolution;
uniform float         uTime;
uniform sampler2D     uEnvTexture;
uniform sampler2D     uDirtTexture;

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
    float dirt = texture(uDirtTexture, fract(vUv * vec2(20., 1.))).r * 0.7 + 0.3;

    vec3 N = normalize(vNormal + vec3(dirt * 0.1, dirt * .2, 0.) * 5.);
    vec3 V = normalize(vSurfaceToView);
    vec3 L = V;
    vec3 R = reflect(V, N);

    float specular = specularBlinnPhong(L, N, V, 1500.);

    float mask = 1. - smoothstep(0.5, 0.6, length(vUv * 2. - 1. + vec2(0.3, 0.)));

    vec4 envReflection = textureCubeUV(uEnvTexture, R, 0.3);

    float dist = 1. - smoothstep(0.1, .7 + float(vInstanceId) * 0.0001, length(vPosition));
    dist *= dist;

    float modelRadiusAttenuation = smoothstep(0., 1., length(vModelPosition.yz) * 1.);
    float modelLengthAttenuation = smoothstep(0.1, 1., (0.05 + vModelPosition.x) * 1.);
    modelRadiusAttenuation = mix(1., modelRadiusAttenuation * modelLengthAttenuation, 1. - modelLengthAttenuation) * 0.5 + 0.5;
    dist *= modelRadiusAttenuation * 1.;

    outColor = envReflection * 0.0008 + vec4(dot(N, L) * 0.006) + vec4(specular * .2) + dist * vec4(.9, .5, 1.1, 1.);
    outColor.a = 1.;

}