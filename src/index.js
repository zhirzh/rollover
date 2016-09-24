import { newScreens } from './utils';


let fps;
let last;
let canvas;
let gl;

const modes = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

let program;

let sampleTextureFramebuffer;

let samplingScreens;
let mainScreen;

function initWebGL() {
  gl = canvas.getContext('webgl');
  gl.clearColor(0, 0, 0, 1);
}


function initScreens(imgSrcsLength) {
  samplingScreens = newScreens(imgSrcsLength);
  mainScreen = newScreens(1);
}


async function fetchShader(id) {
  let shader;
  switch (id) {
    case 'fragment-shader':
      shader = gl.createShader(gl.FRAGMENT_SHADER);
      break;

    case 'vertex-shader':
      shader = gl.createShader(gl.VERTEX_SHADER);
      break;

    default:
  }

  try {
    const res = await fetch(`${id}.glsl`);
    const shaderSrc = await res.text();
    gl.shaderSource(shader, shaderSrc);
  } catch (e) {
    throw e;
  }

  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}


function fetchShaders(...shaderIDs) {
  return Promise.all(shaderIDs.map(shaderId => fetchShader(shaderId)));
}


async function initProgram({ vertexShaderID, fragmentShaderID, attributes, uniforms }) {
  program = gl.createProgram();

  try {
    const shaders = await fetchShaders(vertexShaderID, fragmentShaderID);
    shaders.forEach(shader => gl.attachShader(program, shader));
  } catch (e) {
    throw e;
  }

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
}


function initUniforms({
  mode,
  factor,
  multiplier,
  originOffset,
  recover,
}) {
  gl.uniform1i(program.uMode, mode);
  gl.uniform2fv(program.uFactor, factor);
  gl.uniform2fv(program.uMultiplier, multiplier);
  gl.uniform2fv(program.uOriginOffset, originOffset);
  gl.uniform2fv(program.uRecover, recover);
}


function loadTile(imgSrc) {
  return new Promise((res) => {
    const img = new Image();
    img.src = imgSrc;
    img.onload = () => res(img);
  });
}


function loadTiles(imgSrcs) {
  return Promise.all(imgSrcs.map(loadTile));
}


async function initBackgroundTexture(imgSrcs) {
  try {
    const imgs = await loadTiles(imgSrcs);

    imgs.forEach((img, idx) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      gl.bindTexture(gl.TEXTURE_2D, null);

      samplingScreens[idx].texture = texture;
    });
  } catch (e) {
    throw e;
  }
}


function initSampleTextureFramebuffer() {
  sampleTextureFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
  sampleTextureFramebuffer.width = sampleTextureFramebuffer.height = 1024;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


function initSampleTextureRenderbuffer(sampleTexture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sampleTexture, 0);

  const sampleTextureRenderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, sampleTextureRenderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sampleTextureRenderbuffer);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}


function initSampleTexture() {
  initSampleTextureFramebuffer();

  /* use TEXTURE1 for sampleTexture */
  const sampleTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  initSampleTextureRenderbuffer(sampleTexture);

  mainScreen.texture = sampleTexture;
  gl.bindTexture(gl.TEXTURE_2D, null);
}


function glBuffer(target, data, usage, config = {}) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  for (const [k, v] of Object.entries(config)) {
    buffer[k] = v;
  }

  return buffer;
}


function initSamplingScreen() {
  samplingScreens.forEach((samplingScreen, idx) => {
    let x1;
    let y1;
    let x2;
    let y2;
    let buffer;

    x1 = -1;
    y1 = -1 - (2 * idx);
    x2 = x1 + 2;
    y2 = y1 + 2;
    buffer = glBuffer(
      gl.ARRAY_BUFFER,
      new Float32Array([
        x1, y1,
        x2, y1,
        x2, y2,
        x1, y2,
      ]),
      gl.STATIC_DRAW,
      {
        itemSize: 2,
        numItems: 4,
      });
    samplingScreen.vertexPositionBuffer = buffer;

    x1 = 0;
    y1 = 0;
    x2 = x1 + 1;
    y2 = y1 + 1;
    buffer = glBuffer(
      gl.ARRAY_BUFFER,
      new Float32Array([
        x1, y1,
        x2, y1,
        x2, y2,
        x1, y2,
      ]),
      gl.STATIC_DRAW,
      {
        itemSize: 2,
        numItems: 4,
      });
    samplingScreen.textureCoordBuffer = buffer;

    buffer = glBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([
        0, 1, 2,
        0, 2, 3,
      ]),
      gl.STATIC_DRAW,
      {
        itemSize: 1,
        numItems: 6,
      });
    samplingScreen.indexBuffer = buffer;
  });
}


