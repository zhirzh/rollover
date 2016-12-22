function glBuffer(gl, target, data, usage, config = {}) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  Object.assign(buffer, config);

  return buffer;
}


class Tile {
  constructor(gl, program) {
    this.gl = gl;
    this.program = program;

    this.texture = null;
    this.vertexPositionBuffer = [];
    this.textureCoordBuffer = [];
    this.indexBuffer = [];
  }

  initDataBuffers(tileOffset = { x: 0, y: 0 }) {
    const x1 = -1 + tileOffset.x;
    const y1 = -1 + tileOffset.y;
    const x2 = x1 + 2;
    const y2 = y1 + 2;

    this.vertexPositionBuffer = glBuffer(
      this.gl,
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        x1, y1,
        x2, y1,
        x2, y2,
        x1, y2,
      ]),
      this.gl.STATIC_DRAW,
      {
        itemSize: 2,
        numItems: 4,
      });

    this.textureCoordBuffer = glBuffer(
      this.gl,
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 1,
      ]),
      this.gl.STATIC_DRAW,
      {
        itemSize: 2,
        numItems: 4,
      });

    this.indexBuffer = glBuffer(
      this.gl,
      this.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([
        0, 1, 2,
        0, 2, 3,
      ]),
      this.gl.STATIC_DRAW,
      {
        itemSize: 1,
        numItems: 6,
      });
  }

  render() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexPositionBuffer);
    this.gl.vertexAttribPointer(this.program.aVertexPosition, this.vertexPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.vertexAttribPointer(this.program.aTextureCoord, this.textureCoordBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.gl.drawElements(this.gl.TRIANGLES, this.indexBuffer.numItems, this.gl.UNSIGNED_SHORT, 0);
  }
}


class Screen extends Tile {
  constructor(gl, program, width, height, n = 0) {
    super(gl, program);

    this.gl = gl;
    this.program = program;

    this.frameBuffer = null;
    this.width = width;
    this.height = height;

    this.tiles = [];
    for (let i = 0; i < n; i += 1) {
      this.tiles.push(new Tile(this.gl, this.program));
    }
  }

  render() {
    if (this.tiles.length === 0) {
      super.render();
      return;
    }

    this.tiles.forEach(tile => tile.render());
  }
}

export default Screen;
