/* jshint node: true */

'use strict'

var bl = require('bl'),
  util = require('util'),
  log = require('loglevel'),
  headers = require('./headers'),
  Writable = require('stream').Writable,
  PassThrough = require('stream').PassThrough

/**
 * Extract function name from function
 */
var fnname = function (fn) {
  var s = '' + fn
  return s.split(/\s+/).slice(1, 3)
}

/**
 * @method hex
 * @param {Number} anything
 * @return dec and hex representation of n
 */
var hex = function (n) {
  return n + '(0x' + n.toString(16) + ')'
}

var noop = function () {
  return undefined
}

var Source = function (self, offset) {
  log.debug('Creating new source(' + self + ', ' + offset + ')')
  this.parent = self
  this.offset = offset
  PassThrough.call(this)
}

var emptyStream = function (self, offset) {
  var s = new Source(self, offset)
  s.end()
  return s
}

util.inherits(Source, PassThrough)

Source.prototype.destroy = function (err) {
  this.parent.destroy(err)
}

var Extract = function (opts) {
  if (!(this instanceof Extract)) {
    return new Extract(opts)
  }
  Writable.call(this, opts)

  this.offset = 0
  this.buffer = bl()
  this.missing = 0
  this.onparse = noop
  this.codec = headers.odc
  this.header = null
  this.stream = null
  this.overflow = null
  this.cb = null
  this.locked = false
  this.destroyed = false
  this.consumed = 0

  var self = this

  function oncontinue () {
    log.debug('oncontinue()')
    self.cont()
  }

  function onunlock (err) {
    self.locked = false
    if (err) {
      return self.destroy(err)
    }
    if (!self.stream) {
      oncontinue()
    }
  }

  function onstreamend () {
    self.stream = null
    // Padding must happen on absolute position of name, not on length
    // of name
    // Current position is header + padded name + fileSize
    var c = self.codec,
      h = self.header,
      fs = h.fileSize,
      fsa = c.alignedFileSize(h)
    log.debug('Padding fileSize from ' + hex(fs) +
      ' to ' + hex(fsa))
    log.debug('onstreamend(): consuming ' + hex(fsa) +
      ' bytes')
    log.debug('Buffer before consumption:' + self.buffer)
    self.buffer.consume(fsa)
    self.consumed += fsa
    log.debug('Consumed: ' + hex(self.consumed) + ', offset: ' +
      hex(self.offset))
    // TODO
    self.parseTransparent(headers.odc.magic.length, onmagic)
    // self.parse(headers.odc.magic.length, onmagic)
    if (!self.locked) {
      oncontinue()
    }
  }

  function onname () {
    log.debug('onname()')
    var header = self.header,
      ns = header.nameSize,
      codec = self.codec,
      b = self.buffer,
      nsa = codec.alignedName(header)
    try {
      log.debug('onname(): slicing from 0 to ' + hex(ns))
      self.header.name = b.slice(0, ns - 1).toString('ascii')
      log.debug('onname(): name = ' + self.header.name)
    } catch (err) {
      log.debug('onname(): error ' + err)
      self.emit('error', err)
    }

    log.debug('Padding name length from ' + hex(ns) +
      ' to ' +
      hex(nsa) +
      ' for codec ' + codec.id)
    log.debug('onname(): consuming ' + hex(nsa) + ' bytes')
    b.consume(nsa)
    self.consumed += nsa
    log.debug('Consumed: ' + hex(self.consumed) + ', offset: ' +
      hex(self.offset))

    if (header.name === 'TRAILER!!!') {
      log.debug('self = ' + self)
      log.debug('self.cb = ' + self.cb)
      // TODO self.cb is undefined
      if (self.cb === undefined) {
        return
      }
      return self.cb()
    }

    if (self.header.fileSize === 0) {
      log.debug('onname(): fileSize = 0, parse=(' +
        hex(codec.length) +
        ', onmagic)')
      self.parse(codec.length, onheader)
      self.emit('entry', header, emptyStream(self, self.offset),
        onunlock)
      return
    }

    self.stream = new Source(self, self.offset)
    self.emit('entry', self.header, self.stream, onunlock)
    self.locked = true
    self.parse(codec.alignedFileSize(header), onstreamend)
    oncontinue()
  }

  function onheader () {
    log.debug('onheader()')
    var b = self.buffer,
      header,
      codec = self.codec
    try {
      header = self.header = codec.decode(b.slice(0, codec.length))
      log.debug('onheader(): decoded header ' +
        JSON.stringify(header))
    } catch (err) {
      self.emit('error', err)
    }
    b.consume(codec.length)
    self.consumed += codec.length
    log.debug('Consumed: ' + hex(self.consumed) + ', offset: ' +
      hex(self.offset))
    log.debug('onheader(): Buffer after consuming ' + hex(codec.length) +
      ' bytes: ' + b)
    log.debug('onheader(): Length: ' + hex(b.length))
    if (!header) {
      log.debug('onheader(): No header!')
      // TODO
      // self.parseTransparent(codec.length, onmagic)
      self.parse(codec.length, onmagic)
      oncontinue()
      return
    }

    self.parse(codec.alignedName(header), onname)
    oncontinue()
  }

  function onmagic () {
    log.debug('onmagic()')
    try {
      self.codec = headers.codec(self.buffer)
      log.debug('Installing codec ' + JSON.stringify(
          self.codec))
    } catch (err) {
      self.emit('error', err)
    }
    // Do not consume anything, just keep going with the rest of header
    self.parse(self.codec.length - self.codec.magic.length,
      onheader)
    oncontinue()
  }

  // TODO this.parse(headers.size, onheader)
  this.parseTransparent(headers.odc.magic.length, onmagic)
}

