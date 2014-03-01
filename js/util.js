function openView(view, callback) {
    chrome.app.window.create("view/" + view + ".html", {
        'type': 'panel',
        'bounds': {
            'width': 400,
            'height': 500
        }
    }, callback);
}
