/* jshint bitwise: false */

"use strict";

/**
 * Codec implementation.
 * @class Codec
 */

// First part of codecs definitions, can't embed encode and decoder yet
// because function definition follows later

/**
 * Codec for cpio <code>bin</code> format.
 *
 * @property bin
 * @type object
 */
var bin = {
    "id": "bin",
    "length": 76,
    "magic": "070707"
};

/**
 * Codec for cpio <code>odc</code> format.
 *
 * @property odc
 * @type object
 */
var odc = {
    "id": "odc",
    "length": 76,
    "magic": "070707"
};

/**
 * Codec for cpio <code>newc</code> format.
 *
 * @property newc
 * @type object
 */
var newc = {
    "id": "newc",
    "length": 110,
    "magic": "070701"
};

/**
 * @method hex
 * @param {Number} anything
 * @return dec and hex representation of n
 */
var hex = function (n) {
    return n + '(0x' + n.toString(16) + ')';
}

/**
 * Decode an octal encoded <code>bin</code> or <code>odc</code> buffer.
 *
 * @method decodeOct
 * @param {Array} buf input buffer
 * @param {Number} pos position to read from
 * @param {Number} n read n bytes
 * @return {Number} decoded value
 */
function decodeOct(buf, pos, n) {
    n = n || 6;
    return parseInt(buf.toString('ascii', pos, pos + n), 8);
}

function encodeOct(number, bytes) {
    var s = (Math.min(number, Math.pow(8, bytes) - 1)).toString(8),
        header = '00000000';
    return header.substring(0, s.length - bytes) + s;
}

// According to the spec, this is wrong. Only 'old binary' format requires
// padding, the odc/ SUSv2 format comes w/o padding.
function padEven(name) {
    return name % 2 === 0 ? name : name + '\x00';
}

var encodeOdc = function (opts) {
    opts.name = padEven(opts.name);
    if (opts.nameSize % 2 !== 0) {
        opts.nameSize = opts.nameSize + 1;
    }
    var buf = new Buffer(54 + 22 + opts.name.length);

    buf.write(odc.magic, 0);
    buf.write(encodeOct(opts.dev, 6), 6);
    buf.write(encodeOct(opts.ino, 6), 12);
    buf.write(encodeOct(opts.mode, 6), 18);
    buf.write(encodeOct(opts.uid, 6), 24);
    buf.write(encodeOct(opts.gid, 6), 30);
    buf.write(encodeOct(opts.nlink, 6), 36);
    buf.write(encodeOct(opts.rdev, 6), 42);
    buf.write(encodeOct(opts.mtime.getTime() / 1000, 11), 48);
    buf.write(encodeOct(opts.name.length, 6), 59);
    buf.write(encodeOct(opts.fileSize, 11), 65);
    buf.write(opts.name, 76);
    return buf;
};

var decodeOdc = function (buf) {
    // first 76  bytes
    var magic = buf.toString('ascii', 0, 6);

    if (magic !== odc.magic) {
        throw new Error('Not an odc cpio, expected ' +
            odc.magic +
            ' but got ' +
            magic);
    }
    var header = {};

    header.dev = decodeOct(buf, 6);
    header.ino = decodeOct(buf, 12);
    header.mode = decodeOct(buf, 18);
    header.uid = decodeOct(buf, 24);
    header.gid = decodeOct(buf, 30);
    header.nlink = decodeOct(buf, 36);
    header.rdev = decodeOct(buf, 42);
    header.mtime = new Date(decodeOct(buf, 48, 11) * 1000);
    header.nameSize = decodeOct(buf, 59);
    header.fileSize = decodeOct(buf, 65, 11);

    return header;
};

// Padding rules according to
// http://people.freebsd.org/~kientzle/libarchive/man/cpio.5.txt

/**
 * Padding name and file content for type 'bin': padding on even number of
 * bytes. Uses binary shift to convert from/ to integers.
 *
 * @method padBinIndex
 * @param {Number} index
 * @param {Number} aligned index for cpio type <code>bin</code>
 */
