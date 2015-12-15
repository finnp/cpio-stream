var cpio = require('../')
var fs = require('fs')
var path = require('path')
var concat = require('concat-stream')

module.exports = function (test) {
  test('odc: simple unpack', function (t) {
    var unpack = cpio.extract()
    t.plan(12)
    unpack.on('entry', function (header, stream, cb) {
      t.equal(header.dev, 262143, 'dev')
      t.equal(header.ino, 1, 'ino')
      t.equal(header.mode, 33188, 'mode')
      t.equal(header.uid, 501, 'uid')
      t.equal(header.gid, 20, 'gid')
      t.equal(header.nlink, 1, 'nlink')
      t.equal(header.rdev, 0, 'rdev')
      t.equal(header.mtime.getTime(), (new Date(1419354218000)).getTime(), 'mtime')
      t.equal(header.name, 'test.txt', 'name')
      t.equal(header.size, 12, 'size')
      t.equal(header.type, 'file', 'type')
      stream.on('end', function () {
        cb()
      })
      // stream.pipe(process.stdout)
      stream.pipe(concat(function (content) {
        t.equal(content.toString(), 'hello world\n')
      }))
    })

    fs.createReadStream(path.join(__dirname, 'fixtures/odc/onefile.cpio')).pipe(unpack)
  })

  test('odc: multiple files', function (t) {
    var unpack = cpio.extract()

    var list = [
      './blub',
      './blub/blubber',
      './blub/blubber/empty.txt',
      './blub/blubber/what.txt',
      './blub/what.txt'
    ]

    unpack.on('entry', function (header, stream, cb) {
      list = list.filter(function (name) {
        return name !== header.name
      })

      stream.on('end', function () {
        cb()
      })
      stream.resume()
    })

    unpack.on('finish', function () {
      t.equal(list.length, 0, 'all files present')
      t.end()
    })

    fs.createReadStream(path.join(__dirname, 'fixtures/odc/multiple.cpio')).pipe(unpack)
  })

  test('odc: symlink', function (t) {
    t.plan(6)
    var unpack = cpio.extract()
    unpack.on('entry', function (header, stream, cb) {
      t.pass('file received')
      if (header.name === './link') {
        t.equals(header.type, 'symlink', 'symlink type')
        t.equals(header.linkname, '.gitignore', 'linkname')
      }
      stream.on('end', function () {
        cb()
      })
      stream.resume()
    })
    fs.createReadStream(path.join(__dirname, 'fixtures/odc/link.cpio')).pipe(unpack)
  })

  test('newc: simple unpack', function (t) {
    var unpack = cpio.extract()
    t.plan(14)
    unpack.on('entry', function (header, stream, cb) {
      t.equal(header.ino, 18522521, 'ino')
      t.equal(header.mode, 33188, 'mode')
      t.equal(header.uid, 1000, 'uid')
      t.equal(header.gid, 1000, 'gid')
      t.equal(header.nlink, 1, 'nlink')
      t.equal(header.mtime.getTime(), (new Date(1444378311000)).getTime(), 'mtime')
      t.equal(header.size, 12, 'size')
      t.equal(header.devmajor, 8, 'devmajor')
      t.equal(header.devminor, 5, 'devminor')
      t.equal(header.rdevmajor, 0, 'rdevmajor')
      t.equal(header.rdevminor, 0, 'rdevminor')
      t.equal(header.name, 'test.txt', 'name')
      t.equal(header.type, 'file', 'type')
      stream.on('end', function () {
        cb()
      })
      // stream.pipe(process.stdout)
      stream.pipe(concat(function (content) {
        t.equal(content.toString(), 'hello world\n')
      }))
    })

    fs.createReadStream(path.join(__dirname, 'fixtures/newc/onefile.cpio')).pipe(unpack)
  })

  test('newc: multiple files', function (t) {
    var unpack = cpio.extract()

    var list = [
      'blub',
      'blub/blubber',
      'blub/blubber/empty.txt',
      'blub/blubber/what.txt',
      'blub/what.txt'
    ]

    unpack.on('entry', function (header, stream, cb) {
      list = list.filter(function (name) {
        return name !== header.name
      })

      stream.on('end', function () {
        cb()
      })
      stream.resume()
    })

    unpack.on('finish', function () {
      t.equal(list.length, 0, 'all files present')
      t.end()
    })

    fs.createReadStream(path.join(__dirname, 'fixtures/newc/multiple.cpio')).pipe(unpack)
  })

  test('crc: dir + file + symlink', function (t) {
    var unpack = cpio.extract()
    t.plan(7)
    unpack.on('entry', function (header, stream, cb) {
      stream.pipe(concat(function (content) {
        t.pass(header.name)
        if (header.name === 'test/b') {
          t.same(header.type, 'symlink', 'symlink type')
          t.same(header.linkname, 'a', 'symlink linkname')
        }
        if (header.name === 'test/a') {
          var cksum = 0
          for (var i = 0; i < content.length; i++) cksum += content.readUInt8(i)
          t.same(cksum, header.checksum, 'checksum test')
          t.same(content.toString(), 'test\n')
        }
      }))
      stream.on('end', function () {
        cb()
      })
    })
    fs.createReadStream(path.join(__dirname, 'fixtures/crc/crc.cpio')).pipe(unpack)
  })
}
