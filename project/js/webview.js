$(document).ready(function () {
    $("#webview")[0].addEventListener("contentload", function() { $("#loading").hide(); });
    changeUrl(getUrlParam("url"));
});

function changeUrl(url) {
    $("#webview").attr("src", url);
}