var padBinIndex = function (i) {
    return i + 1 >> 1 << 1;
};

/**
 * Padding name and file content for type 'odc': no padding.
 *
 * @method padOdcIndex
 */
var padOdcIndex = function (i) {
    return i;
};

/**
 * Padding name and file content for type 'newc'.
 *
 * @method padNewcIndex
 * @return the smallest n [n >= i] that is a multiple of 4
 */
var padNewcIndex = function (i) {
    return i + 3 >> 2 << 2;
};

/**
 * Padding for newc, both pathname and filedata are padded to a 4 byte
 * boundary.
 *
 * @method pad
 * @return pad trailer so that length(buf + pad) is a multiple of 4.
 */
var pad = function (padfn, buf) {
    // Curry support
    if (typeof buf === 'undefined') {
        return function (buf) {
            return buf + '\x00\x00\x00'.substring(0, padfn(buf.length) -
                buf.length);
        };
    }
    return buf + '\x00\x00\x00'.substring(0, padfn(buf.length) - buf.length);
};

/**
 * Zero padding (<code>\0</code>) must happen on absolute position of name in
 * cpio structure, not on length of name. A shortcut is to use the current
 * header position and assume is already correctly aligned.
 * Padding happens after the name, so position is
 * <code>align(sizeof(header) + sizeof(name))</code>.
 *
 * @method alignedName
 * @param {object} codec codec context
 * @param {object} header header context
 * @return length of name + number of padded bytes
 */
var alignedName = function (codec, header) {
    var pos = codec.length + header.nameSize,
        p = codec.padIndex(pos),
        // Number of bytes to consume: original size + pad
        n = header.nameSize + p - pos;
    console.log('alignedName: pos = ' + hex(pos) + ', p = ' +
        hex(p) + ', n = ' +
        hex(n));
    return n;
};

/**
 * Zero padding (<code>\0</code>) must happen on absolute position of name in
 * cpio structure, not on length of name. A shortcut is to use the current
 * header position and assume is already correctly aligned.
 * Padding happens after the file content, so position is the sum of
 * <ol>
 *   <li>sizeof(header)</li>
 *   <li>sizeof(aligned name)</li>
 *   <li>sizeof(aligned file size)</li>
 * </ol>
 *
 * @method alignedName
 * @param {object} codec codec context
 * @param {object} header header context
 * @return padded nameIndex
 */
var alignedFileSize = function (codec, header) {
    var pos = codec.length + alignedName(codec, header) + header.fileSize,
        p = codec.padIndex(pos),
        // Number of bytes to consume: original size + pad
        n = header.fileSize + p - pos;
    console.log('alignedFileSize: pos = ' + hex(pos) + ', p = ' +
        hex(p) + ', n = ' +
        hex(n));
    return n;
};

var decodeHex = function (buf, pos, n) {
    n = n || 8;
    return parseInt(buf.toString('ascii', pos, pos + n),
        16);
};

var encodeHex = function (number, bytes) {
    var s = (Math.min(number, Math.pow(16, bytes) - 1)).toString(
            16),
        header = '00000000';
    return header.substring(0, 8 - s.length) + s;
};

var decodeNewc = function (buf) {
    var magic = buf.toString('ascii', 0, 6);
    if (magic !== newc.magic) {
        throw new Error('Not a newc cpio, expected magic ' +
            newc.magic +
            ' but got ' +
            magic);
    }
    var header = {};
    header.ino = decodeHex(buf, 6);
    header.mode = decodeHex(buf, 14);
    header.uid = decodeHex(buf, 22);
    header.gid = decodeHex(buf, 30);
    header.nlink = decodeHex(buf, 38);
    header.mtime = new Date(decodeHex(buf, 46));
    header.fileSize = decodeHex(buf, 54);
    header.devmajor = decodeHex(buf, 62);
    header.devminor = decodeHex(buf, 70);
    header.rdevmajor = decodeHex(buf, 78);
    header.rdevminor = decodeHex(buf, 86);
    header.nameSize = decodeHex(buf, 94);
    header.check = decodeHex(buf, 102);

    return header;
};

