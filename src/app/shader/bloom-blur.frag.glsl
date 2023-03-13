uniform sampler2D uColorTexture;
uniform int uKernelSize;
uniform vec2 uDirection;
uniform vec2 uTexSize;

out vec4 outColor;

in vec2 vUv;

float gaussianPdf(in float x, in float sigma) {
    //float pdf = 0.39894 * exp( -0.5 * x * x)/sigma;
    //float pdf = 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
    float k = .15915494; // 1 / (2 * PI)
    float pdf = (k / sigma) * exp(-(x * x) / (2. * sigma));
    return pow(pdf, 1.);
}

void main() {
    vec2 texelSize = 1. / uTexSize;
    float fSigma = float(uKernelSize);
    float weightSum = gaussianPdf(0.0, fSigma);
    vec3 diffuseSum = texture( uColorTexture, vUv).rgb * weightSum;
    for( int i = 1; i < uKernelSize; i ++ ) {
        float x = float(i);
        float w = gaussianPdf(x, fSigma);
        vec2 uvOffset = uDirection * texelSize * x;
        vec3 sample1 = texture( uColorTexture, vUv + uvOffset).rgb;
        vec3 sample2 = texture( uColorTexture, vUv - uvOffset).rgb;
        diffuseSum += (sample1 + sample2) * w;
        weightSum += 2. * w;
    }
    outColor = vec4(diffuseSum/weightSum, 1.0);
}