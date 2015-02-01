var util = require('util');
var bl = require('bl');
var headers = require('./headers');

var Writable = require('stream').Writable;
var PassThrough = require('stream').PassThrough;

var noop = function() {};

var Source = function(self, offset) {
  this._parent = self;
  this.offset = offset;
  PassThrough.call(this);
};

var emptyStream = function(self, offset) {
  var s = new Source(self, offset);
  s.end();
  return s;
};

util.inherits(Source, PassThrough);

Source.prototype.destroy = function(err) {
  this._parent.destroy(err);
};

var Extract = function(opts) {
  if (!(this instanceof Extract)) return new Extract(opts);
  Writable.call(this, opts);

  this._offset = 0;
  this._buffer = bl();
  this._missing = 0;
  this._onparse = noop;
  this._codec = headers.odc;
  this._header = null;
  this._stream = null;
  this._overflow = null;
  this._cb = null;
  this._locked = false;
  this._destroyed = false;

  var self = this;
  var b = self._buffer;

  function oncontinue() {
    console.log('oncontinue()');
    self._continue();
  }

  function onunlock(err) {
    self._locked = false;
    if (err) return self.destroy(err);
    if (!self._stream) oncontinue();
  }

  function onstreamend() {
    self._stream = null;
    // Padding must happen on absolute position of name, not on length of name
    // Current position is header + padded name + fileSize
    var c = self._codec;
    var h = self._header;
    var pos = c.length + c.padIndex(h.name.length) + h.fileSize;
    var p = c.padIndex(pos);
    // Number of bytes to consume: original size + pad
    var n = h.fileSize + (p - pos);
    console.log(`Padding fileSize from ${pos} to ${p}`);
    console.log(`onstreamend(): consuming ${n} bytes`);
    self._buffer.consume(n);
    self._parseTransparent(headers.odc.magic.length, onmagic);
    if (!self._locked) oncontinue();
  }

  function onmagic() {
    console.log('onmagic()');
    try {
      self._codec = headers.codec(self._buffer);
      console.log('Installing codec ' + JSON.stringify(self._codec));
    } catch (err) {
      self.emit('error', err);
    }
    // Do not consume anything, just keep going with the rest of header
    self._parse(self._codec.length - self._codec.magic.length, onheader);
    oncontinue();
  }

  function onheader() {
    console.log('onheader()');
    var b = self._buffer;
    var header;
    var codec = self._codec;
    try {
      header = self._header = codec.decode(b.slice(0, codec.length));
      console.log('onheader(): decoded header ' + JSON.stringify(header));
    } catch (err) {
      self.emit('error', err);
    }
    b.consume(codec.length);
    console.log('Buffer after consuming ' + codec.length + ' bytes: ' + b);
    console.log('Length: ' + b.length);
    if (!header) {
      self._parseTransparent(codec.length, onmagic);
      oncontinue();
      return;
    }

    self._parse(header.nameSize, onname);
    oncontinue();
  }

  function onname() {
    console.log('onname()');
    var header = self._header;
    var codec = self._codec;
    var b = self._buffer;
    try {
      console.log('onname(): slicing ' + b + ' from 0 to ' + header.nameSize);
      self._header.name = b.slice(0, header.nameSize - 1).toString('ascii');
      console.log('onname(): name = ' + self._header.name);
    } catch (err) {
      self.emit('error', err);
    }
    // Padding must happen on absolute position of name, not on length of name
    // Current position is size of header + size of name
    var pos = codec.length + header.nameSize;
    var p = codec.padIndex(pos);
    // Number of bytes to consume: original size + pad
    var n = header.nameSize + (p - pos);
    console.log(`Padding name length from ${pos} to ${p} for codec ${codec.id}`);
    console.log('onname(): consuming ' + n + ' bytes from ' + b);
    b.consume(n);

    if (header.name === 'TRAILER!!!') return this._cb();

    if (self._header.fileSize === 0) {
      console.log('onname(): fileSize = 0, _parse=(' + codec.length + ', onmagic)');
      self._parse(codec.length, onmagic);
      self.emit('entry', header, emptyStream(self, self._offset), onunlock);
      return;
    }

    self._stream = new Source(self, self._offset);
    self.emit('entry', self._header, self._stream, onunlock);
    self._locked = true;
    self._parse(self._header.fileSize, onstreamend);
    oncontinue();
  }

  //this._parse(headers.size, onheader);
  this._parseTransparent(headers.odc.magic.length, onmagic);
};

util.inherits(Extract, Writable);

Extract.prototype.destroy = function(err) {
  if (this._destroyed) return;
  this._destroyed = true;

  if (err) this.emit('error', err);
  this.emit('close');
  if (this._stream) this._stream.emit('close');
};

Extract.prototype._parse = function(size, onparse) {
  if (this._destroyed) return;
  console.log('----------\n_parse(): _offset = ' + this._offset);
  this._offset += size;
  console.log('_parse(): Progressing offset to ' + this._offset);
  this._missing = size;
  console.log('_parse(): _missing = ' + this._missing);
  this._onparse = onparse;
  // console.log('_parse(): onparse = ' + onparse);
};

Extract.prototype._parseTransparent = function(size, onparse) {
  if (this._destroyed) return;
  console.log('----------\n_parseTransparent(): Not progressing _offset');
  console.log('_parseTransparent(): _offset = ' + this._offset);
  this._missing = size;
  console.log('_parseTransparent(): _missing = ' + this._missing);
  this._onparse = onparse;
};

Extract.prototype._continue = function(err) {
  if (this._destroyed) return;
  var cb = this._cb;
  this._cb = noop;
  if (this._overflow) this._write(this._overflow, undefined, cb);
  else cb();
};

Extract.prototype._write = function(data, enc, cb) {
  if (this._destroyed) return;

  var s = this._stream;
  var b = this._buffer;
  var missing = this._missing;

  // we do not reach end-of-chunk now. just forward it

  if (data.length < missing) {
    console.log('_write(): need ' + missing + ' bytes but received only ' + data.length + ', passing...');
    this._missing -= data.length;
    this._overflow = null;
    if (s) return s.write(data, cb);
    console.log('Appending partial ' + data + ' to buffer ' + b);
    b.append(data);
    return cb();
  }

  // end-of-chunk. the parser should call cb.
  console.log('_write(): cb()');
  this._cb = cb;
  this._missing = 0;

  var overflow = null;
  if (data.length > missing) {
    overflow = data.slice(missing);
    data = data.slice(0, missing);
  }

  if (s) s.end(data);
  else {
    console.log('Appending complete ' + data + ' to buffer ' + b);
    b.append(data);
    console.log('Buffer after append(): ' + b);
  }
  this._overflow = overflow;
  this._onparse();
};

module.exports = Extract;
