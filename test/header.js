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
};