var cpio = require('../'),
  PackNewc = require('../pack-newc').PackNewc,
  fs = require('fs'),
  concat = require('concat-stream'),
  path = require('path')

module.exports = function (test) {
  test('pack file', function (t) {
    t.plan(1)

    var pack = PackNewc()
    console.log('pack:' + pack)
    pack.entry({
      ino: 20575225,
      mode: 33188,
      uid: 501,
      gid: 20,
      nlink: 1,
      mtime: new Date(1427130782),
      fileSize: 12,
      devmajor: 1,
      devminor: 4,
      rdevmajor: 0,
      rdevminor: 0,
      name: 'test.txt'
    }, 'Hello World\n')

    pack.finalize()

    pack.pipe(concat(function (data) {
      var expected = fs.readFileSync(path.join(
        __dirname,
        'fixtures/onefile.newc.cpio'))
      t.deepEqual(data, expected)
    }))
  })
/*
        test('pack file stream', function (t) {
            t.plan(2)

            var pack = cpio.packNewc()

            var entry = pack.entry({
                name: 'test.txt',
                mtime: new Date(1427130782000),
                mode: 33188,
                uid: 501,
                gid: 20,
                fileSize: 12
            }, function (err) {
                if (err) {
                    console.log(err)
                }
                t.ok(!err)
                pack.finalize()
            })

            entry.write('hello ')
            entry.write('world\n')
            entry.end()

            pack.pipe(concat(function (data) {
                var expected = fs.readFileSync(path.join(
                    __dirname,
                    'fixtures/onefile.cpio'))
                //console.log('Expected:' + expected)
                //console.log('Data:    ' + data)
                t.deepEqual(data, expected)
            }))
        })
*/
}
