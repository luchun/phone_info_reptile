/**
 * Created by lu7965 on 2016/5/19.
 */
function SearchKeyword()
{
    document.getElementById('MobileTitle1_txtkeyword').value = document.getElementById('MobileTitle1_txtkeyword').value.replace(/\'/g,'').replace(/"/g,'');
    if (document.getElementById('MobileTitle1_txtkeyword').value == "")
    {
        alert("请输入要查询的关键字!");
        return;
    }
    var xhr =loadPage();
    var qs = "../JavaScript/WebStation.aspx?type=33&keyword="+document.getElementById('MobileTitle1_txtkeyword').value.replace('&','＆');
    qs=qs.replace(/\+/g,"%2B");

    if (xhr)
    {
        xhr.open("GET", qs, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function()
        {
            if (xhr.readyState == 4 && xhr.status == 200)
            {
                window.open(xhr.responseText);

            }
        }
        xhr.send(null);
    }
}
//http://shouji.tenaa.com.cn/