function initMainScreen() {
  let x1;
  let y1;
  let x2;
  let y2;
  x1 = -1;
  y1 = -1;
  x2 = x1 + 2;
  y2 = y1 + 2;
  mainScreen.vertexPositionBuffer = glBuffer(
    gl.ARRAY_BUFFER,
    new Float32Array([
      x1, y1,
      x2, y1,
      x2, y2,
      x1, y2,
    ]),
    gl.STATIC_DRAW,
    {
      itemSize: 2,
      numItems: 4,
    });

  x1 = 0;
  y1 = 0;
  x2 = x1 + 1;
  y2 = y1 + 1;
  mainScreen.textureCoordBuffer = glBuffer(
    gl.ARRAY_BUFFER,
    new Float32Array([
      x1, y1,
      x2, y1,
      x2, y2,
      x1, y2,
    ]),
    gl.STATIC_DRAW,
    {
      itemSize: 2,
      numItems: 4,
    });

  mainScreen.indexBuffer = glBuffer(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([
      0, 1, 2,
      0, 2, 3,
    ]),
    gl.STATIC_DRAW,
    {
      itemSize: 1,
      numItems: 6,
    });
}


function initScrolling() {
  const offset = {
    x: 0,
    y: 0,
  };

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp':
        offset.y -= 0.2;
        break;

      case 'ArrowDown':
        offset.y += 0.2;
        break;

      case 'ArrowLeft':
        offset.x += 0.2;
        break;

      case 'ArrowRight':
        offset.x -= 0.2;
        break;

      default:
    }

    gl.uniform2f(program.uTextureOffset, offset.x, offset.y);
  });
}


function resize() {
  if (canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight) {
    return;
  }

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  const widthRatio = 1080 / canvas.width;
  const heightRatio = (7000 / 5) / canvas.height;


  const backgroundImageAspect = 1080 / (7000 / 5);

  const initialTextureOffset = {
    x: 0,
    y: 0,
  };

  const aspect = {
    x: 1,
    y: 1,
  };

  if (backgroundImageAspect > 1) {
    aspect.x = widthRatio / heightRatio;
    initialTextureOffset.x = -0.5 * (1 - (1 / aspect.x));
  } else {
    aspect.y = heightRatio / widthRatio;
    initialTextureOffset.y = 0.5 * (1 - (1 / aspect.y));
  }

  gl.uniform2f(program.uBGAspect, aspect.x, aspect.y);
  gl.uniform2f(program.uInitialTextureOffset, initialTextureOffset.x, initialTextureOffset.y);
}


function drawSamplingScreen() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTextureFramebuffer);
  gl.viewport(0, 0, sampleTextureFramebuffer.width, sampleTextureFramebuffer.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1i(program.uIsBuffer, true);

  samplingScreens.forEach((samplingScreen) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, samplingScreen.vertexPositionBuffer);
    gl.vertexAttribPointer(program.aVertexPosition, samplingScreen.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, samplingScreen.textureCoordBuffer);
    gl.vertexAttribPointer(program.aTextureCoord, samplingScreen.textureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, samplingScreen.texture);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, samplingScreen.indexBuffer);
    gl.drawElements(gl.TRIANGLES, samplingScreen.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  });
}


function drawMainScreen() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1i(program.uIsBuffer, false);

  gl.bindBuffer(gl.ARRAY_BUFFER, mainScreen.vertexPositionBuffer);
  gl.vertexAttribPointer(program.aVertexPosition, mainScreen.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mainScreen.textureCoordBuffer);
  gl.vertexAttribPointer(program.aTextureCoord, mainScreen.textureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, mainScreen.texture);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mainScreen.indexBuffer);
  gl.drawElements(gl.TRIANGLES, mainScreen.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
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


async function init({
  canvas: _canvas,
  mode,
  factor,
  multiplier,
  originOffset,
  recover,
  imgSrcs,
  fps: _fps,
}) {
  canvas = _canvas;
  fps = _fps;
  last = 0;

  const programConfig = {
    vertexShaderID: 'vertex-shader',
    fragmentShaderID: 'fragment-shader',
    attributes: [
      'aTextureCoord',
      'aVertexPosition',
    ],
    uniforms: [
      'uBGAspect',
      'uFactor',
      'uFactor',
      'uInitialTextureOffset',
      'uIsBuffer',
      'uMode',
      'uMultiplier',
      'uMultiplier',
      'uOriginOffset',
      'uOriginOffset',
      'uRecover',
      'uRecover',
      'uSampler',
      'uTextureOffset',
    ],
  };

  initWebGL();
  initScreens(imgSrcs.length);

  await initProgram(programConfig);
  initUniforms({
    mode,
    factor,
    multiplier,
    originOffset,
    recover,
  });

  await initBackgroundTexture(imgSrcs);
  initSampleTexture();

  initSamplingScreen();
  initMainScreen();

  initScrolling();

  requestAnimationFrame(render);
}


export {
  init,
  modes,
};
