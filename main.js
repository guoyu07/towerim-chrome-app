/**
 * Created by Li Jie (lijie@hortorgames.com) on 14-3-2.
 * Copyright (c) 2014 Hortor Games. All rights reserved.
 */

var user = "lijie@hortorgames.com";
var pass = "lijie1234";
var clientId = "d7b6e062";
var clientSecret = "af2cde4857bcd529d3f573a17e5aa3ae";

$.post(
    "https://tower.im/api/v2/oauth/token", {
        "client_id": clientId,
        "client_secret": clientSecret,
        "grant_type": "password",
        "username": user,
        "password": pass
    }, function(data) {
        chrome.storage.sync.set({user: data}, function() {

        });
        console.log(data);
    }
)
