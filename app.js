/**
 * Created by lu7965 on 2016/5/23.
 */
var fs = require('fs');
var path = require('path');
var http= require('http');
var querystring = require('querystring');
var url = require('url');
//var request = require('request');
//用于将获取到的页面进行转码
var iconv = require('iconv-lite');
var BufferHelper = require('bufferhelper');

//用于解析dom结构
var cheerio = require('cheerio');

//用于优化console颜色
var colors = require('colors');

var   flr = require("./FileLineReader");

var reader = new flr.FileLineReader("./stdin/400.txt");
//todo 判断路径新建或者添加，可以接收指定的文件名
var outputFile = './stdout/info.txt'; // 输出信息将写入的文件
var statistics = { //统计分析
  count : 0, //统计数量
  noResult : 0, //统计无结果的手机
  hasResult : 0, //统计有结果的手机
  fromZol : 0, //统计从 Zol 获取到的手机
  fromTenaa : 0 //统计从 Tenaa 获取到的手机
}

console.log(('开始于 ' + ( new Date(Date.now()))).rainbow);

/**
 * @function getinfo 查询的主体函数
 * @params second boolean 是否是第二次改名查询，不是得话无
 * @params sourcename {string} 如果是第二次查询的话，传进来原名字，
 * */
function getinfo(second, sourcename) {

  if(!second && !reader.hasNextLine()){
    console.log(('结束于 ' + ( new Date( Date.now()))).rainbow);
    console.log(statistics.noResult + '个查询无结果');
    console.log(statistics.hasResult + '个查询有结果');
    console.log(statistics.fromZol + '个查询数据完整');
    console.log(statistics.fromTenaa + '个查询数据只有分辨率缺少别名');
    return false;
  }

  var line,  //从源文件中读取的一个手机名 或者重复传入的名字
    fixname; //处理后的名字

  if(!second){
    line = reader.nextLine();
  }else {
    line = sourcename;
  }
  // 如果不是第二次换名查询，则打印一条标记
  if(!second){
    console.log(("开始查找 line " + (statistics.count+1) + " " + line).underline.cyan);
  }

  if(statistics.count == 400){
    console.log('前400条查询完毕'.rainbow);
    console.log(statistics.noResult + '个查询无结果');
    console.log(statistics.hasResult + '个查询有结果');
    console.log(('当前时间是 ' +( new Date(Date.now()))).rainbow);
  }
  //如果是第二次换名查询就不计数
  if(!second){
    statistics.count++;
    fixname = preFixName(line);
  }else {
    fixname = reFixName(line);
  }

  var postData = querystring.stringify({
      'kword' : fixname
    }, null, null,
    { encodeURIComponent: encodeURIComponent_GBK });

  var zolQueryUrl = url.format({
    protocol: 'http:',
    hostname: 'search.zol.com.cn',
    pathname: '/s/all.php',
    search:postData
  });
  // console.log(zolQueryUrl)
  http.get(zolQueryUrl, function (zolQueryRes) {
    var buffer = new BufferHelper();
    // console.log(zolQueryRes.headers['content-type'] );
    var zolQueryHTML = '';
    zolQueryRes.on('data', function (data) {
      buffer.concat(data)
    });
    zolQueryRes.on('end', function () {
      var buf = buffer.toBuffer();
      var zolQueryHTML = iconv.decode(buf,'GBK');
      var $ = cheerio.load(zolQueryHTML);
      var aladdin = $('.result-for-aladdin');
      var sizeparam, aladdinHeader, aladdinHeaderUrl,aladdinBox,aladdinItem, othername, phonesize, tablesize;
      if(aladdin.length > 0){
        //有找到的结果
        aladdinHeaderUrl = aladdin.find('.item-header').find('h3').find('a').attr('href');
        // 可以通过path判断是否
        // console.log(url.parse(aladdinHeaderUrl).path);
        aladdinHeader = aladdin.find('.item-header').find('h3').find('a').text();
        if(url.parse(aladdinHeaderUrl).path.indexOf('cell_phone') > -1){
          // pathname 中有 'cell_phone' 的是手机详情页
          sizeparam = aladdin.find('.param-table').find('tr').eq(1).find('td').eq(0).find('span').text();
          othername = parsePhoneName(aladdinHeader);
          phonesize = parsePhoneSize(sizeparam);
          console.log(('手机 '+ line + '， 别名 : ' + othername + ' , 分辨率 : ' + phonesize).green);
          statistics.fromZol++;
          statistics.hasResult++;
          writeFile(line, othername, phonesize, zolQueryUrl, getinfo);
          // 统计数据加一
        }else if(url.parse(aladdinHeaderUrl).path.indexOf('tablepc') > -1){
          // pathname 中有 'tablepc' 的是平板详情页
          sizeparam = aladdin.find('.param-table').find('tr').eq(2).find('td').eq(1).find('span').text();
          //有一种情况，第一页没有分辨率信息
          if(sizeparam.indexOf('分辨率')<0){
            othername = parsePhoneName(aladdinHeader);
            return zolgetTablepcInfo(line, othername, aladdinHeaderUrl)
          }else {
            othername = parsePhoneName(aladdinHeader);
            tablesize = parseZolTableSize(sizeparam);
            statistics.hasResult++;
            statistics.fromZol++;
            console.log(('平板 '+ line + '， 别名 : ' + othername + ' , 分辨率 : ' + tablesize).green);
            writeFile(line, othername, tablesize, zolQueryUrl, getinfo);
          }
        }else {
          //其他的都是查错了
          //先换名查询，最后到手机信息网
          if(!second){
            console.log(('没有找到 ' + line + ' , 将再次查询').yellow)
            return getinfo(true, line)
          }else {
            console.log('没有从 zol 找到准确信息，到手机信息网查找'.yellow);
            return geTenaaInfo(line)
          }

        }
      }else {
        //没找到的情况，
        //先换名查询，最后到手机信息网
        if(!second){
          console.log(('没有找到 ' + line + ' , 将再次查询').yellow)
          return getinfo(true, line)
        }else {


          //当前是二次查询，且结果页面没有 $('.result-for-aladdin') 这时候有可能有 个 $('.aladdin-box')是最接近的列表
          aladdinBox = $('.aladdin-box');
          if(aladdinBox.length< 1){
            //启动第二套查找方案 手机信息网
            console.log('没有从 zol 找到信息，到手机信息网查找'.yellow);
            return geTenaaInfo(line)
          }
          aladdinItem = aladdinBox.find('.aladdin_list').eq(0);
          if(aladdinItem.find('.title').attr('href') && aladdinItem.find('.title').attr('href').indexOf('cell_phone') > -1){
            othername = aladdinItem.find('.title').attr('title');
            othername = parsePhoneName(othername);
            sizeparam = aladdinItem.find('.param-table').find('tr').eq(1).find('td').eq(0).text();
            phonesize = parsePhoneSize(sizeparam);
            statistics.hasResult++;
            statistics.fromZol++;
            console.log(('手机 '+ line + '， 别名 : ' + othername + ' , 分辨率 : ' + phonesize).green);
            writeFile(line, othername, phonesize, aladdinItem.find('.title').attr('href'), getinfo);
          }else {
            //启动第二套查找方案 手机信息网
            console.log('没有从 zol 找到信息，到手机信息网查找'.yellow);
            return geTenaaInfo(line)
          }
        }
      }
    })
  })
}
function zolgetTablepcInfo(line, othername, url) {
  http.get(url, function (zolQueryRes) {
    var buffer = new BufferHelper();
    // console.log(zolQueryRes.headers['content-type'] );
    var zolQueryHTML = '';
    zolQueryRes.on('data', function (data) {
      buffer.concat(data)
    });
    zolQueryRes.on('end', function () {
      var buf = buffer.toBuffer();
      var zolQueryHTML = iconv.decode(buf,'GBK');
      var $ = cheerio.load(zolQueryHTML);
      var configSection = $('.config-section');
      var productParamItem = configSection.find('.product-param-item');
      var productParamItemFirst = productParamItem.find('li').eq(0);
      var sizeparam = productParamItemFirst.find('p').eq(1).attr('title');

      statistics.fromZol++;
      statistics.hasResult++;
      console.log(('平板 '+ line + '， 别名 : ' + othername + ' , 分辨率 : ' + sizeparam).green)
      writeFile(line, othername, sizeparam, url, getinfo);
    })
  })
}
// 从名字text中解析正确的名字
function parsePhoneName(text) {
  var start = text.indexOf('【');
  var end = text.indexOf('（');
  if(end < 0)
    end = text.indexOf('】');
  var othername = text.substring(start+1,end);
  othername = othername.replace('苹果', 'APPLE ');
  othername = othername.replace('三星', 'SAMSUNG ');
  othername = othername.replace('小米', 'XIAOMI ');
  othername = othername.replace('红米', 'HM ');
  othername = othername.replace('魅族', 'MEIZU ');
  othername = othername.replace('魅蓝', 'Meilan ');
  othername = othername.replace('华为', 'HUAWEI ');
  othername = othername.replace('荣耀', 'HONOR ');
  othername = othername.replace('麦芒', 'Maimang ');
  othername = othername.replace('畅玩', 'Changwan ');
  othername = othername.replace('金立', 'GIONEE ');
  othername = othername.replace('中兴', 'ZTE ');
  othername = othername.replace('联想', 'Lenovo ');
  othername = othername.replace('美图', 'Meitu ');
  othername = othername.replace('黑莓', 'BlackBerry ');
  return othername;
}
//从 text 中解析正确的分辨率
function parsePhoneSize(text) {
  var start = text.indexOf('  ');  //两个空格
  var end = text.lastIndexOf('像');
  var pureSize;
  if(end<0){
    pureSize = text.substring(start + 2)
  }else {
    pureSize = text.substring(start + 2, end)
  }
  return pureSize
}
//从zol 的 查询结果 table 中取得分辨率
function parseZolTableSize(text) {
  var start = text.indexOf('：');
  var pureSize = text.substring(start + 1);
  return pureSize;
}

