attribute vec2 aTextureCoord;
attribute vec2 aVertexPosition;

uniform vec2 uBGAspect;
uniform vec2 uInitialTextureOffset;
uniform vec2 uTextureOffset;

varying vec2 vTextureCoord;

void main() {
    // flip offset along x-axis to simplify offset calculation in JS
    vec2 offset = (uInitialTextureOffset + uTextureOffset) * vec2(-1, 1);
    gl_Position = vec4((aVertexPosition + offset) * uBGAspect, 0, 1);
    vTextureCoord = aTextureCoord;
}
