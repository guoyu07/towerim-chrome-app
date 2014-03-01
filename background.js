chrome.app.runtime.onLaunched.addListener(function() {
    chrome.storage.sync.get("user", function(data) {
        var user = data ? data.user : {};
        if (user && user["access_token"]) {
            console.log(user);
            openView("main");
        } else {
            openView("login");
        }
    });
});


