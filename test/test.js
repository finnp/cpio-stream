var test = require('tape');

var pack = require('./pack.js');
var extract = require('./extract.js');
var header = require('./header.js');

header(test);
// pack(test);
extract(test);
