$(document).ready(function () {

var Task = function(data, localTasks) {
    this.title = data["content_without_gtd_marks"];
    this.emergency = !_.isEmpty(data["priority_marks"]);
    this.running = ko.observable(data.status == "1");

    this.guid = data.guid;
    this.project = data.project;
    this.completed = ko.observable(false);
    this.showComments = ko.observable(false);
    this.newComment = ko.observable("");
    this.comments = ko.observableArray([]);
    this.commentSubmitting = ko.observable(false);

    var local = localTasks[this.guid] || {};
    this.usedSeconds = local.usedSeconds || 0;
    this.timerText = ko.observable("");
    this._timerId = null;
    if (data["due_at"]) {
        this.due = calcDateDistance(new Date(data["due_at"]));
    }
    syncTaskTimeRecorder(this);
}

function toggleTaskStatus(task, attr, token, showStatus, callback) {
    var data = {}, status = task[attr]();
    data[attr] = status ? 0 : 1;
    $.ajax({
        "url": "https://tower.im/api/v2/todos/" + task.guid + "/?token=" + token,
        "type": "PUT",
        "data": data,
        "success": function(res) {
            if (res.success) {
                task[attr](!status);
                if (showStatus) showStatusText(true, "edit task successfully");
                if (attr == "running") {
                    syncTaskTimeRecorder(task);
                }
                if (_.isFunction(callback)) {
                    callback(task);
                }
            }
        },
        error: function() {
            showStatusText(false, "edit task failed");
        }
    });
}

function syncTaskTimeRecorder(task) {
    function saveUsedTime(task) {
        chrome.storage.sync.get("tasks", function(data) {
            var localTasks = data.tasks || {};
            localTasks[task.guid] = localTasks[task.guid] || {};
            localTasks[task.guid].usedSeconds = task.usedSeconds;
            chrome.storage.sync.set({"tasks": localTasks});
        });
    }

    clearInterval(task._timerId);
    delete task._timerId;
    if (!task.running() || task.completed()) {
        saveUsedTime(task);
    } else {
        var counter = 0;
        task._timerId = setInterval(function() {
            task.usedSeconds ++;
            task.timerText(secondsToTimeInterval(task.usedSeconds));
            counter ++;
            if (counter % 30 == 0) {
                saveUsedTime(task);
            }
        }, 1000);
    }
}

function loadRemoteImage() {
    $("img[data-bind]").each(function() {
        var remoteImg = new RAL.RemoteImage({element: this, width: 24, height: 24});
        RAL.Queue.add(remoteImg);
    });
    RAL.Queue.setMaxConnections(4);
    RAL.Queue.start();
}

function showStatusText(status, text) {
    var className = status ? "alert-success" : "alert-danger";
    $("#statusbar").removeClass("alert-success alert-danger");
    $("#statusbar").stop(false, true).addClass(className).text(text).fadeIn().delay(2500).fadeOut();
}


ko.bindingHandlers.visible = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        var $element = $(element);
        if (value)
            $element.show();
        else
            $element.hide();
    },
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        var $element = $(element);
        var allBindings = allBindingsAccessor();
        // Grab data from binding property
        var duration = allBindings.duration || 250;
        var isCurrentlyVisible = !(element.style.display == "none");
        if (value && !isCurrentlyVisible)
            $element.show(duration);
        else if ((!value) && isCurrentlyVisible)
            $element.hide(duration);
    }
};