/**
 * Encode options in cpio <code>newc</code> format.
 *
 * @method encodeNewc
 * @param {object} opts cpio <code>newc</code> header
 * @return {Buffer} encoded buffer
 */
var encodeNewc = function (opts) {
    opts.name = padEven(opts.name);
    if (opts.nameSize % 2 !== 0) {
        opts.nameSize = opts.nameSize + 1;
    }
    var buf = new Buffer(110 + opts.name.length);

    buf.write(newc.magic, 0);
    buf.write(encodeHex(opts.ino, 8), 6);
    buf.write(encodeHex(opts.mode, 8), 14);
    buf.write(encodeHex(opts.uid, 8), 22);
    buf.write(encodeHex(opts.gid, 8), 30);
    buf.write(encodeHex(opts.nlink, 8), 38);
    buf.write(encodeHex(opts.mtime.getTime() / 1000, 8),
        46);
    buf.write(encodeHex(opts.fileSize, 8), 54);
    buf.write(encodeHex(opts.devmajor, 8), 62);
    buf.write(encodeHex(opts.devminor, 8), 70);
    buf.write(encodeHex(opts.rdevmajor, 8), 78);
    buf.write(encodeHex(opts.rdevminor, 8), 86);
    buf.write(encodeHex(opts.nameSize, 8), 94);
    buf.write(encodeHex(opts.check, 8), 102);
    buf.write(opts.name, 110);
    return buf;
};

/**
 * Determine codec for a given buffer.
 *
 * @method codec
 * @param {Array} buf input buffer
 * @return appropriate codec for a given buffer
 */
var codec = function (buf) {
    var magic = buf.toString('ascii', 0, 6);
    if (magic === newc.magic) {
        return newc;
    }
    if (magic === odc.magic) {
        return odc;
    }
    throw new Error('Unknown cpio magic ' + magic);
};

//cpio 'bin' codec setup
bin.encode = undefined;
bin.decode = undefined;
bin.padIndex = padBinIndex;
bin.pad = pad(padBinIndex);
bin.alignedName = function (header) {
    return alignedName(bin, header);
};
bin.alignedFileSize = function (header) {
    return alignedFileSize(bin, header);
};

// cpio 'odc' codec setup
odc.encode = encodeOdc;
odc.decode = decodeOdc;
odc.padIndex = padOdcIndex;
odc.pad = pad(padOdcIndex);
odc.alignedName = function (header) {
    return alignedName(odc, header);
};
odc.alignedFileSize = function (header) {
    return alignedFileSize(odc, header);
};

// cpio 'newc' codec setup
newc.encode = encodeNewc;
newc.decode = decodeNewc;
newc.padIndex = padNewcIndex;
newc.pad = pad(padNewcIndex);
newc.alignedName = function (header) {
    return alignedName(newc, header);
};
newc.alignedFileSize = function (header) {
    return alignedFileSize(newc, header);
};

// Standard exports
exports.bin = bin;
exports.odc = odc;
exports.newc = newc;
exports.codec = codec;

// Keep 1.0.0 compatibility: odc by default
exports.size = odc.length;
exports.encode = encodeOdc;
exports.decode = decodeOdc;

// Testing
if (process.env.NODE_ENV === "test") {
    exports.decodeHex = decodeHex;
    exports.encodeHex = encodeHex;
    exports.decodeOct = decodeOct;
    exports.encodeOct = encodeOct;

    exports.padBinIndex = padBinIndex;
    exports.padOdcIndex = padOdcIndex;
    exports.padNewcIndex = padNewcIndex;
    exports.pad = pad;
}
