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
var backgroundImage;

var textureScreenVertexPositionBuffer;
var textureScreenTextureCoordBuffer;
var textureScreenIndexBuffer;

var mainScreenVertexPositionBuffer;
var mainScreenTextureCoordBuffer;
var mainScreenIndexBuffer;

var sampleTextureFramebuffer;
var sampleTexture;

var mvMatrix = mat4.create();
var pMatrix = mat4.create();


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return;
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
        return;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return;
    }

    return shader;
}


function webGLStart() {
    canvas = document.getElementById('canvas');
    initWebGL(canvas);

    initProgram();

    initBackgroundTexture();
    initSampleTexture();

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
    backgroundImage.addEventListener('load', function() {
        requestAnimationFrame(render);
    });
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
        return;
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


function initBackgroundTexture() {
    backgroundImage = new Image();
    backgroundImage.src = 'moseshi.2.jpg';
    backgroundImage.src = 'long.jpg';
    backgroundImage.addEventListener('load', function () {
        /* use TEXTURE0 for backgroundTexture */
        backgroundTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundImage);

        gl.bindTexture(gl.TEXTURE_2D, null);
    });
}


function initSampleTexture() {
    initSampleTextureFramebuffer();

    /* use TEXTURE1 for sampleTexture */
    sampleTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    initSampleTextureRenderbuffer();

    gl.bindTexture(gl.TEXTURE_2D, null);
}


function initSampleTextureFramebuffer() {
    sampleTextureFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
    sampleTextureFramebuffer.width = sampleTextureFramebuffer.height = 1024;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


function initSampleTextureRenderbuffer() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);

    var sampleTextureRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, sampleTextureRenderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sampleTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sampleTextureRenderbuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
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

    var aspect = (canvas.width / canvas.height) / (backgroundImage.width / backgroundImage.height);
    gl.uniform1f(uBGAspect, aspect);

    initialTextureOffset = (1 - 1 / aspect) / 2;
    gl.uniform2f(uInitialTextureOffset, 0, initialTextureOffset);
}


function drawSceneTexture() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
    gl.viewport(0, 0, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, textureScreenVertexPositionBuffer);
    gl.vertexAttribPointer(aVertexPosition, textureScreenVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, textureScreenTextureCoordBuffer);
    gl.vertexAttribPointer(aTextureCoord, textureScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.uniform1i(uIsBuffer, true);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textureScreenIndexBuffer);
    gl.uniformMatrix4fv(uPMatrix, false, pMatrix);
    gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);
    gl.drawElements(gl.TRIANGLES, textureScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    // gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    // gl.generateMipmap(gl.TEXTURE_2D);
    // gl.bindTexture(gl.TEXTURE_2D, null);
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

    gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    gl.uniform1i(uIsBuffer, false);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mainScreenIndexBuffer);
    gl.uniformMatrix4fv(uPMatrix, false, pMatrix);
    gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);
    gl.drawElements(gl.TRIANGLES, mainScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}
