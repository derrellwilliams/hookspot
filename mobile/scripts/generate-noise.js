// Generates a 256x256 grayscale white-noise PNG at mobile/assets/noise.png
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const W = 256, H = 256

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8; ihdr[9] = 0 // 8-bit grayscale

const raw = Buffer.alloc(H * (W + 1))
for (let y = 0; y < H; y++) {
  raw[y * (W + 1)] = 0 // filter: None
  for (let x = 0; x < W; x++) raw[y * (W + 1) + 1 + x] = Math.floor(Math.random() * 256)
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

const out = path.join(__dirname, '../assets/noise.png')
fs.writeFileSync(out, png)
console.log('Generated', out)
