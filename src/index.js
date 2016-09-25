import Screen from './screen';
import {
  initWebGL,
  initProgram,
  loadTiles,
} from './utils';


let fps;
let canvas;
let type;
let gl;
let last = 0;
const offset = {
  x: 0,
  y: 0,
};
let aspect;
let initialTextureOffset;

const modes = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

const types = {
  VERTICAL: 1,
  HORIZONTAL: 2,
};

let program;

let samplingScreen;
let mainScreen;


export function initScreens(imgSrcsLength) {
  samplingScreen = new Screen(gl, program, imgSrcsLength);
  samplingScreen.tiles.forEach((tile, idx) => {
    const tileOffset = {
      x: 0,
      y: 0,
    };

    switch (type) {
      case types.VERTICAL:
        tileOffset.y = -1 * (2 * idx);
        break;

      case types.HORIZONTAL:
        tileOffset.x = 2 * idx;
        break;

      default:
    }

    tile.initDataBuffers(tileOffset);
  });

  mainScreen = new Screen(gl, program);
  mainScreen.initDataBuffers();
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

      samplingScreen.tiles[idx].texture = texture;
    });
  } catch (e) {
    throw e;
  }
}


function initSampleTextureFramebuffer() {
  samplingScreen.frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, samplingScreen.frameBuffer);
  samplingScreen.frameBuffer.width = samplingScreen.frameBuffer.height = 1024;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


function initSampleTextureRenderbuffer(sampleTexture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, samplingScreen.frameBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sampleTexture, 0);

  const sampleTextureRenderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, sampleTextureRenderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, samplingScreen.frameBuffer.width, samplingScreen.frameBuffer.height);
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
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, samplingScreen.frameBuffer.width, samplingScreen.frameBuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  initSampleTextureRenderbuffer(sampleTexture);

  mainScreen.texture = sampleTexture;
  gl.bindTexture(gl.TEXTURE_2D, null);
}


function resize() {
  const imgWidth = 1080;
  const imgHeight = 7000 / 5;

  const viewportAspect = window.innerWidth / window.innerHeight;
  const imgAspect = imgWidth / imgHeight;

  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  aspect = {
    x: 1,
    y: 1,
  };
  initialTextureOffset = {
    x: 0,
    y: 0,
  };
  switch (type) {
    case types.VERTICAL:
      aspect.y = viewportAspect / imgAspect;
      initialTextureOffset.y = (1 / aspect.y) - 1;
      break;

    case types.HORIZONTAL:
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

  if (HRTimestamp - last < 1000 / fps) {
    return;
  }
  last = HRTimestamp;

  gl.uniform1i(program.uIsBuffer, true);
  samplingScreen.render();

  gl.uniform1i(program.uIsBuffer, false);
  mainScreen.render();
}


async function init({
  canvas: _canvas,
  mode,
  type: _type,
  factor,
  multiplier,
  originOffset,
  recover,
  imgSrcs = [],
  imgSrc = null,
  fps: _fps,
}) {
  canvas = _canvas;
  fps = _fps;
  type = _type;

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
      'uInitialTextureOffset',
      'uIsBuffer',
      'uMode',
      'uMultiplier',
      'uOriginOffset',
      'uRecover',
      'uSampler',
      'uTextureOffset',
    ],
  };

  gl = initWebGL(canvas);
  program = await initProgram(gl, programConfig);
  initUniforms({
    mode,
    factor,
    multiplier,
    originOffset,
    recover,
  });

  if (imgSrc !== null) {
    imgSrcs.push(imgSrc);
  }

  initScreens(imgSrcs.length);

  await initBackgroundTexture(imgSrcs);
  initSampleTexture();

  resize();
  requestAnimationFrame(render);

  window.addEventListener('resize', resize);
}


function move(delta) {
  switch (type) {
    case types.VERTICAL:
      offset.y += delta;
      if (offset.y < 0) {
        offset.y = 0;
      } else if (offset.y > 8 - (2 * initialTextureOffset.y)) {
        offset.y = 8 - (2 * initialTextureOffset.y);
      }
      break;

    case types.HORIZONTAL:
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
  modes,
  types,
  move,
};
