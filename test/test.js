var test = require('tape')

var pack = require('./pack.js')
var extract = require('./extract.js')
var both = require('./both.js')

pack(test)
extract(test)
both(test)
