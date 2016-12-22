import Screen from './screen';


const modes = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

const directions = {
  HORIZONTAL: 0,
  VERTICAL: 1,
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
  imgUrls: [],
  mode: modes.PARABOLIC,
  direction: directions.VERTICAL,
  factor: 0.1,
  multiplier: 0.1,
  originOffset: -0.5,
  recover: 1,
  fps: 60,
};

let gl;
let mainProgram;
let samplingProgram;
let mainScreen;
let samplingScreen;

let last = 0;
const aspect = [1, 1];
const textureOffset = [0, 0];
const initialTextureOffset = [0, 0];
const tileSize = {
  W: 0,
  H: 0,
};


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


function setUniforms() {
  // TODO: choose better name
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

  gl.useProgram(mainProgram);
  gl.uniform1i(mainProgram.uMode, config.mode);
  gl.uniform2fv(mainProgram.uFactor, config.factor);
  gl.uniform2fv(mainProgram.uMultiplier, config.multiplier);
  gl.uniform2fv(mainProgram.uOriginOffset, config.originOffset);
  gl.uniform2fv(mainProgram.uRecover, config.recover);
}


function fetchImages() {
  return Promise.all(config.imgUrls.map((imgUrl) => {
    const img = new Image();
    img.src = imgUrl;

    return new Promise((resolve) => {
      img.onload = () => {
        if (tileSize.W === 0 || tileSize.H === 0) {
          tileSize.W = img.width;
          tileSize.H = img.height;
        }
        resolve(img);
      };
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

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, samplingScreen.width, samplingScreen.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  samplingScreen.frameBuffer = frameBuffer;
  mainScreen.texture = texture;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
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


function resize() {
  const viewportAspect = window.innerWidth / window.innerHeight;
  const imgAspect = tileSize.W / tileSize.H;

  config.canvas.style.width = `${window.innerWidth}px`;
  config.canvas.style.height = `${window.innerHeight}px`;

  config.canvas.width = window.innerWidth;
  config.canvas.height = window.innerHeight;

  mainScreen.width = gl.drawingBufferWidth;
  mainScreen.height = gl.drawingBufferHeight;

  switch (config.direction) {
    case directions.VERTICAL:
      aspect[config.direction] = viewportAspect / imgAspect;
      break;

    case directions.HORIZONTAL:
      aspect[config.direction] = imgAspect / viewportAspect;
      break;

    default:
  }

  initialTextureOffset[config.direction] = (1 / aspect[config.direction]) - 1;

  gl.useProgram(samplingProgram);
  gl.uniform2fv(samplingProgram.uBGAspect, aspect);
  gl.uniform2fv(samplingProgram.uInitialTextureOffset, initialTextureOffset);
}


function render(HRTimestamp) {
  requestAnimationFrame(render);

  if (HRTimestamp - last < 1000 / config.fps) {
    return;
  }
  last = HRTimestamp;

  samplingScreen.render();
  mainScreen.render();
}


async function init(_config) {
  Object.assign(config, _config);

  gl = config.canvas.getContext('webgl');
  gl.clearColor(0, 0, 0, 1);

  mainProgram = gl.createProgram();
  samplingProgram = gl.createProgram();

  mainScreen = new Screen(gl, mainProgram, gl.drawingBufferWidth, gl.drawingBufferHeight);
  samplingScreen = new Screen(gl, samplingProgram, 512, 512, config.imgUrls.length);

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


function move(percent) {
  // TODO: choose better name for variable `foo`
  const foo = config.imgUrls.length - 1;
  const scrollStart = 0;
  const scrollStop = 2 * (foo - initialTextureOffset[config.direction]);

  textureOffset[config.direction] = percent * scrollStop;
  textureOffset[config.direction] = Math.max(textureOffset[config.direction], scrollStart);
  textureOffset[config.direction] = Math.min(textureOffset[config.direction], scrollStop);

  gl.useProgram(samplingProgram);
  gl.uniform2fv(samplingProgram.uTextureOffset, textureOffset);
}


export {
  init,
  modes,
  directions,
  move,
};