chrome.storage.sync.get(null, function(data) {
    var user = data.user, token = user["access_token"], localTasks = data.tasks || {};
    function refreshTasks(callback) {
        var url = "https://tower.im/api/v2/members/" + user.teams[0].member_guid + "/todos";
        $.ajax({
            url: url,
            data: { "token": token },
            success: function(data) {
                callback(data);
                showStatusText(true, "refresh task list successfully");
            },
            error: function() {
                showStatusText(false, "refresh task list failed");
            }
        });
    }

    refreshTasks(function(data) {
        var viewModel = {
            user: user,
            tasks: ko.observableArray(_.map(data, function(task) { return new Task(task, localTasks); })),
            toggleTask: function() {
                toggleTaskStatus(this, "running", token);
                // 开始一个任务 需要暂停其他开始的任务
                if (this.running()) return;
                _.each(viewModel.tasks(), function(otherTask) {
                    if (otherTask != this && otherTask.running()) {
                        toggleTaskStatus(otherTask, "running", token, false);
                    }
                });
            },
            editTask: function() {
                console.log(this);
            },
            deleteTask: function() {
                $.ajax(
                    "https://tower.im/api/v2/todos/" + this.guid + "/?token=" + token, {
                        "type": "DELETE",
                        "success": function() {
                            showStatusText(true, "delete task successfully");
                        },
                        "error": function() {
                            showStatusText(false, "delete task failed");
                        }
                    }
                );
            },
            finishTask: function() {
                toggleTaskStatus(this, "completed", token, true, function(task) {
                    if (task.completed()) {
                        viewModel._submitComment(task, "任务完成，总共耗时：" + secondsToTimeInterval(task.usedSeconds), false);
                        task.running(false);
                        syncTaskTimeRecorder(task);
                    }
                });
            },
            openTaskUrl: function() {
                openUrl("https://tower.im/projects/" + this.project.guid + "/todos/" + this.guid + "/");
            },
            _refreshComment: function(task) {
                $.ajax({
                    "url": "https://tower.im/api/v2/todos/" + task.guid + "/",
                    "type": "GET",
                    "data": { "token": token },
                    "success": function(data) {
                        task.comments.removeAll();
                        _.each(data.comments.reverse(), function(comment) {
                            task.comments.push(comment);
                        });
                    }
                });
            },
            toggleComments: function(task) {
                task.showComments(!task.showComments());
                if (task.showComments()) {
                    viewModel._refreshComment(task);
                }
            },
            _submitComment: function(task, comment, byUser) {
                $.ajax({
                    "url": "https://tower.im/api/v2/todos/" + task.guid + "/comments",
                    "type": "POST",
                    "data": { "token": token, "content": comment },
                    "success": function() {
                        if (byUser) {
                            showStatusText(true, "submit comment successfully");
                            task.newComment("");
                            task.commentSubmitting(false);
                        }
                        viewModel._refreshComment(task);
                    },
                    "error": function() {
                        if (byUser) {
                            task.commentSubmitting(false);
                        }
                        showStatusText(false, "submit comment failed");
                    }
                });
            },
            addComment: function(task) {
                if (!task.newComment()) {
                    showStatusText(false, "empty comment")
                    return;
                }
                task.commentSubmitting(true);
                viewModel._submitComment(task, task.newComment(), true);
            },
            openProject: function() {
                openUrl("https://tower.im/teams/" + user.teams[0].team_guid + "/");
            },
            openHome: function() {
                openUrl("https://tower.im/members/" + user.teams[0].member_guid + "/?me=1");
            },
            refresh: function() {
                var tasks = this.tasks;
                refreshTasks(function(data) {
                    _.each(tasks(), function(task) {
                        clearInterval(task._timerId);
                    });
                    tasks.removeAll();
                    _.each(data, function(task) {
                        tasks.push(new Task(task, localTasks));
                    });
                    loadRemoteImage();
                });
            }
        };
        console.log(viewModel);
        ko.bindingProvider.instance = new ko.secureBindingsProvider({ attribute: "data-bind" });
        ko.applyBindings(viewModel);
        loadRemoteImage();
    });

    $(document).on("mouseenter", '.list-group-item', function () {
        $(".edit-bar", this).css("display", "block");
    })
    $(document).on("mouseleave", '.list-group-item', function () {
        $(".edit-bar", this).css("display", "none");
    });

});

});
