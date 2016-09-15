attribute vec2 aTextureCoord;
attribute vec2 aVertexPosition;

uniform bool uIsBuffer;
uniform vec2 uBGAspect;

varying vec2 vTextureCoord;

void main() {
    vec4 XY;

    if (uIsBuffer) {
        // Appy corrct aspect
        XY = vec4(aVertexPosition * uBGAspect, 0, 1);
    } else {
        XY = vec4(aVertexPosition, 0, 1);
    }

    gl_Position = XY;
    vTextureCoord = aTextureCoord;
}
