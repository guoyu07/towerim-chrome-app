! function () {
    $(document).ready(function () {
        var clientId = "d7b6e062";
        var clientSecret = "af2cde4857bcd529d3f573a17e5aa3ae";

        var b, c, d, f, g, h, i, j, k;
        return d = $("#js-login-form"), k = $("#js-username"), g = $("#js-password"), c = $("#js-loading"), h = $("#js-toast"),
             j = null, f = null, b = !1, i = function (a) {
            return h.text(a), h.fadeIn(300), setTimeout(function () {
                return h.fadeOut(300)
            }, 3e3)
        },
        d.on("submit", function () {
            if (j = k.val(), f = g.val(), !j || !f) return !1;
            $.ajax({
                url: "https://tower.im/api/v2/oauth/token",
                data: {
                    "client_id": clientId,
                    "client_secret": clientSecret,
                    "grant_type": "password",
                    "username": k.val(),
                    "password": g.val()
                },
                type: "POST",
                dataType: "JSON",
                success: function (data) {
                    return chrome.storage.sync.set({"user": data}, function () {
                        return openView("main", function () {
                            return chrome.app.window.current().close()
                        })
                    })
                },
                error: function () {
                    return c.fadeOut(300), d.fadeIn(300), i("用户名或密码错误")
                }
            });
            return d.fadeOut(300), c.fadeIn(300), !1
        })
    })
}.call(this);