'use strict';

var fps = 60;
var last = 0;
var initialTextureOffset;
var canvas;
var gl;

var shaderProgram;

var aTextureCoord;
var aVertexPosition;
var uBGAspect;
var uInitialTextureOffset;
var uIsBuffer;
var uMVMatrix;
var uPMatrix;
var uSampler;
var uTextureOffset;

var backgroundTexture;

var textureScreenVertexPositionBuffer;
var textureScreenTextureCoordBuffer;
var textureScreenIndexBuffer;

var mainScreenVertexPositionBuffer;
var mainScreenTextureCoordBuffer;
var mainScreenIndexBuffer;

var sampleFramebuffer;
var sampleTexture;

var mvMatrix = mat4.create();
var pMatrix = mat4.create();


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = '';
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType === 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type === 'x-shader/x-fragment') {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type === 'x-shader/x-vertex') {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}


function render(HRTimestamp) {
    requestAnimationFrame(render);

    if (HRTimestamp - last < 1000 / fps) {
        return;
    }
    last = HRTimestamp;

    resize();
    drawSceneTexture();
    drawScene();
}


function resize() {
    if (canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight) {
        return;
    }

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    var aspect = (backgroundTexture.image.height / backgroundTexture.image.width) / (canvas.height / canvas.width);
    gl.uniform1f(uBGAspect, aspect);

    initialTextureOffset = (1 - 1 / aspect) / 2;
    gl.uniform2f(uInitialTextureOffset, 0, initialTextureOffset);
}


function drawSceneTexture() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleFramebuffer);
    gl.viewport(0, 0, sampleFramebuffer.width, sampleFramebuffer.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    gl.bindBuffer(gl.ARRAY_BUFFER, textureScreenVertexPositionBuffer);
    gl.vertexAttribPointer(aVertexPosition, textureScreenVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, textureScreenTextureCoordBuffer);
    gl.vertexAttribPointer(aTextureCoord, textureScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.uniform1i(uSampler, 0);
    gl.uniform1i(uIsBuffer, true);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textureScreenIndexBuffer);
    gl.uniformMatrix4fv(uPMatrix, false, pMatrix);
    gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);
    gl.drawElements(gl.TRIANGLES, textureScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


function drawScene() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.ortho(pMatrix, -1, 1, -1, 1, .1, 100);
    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, mvMatrix, [0, 0, -1]);

    gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenVertexPositionBuffer);
    gl.vertexAttribPointer(aVertexPosition, mainScreenVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenTextureCoordBuffer);
    gl.vertexAttribPointer(aTextureCoord, mainScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    gl.uniform1i(uSampler, 1);
    gl.uniform1i(uIsBuffer, false);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mainScreenIndexBuffer);
    gl.uniformMatrix4fv(uPMatrix, false, pMatrix);
    gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);
    gl.drawElements(gl.TRIANGLES, mainScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}


function initWebGL(canvas) {
    gl = canvas.getContext('webgl');

    gl.clearColor(0, 0, 0, 1);
}


function initProgram() {
    var fragmentShader = getShader(gl, 'fragment-shader');
    var vertexShader = getShader(gl, 'vertex-shader');

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(shaderProgram));
    }

    gl.useProgram(shaderProgram);

    aVertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    aTextureCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    gl.enableVertexAttribArray(aVertexPosition);
    gl.enableVertexAttribArray(aTextureCoord);

    uBGAspect = gl.getUniformLocation(shaderProgram, 'uBGAspect');
    uIsBuffer = gl.getUniformLocation(shaderProgram, 'uIsBuffer');
    uInitialTextureOffset = gl.getUniformLocation(shaderProgram, 'uInitialTextureOffset');
    uMVMatrix = gl.getUniformLocation(shaderProgram, 'uMVMatrix');
    uPMatrix = gl.getUniformLocation(shaderProgram, 'uPMatrix');
    uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
    uTextureOffset = gl.getUniformLocation(shaderProgram, 'uTextureOffset');
}


function initbackgroundTexture() {
    backgroundTexture = gl.createTexture();
    backgroundTexture.image = new Image();
    backgroundTexture.image.src = 'moseshi.2.jpg';
    backgroundTexture.image.src = 'long.jpg';
    backgroundTexture.image.addEventListener('load', function () {
        /* use TEXTURE0 for backgroundTexture */
        gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundTexture.image);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);
    });
}


function initTextureFramebuffer() {
    sampleFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleFramebuffer);
    sampleFramebuffer.width = 1024;
    sampleFramebuffer.height = 1024;

    /* use TEXTURE1 for sampleTexture */
    sampleTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sampleFramebuffer.width, sampleFramebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    var sampleRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, sampleRenderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sampleFramebuffer.width, sampleFramebuffer.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sampleTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sampleRenderbuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


function initTextureScreen() {
    var x1, y1, x2, y2;
    textureScreenVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureScreenVertexPositionBuffer);
    x1 = -1;
    y1 = -1;
    x2 = x1 + 2;
    y2 = y1 + 2;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x2, y2,
        x1, y2,
    ]), gl.STATIC_DRAW);
    textureScreenVertexPositionBuffer.itemSize = 2;
    textureScreenVertexPositionBuffer.numItems = 4;

    textureScreenTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureScreenTextureCoordBuffer);
    x1 = 0;
    y1 = 0;
    x2 = x1 + 1;
    y2 = y1 + 1;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      x1, y1,
      x2, y1,
      x2, y2,
      x1, y2,
    ]), gl.STATIC_DRAW);
    textureScreenTextureCoordBuffer.itemSize = 2;
    textureScreenTextureCoordBuffer.numItems = 4;

    textureScreenIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textureScreenIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
        0, 1, 2,    0, 2, 3,
    ]), gl.STATIC_DRAW);
    textureScreenIndexBuffer.itemSize = 1;
    textureScreenIndexBuffer.numItems = 6;
}


function initMainScreen() {
    var x1, y1, x2, y2;
    mainScreenVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenVertexPositionBuffer);
    x1 = -1;
    y1 = -1;
    x2 = x1 + 2;
    y2 = y1 + 2;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x2, y2,
        x1, y2,
    ]), gl.STATIC_DRAW);
    mainScreenVertexPositionBuffer.itemSize = 2;
    mainScreenVertexPositionBuffer.numItems = 4;

    mainScreenTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenTextureCoordBuffer);
    x1 = 0;
    y1 = 0;
    x2 = x1 + 1;
    y2 = y1 + 1;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      x1, y1,
      x2, y1,
      x2, y2,
      x1, y2,
    ]), gl.STATIC_DRAW);
    mainScreenTextureCoordBuffer.itemSize = 2;
    mainScreenTextureCoordBuffer.numItems = 4;

    mainScreenIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mainScreenIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
        0, 1, 2,    0, 2, 3,
    ]), gl.STATIC_DRAW);
    mainScreenIndexBuffer.itemSize = 1;
    mainScreenIndexBuffer.numItems = 6;
}


function webGLStart() {
    canvas = document.getElementById('canvas');
    initWebGL(canvas);

    initProgram();

    initbackgroundTexture();
    initTextureFramebuffer();

    initMainScreen();
    initTextureScreen();

    var offset = 0;
    window.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') {
            offset -= .01;
        } else if (e.key === 'ArrowUp') {
            offset += .01;
        }
        gl.uniform2f(uTextureOffset, 0, offset);
    });
    backgroundTexture.image.addEventListener('load', function() {
        requestAnimationFrame(render);
    });
}
