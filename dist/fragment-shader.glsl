precision mediump float;

uniform bool uIsBuffer;
uniform sampler2D uSampler;
uniform vec2 uInitialTextureOffset;
uniform vec2 uTextureOffset;


uniform int uMode;

uniform vec2 uFactor;
uniform vec2 uMultiplier;
uniform vec2 uOriginOffset;
uniform vec2 uRecover;

varying vec2 vTextureCoord;

vec2 arctanDistortion(vec2 XY, vec2 factor, vec2 multiplier);
vec2 linearDistortion(vec2 XY, vec2 multiplier);
vec2 parabolicDistortion(vec2 XY, vec2 multiplier);
vec2 polynomialDistortion(vec2 XY, vec2 factor, vec2 multiplier);

void main() {
    vec2 XY;

    if (uIsBuffer) {
        // Add initial and current offset
        XY = vTextureCoord + uInitialTextureOffset + uTextureOffset;
    } else {
        XY = vTextureCoord;
        float R;
        bvec2 isValid;

        /*Normalize components from range {0, 1} to {-1, 1}*/
        XY = (2. * XY) - 1.;

        /*Shift offset*/
        XY += uOriginOffset;

        /*Calculate distortion*/
        if (uMode == 1) {
            XY = arctanDistortion(XY, uFactor, uMultiplier);
        } else if (uMode == 2) {
            XY = linearDistortion(XY, uMultiplier);
        } else if (uMode == 3) {
            XY = parabolicDistortion(XY, uMultiplier);
        } else if (uMode == 4) {
            XY = polynomialDistortion(XY, uFactor, uMultiplier);
        }

        /*Reset origin*/
        XY -= uOriginOffset;

        /*Recover edges*/
        XY *= uRecover;

        /*Filter valid regions*/
        isValid = lessThanEqual(abs(XY), vec2(1, 1));
        if (isValid.x && isValid.y) {
            /*De-normalize*/
            XY = (XY + 1.) / 2.;
        } else {
            discard;
        }
    }

    gl_FragColor = texture2D(uSampler, XY);
}

vec2 arctanDistortion(vec2 XY, vec2 factor, vec2 multiplier) {
    vec2 t = length(XY) * factor;
    vec2 R;

    if (factor.x == 0.) {
        R = vec2(1, atan(t.y) / t.y);
    } else if (factor.y == 0.) {
        R = vec2(atan(t.x) / t.x, 1);
    } else {
        R = atan(t) / t;
    }

    return XY * (1. - multiplier * (1. - R));
}

vec2 linearDistortion(vec2 XY, vec2 multiplier) {
    float R = length(XY);
    return XY * (1. - multiplier * R);
}

vec2 parabolicDistortion(vec2 XY, vec2 multiplier) {
    float R = dot(XY, XY);
    return XY * (1. - multiplier * R);
}

vec2 polynomialDistortion(vec2 XY, vec2 factor, vec2 multiplier) {
    vec2 R = pow(vec2(length(XY), length(XY)), factor);
    return XY * (1. - multiplier * R);
}
