export function zip(...arrs) {
  const minLen = Math.min(...arrs.map(a => a.length));

  const arr = [];
  for (let i = 0; i < minLen; i += 1) {
    const x = arrs.map(a => a[i]);
    arr.push(x);
  }

  return arr;
}