// 对名字进行预处理
// 都是根据经验进行的预判

function preFixName(name){
  //去掉LTETD, 如 HM NOTE 1LTETD
  name = name.replace('LTETD','');
  //去掉LTEW, 如 HM NOTE 1LTEW
  name = name.replace('LTEW','');
  //去掉LTE 如 ZTE Grand S II LTE
  name = name.replace('LTE','');

  //将 Redmi 替换为 红米;
  name = name.replace('Redmi','红米');
  //将 'HM ' 替换为 红米;
  name = name.replace('HM ','红米 ');
  //把 '红米 NOTE 1' 转为 '红米 NOTE'
  if(name == '红米 NOTE 1'){
    name = '红米 NOTE'
  }


  return name;
}
function reFixName(name) {
  //一般 SM-开头的都是 三星公司的产品
  //先 "SM-" 查询，找不到的再 "三星 " 查询， 最后进入 "手机信息网查询"
  name = name.replace('SM-','三星 ');
  // 有时候去掉'HUAWEI' 能找到信息;
  name = name.replace('HUAWEI','');
  // 有时候去掉oppo 能找到信息
  name = name.replace('OPPO ','');
  // 有时候去掉 vivo 能找到信息
  name = name.replace('vivo ','');
  // todo "-" 好像用gb2312编码后有点问题
  // name = name.replace('-',' ');
  return name;
}

