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
function openUrl(url, callback, isHide) {
    console.log("open url: " + url);
    function createWebview(url, callback, isHide) {
        chrome.app.window.create("/view/webview.html?url=" + encodeURIComponent(url), {
            'id': "towerim-ex-webview-window-" + Math.random(),
            'type': 'shell',
            'hidden': !!isHide,
            'bounds': {
                'width': 1100,
                'height': 800
            }
        }, callback);
    }

    function onWebviewClosed() {
        createWebview(url, function(createdWindow) {
            webviewWindowId = createdWindow.id;
            createdWindow.onClosed.addListener(onWebviewClosed);
        }, true);
    }

    var win = chrome.app.window.get(webviewWindowId)
    if (win) {
        win.contentWindow.changeUrl(url);
        win.show();
    } else {
        createWebview(url,  function(createdWindow) {
            webviewWindowId = createdWindow.id;
            createdWindow.onClosed.addListener(onWebviewClosed);
            if (_.isFunction(callback)) {
                callback(createdWindow);
            }
        }, !!isHide);
    }
}

function isString(obj) {
    return typeof obj == 'string' || obj instanceof String;
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

function secondsToTimeInterval(seconds) {
    var text = "";
    if (seconds >= 3600) {
        text += Math.floor(seconds / 3600) + "h";
        seconds = seconds % 3600;
    }
    if (seconds >= 60) {
        text += " " + Math.floor(seconds / 60) + "m";
        seconds = seconds % 60;
    }
    if (seconds > 0) {
        text += " " + seconds + "s";
    }
    return text;
}