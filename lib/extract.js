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

  this._checksum = 0
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

    if(type)
      this._parse(type.size, onheader)
    else
      this._parse(6, ontype)

    oncontinue()
  }

  function onheader () {
    try {
      var header = self._header = type.decode(self._buffer)
    } catch (err) {
      self.emit('error', err)
    }

    if (header)
      this._parse(header._nameStrike, onname)
    else
      this._parse(type.size, onheader)

    oncontinue()
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

    if (header.name === 'TRAILER!!!') return this._cb()

    if (header.size === 0) {
      self.emit('entry', header, emptyStream(self, self._offset), onunlock)
      return self._parse(6, ontype)
    }

    self._stream = new Source(self, self._offset)
    self.emit('entry', header, self._stream, onunlock)

    self._locked = true
    self._parse(header._sizeStrike, onstreamend, header.size)
    oncontinue()
  }

  function onstreamend () {
    self._stream = null
    self._checksum &= 0xFFFFFFFF

    var check = self._header._check
    if(check !== undefined && check !== self._checksum)
      self.emit('error', 'Bad checksum "'+self._checksum+'", expected "'+check+'"')

    self._checksum = 0

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

Extract.prototype._continue = function (err) {
  if (this._destroyed) return
  var cb = this._cb
  this._cb = noop
  if (this._overflow) this._write(this._overflow, undefined, cb)
  else cb()
}

Extract.prototype._write = function (data, enc, cb) {
  if (this._destroyed) return

  var s = this._stream
  var b = this._buffer

  var strike  = this._strike
  var missing = this._missing

  this._overflow = null


  // we do not reach end-of-chunk now. just forward it

  if(data.length < strike)
  {
    this._strike  -= data.length
    this._missing -= data.length

    if(s)
    {
      data = data.slice(0, missing)
      s.write(data, cb)

      for(var i=0; i<data.length; i++)
        this._checksum += data.readUInt8(i)
    }
    else
    {
      b.append(data)
      cb()
    }

    return
  }


  // end-of-chunk. the parser should call cb.

  this._cb = cb
  this._strike  = 0
  this._missing = 0

  if(data.length > strike)
  {
    this._overflow = data.slice(strike)
    data = data.slice(0, missing)
  }

  if(s)
    s.end(data)
  else
    b.append(data)

  this._onparse()
}

module.exports = Extract
