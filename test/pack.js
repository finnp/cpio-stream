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
      name: 'b',
      mtime: new Date(1450121663000),
      mode: 16877,
      uid: 501,
      gid: 20,
      nlink: 3
    }, function (err) {
      t.ok(!err, 'err dir .')
      pack.entry({
        name: 'b/a',
        mtime: new Date(1450121663000),
        mode: 16877,
        uid: 501,
        gid: 20,
        nlink: 3
      }, function (err) {
        t.ok(!err, 'err dir ./')
        var entry = pack.entry({
          name: 'b/a/test.txt',
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
      var expected = fs.readFileSync(path.join(__dirname, 'fixtures/odc/a.cpio'))
      t.deepEqual(expected, data, 'equivalent cpio')
    }))
  })
  test('odc: file helper', function (t) {
    t.plan(1)

    var pack1 = cpio.pack()
    pack1.entry({
      name: 'test.txt',
      mtime: new Date(1419354218000),
      mode: 33188,
      uid: 501,
      gid: 20
    }, 'hello world\n')
    pack1.finalize()

    var pack2 = cpio.pack()
    pack2.file({
      name: 'test.txt',
      mtime: new Date(1419354218000),
      mode: 420,
      uid: 501,
      gid: 20
    }, 'hello world\n')
    pack2.finalize()


    pack1.pipe(concat(function (result1) {
      pack2.pipe(concat(function (result2) {
        t.deepEqual(result1, result2)
      }))
    }))
  })
}
// vim: et:ts=2:sw=2
