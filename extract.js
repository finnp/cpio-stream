/* jshint node: true */

"use strict";

var util = require('util');
var bl = require('bl');
var headers = require('./headers');

var Writable = require('stream').Writable;
var PassThrough = require('stream').PassThrough;

var noop = function () {
    return undefined;
};

var Source = function(self, offset) {
    this.parent = self;
    this.offset = offset;
    PassThrough.call(this);
};

var emptyStream = function (self, offset) {
    var s = new Source(self, offset);
    s.end();
    return s;
};

util.inherits(Source, PassThrough);

Source.prototype.destroy = function (err) {
    this.parent.destroy(err);
};

var Extract = function (opts) {
    if (!(this instanceof Extract)) {
        return new Extract(opts);
    }
    Writable.call(this, opts);

    this.offset = 0;
    this.buffer = bl();
    this.missing = 0;
    this.onparse = noop;
    this.codec = headers.odc;
    this.header = null;
    this.stream = null;
    this.overflow = null;
    this.cb = null;
    this.locked = false;
    this.destroyed = false;

    var self = this;

    function oncontinue() {
        console.log('oncontinue()');
        self.cont();
    }

    function onunlock(err) {
        self.locked = false;
        if (err) {
            return self.destroy(err);
        }
        if (!self.stream) {
            oncontinue();
        }
    }

    function onstreamend() {
        self.stream = null;
        // Padding must happen on absolute position of name, not on length
        // of name
        // Current position is header + padded name + fileSize
        var c = self.codec,
            h = self.header,
            pos = c.length + c.padIndex(h.name.length) + h.fileSize,
            p = c.padIndex(pos),
            // Number of bytes to consume: original size + pad
            n = h.fileSize + p - pos;
        console.log('Padding fileSize from ' + pos + ' to ' + p);
        console.log('onstreamend(): consuming ' + n + ' bytes');
        self.buffer.consume(n);
        self.parseTransparent(headers.odc.magic.length, onmagic);
        if (!self.locked) {
            oncontinue();
        }
    }

    function onname() {
        console.log('onname()');
        var header = self.header,
            ns = header.nameSize,
            codec = self.codec,
            b = self.buffer;
        try {
            console.log('onname(): slicing ' + b + ' from 0 to ' +
                ns);
            self.header.name = b.slice(0, ns - 1).toString(
                'ascii');
            console.log('onname(): name = ' + self.header.name);
        } catch (err) {
            self.emit('error', err);
        }
        // Padding must happen on absolute position of name, not on length
        // of name
        // Current position is size of header + size of name
        var pos = codec.length + ns;
        var p = codec.padIndex(pos);
        // Number of bytes to consume: original size + pad
        var n = ns + p - pos;
        console.log(
            'Padding name length from ' + pos + ' to ' + p +
            ' for codec ' + codec.id
        );
        console.log('onname(): consuming ' + n + ' bytes from ' + b);
        b.consume(n);

        if (header.name === 'TRAILER!!!') {
            return this.cb();
        }

        if (self.header.fileSize === 0) {
            console.log('onname(): fileSize = 0, parse=(' + codec.length +
                ', onmagic)');
            self.parse(codec.length, onmagic);
            self.emit('entry', header, emptyStream(self, self.offset),
                onunlock);
            return;
        }

        self.stream = new Source(self, self.offset);
        self.emit('entry', self.header, self.stream, onunlock);
        self.locked = true;
        self.parse(self.header.fileSize, onstreamend);
        oncontinue();
    }

    function onheader() {
        console.log('onheader()');
        var b = self.buffer,
            header,
            codec = self.codec;
        try {
            header = self.header = codec.decode(b.slice(0, codec.length));
            console.log('onheader(): decoded header ' + JSON.stringify(
                header));
        } catch (err) {
            self.emit('error', err);
        }
        b.consume(codec.length);
        console.log('Buffer after consuming ' + codec.length +
            ' bytes: ' + b);
        console.log('Length: ' + b.length);
        if (!header) {
            self.parseTransparent(codec.length, onmagic);
            oncontinue();
            return;
        }

        self.parse(header.nameSize, onname);
        oncontinue();
    }

    function onmagic() {
        console.log('onmagic()');
        try {
            self.codec = headers.codec(self.buffer);
            console.log('Installing codec ' + JSON.stringify(self.codec));
        } catch (err) {
            self.emit('error', err);
        }
        // Do not consume anything, just keep going with the rest of header
        self.parse(self.codec.length - self.codec.magic.length,
            onheader);
        oncontinue();
    }

    //this.parse(headers.size, onheader);
    this.parseTransparent(headers.odc.magic.length, onmagic);
};

util.inherits(Extract, Writable);

Extract.prototype.destroy = function (err) {
    if (this.destroyed) {
        return;
    }
    this.destroyed = true;

    if (err) {
        this.emit('error', err);
    }
    this.emit('close');
    if (this.stream) {
        this.stream.emit('close');
    }
};

Extract.prototype.parse = function (size, onparse) {
    if (this.destroyed) {
        return;
    }
    console.log('----------\nparse(): offset = ' + this.offset);
    this.offset += size;
    console.log('parse(): Progressing offset to ' + this.offset);
    this.missing = size;
    console.log('parse(): missing = ' + this.missing);
    this.onparse = onparse;
    // console.log('parse(): onparse = ' + onparse);
};

Extract.prototype.parseTransparent = function (size, onparse) {
    if (this.destroyed) {
        return;
    }
    console.log('----------\nparseTransparent(): Not progressing offset');
    console.log('parseTransparent(): offset = ' + this.offset);
    this.missing = size;
    console.log('parseTransparent(): missing = ' + this.missing);
    this.onparse = onparse;
};

Extract.prototype.cont = function (err) {
    if (this.destroyed) {
        return;
    }
    var cb = this.cb;
    this.cb = noop;
    if (this.overflow) {
        this.write(this.overflow, undefined, cb);
    } else {
        cb();
    }
};

Extract.prototype.write = function (data, enc, cb) {
    if (this.destroyed) {
        return;
    }

    var s = this.stream;
    var b = this.buffer;
    var missing = this.missing;

    // we do not reach end-of-chunk now. just forward it

    if (data.length < missing) {
        console.log('write(): need ' + missing +
            ' bytes but received only ' + data.length + ', passing...'
        );
        this.missing -= data.length;
        this.overflow = null;
        if (s) {
            return s.write(data, cb);
        }
        console.log('Appending partial ' + data + ' to buffer ' + b);
        b.append(data);
        return cb();
    }

    // end-of-chunk. the parser should call cb.
    console.log('write(): cb()');
    this.cb = cb;
    this.missing = 0;

    var overflow = null;
    if (data.length > missing) {
        overflow = data.slice(missing);
        data = data.slice(0, missing);
    }

    if (s) {
        s.end(data);
    } else {
        console.log('Appending complete ' + data + ' to buffer ' + b);
        b.append(data);
        console.log('Buffer after append(): ' + b);
    }
    this.overflow = overflow;
    this.onparse();
};

module.exports = Extract;
