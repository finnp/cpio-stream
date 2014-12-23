# cpio-stream
[![NPM](https://nodei.co/npm/cpio-stream.png)](https://nodei.co/npm/cpio-stream/)

`cpio-stream` is a streaming cpio packer. It is basically the `cpio` version
on [tar-stream](https://github.com/mafintosh/tar-stream).

Right now it only implements the `odc` / `old character` format (`--format odc`)
following [this documentation](http://people.freebsd.org/~kientzle/libarchive/man/cpio.5.txt).

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

`TODO`

## License
MIT, with some of the code taken from the `tar-stream` module by @mafintosh