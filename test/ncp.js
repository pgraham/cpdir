/* global describe, before, beforeEach, it */

var assert = require('assert')
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')
var readDirFiles = require('read-dir-files').read
var ncp = require('../').ncp

describe('ncp', function () {
  describe('regular files and directories', function () {
    var fixtures = path.join(__dirname, 'regular-fixtures')
    var src = path.join(fixtures, 'src')
    var out = path.join(fixtures, 'out')

    before(function (cb) {
      rimraf(out, function () {
        ncp(src, out, cb)
      })
    })

    describe('when copying a directory of files', function () {
      it('files are copied correctly', function (cb) {
        readDirFiles(src, 'utf8', function (srcErr, srcFiles) {
          readDirFiles(out, 'utf8', function (outErr, outFiles) {
            assert.ifError(srcErr)
            assert.deepEqual(srcFiles, outFiles)
            cb()
          })
        })
      })
    })

    describe('when copying files using filter function', function () {
      before(function (cb) {
        var filter = function (name) {
          return name.substr(name.length - 1) !== 'a'
        }
        rimraf(out, function () {
          ncp(src, out, {filter: filter}, cb)
        })
      })

      it('files are copied correctly', function (cb) {
        readDirFiles(src, 'utf8', function (srcErr, srcFiles) {
          function filter (files) {
            for (var fileName in files) {
              var curFile = files[fileName]
              if (curFile instanceof Object) { return filter(curFile) }
              if (fileName.substr(fileName.length - 1) === 'a') { delete files[fileName] }
            }
          }
          filter(srcFiles)
          readDirFiles(out, 'utf8', function (outErr, outFiles) {
            assert.ifError(outErr)
            assert.deepEqual(srcFiles, outFiles)
            cb()
          })
        })
      })
    })

    describe('when copying files using filter regex', function () {
      before(function (cb) {
        var filter = /[^a]$/
        rimraf(out, function () {
          ncp(src, out, {filter: filter}, cb)
        })
      })

      it('files are copied correctly', function (cb) {
        readDirFiles(src, 'utf8', function (srcErr, srcFiles) {
          function filter (files) {
            for (var fileName in files) {
              var curFile = files[fileName]
              if (curFile instanceof Object) { return filter(curFile) }
              if (fileName.substr(fileName.length - 1) === 'a') { delete files[fileName] }
            }
          }
          filter(srcFiles)
          readDirFiles(out, 'utf8', function (outErr, outFiles) {
            assert.ifError(outErr)
            assert.deepEqual(srcFiles, outFiles)
            cb()
          })
        })
      })
    })

    describe('when copying files using includeFiles', function () {

    })

    describe('when using clobber=false', function () {
      it('the copy is completed successfully', function (cb) {
        ncp(src, out, function () {
          ncp(src, out, {clobber: false}, function (err) {
            assert.ifError(err)
            cb()
          })
        })
      })
    })

    describe('when using transform', function () {
      it('file descriptors are passed correctly', function (cb) {
        ncp(src, out, {
          transform: function (read, write, file) {
            assert.notEqual(file.name, undefined)
            assert.strictEqual(typeof file.mode, 'number')
            read.pipe(write)
          }
        }, cb)
      })
    })

    describe('when using rename', function () {
      it('output files are correctly redirected', function (cb) {
        ncp(src, out, {
          rename: function (target) {
            if (path.basename(target) === 'a') return path.resolve(path.dirname(target), 'z')
            return target
          }
        }, function (err) {
          if (err) return cb(err)

          readDirFiles(src, 'utf8', function (srcErr, srcFiles) {
            readDirFiles(out, 'utf8', function (outErr, outFiles) {
              assert.ifError(srcErr)
              assert.deepEqual(srcFiles.a, outFiles.z)
              cb()
            })
          })
        })
      })
    })
  })

  describe('symlink handling', function () {
    var fixtures = path.join(__dirname, 'symlink-fixtures')
    var src = path.join(fixtures, 'src')
    var out = path.join(fixtures, 'out')

    beforeEach(function (cb) {
      rimraf(out, cb)
    })

    it('copies symlinks by default', function (cb) {
      ncp(src, out, function (err) {
        if (err) return cb(err)
        assert.equal(fs.readlinkSync(path.join(out, 'file-symlink')), 'foo')
        assert.equal(fs.readlinkSync(path.join(out, 'dir-symlink')), 'dir')
        cb()
      })
    })

    it('copies file contents when dereference=true', function (cb) {
      ncp(src, out, { dereference: true }, function (err) {
        if (err) {
          return cb(err)
        }
        var fileSymlinkPath = path.join(out, 'file-symlink')
        assert.ok(fs.lstatSync(fileSymlinkPath).isFile())
        assert.equal(fs.readFileSync(fileSymlinkPath), 'foo contents')

        var dirSymlinkPath = path.join(out, 'dir-symlink')
        assert.ok(fs.lstatSync(dirSymlinkPath).isDirectory())
        assert.deepEqual(fs.readdirSync(dirSymlinkPath), ['bar'])

        cb()
      })
    })
  })

  describe('broken symlink handling', function () {
    var fixtures = path.join(__dirname, 'broken-symlink-fixtures')
    var src = path.join(fixtures, 'src')
    var out = path.join(fixtures, 'out')

    beforeEach(function (cb) {
      rimraf(out, cb)
    })

    it('copies broken symlinks by default', function (cb) {
      ncp(src, out, function (err) {
        if (err) return cb(err)
        assert.equal(fs.readlinkSync(path.join(out, 'broken-symlink')), 'does-not-exist')
        cb()
      })
    })

    it('returns an error when dereference=true', function (cb) {
      ncp(src, out, {dereference: true}, function (err) {
        assert.equal(err.length, 1)
        assert.equal(err[0].code, 'ENOENT')
        cb()
      })
    })
  })

  describe('modified files copies', function () {
    var fixtures = path.join(__dirname, 'modified-files-fixtures')
    var src = path.join(fixtures, 'src')
    var out = path.join(fixtures, 'out')

    it('if file not exists copy file to target', function (cb) {
      rimraf(out, function () {
        ncp(src, out, {modified: true, clobber: false}, function (err) {
          if (err) {
            return cb(err)
          }

          assert.equal(fs.existsSync(out), true)
          cb()
        })
      })
    })

    it('change source file mtime and copy', function (cb) {
      fs.utimesSync(src + '/a', new Date().getTime() / 1000, new Date('2099-01-01 00:00:00').getTime() / 1000)
      ncp(src, out, {modified: true, clobber: false}, function (err) {
        if (err) {
          return cb(err)
        }

        fs.stat(out + '/a', function (err, stats) {
          if (err) {
            return cb(err)
          }
          assert.equal(stats.mtime.getTime(), new Date('2099-01-01 00:00:00').getTime())
          cb()
        })
      })
    })
  })
})
