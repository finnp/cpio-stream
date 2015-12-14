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

  test('odc: directories and file', function (t) {
    t.plan(4)

    var pack = cpio.pack()

    pack.entry({
      name: '.',
      mtime: new Date(1419354218000),
      mode: 16877,
      uid: 501,
      gid: 20
    }, function (err) {
      t.ok(!err, 'err dir .')
      pack.entry({
        name: './a',
        mtime: new Date(1419354218000),
        mode: 16877,
        uid: 501,
        gid: 20
      }, function (err) {
        t.ok(!err, 'err dir ./')
        var entry = pack.entry({
          name: './a/test.txt',
          mode: 33188,
          mtime: new Date(1450121663000),
          size: 5,
          uid: 501,
          gid: 20
        }, function (err) {
          t.ok(!err, 'err file')
          pack.finalize()
        })

        entry.write('test\n')
        entry.end()
      })
    })

    pack.pipe(concat(function (data) {
      // TODO: test contents
      t.ok(true, 'complete')
    }))
  })
}
