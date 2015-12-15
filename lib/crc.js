var newc = require('./newc')

exports.size = newc.size

exports.decode = function (buf) {
  var check = newc.decodeHex(buf, 96)
  var header = newc.decode(buf)

  header.checksum = check

  return header
}
