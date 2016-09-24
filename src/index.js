import Screen from './screen';
import {
  initWebGL,
  initProgram,
  loadTiles,
} from './utils';


let fps;
let canvas;
let gl;
let last = 0;

const modes = {
  ARCTAN: 1,
  LINEAR: 2,
  PARABOLIC: 3,
  POLYNOMIAL: 4,
};

let program;

let samplingScreen;
let mainScreen;


export function initScreens(imgSrcsLength) {
  samplingScreen = new Screen(gl, program, imgSrcsLength);
  mainScreen = new Screen(gl, program);
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


function initSamplingScreen() {
  samplingScreen.tiles.forEach((tile, idx) => {
    const offset = {
      x: 0,
      y: -1 * (2 * idx),
    };

    tile.initDataBuffers(offset);
  });
}


function initMainScreen() {
  mainScreen.initDataBuffers();
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
  gl.uniform1i(program.uIsBuffer, true);
  samplingScreen.render();
}


function drawMainScreen() {
  gl.uniform1i(program.uIsBuffer, false);
  mainScreen.render();
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

  initScreens(imgSrcs.length);

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
