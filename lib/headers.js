var crc  = require('./crc')
var newc = require('./newc')
var odc  = require('./odc')


exports.encode = odc.encode

exports.type = function (buf) {
  var type

  if(parseInt(buf.toString('ascii', 0, 2), 256) === 070707)
    throw new Error('Old Binary format is not supported')

  var magic = buf.toString('ascii', 0, 6)
  switch(magic)
  {
    // Big endianess

    case '070707':  // Portable ASCII format
      type = odc
    break

    case '070701':  // New ASCII format
      type = newc
    break

    case '070702':  // New CRC format, same as new ASCII format but with check
      type = crc
    break

    // Small endianess

    case '707070':  // Portable ASCII format
    case '707010':  // New ASCII format
    case '707020':  // New CRC format, same as new ASCII format but with check
      throw new Error('Small endianess not supported')
    break

    // Unknown magic number

    default:
      throw new Error('Not a cpio (magic = "'+magic+'")')
  }

  buf.consume(6)
  return type
}
