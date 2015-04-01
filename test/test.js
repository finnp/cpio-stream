var test = require('tape'),
  pack = require('./pack'),
  packNewc = require('./pack-newc'),
  extract = require('./extract'),
  header = require('./header')

// header(test)
// pack(test)
packNewc(test)
// extract(test)
