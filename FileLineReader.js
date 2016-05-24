/*
* Thanks to http://blog.jaeckel.com/2010/03/i-tried-to-find-example-on-using-node.html
 */
var fs = require('fs');

exports.FileLineReader = function (filename, bufferSize) {
  if(!bufferSize){
    bufferSize = 8192;
  }

  var currentPositionInFlie = 0;
  var buffer = '';
  var fd = fs.openSync(filename, "r");

  var fillBuffer = function (position) {
    var res = fs.readSync(fd, bufferSize, position, "utf-8");

    buffer += res[0];
    if(res[1] == 0){
      return -1;
    }
    return position + res[1];
  };

  currentPositionInFlie = fillBuffer(0);

  this.hasNextLine = function () {
    while (buffer.indexOf("\n")== -1){
      currentPositionInFlie = fillBuffer(currentPositionInFlie);
      if(currentPositionInFlie == -1){
        return false
      }
    }

    if(buffer.indexOf("\n") > -1){
      return true
    }
    return false
  };
  this.nextLine = function () {
    var lineEnd = buffer.indexOf("\n");
    var result = buffer.substring(0, lineEnd);

    buffer = buffer.substring(result.length + 1, buffer.length)
    return result
  };
  return this
};

