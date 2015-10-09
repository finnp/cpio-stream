exports.size = 104

exports.decode = function (buf) {
  var header = {}

  header.ino         = decodeHex(buf)
  header.mode        = decodeHex(buf, 8)
  header.uid         = decodeHex(buf, 16)
  header.gid         = decodeHex(buf, 24)
  header.nlink       = decodeHex(buf, 32)
  header.mtime       = new Date(decodeHex(buf, 40) * 1000)
  header.size        = decodeHex(buf, 48)
  header.devmajor    = decodeHex(buf, 56)
  header.devminor    = decodeHex(buf, 64)
  header.rdevmajor   = decodeHex(buf, 72)
  header.rdevminor   = decodeHex(buf, 80)
  header._nameLength = decodeHex(buf, 88)

  header._sizeStrike = header.size        + 4 - (header.size % 4 || 4)
  header._nameStrike = header._nameLength + 4 - ((6+exports.size+header._nameLength) % 4 || 4)

  buf.consume(exports.size)
  return header
}


function decodeHex (buf, pos, n) {
  pos = pos || 0
  n = n || 8
  return parseInt(buf.toString('ascii', pos, pos + n), 16)
}


exports.decodeHex = decodeHex
