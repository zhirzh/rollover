attribute vec2 aTextureCoord;
attribute vec2 aVertexPosition;

varying vec2 vTextureCoord;

void main() {
    gl_Position = vec4(aVertexPosition, 0, 1);
    vTextureCoord = aTextureCoord;
}
