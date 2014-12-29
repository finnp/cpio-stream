var util = require('util')
var bl = require('bl')
var headers = require('./headers')

var Writable = require('stream').Writable
var PassThrough = require('stream').PassThrough

var noop = function() {}

var emptyStream = function(self, offset) {
  var s = new Source(self, offset)
  s.end()
  return s
}

var Source = function(self, offset) {
  this._parent = self
  this.offset = offset
  PassThrough.call(this)
}

util.inherits(Source, PassThrough)

Source.prototype.destroy = function(err) {
  this._parent.destroy(err)
}

var Extract = function(opts) {
  if (!(this instanceof Extract)) return new Extract(opts)
  Writable.call(this, opts)

  this._offset = 0
  this._buffer = bl()
  this._missing = 0
  this._onparse = noop
  this._header = null
  this._stream = null
  this._overflow = null
  this._cb = null
  this._locked = false
  this._destroyed = false

  var self = this
  var b = self._buffer

  function oncontinue() {
    self._continue()
  }

  function onunlock(err) {
    self._locked = false
    if (err) return self.destroy(err)
    if (!self._stream) oncontinue()
  }

  function onstreamend() {
    self._stream = null
    self._buffer.consume(self._header.size)
    self._parse(headers.size, onheader)
    if (!self._locked) oncontinue()
  }

  function onheader() {
    var b = self._buffer
    var header
    try {
      header = self._header = headers.decode(b.slice(0, headers.size))
    } catch (err) {
      self.emit('error', err)
    }
    b.consume(headers.size)

    if (!header) {
      self._parse(headers.size, onheader)
      oncontinue()
      return
    }

    this._parse(header._nameLength, onname)
    oncontinue()
  }
  
  function onname() {
    var header = self._header
    var b = self._buffer
    try {
      self._header.name = b.slice(0, header._nameLength - 1).toString('ascii')
    } catch (err) {
      self.emit('error', err)
    }
    b.consume(header._nameLength)

    if(header.name === 'TRAILER!!!') return

    if (self._header.size === 0) {
      self._parse(headers.size, onheader)
      self.emit('entry', header, emptyStream(self, self._offset), onunlock)
      return
    }
    

    self._stream = new Source(self, self._offset)
    self.emit('entry', self._header, self._stream, onunlock)
    self._locked = true
    self._parse(self._header.size, onstreamend)
    oncontinue()
  }

  this._parse(headers.size, onheader)
}

util.inherits(Extract, Writable)

Extract.prototype.destroy = function(err) {
  if (this._destroyed) return
  this._destroyed = true

  if (err) this.emit('error', err)
  this.emit('close')
  if (this._stream) this._stream.emit('close')
}

Extract.prototype._parse = function(size, onparse) {
  if (this._destroyed) return
  this._offset += size
  this._missing = size
  this._onparse = onparse
}

Extract.prototype._continue = function(err) {
  if (this._destroyed) return
  var cb = this._cb
  this._cb = noop
  if (this._overflow) this._write(this._overflow, undefined, cb)
  else cb()
}

Extract.prototype._write = function(data, enc, cb) {
  if (this._destroyed) return

  var s = this._stream
  var b = this._buffer
  var missing = this._missing

  // we do not reach end-of-chunk now. just forward it

  if (data.length < missing) {
    this._missing -= data.length
    this._overflow = null
    if (s) return s.write(data, cb)
    b.append(data)
    return cb()
  }

  // end-of-chunk. the parser should call cb.

  this._cb = cb
  this._missing = 0

  var overflow = null
  if (data.length > missing) {
    overflow = data.slice(missing)
    data = data.slice(0, missing)
  }

  if (s) s.end(data)
  else b.append(data)

  this._overflow = overflow
  this._onparse()
}

module.exports = Extract