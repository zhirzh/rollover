export function initWebGL(canvas) {
  const gl = canvas.getContext('webgl');
  gl.clearColor(0, 0, 0, 1);

  return gl;
}


async function fetchShader(gl, id) {
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


export function fetchShaders(gl, ...shaderIDs) {
  return Promise.all(shaderIDs.map(shaderId => fetchShader(gl, shaderId)));
}


export async function initProgram(gl, { vertexShaderID, fragmentShaderID, attributes, uniforms }) {
  const program = gl.createProgram();

  try {
    const shaders = await fetchShaders(gl, vertexShaderID, fragmentShaderID);
    shaders.forEach(shader => gl.attachShader(program, shader));
  } catch (e) {
    throw e;
  }

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }

  gl.useProgram(program);

  attributes.forEach((attribute) => {
    program[attribute] = gl.getAttribLocation(program, attribute);
    gl.enableVertexAttribArray(program[attribute]);
  });

  uniforms.forEach((uniform) => {
    program[uniform] = gl.getUniformLocation(program, uniform);
  });

  return program;
}


function loadTile(imgSrc) {
  return new Promise((res) => {
    const img = new Image();
    img.src = imgSrc;
    img.onload = () => res(img);
  });
}


export function loadTiles(imgSrcs) {
  return Promise.all(imgSrcs.map(loadTile));
}


export function glBuffer(gl, target, data, usage, config = {}) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  for (const [k, v] of Object.entries(config)) {
    buffer[k] = v;
  }

  return buffer;
}