//通过 tenaa 进行搜索
function geTenaaInfo(name) {
  var line = name;
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
    var firsturl = '';
    res.on('data', function (data) {
      firsturl += data
    });
    res.on('end', function () {
      firsturl = url.resolve('http://shouji.tenaa.com.cn/JavaScript', firsturl);

      http.get(firsturl,function (res2) {
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
          if(lineGrayTD.length == 0){
            // 没有查询到结果的直接进入递归
            // 统计数据
            statistics.noResult++;
            console.log(('没有从手机信息网中获取到结果').red);
            writeFile(line, '未找到别名', '未找到分辨率信息', firsturl, getinfo);
          }else if(lineGrayTD.length == 1) {

            ahref = lineGrayTD.eq(0).find('a').eq(0).attr('href');
            detaileUrl = url.resolve(firsturl, ahref);
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
                // console.log(('获取到的尺寸信息: ' + sizeInfo).green);
                // 统计数据加一
                if(sizeInfo){
                  statistics.fromTenaa++;
                  statistics.hasResult++;
                  writeFile(line, '未找到别名', sizeInfo, detaileUrl, getinfo)
                }else {
                  statistics.noResult++;
                  writeFile(line, '未找到别名', '未找到分辨率信息', detaileUrl, getinfo);
                }
              })
            })
          }else {

            //进行遍历确认是哪一个
            var c = 0;
            var temptxt,temptda;
            var gettheone = false;
            for(c; c<lineGrayTD.length; c++){
              temptda = $(lineGrayTD[c]).find('tr').eq(1).find('a');
              temptxt = $(lineGrayTD[c]).find('tr').eq(1).find('a').text();
              if(temptxt == line){
                // console.log(('最接近的结果 ' + temptxt).yellow);
                gettheone = temptda.attr('href');
                break;
              }
            }

            if(gettheone){
              gettheone = url.resolve(firsturl, gettheone);
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
                  // console.log(('获取到的尺寸信息: ' + sizeInfo).green);
                  // 统计数据加一
                  if(sizeInfo){
                    statistics.fromTenaa++;
                    statistics.hasResult++;
                    writeFile(line, '未找到别名', sizeInfo, gettheone, getinfo)
                  }else {
                    statistics.noResult++;
                    writeFile(line, '未找到别名', '未找到分辨率信息', gettheone, getinfo);
                  }
                })
              })
            }else {
              //统计数据
              statistics.noResult++;
              console.log(('没有从手机信息网中获取到结果').red);
              writeFile(line, '未找到别名', '未找到分辨率信息', firsturl, getinfo);
            }
          }
        })
      });

    });

  }).on('error',function (e) {
    console.log(e)
  })
}

