function openView(view, callback) {
    chrome.app.window.create("/view/" + view + ".html", {
        'type': 'shell',
        'bounds': {
            'width': 400,
            'height': 500
        }
    }, callback);
}

var webviewWindowId = "towerim-ex-webview-window";
function openUrl(url, callback) {
    console.log("open url: " + url);
    var win = chrome.app.window.get(webviewWindowId)
    if (win) {
        win.contentWindow.changeUrl(url);
        win.show();
    } else {
        chrome.app.window.create("/view/webview.html?url=" + encodeURIComponent(url), {
            'id': webviewWindowId,
            'type': 'shell',
            'bounds': {
                'width': 1024,
                'height': 800
            }
        }, function(createdWindow) {
            webviewWindowId = createdWindow.id;
            if (_.isFunction(callback)) {
                callback(createdWindow);
            }
        });
    }
}

function getUrlParam(key) {
    var result = new RegExp(key + "=([^&]*)", "i").exec(window.location.search);
    return result && decodeURIComponent(result[1]) || "";
}

function calcDateDistance(from, to) {
    to = to || new Date();
    to.setHours(0);
    to.setMinutes(0);
    to.setSeconds(0);
    to.setMilliseconds(0);
    var d = (from.getTime() - to.getTime()) / (86400 * 1000);
    if (d >= 0) {
        if (d < 1) return "今天";
        d = Math.floor(d);
        if (d == 1) return "明天";
        else if (d == 2) return "后天";
        else return d + "天后";
    } else {
        d = Math.ceil(-d);
        if (d == 1) return "昨天";
        else if (d == 2) return "前天";
        else return d + "天前";
    }
}