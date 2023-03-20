uniform sampler2D uColorTexture;
uniform sampler2D uBlurTexture1;
uniform sampler2D uBlurTexture2;
uniform sampler2D uBlurTexture3;
uniform sampler2D uBlurTexture4;
uniform sampler2D uBlurTexture5;
uniform sampler2D uLensDirtTexture;
uniform int uMipCount;
uniform vec2 uResolution;

out vec4 outColor;

in vec2 vUv;

#include "../../libs/lygia/color/tonemap/unreal.glsl"

float bloomFactor(const in int mip) {
    return 1. - (1. / float(uMipCount)) * float(mip);
}

float lerpBloomFactor(const in float factor) {
    float bloomRadius = 1.;
    float mirrorFactor = 1.2 - factor;
    return mix(factor, mirrorFactor, bloomRadius);
}

vec2 objectFitCover(vec2 uv, vec2 viewportSize, vec2 objectSize) {
    vec2 st = uv * 2. - 1.;
    st = st * (viewportSize / max(viewportSize.x, viewportSize.y)) * (min(objectSize.x, objectSize.y) / objectSize );
    st = st * 0.5 + 0.5;
    return st;
}

void main() {
    vec2 dirtTexSize = vec2(textureSize(uLensDirtTexture, 0));
    vec2 st = objectFitCover(vUv, uResolution, dirtTexSize);
    float bloomStrength = .03;

    vec4 color =    lerpBloomFactor(.9) * texture(uBlurTexture1, vUv) +
				    lerpBloomFactor(.7) * texture(uBlurTexture2, vUv) +
                    lerpBloomFactor(.5) * texture(uBlurTexture3, vUv) +
                    lerpBloomFactor(.2) * texture(uBlurTexture4, vUv) +
                    lerpBloomFactor(.1) * texture(uBlurTexture5, vUv);

    vec4 dirt = texture(uLensDirtTexture, st) * vec4(6., 6., 10., 1.) * .9 + 1.;

    color *= bloomStrength * dirt;

    vec4 base = texture(uColorTexture, vUv);
    color += base;

    outColor = tonemapUnreal(color);
}