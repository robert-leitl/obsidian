/**
 * Transforms the given uv coodrinates to fit the object size
 * within the viewport size so that the object is not distorted
 * and the viewport is fully occupied by the object.
 */
vec2 objectFitCover(vec2 uv, vec2 viewportSize, vec2 objectSize) {
    vec2 st = uv * 2. - 1.;
    st = st * (viewportSize / max(viewportSize.x, viewportSize.y)) * (min(objectSize.x, objectSize.y) / objectSize );
    st = st * 0.5 + 0.5;
    return st;
}