/**
 * @function writeFile
 * @param {string} name 设备名称
 * @param {string} othername 设备别名
 * @param {string} size 设备分辨率参数
 * @param {string} link 获取信息的地址,将被写到SQL的注释中，方便回查
 * @param {function} cb 异步写入后的回调，一般是写入后进行下一次爬取
 * */
function writeFile(name, othername, size, link, cb) {
  fs.appendFile(outputFile, "INSERT INTO #TEMP VALUES ('" + name + "','" + othername + "','" + size + "') /* " + link + " */" + '\r\n', 'utf8', function (err) {
    if(err)
      console.log(err);
    cb && cb();
  });
}
//GBK编码
//参考 https://cnodejs.org/topic/50fb0178df9e9fcc58c565c9
function encodeURIComponent_GBK(str) {
  if(str==null || typeof(str)=='undefined' || str=='')
    return '';

  var a = str.toString().split('');

  for(var i=0; i<a.length; i++) {
    var ai = a[i];
    if( (ai>='0' && ai<='9') || (ai>='A' && ai<='Z') || (ai>='a' && ai<='z') || ai==='.' || ai==='-' || ai==='_') continue;
    var b = iconv.encode(ai, 'gbk');
    var e = ['']; // 注意先放个空字符串，最保证前面有一个%
    for(var j = 0; j<b.length; j++)
      e.push( b.toString('hex', j, j+1).toUpperCase() );
    a[i] = e.join('%');
  }
  return a.join('');
}
//开始
getinfo();
