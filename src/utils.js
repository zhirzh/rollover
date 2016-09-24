const Screen = {
  texture: undefined,
  vertexPositionBuffer: [],
  textureCoordBuffer: [],
  indexBuffer: [],
};

function newScreen() {
  return Object.assign(Object.create(Screen), {});
}

export function newScreens(n) {
  if (n < 1) {
    return null;
  }

  if (n === 1) {
    return newScreen();
  }

  const screens = [];
  while (n > 0) {
    screens.push(newScreen());
    n -= 1;
  }

  return screens;
}
