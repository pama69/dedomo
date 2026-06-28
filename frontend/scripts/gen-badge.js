// Genera badge-96.png: silhouette casetta bianca su sfondo trasparente.
// Android maschera il badge col solo canale alpha → serve trasparenza + forma bianca.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 96, H = 96;

// Pentagono "casetta": tetto + pareti (coordinate su canvas 96x96)
const house = [
  [48, 10],  // apice tetto
  [86, 44],  // gronda dx
  [86, 86],  // base dx
  [10, 86],  // base sx
  [10, 44],  // gronda sx
];
// Porta (ritaglio) al centro in basso
const door = { x0: 40, y0: 58, x1: 56, y1: 86 };

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Raw scanlines RGBA con filtro 0 per riga
const raw = Buffer.alloc((W * 4 + 1) * H);
let p = 0;
for (let y = 0; y < H; y++) {
  raw[p++] = 0; // filter type
  for (let x = 0; x < W; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    const inHouse = inPoly(cx, cy, house);
    const inDoor = cx >= door.x0 && cx <= door.x1 && cy >= door.y0 && cy <= door.y1;
    const on = inHouse && !inDoor;
    raw[p++] = 255;            // R
    raw[p++] = 255;            // G
    raw[p++] = 255;            // B
    raw[p++] = on ? 255 : 0;   // A
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace

const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "public", "badge-96.png");
fs.writeFileSync(out, png);
console.log("Scritto", out, png.length, "bytes");
