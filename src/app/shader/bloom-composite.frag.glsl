uniform sampler2D uColorTexture;
uniform sampler2D uBlurTexture1;
uniform sampler2D uBlurTexture2;
uniform sampler2D uBlurTexture3;
uniform sampler2D uBlurTexture4;
uniform sampler2D uBlurTexture5;
uniform int uMipCount;

out vec4 outColor;

in vec2 vUv;

#include "../../libs/lygia/color/tonemap/reinhard.glsl"
#include "../../libs/lygia/color/tonemap/filmic.glsl"
#include "../../libs/lygia/color/tonemap/debug.glsl"
#include "../../libs/lygia/color/tonemap/linear.glsl"
#include "../../libs/lygia/color/tonemap/unreal.glsl"

float bloomFactor(const in int mip) {
    return 1. - (1. / float(uMipCount)) * float(mip);
}

float lerpBloomFactor(const in float factor) {
    float bloomRadius = 1.;
    float mirrorFactor = 1.2 - factor;
    return mix(factor, mirrorFactor, bloomRadius);
}

void main() {
    float bloomStrength = .01;

    /*vec4 color =    lerpBloomFactor(bloomFactor(0)) * texture(uBlurTexture1, vUv) +
				    lerpBloomFactor(bloomFactor(1)) * texture(uBlurTexture2, vUv) +
                    lerpBloomFactor(bloomFactor(2)) * texture(uBlurTexture3, vUv) +
                    lerpBloomFactor(bloomFactor(3)) * texture(uBlurTexture4, vUv) +
                    lerpBloomFactor(bloomFactor(4)) * texture(uBlurTexture5, vUv);*/

    vec4 color =    lerpBloomFactor(.9) * texture(uBlurTexture1, vUv) +
				    lerpBloomFactor(.7) * texture(uBlurTexture2, vUv) +
                    lerpBloomFactor(.5) * texture(uBlurTexture3, vUv) +
                    lerpBloomFactor(.2) * texture(uBlurTexture4, vUv) +
                    lerpBloomFactor(.1) * texture(uBlurTexture5, vUv);

    color *= bloomStrength;

    color += texture(uColorTexture, vUv);

    outColor = tonemapUnreal(color);

    //outColor = tonemapUnreal(texture(uBlurTexture1, vUv));
}