var cpio = require('../')
var fs = require('fs')
var path = require('path')
var concat = require('concat-stream')

module.exports = function (test) {

  test('simple unpack', function (t) {
    var unpack = cpio.extract()
    t.plan(9)
    unpack.on('entry', function (header, stream, cb) {
      t.equal(header.dev, 262143, 'dev')
      t.equal(header.ino, 1, 'ino')
      t.equal(header.mode, 33188, 'mode')
      t.equal(header.uid, 501, 'uid')
      t.equal(header.nlink, 1, 'nlink')
      t.equal(header.mtime.getTime(), (new Date(1419354218000)).getTime(), 'date')
      t.equal(header.rdev, 0, 'rdev')
      t.equal(header.name, 'test.txt', 'name')
      stream.on('end', function () {
        cb()
      })
      // stream.pipe(process.stdout)
      stream.pipe(concat(function (content) {
        t.equal(content.toString(), 'hello world\n')
      }))
    })

    fs.createReadStream(path.join(__dirname,'fixtures/onefile.cpio')).pipe(unpack)
  })
  
}

