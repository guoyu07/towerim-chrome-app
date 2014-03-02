$(document).ready(function () {
    changeUrl(getUrlParam("url"));
});

function changeUrl(url) {
    $("#webview").attr("src", url);
}