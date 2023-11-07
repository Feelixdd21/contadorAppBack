var fs = require('co-fs');
var path = require('path');
var views = require('co-views');
var origFs = require('fs');
var koaRouter = require('koa-router');
var bodyParser = require('koa-bodyparser');
var formParser = require('co-busboy');

var Tools = require('./tools');
var FilePath = require('./fileMap').filePath;
var FileManager = require('./fileManager');

var router = new koaRouter();
var render = views(path.join(__dirname, './views'), {map: {html: 'ejs'}});

router.get('/', function *() {
  this.redirect('files');
});

router.get('/files', function *() {
  this.body = yield render('files');
});

router.get('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
  var p = this.request.fPath;
  var stats = yield fs.stat(p);
  if (stats.isDirectory()) {
    this.body = yield * FileManager.list(p);
  }
  else {
    //this.body = yield fs.createReadStream(p);
    this.body = origFs.createReadStream(p);
  }
});

router.del('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
  var p = this.request.fPath;
  yield * FileManager.remove(p);
  this.body = 'Eliminado correctamente!';
});

router.put('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, bodyParser(), function* () {
  var type = this.query.type;
  var p = this.request.fPath;
  if (!type) {
    this.status = 400;
    this.body = 'Tipo de argumento faltante'
  }
  else if (type === 'MOVE') {
    var src = this.request.body.src;
    if (!src || ! (src instanceof Array)) return this.status = 400;
    var src = src.map(function (relPath) {
      return FilePath(relPath, true);
    });
    yield * FileManager.move(src, p);
    this.body = 'Se movio correctamente!';
  }
  else if (type === 'RENAME') {
    var target = this.request.body.target;
    if (!target) return this.status = 400;
    yield * FileManager.rename(p, FilePath(target, true));
    this.body = 'Se cambio el nombre con exito!';
  }
  else {
    this.status = 400;
    this.body = 'Error de tipo de argumento!';
  }
});

router.post('/api/(.*)', Tools.loadRealPath, Tools.checkPathNotExists, bodyParser(), function *() {
  var type = this.query.type;
  var p = this.request.fPath;
  if (!type) {
    this.status = 400;
    this.body = 'Tipo de argumento faltante!';
  }
  else if (type === 'CREATE_FOLDER') {
    yield * FileManager.mkdirs(p);
    this.body = 'Se creo la carpeta con exito!';
  }
  else if (type === 'UPLOAD_FILE') {
    var formData = yield formParser(this.req);
    if (formData.fieldname === 'upload'){
      var writeStream = origFs.createWriteStream(p);
      formData.pipe(writeStream);
      this.body = 'Se subio el archivo correctamente!';
    }
    else {
      this.status = 400;
      this.body = 'Falta subir archivo!';
    }
  }
  else if (type === 'CREATE_ARCHIVE') {
    var src = this.request.body.src;
    if (!src) return this.status = 400;
    src = src.map(function(file) {
      return FilePath(file, true);
    })
    var archive = p;
    yield * FileManager.archive(src, archive, C.data.root, !!this.request.body.embedDirs);
    this.body = 'Se creo archivo correctamente!';
  }
  else {
    this.status = 400;
    this.body = 'Error de tipo de argumento!';
  }
});

module.exports = router.middleware();