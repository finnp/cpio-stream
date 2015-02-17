# cpio-stream

[![Build Status](https://travis-ci.org/jhinrichsen/cpio-stream.png?branch=master)](https://travis-ci.org/jhinrichsen/cpio-stream)
[![BSD](http://b.repl.ca/v1/license-MIT-blue.png)](http://en.wikipedia.org/wiki/BSD_licenses)
[![ECMAScript](http://b.repl.ca/v1/language-ECMAScript-blue.png)](http://www.ecmascript.org/)



`cpio-stream` is a streaming cpio packer. It is basically the `cpio` version
on [tar-stream](https://github.com/mafintosh/tar-stream).

Right now it only implements the `odc` / `old character` format (`--format odc`)
following [this documentation](http://people.freebsd.org/~kientzle/libarchive/man/cpio.5.txt).

newc format is on its way though.

## Packing

```js
var cpio = require('cpio-stream')
var pack = cpio.pack()

pack.entry({name: 'my-test.txt'}, 'hello, world\n')

var entry = pack.entry({'my-stream-test.txt', size: 11}, function (err) {
  // stream was added
  // no more entries
  pack.finalize()
})

entry.write('hello')
entry.write(' world')
entry.end()

// pipe the archive somewhere
pack.pipe(process.stdout)

```

## Extracting

```js
var extract = cpio.extract()

extract.on('entry', function (header, stream, callback) {
  stream.on('end', function () {
    callback()
  })
  
  stream.resume() // auto drain
})

extract.on('finish', function () {
  // all entries read
})

pack.pipe(extract)
```

## License
MIT, with some of the code taken from the `tar-stream` module by @mafintosh
