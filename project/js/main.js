$(document).ready(function () {

var Task = function(data) {
    this.title = data["content_without_gtd_marks"];
    this.emergency = !_.isEmpty(data["priority_marks"]);
    this.running = ko.observable(data.status == "1");
    this.guid = data.guid;
    this.project = data.project;
    this.completed = ko.observable(false);
    if (data["due_at"]) {
        this.due = calcDateDistance(new Date(data["due_at"]));
    }
}

function toggleTaskStatus(task, attr, token, showStatus) {
    var data = {}, status = task[attr]();
    data[attr] = status ? 0 : 1;
    $.ajax({
        "url": "https://tower.im/api/v2/todos/" + task.guid + "/?token=" + token,
        "method": "PUT",
        "data": data,
        "success": function(res) {
            if (res.success) {
                task[attr](!status);
                if (showStatus) showStatusText(true, "edit task successfully");
            }
        },
        error: function() {
            showStatusText(false, "edit task failed");
        }
    });
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

chrome.storage.sync.get("user", function(data) {
    var user = data.user, token = user["access_token"];
    function refreshTasks(callback) {
        $.ajax(
            "https://tower.im/api/v2/members/" + user.teams[0].member_guid + "/todos", {
                data: { "token": token },
                success: function(data) {
                    callback(data);
                    showStatusText(true, "refresh task list successfully");
                },
                error: function() {
                    showStatusText(false, "refresh task list failed");
                }
            }
        );
    }

    refreshTasks(function(data) {
        console.log(data);
        var viewModel = {
            user: user,
            tasks: ko.observableArray(_.map(data, function(task) { return new Task(task); })),
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
                        method: "DELETE",
                        success: function() {
                            showStatusText(true, "delete task successfully");
                        },
                        error: function() {
                            showStatusText(false, "delete task failed");
                        }
                    }
                );
            },
            finishTask: function() {
                toggleTaskStatus(this, "completed", token);
            },
            openTaskUrl: function() {
                openUrl("https://tower.im/projects/" + this.project.guid + "/todos/" + this.guid + "/");
            },
            refresh: function() {
                var tasks = this.tasks;
                refreshTasks(function(data) {
                    tasks.removeAll();
                    _.each(data, function(task) {
                        tasks.push(new Task(task));
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