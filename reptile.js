var fs = require('fs');
var path = require('path');
var readline = require('readline');
var http= require('http');

var rl = readline.createInterface({
    input: fs.createReadStream('t.txt')
});
rl.on('line',function (line) {
    console.log('Line from file:', line.replace(/\'/g,'').replace(/"/g,'').replace('&','＆').replace(/\+/g,"%2B"));
    http.request()
});