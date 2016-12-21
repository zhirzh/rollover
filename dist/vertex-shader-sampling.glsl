attribute vec2 aTextureCoord;
attribute vec2 aVertexPosition;

uniform vec2 uBGAspect;
uniform vec2 uInitialTextureOffset;
uniform vec2 uTextureOffset;

varying vec2 vTextureCoord;

void main() {
    gl_Position = vec4((aVertexPosition + uInitialTextureOffset + uTextureOffset) * uBGAspect, 0, 1);
    vTextureCoord = aTextureCoord;
}
