import {
  Screen,
} from './utils';


const offset = {
  x: 0,
  y: 0,
};

const filters = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

const modes = {
  VERTICAL: 1,
  HORIZONTAL: 2,
};

const glConfig = {
  vertexShader: 'vertex-shader.glsl',
  fragmentShader: 'fragment-shader.glsl',
  attributes: [
    'aTextureCoord',
    'aVertexPosition',
  ],
  uniforms: [
    'uBGAspect',
    'uFactor',
    'uInitialTextureOffset',
    'uIsBuffer',
    'ufilter',
    'uMultiplier',
    'uOriginOffset',
    'uRecover',
    'uSampler',
    'uTextureOffset',
  ],
};

const config = {
  canvas: null,
  filter: filters.PARABOLIC,
  mode: modes.HORIZONTAL,
  factor: [0, 0],
  multiplier: [0, 0],
  originOffset: [0, 0],
  recover: [1, 1],
  imgSrcs: [],
  imgSrc: null,
  fps: 60,
};

let last = 0;
let aspect;
let initialTextureOffset;

let gl;
let program;
let samplingScreen;
let mainScreen;


function initSamplingFrameBuffer() {
  const frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  frameBuffer.width = 512;
  frameBuffer.height = 512;
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frameBuffer.width, frameBuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  samplingScreen.frameBuffer = frameBuffer;
  mainScreen.texture = texture;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
}


function resize() {
  const imgWidth = 1080;
  const imgHeight = 7000 / 5;

  const viewportAspect = window.innerWidth / window.innerHeight;
  const imgAspect = imgWidth / imgHeight;

  config.canvas.style.width = `${window.innerWidth}px`;
  config.canvas.style.height = `${window.innerHeight}px`;

  config.canvas.width = window.innerWidth;
  config.canvas.height = window.innerHeight;

  aspect = {
    x: 1,
    y: 1,
  };
  initialTextureOffset = {
    x: 0,
    y: 0,
  };
  switch (config.mode) {
    case modes.VERTICAL:
      aspect.y = viewportAspect / imgAspect;
      initialTextureOffset.y = (1 / aspect.y) - 1;
      break;

    case modes.HORIZONTAL:
      aspect.x = imgAspect / viewportAspect;
      // aspect.x = 1;
      initialTextureOffset.x = -1 * ((1 / aspect.x) - 1);
      break;

    default:
  }

  gl.uniform2f(program.uBGAspect, aspect.x, aspect.y);
  gl.uniform2f(program.uInitialTextureOffset, initialTextureOffset.x, initialTextureOffset.y);
}


function render(HRTimestamp) {
  requestAnimationFrame(render);

  if (HRTimestamp - last < 1000 / config.fps) {
    return;
  }
  last = HRTimestamp;

  gl.uniform1i(program.uIsBuffer, true);
  gl.bindFramebuffer(gl.FRAMEBUFFER, samplingScreen.frameBuffer);
  gl.viewport(0, 0, samplingScreen.frameBuffer.width, samplingScreen.frameBuffer.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  samplingScreen.tiles.forEach(tile => tile.render());

  gl.uniform1i(program.uIsBuffer, false);
  gl.bindFramebuffer(gl.FRAMEBUFFER, mainScreen.frameBuffer);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
  mainScreen.render();
}


function fetchShaderSrc(shaderUrl) {
  return fetch(shaderUrl).then(resp => resp.text());
}


async function initShader(shaderType, shaderUrl) {
  const shaderSrc = await fetchShaderSrc(shaderUrl);

  const shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSrc);

  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw Error(gl.getShaderInfoLog(shader));
  }
  gl.attachShader(program, shader);

  return shader;
}


async function initProgram() {
  await initShader(gl.VERTEX_SHADER, glConfig.vertexShader);
  await initShader(gl.FRAGMENT_SHADER, glConfig.fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  glConfig.attributes.forEach((attribute) => {
    program[attribute] = gl.getAttribLocation(program, attribute);
    gl.enableVertexAttribArray(program[attribute]);
  });

  glConfig.uniforms.forEach((uniform) => {
    program[uniform] = gl.getUniformLocation(program, uniform);
  });

  const {
    filter,
    factor,
    multiplier,
    originOffset,
    recover,
  } = config;
  gl.uniform1i(program.ufilter, filter);
  gl.uniform2fv(program.uFactor, factor);
  gl.uniform2fv(program.uMultiplier, multiplier);
  gl.uniform2fv(program.uOriginOffset, originOffset);
  gl.uniform2fv(program.uRecover, recover);
}


function initDataBuffers() {
  mainScreen.initDataBuffers();
  samplingScreen.tiles.forEach((tile, idx) => {
    const tileOffset = {
      x: 0,
      y: 0,
    };

    switch (config.mode) {
      case modes.VERTICAL:
        tileOffset.y = -1 * (2 * idx);
        break;

      case modes.HORIZONTAL:
        tileOffset.x = 2 * idx;
        break;

      default:
    }

    tile.initDataBuffers(tileOffset);
  });

  initSamplingFrameBuffer();

  return Promise.resolve();
}


function fetchImages() {
  return Promise.all(config.imgSrcs.map((imgSrc) => {
    const img = new Image();
    img.src = imgSrc;

    return new Promise((resolve) => {
      img.onload = () => resolve(img);
    });
  }));
}


async function initTextures() {
  const imgs = await fetchImages();
  imgs.forEach((img, idx) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    samplingScreen.tiles[idx].texture = texture;

    gl.bindTexture(gl.TEXTURE_2D, null);
  });
}


async function init(_config) {
  Object.assign(config, _config);

  gl = config.canvas.getContext('webgl');
  gl.clearColor(0, 0, 0, 1);

  program = gl.createProgram();
  mainScreen = new Screen(gl, program);
  samplingScreen = new Screen(gl, program, config.imgSrcs.length);

  await Promise.all([
    initProgram(),
    initTextures(),
    initDataBuffers(),
  ]);

  resize();
  requestAnimationFrame(render);

  window.addEventListener('resize', resize);
}


function move(delta) {
  switch (config.mode) {
    case modes.VERTICAL:
      offset.y += delta;
      if (offset.y < 0) {
        offset.y = 0;
      } else if (offset.y > 8 - (2 * initialTextureOffset.y)) {
        offset.y = 8 - (2 * initialTextureOffset.y);
      }
      break;

    case modes.HORIZONTAL:
      offset.x += -1 * delta;
      if (offset.x > 0) {
        offset.x = 0;
      } else if (offset.x < -8 - (2 * initialTextureOffset.x)) {
        offset.x = -8 - (2 * initialTextureOffset.x);
      }
      break;

    default:
  }

  gl.uniform2f(program.uTextureOffset, offset.x, offset.y);
}


export {
  init,
  filters,
  modes,
  move,
};
