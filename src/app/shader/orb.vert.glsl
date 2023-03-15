
out vec2 vUv;
out vec3 vNormal;
out vec3 vSurfaceToView;
out vec3 vPosition;

void main() {
    vUv = uv;
    vNormal = (modelMatrix * vec4(normal, 0.)).xyz;
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vPosition = worldPosition.xyz;
    vSurfaceToView = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}