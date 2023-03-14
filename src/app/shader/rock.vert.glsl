
out vec2 vUv;
out vec3 vNormal;
out vec3 vSurfaceToView;

void main() {
    vUv = uv;
    vNormal = (modelMatrix * vec4(normal, 0.)).xyz;
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vSurfaceToView = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}