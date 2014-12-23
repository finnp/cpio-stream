exports.encode = function (opts) {
  opts.name = padEven(opts.name)
  if(opts.size % 2 !== 0) opts.size++
  
  var buf = new Buffer(54 + 22 + opts.name.length)

  buf.write('070707', 0)
  buf.write(encodeOct(opts.dev, 6), 6)
  buf.write(encodeOct(opts.ino, 6), 12)
  buf.write(opts.mode.toString(8), 18)
  buf.write(encodeOct(opts.uid, 6), 24)
  buf.write(encodeOct(opts.gid, 6), 30)
  buf.write(encodeOct(opts.nlink, 6), 36)
  buf.write(encodeOct(opts.rdev, 6), 42)
  buf.write(encodeOct(opts.mtime.getTime() / 1000, 11), 48)
  buf.write(encodeOct(opts.name.length, 6), 59)
  buf.write(encodeOct(opts.size, 11), 65)
  buf.write(opts.name, 76)
  return buf
}

function encodeOct(number, bytes) {
  var str = (Math.min(number, Math.pow(8,bytes) - 1)).toString(8)
  str = Array(bytes - str.length + 1).join('0') + str
  return str
}

function padEven(name) {
  if(name % 2 === 0) return name
  return name + '\0'
}
