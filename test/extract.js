var assert = require('assert');
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
            t.equal(header.mtime.getTime(), (new Date(
                1419354218000)).getTime(), 'date')
            t.equal(header.rdev, 0, 'rdev')
            t.equal(header.name, 'test.txt', 'name')
            stream.on('end', function () {
                    cb()
                })
                // stream.pipe(process.stdout)
            stream.pipe(concat(function (content) {
                t.equal(content.toString(),
                    'hello world\n')
            }))
        })

        fs.createReadStream(path.join(__dirname,
            'fixtures/onefile.cpio')).pipe(unpack)
    })

    test('multiple files', function (t) {
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

        fs.createReadStream(path.join(__dirname,
            'fixtures/multiple.cpio')).pipe(unpack)
    })

    // -rwxr-xr-x   1 root     root         6136 Jan  4  2004 ./bin/mktemp
    // -rw-r--r--   1 root     root         2160 Jan  4  2004 ./usr/share/man/man1/mktemp.1.bz2
    test('RPM small payload', function (t) {
        var unpack = cpio.extract();

        var list = [
            './bin/mktemp',
            './usr/share/man/man1/mktemp.1.bz2'
        ]

        unpack.on('entry', function (header, stream, cb) {
            list = list.filter(function (name) {
                return name !== header.name
            })

            stream.on('end', function () {
                cb()
            })
            stream.resume();
        })

        unpack.on('finish', function () {
            t.equal(list.length, 0, 'all files present');
            t.end();
        })

        fs.createReadStream(path.join(__dirname,
            'fixtures/mktemp-1.5-12sls.i586.cpio')).pipe(
            unpack)
    });

    test('RPM large payload, need to fetch ' +
        'http://ftp.hosteurope.de/mirror/' +
        'ftp.suse.com/pub/suse/discontinued/i386/9.3/suse/src/' +
        'OpenOffice_org1-1.1.3-4.src.rpm',
        function (t) {

            t.timeoutAfter(10000);

            var unpack = cpio.extract(),
                n = 0;

            unpack.on('entry', function (header, stream, cb) {
                console.log('* entry(' + n + '): ' + JSON.stringify(
                    header));
                n = n + 1;

                assert.equal(header.name[0], '.');
                assert.equal(header.name[1], '/');

                stream.on('end', function () {
                    cb();
                });
                // Just auto drain
                stream.resume();
            });

            unpack.on('finish', function () {
                console.log('finish()');
                // t.equal(n, 138, 'all files present');
                t.equal(n, 10, 'all files present');
                t.end();
            })

            fs.createReadStream(path.join(__dirname,
                //'fixtures/OpenOffice_org1-1.1.3-4.src.cpio'
                // 'fixtures/FlightGear-0.9.3-91.i586.cpio'
                'fixtures/bonnie++-1.02-335.i586.cpio'
            )).pipe(
                unpack);
        });
}
