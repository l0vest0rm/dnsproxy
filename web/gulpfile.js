var fs = require('fs');
var path = require("path");
var gulp = require("gulp");
var rename = require('gulp-rename');
var through = require('through2');
var browserify = require("browserify");
var source = require("vinyl-source-stream");
var tsify = require("tsify");
var uglify = require("gulp-uglify");
var sourcemaps = require("gulp-sourcemaps");
var buffer = require("vinyl-buffer");
var Handlebars = require('handlebars');
var concat = require('gulp-concat');
var paths = {
  pages: ["src/*.html"],
};

var needHash = [
  'dist/js/bundle.js',
  'dist/css/bundle.css',
]

const hash = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

var hb = Handlebars.create();
hb.registerHelper('eq', (a, b) => a == b);

function registerPartial(folderName) {
  const items = fs.readdirSync(folderName, { withFileTypes: true });
  items.forEach((item) => {
    if (path.extname(item.name) === ".hbs") {
      console.log(`Found file: ${item.name} in folder: ${folderName}`);
      let template = fs.readFileSync(`${folderName}/${item.name}`, 'utf8');
      hb.registerPartial(item.name.replace('.hbs', ''), template);
    }
  });
}

function loadJson(path) {
  if (!fs.existsSync(path)) {
    console.log(`loadJson file not exist ${path}`);
    return {};
  }
  let content = fs.readFileSync(path, 'utf8');
  return JSON.parse(content);
}

function computeHashs(config, needHash) {
  for (let file of needHash) {
    let arr = file.split('/');
    let id = arr[arr.length - 1].replace('.', '')
    config[id] = hash(fs.readFileSync(file, 'utf-8'));
  }
  console.log('computeHashs', config)
}

function handlebars(config) {
  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      this.push(file);
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new Error('Streaming not supported'));
      return cb();
    }

    console.log(`compile ${file.path}`);
    let basename = path.basename(file.path, '.hbs');
    let _config = loadJson(`src/config/${basename}.json`)
    _config = { ...config, ..._config };
    var fileContents = file.contents.toString();
    var template = hb.compile(fileContents);
    file.contents = Buffer.from(template(_config));

    this.push(file);
    cb();
  });
}

gulp.task("copy-html", function () {
  return gulp.src(paths.pages).pipe(gulp.dest("dist"));
});

gulp.task("bundle", function () {
  return browserify({
    standalone: "lib",
    basedir: ".",
    debug: true,
    entries: ["src/bundle.ts"]
  })
    .plugin(tsify)
    .transform("babelify", {
      presets: ["env"],
      extensions: [".ts"],
    })
    .bundle()
    .pipe(source("bundle.js"))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    //.pipe(uglify())
    .pipe(sourcemaps.write("./"))
    .pipe(gulp.dest("dist/js"))
});

//编译模板文件,src指定具体文件或者模糊匹配文件
function compileHbs(src) {
  console.log('compileHbs', src);
  var config = loadJson('src/config/common.json');
  computeHashs(config, needHash);
  registerPartial('src/partials');
  return gulp.src(src)
    .pipe(handlebars(config))
    .pipe(rename(function (path) {
      path.basename = path.basename;
      path.extname = '.html';
    }))
    .pipe(gulp.dest('dist'));
}

gulp.task('compile', function () {
  return compileHbs('src/*.hbs')
});

gulp.task('rangy', function () {
  gulp.src(['dist/js/rangy-core.js', 'dist/js/rangy-classapplier.js', 'dist/js/rangy-highlighter.js', 'dist/js/rangy-textrange.js'])
    .pipe(concat('rangy.js'))
    .pipe(uglify())
    .pipe(gulp.dest('dist/js'));
});

gulp.task("default", function () {
  //初始
  gulp.watch('src/**/*.ts', { ignoreInitial: false, delay: 1000 }, gulp.task('bundle'));
  gulp.watch(['src/partials/*.hbs', 'src/config/*.json', 'dist/**/*.css', 'dist/**/*.js'], { ignoreInitial: false, delay: 1000 }, gulp.task('compile'));
  //gulp.watch('dist/js/*.js', { ignoreInitial: false, delay: 1000 }, gulp.task('rangy'));
  //变动
  gulp.watch('src/*.hbs', { delay: 1000 }).on("change", compileHbs);
});


//https://github.com/BrenMurrell/handlebars-static-html-generator