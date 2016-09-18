let fps = 60;
let last = 0;
let canvas;
let gl;
let config;

let modes = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

let program;

let backgroundTexture;
let backgroundImage;

let sampleTexture;
let sampleTextureFramebuffer;

let samplingScreenVertexPositionBuffer;
let samplingScreenTextureCoordBuffer;
let samplingScreenIndexBuffer;

let mainScreenVertexPositionBuffer;
let mainScreenTextureCoordBuffer;
let mainScreenIndexBuffer;


function getShader(id) {
  return fetch(`${id}.glsl`).
    then((res) => res.text()).
    then((script) => {
      let shader;
      switch (id) {
        case 'fragment-shader':
          shader = gl.createShader(gl.FRAGMENT_SHADER);
          break;

        case 'vertex-shader':
          shader = gl.createShader(gl.VERTEX_SHADER);
          break;

        default:
          return;
      }

      gl.shaderSource(shader, script);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return;
      }

      return shader;
    });
}


function init(_config) {
  config =  _config;

  initWebGL();

  initProgram({
    vertexShader: 'vertex-shader',
    fragmentShader: 'fragment-shader',
    attributes: [
      'aTextureCoord',
      'aVertexPosition'
    ],
    uniforms: [
      'uBGAspect',
      'uFactor',
      'uInitialTextureOffset',
      'uIsBuffer',
      'uMultiplier',
      'uOriginOffset',
      'uRecover',
      'uSampler',
      'uTextureOffset',
    ],
  });

  initBackgroundTexture().then(initSamplingScreen);
  initSampleTexture();

  initSamplingScreen();
  initMainScreen();

  initScrolling();

  setTimeout(function() {
    requestAnimationFrame(render);
  }, 1000);
}


function initWebGL() {
  canvas = document.getElementById(config.canvas);
  gl = canvas.getContext('webgl');
  gl.clearColor(0, 0, 0, 1);
}


function initProgram({ vertexShader, fragmentShader, attributes, uniforms }) {
  Promise.all([
    getShader(vertexShader),
    getShader(fragmentShader),
  ]).
    then(([fragmentShader, vertexShader]) => {
      program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return;
      }

      gl.useProgram(program);

      attributes.forEach((attribute) => {
        program[attribute] = gl.getAttribLocation(program, attribute);
        gl.enableVertexAttribArray(program[attribute]);
      });

      uniforms.forEach((uniform) => {
        program[uniform] = gl.getUniformLocation(program, uniform);
      });

      initUniforms();
    }).
    catch((e) => console.error(e));
}


function initUniforms() {
  gl.uniform1i(program.uMode, config.mode);
  gl.uniform2fv(program.uFactor, config.factor);
  gl.uniform2fv(program.uMultiplier, config.multiplier);
  gl.uniform2fv(program.uOriginOffset, config.originOffset);
  gl.uniform2fv(program.uRecover, config.recover);
}


var images = [];
var textures = [];
var tileVertexPositionBuffers = [];
function initBackgroundTexture() {
  var imgSrcs = [
    'img/1.jpg',
    'img/2.jpg',
    'img/3.jpg',
    'img/4.jpg',
    'img/5.jpg',
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

  let sampleTextureRenderbuffer = gl.createRenderbuffer();
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
  let x1, y1, x2, y2;
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
    0, 1, 2,  0, 2, 3,
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
  drawSamplingScreen();
  drawMainScreen();
}


function resize() {
  if (canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight) {
    return;
  }

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  let widthRatio = 1080 / canvas.width;
  let heightRatio = (7000/5) / canvas.height;


  let backgroundImageAspect = 1080 / (7000/5);

  let initialTextureOffset = {
    x: 0,
    y: 0,
  };

  let aspect = {
    x: 1,
    y: 1,
  };

  if (backgroundImageAspect > 1) {
    aspect.x = widthRatio / heightRatio;
    initialTextureOffset.x = -0.5 * (1 - 1 / aspect.x);
  } else {
    aspect.y = heightRatio / widthRatio;
    initialTextureOffset.y = 0.5 * (1 - 1 / aspect.y);
  }

  gl.uniform2f(program.uBGAspect, aspect.x, aspect.y);
  gl.uniform2f(program.uInitialTextureOffset, initialTextureOffset.x, initialTextureOffset.y);
}


function drawSamplingScreen() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
    gl.viewport(0, 0, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(program.uIsBuffer, true);

    tileVertexPositionBuffers.forEach((tileVertexPositionBuffer, idx) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, tileVertexPositionBuffer);
        gl.vertexAttribPointer(program.aVertexPosition, tileVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, samplingScreenTextureCoordBuffer);
        gl.vertexAttribPointer(program.aTextureCoord, samplingScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

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
  gl.vertexAttribPointer(program.aVertexPosition, mainScreenVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mainScreenTextureCoordBuffer);
  gl.vertexAttribPointer(program.aTextureCoord, mainScreenTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
  gl.uniform1i(program.uIsBuffer, false);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mainScreenIndexBuffer);
  gl.drawElements(gl.TRIANGLES, mainScreenIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}


function initScrolling() {
  let offset = {
    x: 0,
    y: 0,
  };
  window.addEventListener('keydown', function(e) {
    switch (e.key) {
      case 'ArrowUp':
        offset.y += .002;
        break;

      case 'ArrowDown':
        offset.y -= .002;
        break;

      case 'ArrowLeft':
        offset.x -= .002;
        break;

      case 'ArrowRight':
        offset.x += .002;
        break;
    }

    gl.uniform2f(program.uTextureOffset, offset.x, offset.y);
  });
}

export {
  init,
  modes,
};
