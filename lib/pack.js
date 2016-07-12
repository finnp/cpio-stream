var util = require('util')
var constants = require('constants')
var eos = require('end-of-stream')
var Readable = require('stream').Readable
var Writable = require('stream').Writable

var END_OF_CPIO = {name: "TRAILER!!!"}

module.exports = Pack

var Sink = function (to) {
  Writable.call(this)
  this.written = 0
  this._to = to
  this._destroyed = false
}

util.inherits(Sink, Writable)

Sink.prototype._write = function (data, enc, cb) {
  this.written += data.length
  if (this._to._push(data)) return cb()
  this._to._drain = cb
}

Sink.prototype.destroy = function () {
  if (this._destroyed) return
  this._destroyed = true
  this.emit('close')
}

function Pack (opts) {
  if (!(this instanceof Pack)) return new Pack(opts)
  Readable.call(this, opts)

  this.newc = opts && opts.format === "newc"

  if (this.newc)
    this._encode = require("./newc").encode
  else
    this._encode = require("./odc").encode

  this.padding = 512
  this._ino = 1 // cpio on mac just increases this one every time

  this._stream = null
  this._finalized = false
  this._finalizing = false
  this._destroyed = false
  this._drain = noop
  this._size = 0
}

util.inherits(Pack, Readable)

Pack.prototype.entry = function (header, buffer, callback) {
  if (this._stream) throw new Error('already piping an entry')
  if (this._finalized || this._destroyed) return

  if (typeof buffer === 'function') {
    callback = buffer
    buffer = null
  }

  if (header.linkname) buffer = new Buffer(header.linkname)

  var self = this

  if (!callback) callback = noop

  if (!header.dev) header.dev = parseInt(777777, 8)
  if (!header.ino) header.ino = this._ino++
  if (!header.mode) header.mode = parseInt(100644, 8)
  if (!header.uid) header.uid = 0
  if (!header.gid) header.gid = 0
  if (!header.nlink) header.nlink = 1
  if (!header.rdev) header.rdev = 0
  if (!header.mtime) header.mtime = new Date()
  if (!header.size) header.size = 0
  if (!header.rdevmajor) header.rdevmajor = 0
  if (!header.rdevminor) header.rdevminor = header.rdev
  if (!header.devmajor) header.devmajor = 0
  if (!header.devminor) header.devminor = header.dev

  if (header.type) header.mode = typeToMode(header.type, header.mode)

  if (typeof buffer === 'string') buffer = new Buffer(buffer)
  if (Buffer.isBuffer(buffer)) {
    header.size = buffer.length

    this._push(this._encode(header))
    this._push(buffer)
    // if(buffer.length % 2 !== 0) this._push(new Buffer('\0'))
    if (this.newc) {
      var mod4 = buffer.length % 4
      var paddinglength = (4 - mod4) % 4
      this._push(Buffer.from( new Array(paddinglength + 1).join("\0") ))
    }

    process.nextTick(callback)
    return new Void()
  }

  this._push(this._encode(header))

  if ((header.mode & constants.S_IFMT) !== constants.S_IFREG) {
    process.nextTick(callback)
    return new Void()
  }

  var sink = new Sink(this)

  this._stream = sink

  eos(sink, function (err) {
    self._stream = null

    if (err) {
      self.destroy()
      return callback(err)
    }

    if (sink.written !== header.size) {
      self.destroy()
      return callback(new Error('size mismatch'))
    }

    // if(sink.written % 2 !== 0) self._push(new Buffer('\0'))
    if (self.newc) {
      var mod4 = sink.written % 4
      var paddinglength = (4 - mod4) % 4
      self._push(Buffer.from( new Array(paddinglength + 1).join("\0") ))
    }

    if (self._finalizing) self.finalize()
    callback()
  })

  return sink
}

var Void = function () {
  Writable.call(this)
  this._destroyed = false
}

util.inherits(Void, Writable)

Void.prototype._write = function (data, enc, cb) {
  cb(new Error('No body allowed for this entry'))
}

Void.prototype.destroy = function () {
  if (this._destroyed) return
  this._destroyed = true
  this.emit('close')
}

Pack.prototype.finalize = function () {
  if (this._stream) {
    this._finalizing = true
    return
  }

  if (this._finalized) return

  this._push(this._encode(END_OF_CPIO))

  var fill = new Buffer(this.padding)
  fill.fill(0)
  this.push(fill.slice(0, this.padding - this._size))

  this.push(null)
}

Pack.prototype._push = function (data) {
  this._size += data.length
  if (this._size >= this.padding) this._push = this.push

  return this.push(data)
}

Pack.prototype.destroy = function (err) {
  if (this._destroyed) return
  this._destroyed = true

  if (err) this.emit('error', err)
  this.emit('close')
  if (this._stream && this._stream.destroy) this._stream.destroy()
}

Pack.prototype._read = function (size) {
  var drain = this._drain
  this._drain = noop
  drain()
}

function noop () {}

var MASK = parseInt(7777, 8)

function typeToMode (type, mode) {
  var value = 0
  if (type === 'file') value = constants.S_IFREG
  if (type === 'directory') value = constants.S_IFDIR
  if (type === 'symlink') value = constants.S_IFLNK
  if (type === 'socket') value = constants.S_IFSOCK
  if (type === 'block-device') value = constants.S_IFBLK
  if (type === 'character-device') value = constants.S_IFCHR
  if (type === 'fifo') value = constants.S_IFIFO
  return (value || (constants.S_IFMT & mode)) | (MASK & mode)
}
