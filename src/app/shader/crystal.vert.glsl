
out vec2 vUv;
out vec3 vNormal;
out vec3 vSurfaceToView;
out vec3 vPosition;
out vec3 vModelPosition;
flat out int vInstanceId;

void main() {
    vUv = uv;
    vInstanceId = gl_InstanceID;
    vModelPosition = position;
    vNormal = (modelMatrix * instanceMatrix * vec4(normal, 0.)).xyz;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4( position, 1.0 );
    vPosition = worldPosition.xyz;
    vSurfaceToView = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}