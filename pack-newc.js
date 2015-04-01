/* jshint bitwise: false */

'use strict'

var eos = require('end-of-stream'),
  util = require('util'),
  headers = require('./headers'),
  Pack = require('./pack').Pack,
  Sink = require('./pack').Sink,
  Void = require('./pack').Void,

  noop = function noop () {}

function PackNewc (opts) {
  if (!(this instanceof PackNewc)) {
    return new PackNewc(opts)
  }

  Pack.call(this)
}

PackNewc.prototype.entry = function (header, buffer, callback) {
  if (this._stream) {
    throw new Error('already piping an entry')
  }
  if (this._finalized || this._destroyed) {
    return
  }

  if (typeof buffer === 'function') {
    callback = buffer
    buffer = null
  }

  var self = this

  if (!callback) {
    callback = noop
  }

  if (!header.ino) {
    header.ino = this._ino++
  }
  if (!header.mode) {
    // octal 0100644
    // make this compatible with tar-stream?
    header.mode = 33188
  }
  if (!header.uid) {
    header.uid = 0
  }
  if (!header.gid) {
    header.gid = 0
  }
  if (!header.nlink) {
    header.nlink = 1
  }
  if (!header.mtime) {
    header.mtime = new Date()
  }
  if (!header.fileSize) {
    header.fileSize = 0
  }
  if (!header.devmajor) {
    header.devmajor = 0
  }
  if (!header.devminor) {
    header.devminor = 0
  }
  if (!header.rdevmajor) {
    header.rdevmajor = 0
  }
  if (!header.rdevminor) {
    header.rdevminor = 0
  }
  if (!header.nameSize) {
    header.nameSize = 0
  }
  if (!header.check) {
    header.check = 0
  }

  if (typeof buffer === 'string') {
    buffer = new Buffer(buffer)
  }
  if (Buffer.isBuffer(buffer)) {
    header.fileSize = buffer.length

    this._push(this.codec.encode(header))
    this._push(buffer)
    if (buffer.length % 2 !== 0) {
      this._push(new Buffer('\0'))
    }
    process.nextTick(callback)
    return new Void()
  }

  this._push(headers.encode(header))

  // 0170000 == 61440
  // 0100000 == 32768
  if ((header.mode & 61440) !== 32768) {
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

    if (sink.written !== header.fileSize) {
      self.destroy()
      return callback(new Error('size mismatch'))
    }

    if (sink.written % 2 !== 0) {
      self._push('\0')
    }
    if (self._finalizing) {
      self.finalize()
    }
    callback()
  })

  return sink
}

util.inherits(PackNewc, Pack)

exports.PackNewc = PackNewc
