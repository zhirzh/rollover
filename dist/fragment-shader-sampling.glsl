precision mediump float;

uniform sampler2D uSampler;

varying vec2 vTextureCoord;

void main() {
    vec2 XY;

    // Add initial and current offset
    XY = vTextureCoord;

    gl_FragColor = texture2D(uSampler, XY);
}
