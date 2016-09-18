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
var backgroundTexture2;
var backgroundImage2;

var sampleTexture;
var sampleTextureFramebuffer;

var samplingScreenVertexPositionBuffer;
var samplingScreenVertexPositionBuffer2;
var samplingScreenTextureCoordBuffer;
var samplingScreenIndexBuffer;

var mainScreenVertexPositionBuffer;
var mainScreenTextureCoordBuffer;
var mainScreenIndexBuffer;


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

    initBackgroundTexture().then(initSamplingScreen);
    initSampleTexture();

    initMainScreen();

    var offset = 0;
    window.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') {
            offset += .1;
        } else if (e.key === 'ArrowUp') {
            offset -= .1;
        }
        gl.uniform2f(uTextureOffset, 0, offset);
    });
    setTimeout(function() {
        requestAnimationFrame(render);
    }, 1000);
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


var images = [];
var textures = [];
var tileVertexPositionBuffers = [];
function initBackgroundTexture() {
    var imgSrcs = [
        '1.jpg',
        '2.jpg',
        '3.jpg',
        '4.jpg',
        '5.jpg',
    ];

    var promises = imgSrcs.map((imgSrc) => {
        return new Promise((res) => {
            var img = new Image();
            img.src = imgSrc;
            img.onload = () => res(img);
        })
    })

    return Promise.all(promises).
        then((imgs) => {
            images = imgs;
        }).
        then(() => {
            textures = images.map((img) => {
                var texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

                gl.bindTexture(gl.TEXTURE_2D, null);

                return texture;
            });
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
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sampleTexture, 0);

    var sampleTextureRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, sampleTextureRenderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sampleTextureRenderbuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}


function initSamplingScreen() {
    var x1, y1, x2, y2;
    tileVertexPositionBuffers = textures.map((texture, idx) => {
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        x1 = -1;
        y1 = -1 * (1 + idx * 2);
        x2 = x1 + 2;
        y2 = y1 + 2;
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            x1, y1,
            x2, y1,
            x2, y2,
            x1, y2,
        ]), gl.STATIC_DRAW);
        buffer.itemSize = 2;
        buffer.numItems = 4;

        return buffer;
    });

    samplingScreenTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, samplingScreenTextureCoordBuffer);
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
    samplingScreenTextureCoordBuffer.itemSize = 2;
    samplingScreenTextureCoordBuffer.numItems = 4;

    samplingScreenIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, samplingScreenIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
        0, 1, 2,    0, 2, 3,
    ]), gl.STATIC_DRAW);
    samplingScreenIndexBuffer.itemSize = 1;
    samplingScreenIndexBuffer.numItems = 6;
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

    initMVPMatrices();
}


function initMVPMatrices() {
    var mvMatrix = mat4.create();
    mat4.fromTranslation(mvMatrix, [0, 0, -1]);
    gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);

    var pMatrix = mat4.create();
    mat4.ortho(pMatrix, -1, 1, -1, 1, .1, 100);
    gl.uniformMatrix4fv(uPMatrix, false, pMatrix);
}


function render(HRTimestamp) {
    requestAnimationFrame(render);

    if (HRTimestamp - last < 1000 / fps) {
        return;
    }
    last = HRTimestamp;

    resize();
    drawSamplingScreen();
    drawMainScreen();
}


function resize() {
    if (canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight) {
        return;
    }

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    var aspect = (canvas.width / canvas.height) / (1080 / 7000);
    gl.uniform1f(uBGAspect, aspect);

    initialTextureOffset = (1 - 1 / aspect) / 2;
    gl.uniform2f(uInitialTextureOffset, 0, initialTextureOffset);
}


function drawSamplingScreen() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
    gl.viewport(0, 0, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(uIsBuffer, true);

    tileVertexPositionBuffers.forEach((tileVertexPositionBuffer, idx) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, tileVertexPositionBuffer);
        gl.vertexAttribPointer(aVertexPosition, tileVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, samplingScreenTextureCoordBuffer);
        gl.vertexAttribPointer(aTextureCoord, samplingScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindTexture(gl.TEXTURE_2D, textures[idx]);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, samplingScreenIndexBuffer);
        gl.drawElements(gl.TRIANGLES, samplingScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    })

    // gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    // gl.generateMipmap(gl.TEXTURE_2D);
    // gl.bindTexture(gl.TEXTURE_2D, null);
}


function drawMainScreen() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenVertexPositionBuffer);
    gl.vertexAttribPointer(aVertexPosition, mainScreenVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenTextureCoordBuffer);
    gl.vertexAttribPointer(aTextureCoord, mainScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
    gl.uniform1i(uIsBuffer, false);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mainScreenIndexBuffer);
    gl.drawElements(gl.TRIANGLES, mainScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}
