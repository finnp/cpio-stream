var util = require('util')
var eos = require('end-of-stream')
var Readable = require('stream').Readable
var Writable = require('stream').Writable
var headers = require('./headers.js')

// this could also be encoded through headers
var END_OF_CPIO = new Buffer('0707070000000000000000000000000000000000010000000000000000000001300000000000TRAILER!!!')


module.exports = Pack

var Sink = function(to) {
  Writable.call(this)
  this.written = 0
  this._to = to
  this._destroyed = false
}

util.inherits(Sink, Writable)

Sink.prototype._write = function(data, enc, cb) {
  this.written += data.length
  if (this._to._push(data)) return cb()
  this._to._drain = cb
}

Sink.prototype.destroy = function() {
  if (this._destroyed) return
  this._destroyed = true
  this.emit('close')
}



function Pack(opts) {
  if (!(this instanceof Pack)) return new Pack(opts)
  Readable.call(this, opts)

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


Pack.prototype.entry = function(header, buffer, callback) {
  if (this._stream) throw new Error('already piping an entry')
  if (this._finalized || this._destroyed) return

  if (typeof buffer === 'function') {
    callback = buffer
    buffer = null
  }

  var self = this

  if (!callback) callback = noop

  if (!header.dev) header.dev = 0777777
  if (!header.ino) header.ino = this._ino++
    if (!header.mode) header.mode = 0100644 // make this compatible with tar-stream?
  if (!header.uid) header.uid = 0
  if (!header.gid) header.gid = 0
  if (!header.nlink) header.nlink = 1
  if (!header.rdev) header.rdev = 0
  if (!header.mtime) header.mtime = new Date()
  if (!header.fileSize) header.fileSize = 0

  if (typeof buffer === 'string') buffer = new Buffer(buffer)
  if (Buffer.isBuffer(buffer)) {
    header.fileSize = buffer.length

    this._push(headers.encode(header))
    this._push(buffer)
    if (buffer.length % 2 !== 0) this._push(new Buffer('\0'))

    process.nextTick(callback)
    return new Void()
  }

  this._push(headers.encode(header))

  if (header.mode & 0170000 !== 0100000) {
    process.nextTick(callback)
    return new Void()
  }

  var sink = new Sink(this)

  this._stream = sink

  eos(sink, function(err) {
    self._stream = null

    if (err) {
      self.destroy()
      return callback(err)
    }

    if (sink.written !== header.fileSize) {
      self.destroy()
      return callback(new Error('size mismatch'))
    }

    if (sink.written % 2 !== 0) self._push('\0')

    if (self._finalizing) self.finalize()
    callback()
  })

  return sink
}

var Void = function() {
  Writable.call(this)
  this._destroyed = false
}

util.inherits(Void, Writable)

Void.prototype._write = function(data, enc, cb) {
  cb(new Error('No body allowed for this entry'))
}

Void.prototype.destroy = function() {
  if (this._destroyed) return
  this._destroyed = true
  this.emit('close')
}

Pack.prototype.finalize = function() {
  if (this._stream) {
    this._finalizing = true
    return
  }

  if (this._finalized) return

  this._push(END_OF_CPIO)

  var fill = new Buffer(this.padding)
  fill.fill(0)
  this.push(fill.slice(0, this.padding - this._size))

  this.push(null)
}

Pack.prototype._push = function(data) {
  this._size += data.length
  if (this._size >= this.padding) this._push = this.push

  return this.push(data)
}


Pack.prototype.destroy = function(err) {
  if (this._destroyed) return
  this._destroyed = true

  if (err) this.emit('error', err)
  this.emit('close')
  if (this._stream && this._stream.destroy) this._stream.destroy()
}

Pack.prototype._read = function(size) {
  var drain = this._drain
  this._drain = noop
  drain()
}

function noop() {}