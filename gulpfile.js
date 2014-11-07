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
  return gulp.src('src/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({
      includePaths: [ './css-lib', './node_modules' ]
    }))
    .on('data', fixSourceMaps())
    .pipe(sourcemaps.write())
    .pipe(rework(reworkPlugin, {
      sourcemap: true
    }))
    .pipe(gulp.dest('build'));
});

gulp.task('inject', function() {
  return gulp.src('src/*.html')
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

  // visit each node (selector) in the stylesheet recursively using the official utility method
  visit(stylesheet, function (declarations, node) {

    // each node may have multiple declarations
    declarations.forEach(function (declaration) {

      // reverse the original source-map to find the original sass file
      var cssStart  = declaration.position.start;
      var sassStart = sourceMap.originalPositionFor({
        line:   cssStart.line,
        column: cssStart.column
      });
      var sassDir = path.dirname(sassStart.source);

      // allow multiple url() values in the declaration
      //  the url will be every second value (i % 2)
      declaration.value = declaration.value
        .split(/url\s*\(\s*['"]([^'"?#]*)(?:\?[^'"]*)?['"]\s*\)/g)
        .map(function (token, i) {
          if (i % 2) {
            var split = [ sassDir, token ];
            for (var i = 0; i < 3; i++, split.splice(1, 0, '..')) {   // hack to look up to 2 directories further up
              var urlFile = path.resolve(path.join.apply(path, split));
              if (fs.existsSync(urlFile)) {
                var type     = mime.lookup(urlFile);
                var contents = fs.readFileSync(urlFile);
                var base64   = new Buffer(contents).toString('base64');
                return 'url(data:' + type + ';base64,' + base64 + ')';
              }
            }
          }
          return token;
        }).join('');
    });
  });
}