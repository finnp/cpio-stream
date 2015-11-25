var cpio = require('../')
var fs = require('fs')
var concat = require('concat-stream')
var path = require('path')

module.exports = function (test) {
  test('odc: pack file', function (t) {
    t.plan(1)

    var pack = cpio.pack()

    pack.entry({
      name: 'test.txt',
      mtime: new Date(1419354218000),
      mode: 33188,
      uid: 501,
      gid: 20
    }, 'hello world\n')

    pack.finalize()

    pack.pipe(concat(function (data) {
      var expected = fs.readFileSync(path.join(__dirname, 'fixtures/odc/onefile.cpio'))
      t.deepEqual(data, expected)
    }))
  })

  test('odc: pack file stream', function (t) {
    t.plan(2)

    var pack = cpio.pack()

    var entry = pack.entry({
      name: 'test.txt',
      mtime: new Date(1419354218000),
      mode: 33188,
      uid: 501,
      gid: 20,
      size: 12
    }, function (err) {
      t.ok(!err)
      pack.finalize()
    })

    entry.write('hello ')
    entry.write('world\n')
    entry.end()

    pack.pipe(concat(function (data) {
      var expected = fs.readFileSync(path.join(__dirname, 'fixtures/odc/onefile.cpio'))
      t.deepEqual(data, expected)
    }))
  })
}
