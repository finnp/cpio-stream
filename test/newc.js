var cpio = require('../')
var fs = require('fs')
var concat = require('concat-stream')
var path = require('path')

module.exports = function (test) {
  test('newc: pack file', function (t) {
    t.plan(1)

    var pack = cpio.pack({format: 'newc'})

    pack.entry({
      ino: 18522521,
      devmajor: 8,
      devminor: 5,
      name: 'test.txt',
      mtime: new Date(1444378311000),
      mode: 33188,
      uid: 1000,
      gid: 1000
    }, 'hello world\n')

    pack.finalize()

    pack.pipe(concat(function (data) {
      var expected = fs.readFileSync(path.join(__dirname, 'fixtures/newc/onefile.cpio'))
      t.deepEqual(data, expected)
    }))
  })

  test('newc: pack file stream', function (t) {
    t.plan(2)

    var pack = cpio.pack({format: 'newc'})

    var entry = pack.entry({
      ino: 18522521,
      devmajor: 8,
      devminor: 5,
      name: 'test.txt',
      mtime: new Date(1444378311000),
      mode: 33188,
      uid: 1000,
      gid: 1000,
      size: 12
    }, function (err) {
      t.ok(!err)
      pack.finalize()
    })

    entry.write('hello ')
    entry.write('world\n')
    entry.end()

    pack.pipe(concat(function (data) {
      var expected = fs.readFileSync(path.join(__dirname, 'fixtures/newc/onefile.cpio'))
      t.deepEqual(data, expected)
    }))
  })

  test('newc: directories and file', function (t) {
    t.plan(4)

    var pack = cpio.pack({format: 'newc'})

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
      var expected = fs.readFileSync(path.join(__dirname, 'fixtures/newc/a.cpio'))
      t.deepEqual(expected, data, 'equivalent cpio')
    }))
  })
}
