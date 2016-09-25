import {
  glBuffer,
} from './utils';


class Tile {
  constructor(gl, program) {
    this.gl = gl;
    this.program = program;

    this.texture = null;
    this.vertexPositionBuffer = [];
    this.textureCoordBuffer = [];
    this.indexBuffer = [];
  }

  initDataBuffers(offset = { x: 0, y: 0 }) {
    const x1 = -1 + offset.x;
    const y1 = -1 + offset.y;
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
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexPositionBuffer);
    this.gl.vertexAttribPointer(this.program.aVertexPosition, this.vertexPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.vertexAttribPointer(this.program.aTextureCoord, this.textureCoordBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.gl.drawElements(this.gl.TRIANGLES, this.indexBuffer.numItems, this.gl.UNSIGNED_SHORT, 0);
  }
}


export default class Screen extends Tile {
  constructor(gl, program, n = 0) {
    super();
    this.gl = gl;
    this.program = program;

    this.tilesCount = n;

    this.frameBuffer = null;

    if (n > 0) {
      this.tiles = this.initTiles();
    }
  }

  initTiles() {
    const tiles = [];
    for (let i = 0; i < this.tilesCount; i += 1) {
      tiles.push(new Tile(this.gl, this.program));
    }

    return tiles;
  }

  render() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);

    if (this.frameBuffer === null) {
      this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    } else {
      this.gl.viewport(0, 0, this.frameBuffer.width, this.frameBuffer.height);
    }

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if (this.tilesCount === 0) {
      super.render();
    } else {
      this.tiles.forEach(tile => tile.render());
    }
  }
}
