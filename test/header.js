/* jslint node: true, esnext: true */

"use strict";

var header = require('../headers.js');
var fs = require('fs');
var path = require('path');

module.exports = function(test) {

  test('Find odc codec', function(t) {
    let filename = path.join(__dirname, 'fixtures/onefile.cpio');
    let buf = fs.readFileSync(filename);
    let c = header.codec(buf);
    t.equal(c.id, "odc", "odc");
    t.end();
  });

  test('Find newc codec', function(t) {
    let filename = path.join(__dirname, 'fixtures/mktemp-1.5-12sls.i586.cpio');
    let buf = fs.readFileSync(filename);
    let c = header.codec(buf);
    t.equal(c.id, "newc", "newc");
    t.end();
  });

  test('Newc hex decoding', function(t) {
    t.equal(header.decodeHex('000017f8'), 6136, header.decodeHex('000017f8'));
    t.end();
  });

  test('Newc hex encoding', function(t) {
    t.equal(header.encodeHex(6136, 8), '000017f8', header.encodeHex(6136, 8));
    t.end();
  });

  test('Newc index padding', function(t) {
    t.equal(header.padNewcIndex(3), 4);
    t.equal(header.padNewcIndex(4), 4);
    t.equal(header.padNewcIndex(5), 8);

    t.equal(header.padNewcIndex(19), 20);
    t.equal(header.padNewcIndex(20), 20);
    t.equal(header.padNewcIndex(21), 24);
    t.end();
  });

  test('Newc padding', function(t) {
    t.equal(header.pad(header.padNewcIndex, '123'),   '123\0');
    t.equal(header.pad(header.padNewcIndex, '1234'),  '1234');
    t.equal(header.pad(header.padNewcIndex, '12345'), '12345\0\0\0');
    t.end();
  });

  test('Curry support for pad', function(t) {
    t.equal(header.bin.pad ('123'), '123\0', 'Testing bin codec for one-before-edge');
    t.equal(header.odc.pad ('123'), '123',   'Testing odc codec for edge');
    t.equal(header.newc.pad('123'), '123\0', 'Testing newc codec for one-after-edge');

    t.equal(header.bin.pad ('1234'), '1234');
    t.equal(header.odc.pad ('1234'), '1234');
    t.equal(header.newc.pad('1234'), '1234');

    t.equal(header.bin.pad ('12345'), '12345\0');
    t.equal(header.odc.pad ('12345'), '12345');
    t.equal(header.newc.pad('12345'), '12345\0\0\0');

    t.end();
  });

  test('Codec setup', function(t) {
    t.equal(header.newc.padIndex(7), 8);
    t.end();
  });
};
