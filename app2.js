/**
 * Created by lu7965 on 2016/5/23.
 */
var fs = require('fs');
var path = require('path');
//var http= require('http');
var http = require('follow-redirects').http;
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

var reader = new flr.FileLineReader("./stdin/temp.txt");
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
  var fixname; //处理后的名字
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
  fixname = preFixName(line);;
  var postData = querystring.stringify({
    'kword' : fixname
  });
  var zolQueryUrl = url.format({
    protocol: 'http:',
    hostname: 'search.zol.com.cn',
    pathname: '/s/all.php',
    search:postData
  });
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
      var sizeparam, aladdinHeader, aladdinHeaderUrl, othername, phonesize, tablesize;
      if(aladdin.length > 0){
        //有找到的结果
        aladdinHeaderUrl = aladdin.find('.item-header').find('h3').find('a').attr('href');
        console.log(url.parse(aladdinHeaderUrl).path);
        aladdinHeader = aladdin.find('.item-header').find('h3').find('a').text();
        if(url.parse(aladdinHeaderUrl).path.indexOf('cell_phone') > -1){
          // pathname 中有 'cell_phone' 的是手机详情页
          sizeparam = aladdin.find('.param-table').find('tr').eq(1).find('td').eq(0).find('span').text();
          othername = parsePhoneName(aladdinHeader);
          phonesize = parsePhoneSize(sizeparam);
          console.log('手机 '+ line + '， 别名 : ' + othername + ' , 分辨率 : ' + phonesize)
        }else if(url.parse(aladdinHeaderUrl).path.indexOf('tablepc') > -1){
          // pathname 中有 'tablepc' 的是平板详情页
          sizeparam = aladdin.find('.param-table').find('tr').eq(2).find('td').eq(1).find('span').text();
          //有一种情况，第一页没有分辨率信息
          if(sizeparam.indexOf('分辨率')<0){
            return zolgetTablepcInfo(aladdinHeaderUrl)
          }else {
            othername = parsePhoneName(aladdinHeader);
            tablesize = parseZolTableSize(sizeparam);
            console.log('平板 '+ line + '， 别名 : ' + othername + ' , 分辨率 : ' + tablesize)
          }
        }else {
          //其他的都是查错了
        }

         console.log(aladdinHeader);
         console.log(sizeparam);
      }else {
        //没找到的情况，启动第二套查找方案 gsmchoice
        console.log('没有从 zol 找到信息，到gsmchoice查找');
        return getGsmchoiceInfo(line)
      }
      getinfo();
    })
  })
}
function zolgetTablepcInfo(url) {
  http.get(url, function (zolQueryRes) {
    var buffer = new BufferHelper();
    console.log(zolQueryRes.headers['content-type'] );
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
      console.log(sizeparam);
      getinfo();
    })
  })
}
// 从名字text中解析正确的名字
function parsePhoneName(text) {
  var start = text.indexOf('【');
  var end = text.indexOf('（');
  var othername = text.substring(start+1,end);
  othername = othername.replace('苹果', 'APPLE ');
  othername = othername.replace('三星', 'SAMSUNG ');
  othername = othername.replace('小米', 'XIAOMI ');
  othername = othername.replace('魅族', 'MEIZU ');
  othername = othername.replace('华为', 'HUAWEI ');
  othername = othername.replace('荣耀', 'HONOR ');
  othername = othername.replace('金立', 'GIONEE ');
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
  console.log(name);
  return name;
}

//通过 Gsmchoice 进行搜索
function getGsmchoiceInfo(name) {
  var fixname = preFixName(name);
  var othername,sizeparam ;
  //这个站点有一个302重定向，所以很慢
  // var r = request.post({
  //   url:'http://zh-cn.gsmchoice.com/zh-cn/search/',
  //   form: {sSearch4:'OPPO R7sm'},
  //   followRedirect : true
  // }, function(err,httpResponse,body){
  //   if(err){
  //     console.log(err)
  //   }
  //   console.log(r.uri);
  //   console.log(httpResponse.request.uri);
  //
  //   if(httpResponse.statusCode == 200){
  //     console.log('啥意思');
  //     var $ = cheerio.load(body);
  //     var phoneModelName = $('body');
  //     console.log(phoneModelName.html())
  //     // 如果返回的是详情页 是有 #PhoneModelName 的
  //     if(phoneModelName.length > 0){
  //       othername = phoneModelName.find('h1').text();
  //       sizeparam = $('.PhoneData').find('li').eq(8).find('.phoneCategoryValue').text();
  //       console.log(sizeparam);
  //     }else {
  //       // 也可能是多个的列表
  //     }
  //   }
  //
  //       // getinfo();
  // });
  var post_data = querystring.stringify({
    'sSearch4' : fixname
  });
  console.log(post_data)
  // gsmchoice 重定向太多
  var post_options = {
    "method": "POST",
    "hostname": "zh-cn.gsmchoice.com",
    "port": null,
    "path": "/zh-cn/search/",
    "headers": {
      "content-type": "application/x-www-form-urlencoded",
      "cache-control": "no-cache",
      "postman-token": "b134aa9f-25c1-5018-9e00-fa20c43715e5"
    }
  };
  // Set up the request
  var post_req = http.request(post_options, function(res) {
    var html = '';
     console.log(res.headers['content-type'] );
     console.log(res.fetchedUrls);
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      console.log('接收中');
      html += chunk;
    });
    res.on('end', function () {
      console.log('已从gsmchoice接收数据');
      var $ = cheerio.load(html);
      var phoneModelName = $('#PhoneModelName');
       // 如果返回的是详情页 是有 #PhoneModelName 的
      console.log(phoneModelName.length)
      if(phoneModelName.length > 0){
        othername = phoneModelName.find('h1').text();
        sizeparam = $('.PhoneData').find('li').eq(8).find('.phoneCategoryValue').text();
        console.log(sizeparam);
      }else {
        // 也可能是多个的列表
      }
      //getinfo();
    })
    res.on('error',function (e) {
      console.log(e)
    })
  });

  // post the data
  // post_req.write("sSearch4=OPPO+R7sm");
  post_req.write(querystring.stringify({ sSearch4: 'OPPO R7sm' }));
  post_req.end();
}
//开始
getinfo();