util.inherits(Extract, Writable)

Extract.prototype.destroy = function (err) {
  if (this.destroyed) {
    return
  }
  this.destroyed = true

  if (err) {
    this.emit('error', err)
  }
  this.emit('close')
  if (this.stream) {
    this.stream.emit('close')
  }
}

Extract.prototype.parse = function (size, onparse) {
  if (this.destroyed) {
    return
  }
  log.debug('----------\nparse(): offset = ' + hex(this.offset))
  this.offset += size
  log.debug('parse(): Progressing offset to ' + hex(this.offset))
  this.missing = size
  log.debug('parse(): missing = ' + hex(this.missing))
  this.onparse = onparse
// log.debug('parse(): onparse = ' + onparse)
}

Extract.prototype.parseTransparent =
  function (size, onparse) {
    if (this.destroyed) {
      return
    }
    log.debug('----------\nparseTransparent(): Not progressing offset')
    log.debug('parseTransparent(): offset = ' +
      hex(this.offset))
    this.missing = size
    log.debug('parseTransparent(): missing = ' +
      hex(this.missing))
    this.onparse = onparse
  }

Extract.prototype.cont = function (err) {
  log.debug('cont()')
  if (this.destroyed) {
    return
  }
  var cb = this.cb
  this.cb = noop
  if (this.overflow) {
    this._write(this.overflow, undefined, cb)
  } else {
    log.debug('cont(): calling cb() = ' + cb)
    cb()
  }
}

Extract.prototype._write = function (data, enc, cb) {
  log.debug('write() callback')
  if (this.destroyed) {
    return
  }

  var s = this.stream
  var b = this.buffer
  var missing = this.missing

  log.debug('write(): data.length = ' +
    hex(data.length) +
    ', missing = ' +
    hex(missing))
    // we do not reach end-of-chunk now. just forward it

  if (data.length < missing) {
    log.debug('write(): need ' + hex(
        missing) +
      ' bytes but received only ' +
      hex(data.length) +
      ', passing...'
    )
    this.missing -= data.length
    this.overflow = null
    if (s) {
      log.debug('Writing data to stream, cb = ' + cb)
      return s.write(data, cb)
    }
    log.debug('Appending partial chunk')
    b.append(data)
    if (cb) {
      return cb()
    }
    return
  }

  // end-of-chunk. the parser should call cb.
  log.debug('write(): end of chunk')
  log.debug('Saving cb = ' + cb + ' for later.')
  this.cb = cb
  this.missing = 0

  var overflow = null
  if (data.length > missing) {
    overflow = data.slice(missing)
    log.debug('Saved overflow')
    data = data.slice(0, missing)
  }

  if (s) {
    s.end(data)
  } else {
    log.debug('Appending complete chunk')
    b.append(data)
  // log.debug('Buffer after append(): ' + b)
  }
  this.overflow = overflow
  log.debug('Continueing with function ' + fnname(this.onparse))
  this.onparse()
}

module.exports = Extract
