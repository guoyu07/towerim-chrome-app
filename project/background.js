chrome.app.runtime.onLaunched.addListener(function() {
    chrome.storage.local.get("user", function(data) {
        var user = data ? data.user : {};
        if (user && user["access_token"] && user["expires_at"]
                 && new Date().getTime() <= user["expires_at"]) {
            openView("main");
        } else {
            openView("login");
        }
    });
});


