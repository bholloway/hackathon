var gulp              = require('gulp');
var sass              = require('gulp-sass');
var rework            = require('gulp-rework');
var sourcemaps        = require('gulp-sourcemaps');
var inject            = require('gulp-inject');
var runSequence       = require('run-sequence');
var visit             = require('rework-visit');
var path              = require('path');
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var mime              = require('mime');
var fs                = require('fs');

gulp.task('default', function (done) {
  runSequence('css', 'inject', done);
});

gulp.task('css', function () {
  gulp.src('src/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({
      includePaths: [ './css-lib' ]
    }))
    .on('data', fixSourceMaps())
    .pipe(sourcemaps.write())
    .pipe(rework(reworkPlugin, {
      sourcemap: true
    }))
    .pipe(gulp.dest('build'));
});

gulp.task('inject', function() {
  gulp.src('src/*.html')
    .pipe(gulp.dest('build'))
    .pipe(inject(gulp.src('build/*.css'), {
      relative: true
    }))
    .pipe(gulp.dest('build'));
});

var sourceMap;

function fixSourceMaps() {
  return function(file) {
    file.base = process.cwd();
    file.path = path.join(process.cwd(), path.basename(file.path));
    file.sourceMap.sources.forEach(function(relative, i, array) {
      array[i] = relative.replace(/^\.{2}[\\\/]/, '')
    });
    sourceMap = new SourceMapConsumer(file.sourceMap);
  }
}

function reworkPlugin(stylesheet) {
  visit(stylesheet, function (declarations, node) {
    declarations.forEach(function (declaration) {
      var analysis = /^(.*)url\s*\(\s*['"]([^'"]*)['"]\s*\)(.*)$/.exec(declaration.value)
      if (analysis) {
        var cssStart  = declaration.position.start;
        var sassStart = sourceMap.originalPositionFor({
          line:   cssStart.line,
          column: cssStart.column
        });
        var sassDir = path.dirname(sassStart.source);
        var urlFile = path.resolve(path.join(sassDir, analysis[2]));
        var type    = mime.lookup(urlFile);
        if (fs.existsSync(urlFile)) {
          var contents = fs.readFileSync(urlFile);
          var base64   = new Buffer(contents).toString('base64');
          analysis[2]  = 'url(data:' + type + ';base64,' + base64 + ')';
          declaration.value = analysis.slice(1).join('');
        } else {
          throw new Error('cannot find source for file "' + urlFile + '"')
        }
      }
    });
  });
}