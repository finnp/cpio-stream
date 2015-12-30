var concat = require('concat-stream')
var cpio = require('../')

var pack = cpio.pack()
var unpack = cpio.extract()

var entry1 = {'name': '.', 'mode': 16877, 'mtime': new Date('2015-12-30T14:53:10.000Z'), 'size': 0, 'type': 'directory', 'uid': 0, 'gid': 80}
var entry2 = {'name': 'test.txt', 'mode': 33188, 'mtime': new Date('2015-12-30T14:38:36.000Z'), 'size': 5, 'type': 'file', 'uid': 0, 'gid': 80}

module.exports = function (test) {
  test('odc: both pack and extract', function (t) {
    pack.entry(entry1, function () {
      var entry = pack.entry(entry2, function () {
        pack.finalize()
      })
      entry.end('test\n')
    })

    pack.pipe(unpack)
    t.plan(5)
    unpack.on('entry', function (header, stream, cb) {
      if (header.name === 'test.txt') {
        t.equals(header.mtime.getTime(), new Date('2015-12-30T14:38:36.000Z').getTime())
        t.equals(header.size, 5)
        stream.pipe(concat(function (content) {
          t.equals(content.toString(), 'test\n', 'test.txt content')
        }))
      } else {
        t.equals(header.mtime.getTime(), new Date('2015-12-30T14:53:10.000Z').getTime())
        stream.resume()
      }
      stream.on('end', function () {
        cb()
      })
    })
    unpack.on('finish', function () {
      t.pass('Finished')
    })
  })
}
