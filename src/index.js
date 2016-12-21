import {
  Screen,
} from './utils';


const modes = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

const directions = {
  VERTICAL: 1,
  HORIZONTAL: 2,
};

const mainProgramConfig = {
  vertexShader: 'vertex-shader-main.glsl',
  fragmentShader: 'fragment-shader-main.glsl',
  attributes: [
    'aTextureCoord',
    'aVertexPosition',
  ],
  uniforms: [
    'uFactor',
    'uMode',
    'uMultiplier',
    'uOriginOffset',
    'uRecover',
    'uSampler',
  ],
};

const samplingProgramConfig = {
  vertexShader: 'vertex-shader-sampling.glsl',
  fragmentShader: 'fragment-shader-sampling.glsl',
  attributes: [
    'aTextureCoord',
    'aVertexPosition',
  ],
  uniforms: [
    'uBGAspect',
    'uInitialTextureOffset',
    'uTextureOffset',
  ],
};

const config = {
  canvas: null,
  mode: modes.PARABOLIC,
  direction: directions.HORIZONTAL,
  factor: 0.1,
  multiplier: 0.1,
  originOffset: -0.5,
  recover: 1,
  imgSrcs: [],
  fps: 60,
};

let gl;
let mainProgram;
let samplingProgram;
let mainScreen;
let samplingScreen;

let last = 0;
let aspect;
let initialTextureOffset;
const offset = {
  x: 0,
  y: 0,
};


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
  switch (config.direction) {
    case directions.VERTICAL:
      aspect.y = viewportAspect / imgAspect;
      initialTextureOffset.y = (1 / aspect.y) - 1;
      break;

    case directions.HORIZONTAL:
      aspect.x = imgAspect / viewportAspect;
      // aspect.x = 1;
      initialTextureOffset.x = -1 * ((1 / aspect.x) - 1);
      break;

    default:
  }

  gl.useProgram(samplingProgram);
  gl.uniform2f(samplingProgram.uBGAspect, aspect.x, aspect.y);
  gl.uniform2f(samplingProgram.uInitialTextureOffset, initialTextureOffset.x, initialTextureOffset.y);
}


function render(HRTimestamp) {
  requestAnimationFrame(render);

  if (HRTimestamp - last < 1000 / config.fps) {
    return;
  }
  last = HRTimestamp;

  gl.useProgram(samplingProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, samplingScreen.frameBuffer);
  gl.viewport(0, 0, samplingScreen.frameBuffer.width, samplingScreen.frameBuffer.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  samplingScreen.tiles.forEach(tile => tile.render());

  gl.useProgram(mainProgram);
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

  return shader;
}


function setUniforms() {
  switch (config.direction) {
    case directions.VERTICAL:
      config.factor = [config.factor, 0];
      config.multiplier = [config.multiplier, 0];
      config.originOffset = [0, config.originOffset];
      config.recover = [1, config.recover];
      break;

    case directions.HORIZONTAL:
      config.factor = [0, config.factor];
      config.multiplier = [0, config.multiplier];
      config.originOffset = [config.originOffset, 0];
      config.recover = [config.recover, 1];
      break;

    default:
  }

  gl.uniform1i(mainProgram.uMode, config.mode);
  gl.uniform2fv(mainProgram.uFactor, config.factor);
  gl.uniform2fv(mainProgram.uMultiplier, config.multiplier);
  gl.uniform2fv(mainProgram.uOriginOffset, config.originOffset);
  gl.uniform2fv(mainProgram.uRecover, config.recover);
}


async function initProgram(program, programConfig) {
  const vertexShader = await initShader(gl.VERTEX_SHADER, programConfig.vertexShader);
  gl.attachShader(program, vertexShader);

  const fragmentShader = await initShader(gl.FRAGMENT_SHADER, programConfig.fragmentShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  programConfig.attributes.forEach((attribute) => {
    program[attribute] = gl.getAttribLocation(program, attribute);
    gl.enableVertexAttribArray(program[attribute]);
  });

  programConfig.uniforms.forEach((uniform) => {
    program[uniform] = gl.getUniformLocation(program, uniform);
  });
}


function initDataBuffers() {
  mainScreen.initDataBuffers();
  samplingScreen.tiles.forEach((tile, idx) => {
    const tileOffset = {
      x: 0,
      y: 0,
    };

    switch (config.direction) {
      case directions.VERTICAL:
        tileOffset.y = -1 * (2 * idx);
        break;

      case directions.HORIZONTAL:
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

  mainProgram = gl.createProgram();
  mainScreen = new Screen(gl, mainProgram);

  samplingProgram = gl.createProgram();
  samplingScreen = new Screen(gl, samplingProgram, config.imgSrcs.length);

  await Promise.all([
    initProgram(mainProgram, mainProgramConfig).then(setUniforms),
    initProgram(samplingProgram, samplingProgramConfig),
    initTextures(),
    initDataBuffers(),
  ]);

  resize();
  requestAnimationFrame(render);

  window.addEventListener('resize', resize);
}


function move(delta) {
  switch (config.direction) {
    case directions.VERTICAL:
      offset.y += delta;
      if (offset.y < 0) {
        offset.y = 0;
      } else if (offset.y > 8 - (2 * initialTextureOffset.y)) {
        offset.y = 8 - (2 * initialTextureOffset.y);
      }
      break;

    case directions.HORIZONTAL:
      offset.x += -1 * delta;
      if (offset.x > 0) {
        offset.x = 0;
      } else if (offset.x < -8 - (2 * initialTextureOffset.x)) {
        offset.x = -8 - (2 * initialTextureOffset.x);
      }
      break;

    default:
  }

  gl.useProgram(samplingProgram);
  gl.uniform2f(samplingProgram.uTextureOffset, offset.x, offset.y);
}


export {
  init,
  modes,
  directions,
  move,
};
