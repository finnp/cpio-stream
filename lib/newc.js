exports.size = 104

exports.encode = function (opts) {
  if (opts.name[opts.name.length-1] !== '\0')
    opts.name += '\0'
  var paddedName = padName(opts.name)

  var buf = new Buffer(110 + paddedName.length)
  var mtime = opts.mtime || 0
  if (mtime instanceof Date)
    mtime = Math.round(opts.mtime.getTime() / 1000)

  buf.write('070701', 0)
  buf.write(encodeHex(opts.ino || 0, 8), 6)
  buf.write(encodeHex(opts.mode || 0, 8), 14)
  buf.write(encodeHex(opts.uid || 0, 8), 22)
  buf.write(encodeHex(opts.gid || 0, 8), 30)
  buf.write(encodeHex(opts.nlink || 1, 8), 38)
  buf.write(encodeHex(mtime, 8), 46)
  buf.write(encodeHex(opts.size || 0, 8), 54)
  buf.write(encodeHex(opts.devmajor || 0, 8), 62)
  buf.write(encodeHex(opts.devminor || opts.dev || 0, 8), 70)
  buf.write(encodeHex(opts.rdevmajor || 0, 8), 78)
  buf.write(encodeHex(opts.rdevminor || opts.rdev || 0, 8), 86)
  buf.write(encodeHex(opts.name.length, 8), 94)
  buf.write(encodeHex(0, 8), 102) //check
  buf.write(paddedName, 110)

  return buf
}

exports.decode = function (buf) {
  var header = {}

  header.ino = decodeHex(buf)
  header.mode = decodeHex(buf, 8)
  header.uid = decodeHex(buf, 16)
  header.gid = decodeHex(buf, 24)
  header.nlink = decodeHex(buf, 32)
  header.mtime = new Date(decodeHex(buf, 40) * 1000)
  header.size = decodeHex(buf, 48)
  header.devmajor = decodeHex(buf, 56)
  header.devminor = decodeHex(buf, 64)
  header.rdevmajor = decodeHex(buf, 72)
  header.rdevminor = decodeHex(buf, 80)
  header._nameLength = decodeHex(buf, 88)

  header._sizeStrike = header.size + 4 - (header.size % 4 || 4)
  header._nameStrike = header._nameLength + 4 - ((6 + exports.size + header._nameLength) % 4 || 4)

  buf.consume(exports.size)
  return header
}

function decodeHex (buf, pos, n) {
  pos = pos || 0
  n = n || 8
  return parseInt(buf.toString('ascii', pos, pos + n), 16)
}

function encodeHex (number, bytes) {
  var str = (Math.min(number, Math.pow(16, bytes) - 1)).toString(16)
  str = str.toUpperCase()
  str = Array(bytes - str.length + 1).join('0') + str
  return str
}

function padName (name) {
  var modulo = (name.length + 2) % 4
  var padding = (4 - modulo) % 4
  return name + Array(padding + 1).join("\0")
}

exports.decodeHex = decodeHex
