/**
 * Created by lu7965 on 2016/5/23.
 */
var fs = require('fs');
var path = require('path');
var http= require('http');
var querystring = require('querystring');
var url = require('url');
//用于将获取到的页面进行转码
var iconv = require('iconv-lite');
var BufferHelper = require('bufferhelper');

//用于解析dom结构
var cheerio = require('cheerio');

//用于优化console颜色
var colors = require('colors');

var   flr = require("./FileLineReader");

var reader = new flr.FileLineReader("./stdin/list.txt");
var i =1;
var noresult = 0;
var hasresult = 0;

console.log(('开始于 ' +Date.now()).rainbow);

function getinfo() {
  if(!reader.hasNextLine()){
    console.log(('结束于 ' +Date.now()).rainbow);
    console.log(noresult + '个查询无结果');
    console.log(hasresult + '个查询有结果');
    return false;
  }
  var line = reader.nextLine();
  console.log(("line " + i + " " + line).underline.cyan);
  if(i==400){
    //前400个执行完毕时输出一条显示
    //测试中前400条用时30分钟
    //共有93条无查询结果
    //有问题的数据如 vivo X5M 登记错误
    //A11 匹配错误
    //Lenovo K30-T 登记错误
    //X9000 匹配错误
    console.log('前400条查询完毕'.rainbow);
    console.log(noresult + '个查询无结果');
    console.log(hasresult + '个查询有结果');
    console.log(('当前时间是 ' +Date.now()).rainbow);
  }
  i++;
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
  http.get(rurl, function (res) {
    console.log(rurl)
    var html = '';
    res.on('data', function (data) {
      html += data
    });
    res.on('end', function () {
      html = url.resolve('http://shouji.tenaa.com.cn/JavaScript', html);
      http.get(html,function (res2) {
        //这个网站是gb2312编码
        // console.log(res2.headers['content-type'] );
        var buffer = new BufferHelper();
        res2.on('data', function (data2) {
          buffer.concat(data2);
        });
        res2.on('end', function () {
          var buf = buffer.toBuffer();
          var str = iconv.decode(buf,'GBK');
          var $ = cheerio.load(str);
          // #showMobile 里放着查询结果
          var showMobile = $('#showMobile');
          var lineGrayTD = showMobile.find('.lineGrayTD');
          var ahref;
          var detaileUrl;
          console.log('有 ' + lineGrayTD.length + '个结果');
          if(lineGrayTD.length == 0){
            noresult ++;
            //没有结果的直接进入递归

            fs.appendFile('./stdout/info.txt',line + " : " + "未找到信息" + "\r\n", 'utf8', function (err) {
              if(err)
                console.log(err);
              getinfo();
            });
          }else if(lineGrayTD.length == 1) {
            hasresult ++;
            ahref = lineGrayTD.eq(0).find('a').eq(0).attr('href');
            detaileUrl = url.resolve(html, ahref);
            http.get(detaileUrl,function (res3) {
              var buffer = new BufferHelper();
              res3.on('data', function (data3) {
                buffer.concat(data3);
              });
              res3.on('end', function () {
                var buf = buffer.toBuffer();
                var str = iconv.decode(buf, 'GBK');
                var $ = cheerio.load(str);
                // #showMobile 里放着查询结果
                var showMobile = $('#tblParameter');
                var sizeTD = showMobile.find('tr').eq(10).find('td').eq(1).text();
                var sizeStart = sizeTD.indexOf(':');
                var sizeEnd = sizeTD.indexOf(';');
                var sizeInfo = sizeTD.substring(sizeStart + 1,sizeEnd);
                console.log(('获取到的尺寸信息: ' + sizeInfo).green);
                if(sizeInfo){
                  fs.appendFile('./stdout/info.txt',line + " : " + sizeInfo + "\r\n", 'utf8', function (err) {
                    if(err)
                      console.log(err);
                    getinfo();
                  });
                }else {
                  fs.appendFile('./stdout/info.txt',line + " : " + "未找到信息" + "\r\n", 'utf8', function (err) {
                    if(err)
                      console.log(err);
                    getinfo();
                  });
                }
              })
            })
          }else {
            hasresult ++;
            //进行遍历确认是哪一个
            var c = 0;
            var temptxt,temptda;
            var gettheone = false;
            for(c; c<lineGrayTD.length; c++){
              temptda = $(lineGrayTD[c]).find('tr').eq(1).find('a');
              temptxt = $(lineGrayTD[c]).find('tr').eq(1).find('a').text();
              if(temptxt == line){
                console.log(('最接近的结果 ' + temptxt).yellow);
                gettheone = temptda.attr('href');
                break;
              }
            }

            if(gettheone){
              gettheone = url.resolve(html, gettheone);
              http.get(gettheone,function (res4) {
                var buffer = new BufferHelper();
                res4.on('data', function (data4) {
                  buffer.concat(data4);
                });
                res4.on('end', function () {
                  var buf = buffer.toBuffer();
                  var str = iconv.decode(buf, 'GBK');
                  var $ = cheerio.load(str);
                  // #showMobile 里放着查询结果
                  var showMobile = $('#tblParameter');
                  var sizeTD = showMobile.find('tr').eq(10).find('td').eq(1).text();
                  var sizeStart = sizeTD.indexOf(':');
                  var sizeEnd = sizeTD.indexOf(';');
                  var sizeInfo = sizeTD.substring(sizeStart + 1,sizeEnd);
                  console.log(('获取到的尺寸信息: ' + sizeInfo).green);
                  if(sizeInfo){
                    fs.appendFile('./stdout/info.txt',line + " : " + sizeInfo + "\r\n", 'utf8', function (err) {
                      if(err)
                        console.log(err);
                      getinfo();
                    });
                  }else {
                    fs.appendFile('./stdout/info.txt',line + " : " + "未找到信息" + "\r\n", 'utf8', function (err) {
                      if(err)
                        console.log(err);
                      getinfo();
                    });
                  }

                })
              })
            }else {
              console.log(('没有从结果中分析到准确结果').red);
              fs.appendFile('./stdout/info.txt',line + " : " + "未找到信息" + "\r\n", 'utf8', function (err) {
                if(err)
                  console.log(err);
                getinfo();
              });
            }
          }
        })
      });

    });

  }).on('error',function (e) {
    console.log(e)
  })
}
//开始执行
getinfo();
