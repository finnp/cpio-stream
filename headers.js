/* jslint node: true, esnext: true */

"use strict";

// First part of codecs definitions, can't embed encode and decoder yet
// because function definition follows later
let odc = {
  "id": "odc",
  "length": 76,
  "magic": "070707"
};

let newc = {
  "id": "newc",
  "length": 110,
  "magic": "070701",
};

function decodeOct(buf, pos, n) {
  n = n || 6;
  return parseInt(buf.toString('ascii', pos, pos + n), 8);
}

function encodeOct(number, bytes) {
  var str = (Math.min(number, Math.pow(8, bytes) - 1)).toString(8);
  str = new Array(bytes - str.length + 1).join('0') + str;
  return str;
}

function padEven(name) {
  if (name % 2 === 0) return name;
  return name + '\0';
}

let encodeOdc = function(opts) {
  opts.name = padEven(opts.name);
  if (opts.nameSize % 2 !== 0) opts.nameSize++;

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

let decodeOdc = function(buf) {
  // first 76  bytes
  var magic = buf.toString('ascii', 0, 6);
  // TODO: Support small endianess (707070)
  if (magic !== odc.magic) {
    throw new Error(`Not an odc cpio, expected ${odc.magic} but got ${magic}`);
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

let decodeHex = function(buf, pos, n) {
  n = n || 8;
  return parseInt(buf.toString('ascii', pos, pos + n, 16));
};

let encodeHex = function(number, bytes) {
  var str = (Math.min(number, Math.pow(16, bytes) - 1)).toString(16);
  str = new Array(bytes - str.length + 1).join('0') + str;
  return str;
};

let decodeNewc = function(buf) {
  var magic = buf.toString('ascii', 0, 6);
  if (magic !== newc.magic) {
    throw new Error(`Not a newc cpio, expected magic ${newc.magic} but got ${magic}`);
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

let encodeNewc = function(opts) {
  opts.name = padEven(opts.name);
  if (opts.nameSize % 2 !== 0) opts.nameSize++;

  var buf = new Buffer(110 + opts.name.length);

  buf.write(newc.magic, 0);
  buf.write(encodeHex(opts.ino, 8), 6);
  buf.write(encodeHex(opts.mode, 8), 14);
  buf.write(encodeHex(opts.uid, 8), 22);
  buf.write(encodeHex(opts.gid, 8), 30);
  buf.write(encodeHex(opts.nlink, 8), 38);
  buf.write(encodeHex(opts.mtime.getTime() / 1000, 8), 46);
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

// Return appropriate codec for a given buffer
let codec = function(buf) {
  let magic = buf.toString('ascii', 0, 6);
  if (magic == newc.magic) return newc;
  if (magic == odc.magic) return odc;
  throw new Error('Unknown cpio magic ' + magic);
};

odc.encode = encodeOdc;
odc.decode = decodeOdc;
newc.encode = encodeNewc;
newc.decode = decodeNewc;

exports.odc = odc;
exports.newc = newc;
exports.codec = codec;

// Keep 1.0.0 compatibility: odc by default
exports.size = odc.length;
exports.encode = encodeOdc;
exports.decode = decodeOdc;