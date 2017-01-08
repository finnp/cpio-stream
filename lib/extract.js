var constants = require('constants')
var util = require('util')
var bl = require('bl')
var headers = require('./headers')

var Writable = require('stream').Writable
var PassThrough = require('stream').PassThrough

var noop = function () {}

var emptyStream = function (self, offset) {
  var s = new Source(self, offset)
  s.end()
  return s
}

var Source = function (self, offset) {
  this._parent = self
  this.offset = offset
  PassThrough.call(this)
}

util.inherits(Source, PassThrough)

Source.prototype.destroy = function (err) {
  this._parent.destroy(err)
}

var Extract = function (opts) {
  if (!(this instanceof Extract)) return new Extract(opts)
  Writable.call(this, opts)

  var type

  this._offset = 0
  this._buffer = bl()
  this._strike = 0
  this._missing = 0
  this._onparse = noop
  this._header = null
  this._stream = null
  this._overflow = null
  this._cb = null
  this._locked = false
  this._destroyed = false
  this._end = false

  var self = this

  function oncontinue () {
    self._continue()
  }

  function onunlock (err) {
    self._locked = false
    if (err) return self.destroy(err)
    if (!self._stream) oncontinue()
  }

  function ontype () {
    try {
      type = headers.type(self._buffer)
    } catch (err) {
      self.emit('error', err)
    }

    if (type) this._parse(type.size, onheader)
    else this._parse(6, ontype)

    oncontinue()
  }

  function onheader () {
    try {
      var header = self._header = type.decode(self._buffer)
    } catch (err) {
      self.emit('error', err)
    }

    if (header) {
      header.type = typeFromMode(header.mode)
      this._parse(header._nameStrike, onname)
    } else {
      this._parse(type.size, onheader)
    }

    oncontinue()
  }

  function onsymlink () {
    var b = self._buffer
    var header = self._header
    var data = b.slice(0, header.size)
    try {
      header.linkname = data.toString()
      b.consume(header.size)
    } catch (err) {
      self.emit('error', err)
    }
    self.emit('entry', header, emptyStream(self, self._offset), function () {
      self._parse(6, ontype)
      oncontinue()
    })
  }

  function onname () {
    var header = self._header
    var b = self._buffer

    try {
      header.name = b.slice(0, header._nameLength - 1).toString('ascii')
      b.consume(header._nameStrike)
    } catch (err) {
      self.emit('error', err)
    }

    if (header.name === 'TRAILER!!!') {
      self._onparse = noop
      self._end = true
      return oncontinue()
    }

    if (header.size === 0) {
      self.emit('entry', header, emptyStream(self, self._offset), onunlock)
      return self._parse(6, ontype)
    }

    if (header.type === 'symlink') {
      self._parse(header._sizeStrike, onsymlink, header.size)
      return oncontinue()
    }

    self._stream = new Source(self, self._offset)
    self.emit('entry', header, self._stream, onunlock)

    self._locked = true
    self._parse(header._sizeStrike, onstreamend, header.size)
    oncontinue()
  }

  function onstreamend () {
    self._stream = null

    self._parse(6, ontype)
    if (!self._locked) oncontinue()
  }

  this._parse(6, ontype)
}
util.inherits(Extract, Writable)

Extract.prototype.destroy = function (err) {
  if (this._destroyed) return
  this._destroyed = true

  if (err) this.emit('error', err)
  this.emit('close')
  if (this._stream) this._stream.emit('close')
}

Extract.prototype._parse = function (strike, onparse, size) {
  if (this._destroyed) return
  this._offset += strike
  this._strike = strike
  this._missing = size || strike
  this._onparse = onparse
}

Extract.prototype._continue = function () {
  if (this._destroyed) return
  var cb = this._cb
  this._cb = noop
  if (this._overflow) this._write(this._overflow, undefined, cb)
  else cb()
}

Extract.prototype._write = function (data, enc, cb) {
  if (this._destroyed) return
  if (this._end) return cb() // ignore write after end

  var s = this._stream
  var b = this._buffer

  var strike = this._strike
  var missing = this._missing

  this._overflow = null

  // we do not reach end-of-chunk now. just forward it
  if (data.length < missing) {
    this._strike -= data.length
    this._missing -= data.length

    if (s) {
      s.write(data, cb)
    } else {
      b.append(data)
      cb()
    }

    return
  }

  // end-of-chunk. the parser should call cb.
  this._cb = cb
  this._missing = 0

  if (missing) {
    let data2 = data.slice(0, missing)

    if (s) s.end(data2)
    else b.append(data2)
  }

  // we did not reach strike padding
  if (data.length < strike) {
    this._strike -= data.length

    return
  }

  // end of entry file
  this._strike = 0

  this._overflow = data.slice(strike)

  this._onparse()
}

function typeFromMode (mode) {
  var cmpValue = mode & constants.S_IFMT
  if (cmpValue === constants.S_IFREG) return 'file'
  if (cmpValue === constants.S_IFDIR) return 'directory'
  if (cmpValue === constants.S_IFLNK) return 'symlink'
  if (cmpValue === constants.S_IFSOCK) return 'socket'
  if (cmpValue === constants.S_IFBLK) return 'block-device'
  if (cmpValue === constants.S_IFCHR) return 'character-device'
  if (cmpValue === constants.S_IFIFO) return 'fifo'
  return false
}

module.exports = Extract
