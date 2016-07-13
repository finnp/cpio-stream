exports.size = 70

exports.encode = function (opts) {
  if (opts.name[opts.name.length - 1] !== '\0') {
    opts.name += '\0'
  }

  var buf = new Buffer(54 + 22 + opts.name.length)
  if (opts.mtime instanceof Date) {
    opts.mtime = Math.round(opts.mtime.getTime() / 1000)
  }

  buf.write('070707', 0)
  buf.write(encodeOct(opts.dev, 6), 6)
  buf.write(encodeOct(opts.ino, 6), 12)
  buf.write(encodeOct(opts.mode, 6), 18)
  buf.write(encodeOct(opts.uid, 6), 24)
  buf.write(encodeOct(opts.gid, 6), 30)
  buf.write(encodeOct(opts.nlink, 6), 36)
  buf.write(encodeOct(opts.rdev, 6), 42)
  buf.write(encodeOct(opts.mtime, 11), 48)
  buf.write(encodeOct(opts.name.length, 6), 59)
  buf.write(encodeOct(opts.size, 11), 65)
  buf.write(opts.name, 76)

  return buf
}

exports.decode = function (buf) {
  var header = {}

  header.dev = decodeOct(buf)
  header.ino = decodeOct(buf, 6)
  header.mode = decodeOct(buf, 12)
  header.uid = decodeOct(buf, 18)
  header.gid = decodeOct(buf, 24)
  header.nlink = decodeOct(buf, 30)
  header.rdev = decodeOct(buf, 36)
  header.mtime = new Date(decodeOct(buf, 42, 11) * 1000)
  header._nameLength = decodeOct(buf, 53)
  header.size = decodeOct(buf, 59, 11)

  header._sizeStrike = header.size
  header._nameStrike = header._nameLength

  buf.consume(exports.size)
  return header
}

function decodeOct (buf, pos, n) {
  pos = pos || 0
  n = n || 6
  return parseInt(buf.toString('ascii', pos, pos + n), 8)
}

function encodeOct (number, bytes) {
  number = number || 0
  var str = (Math.min(number, Math.pow(8, bytes) - 1)).toString(8)
  str = Array(bytes - str.length + 1).join('0') + str
  return str
}
