var fs = require('fs');
var path = require('path');
var readline = require('readline');
var http= require('http');
var querystring = require('querystring');
var url = require('url');

var rl = readline.createInterface({
    input: fs.createReadStream('p.txt')
});
rl.on('line',function (line) {
    console.log('Line from file:', line);
    var postData = querystring.stringify({
        'type' : 33,
        'keyword' : line
    });
    var rurl = url.format({
        protocol: 'http:',
        hostname: 'shouji.tenaa.com.cn',
        pathname: '/JavaScript/WebStation.aspx',
        search:postData
    });
    var options = {
        protocol: 'http:',
        hostname: 'shouji.tenaa.com.cn',
        pathname: '/JavaScript/WebStation.aspx',
        method: 'GET',
        search:postData,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    http.get(rurl, function (res) {
        var html = '';
        res.on('data', function (data) {
            html += data
        });
        res.on('end', function () {
            console.log(html)
        })
      res.on('error', function (e) {
        console.log(e)
      })
    }).on('error',function (e) {
        console.log(e)
    })

});
