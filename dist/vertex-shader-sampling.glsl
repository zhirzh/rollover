attribute vec2 aTextureCoord;
attribute vec2 aVertexPosition;

uniform vec2 uBGAspect;
uniform vec2 uInitialTextureOffset;
uniform vec2 uTextureOffset;

varying vec2 vTextureCoord;

void main() {
    vec4 XY;

    // Appy corrct aspect
    XY = vec4((aVertexPosition + uInitialTextureOffset + uTextureOffset) * uBGAspect, 0, 1);

    gl_Position = XY;
    vTextureCoord = aTextureCoord;
}
