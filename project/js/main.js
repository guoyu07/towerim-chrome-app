$(document).ready(function () {

var Task = function(data, localTasks) {
    this.title = data["content_without_gtd_marks"];
    this.emergency = !_.isEmpty(data["priority_marks"]);
    this.running = ko.observable(data.status == "1");

    this.guid = data.guid;
    this.url = "https://tower.im/projects/" + data.project.guid + "/todos/" + data.guid + "/";
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

function initUI() {
    $("img[data-src]").each(function() {
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

function reloadCSS(theme) {
    $("link").remove();
    loadCSS("/lib/bootstrap/css/" + theme.url);
    loadCSS("/css/main.css");
}

// animate visible
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
        var duration = 200;
        var isCurrentlyVisible = !(element.style.display == "none");
        if (value && !isCurrentlyVisible)
            $element.show(duration);
        else if ((!value) && isCurrentlyVisible)
            $element.hide(duration);
    }
};

// two way bind datepicker to date
ko.bindingHandlers.datepicker = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        //initialize datepicker with some optional options
        var options = allBindingsAccessor().datepickerOptions || {
            format: 'yyyy-mm-dd',
            startDate: new Date(),
            autoclose: true,
            todayHighlight: true,
            todayBtn: "linked"
        };
        $(element).datepicker(options);

        //when a user changes the date, update the view model
        ko.utils.registerEventHandler(element, "changeDate", function(event) {
            var value = valueAccessor();
            if (ko.isObservable(value)) {
                value(formatDate(event.date, "yyyy-MM-dd"));
            }
        });
    },
    update: function(element, valueAccessor)   {
        var widget = $(element).data("datepicker");
        //when the view model is updated, update the widget
        if (widget) {
            widget.date = ko.utils.unwrapObservable(valueAccessor());
            if (!widget.date) {
                return;
            }
            if (isString(widget.date)) {
                widget.date = new Date(widget.date);
            }
            widget.setValue();
        }
    }
};

chrome.storage.sync.get(null, function(data) {
    console.log("[init] get storage finish", new Date(), data);
    var user = data.user, token = user["access_token"], localTasks = data.tasks || {};
    var theme = data.theme || { name: "default", url: "bootstrap.min.css" };
    reloadCSS(theme);

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
                callback(null);
                showStatusText(false, "refresh task list failed");
            }
        });
    }

    function dataToProjects(data, localTasks) {
        var projects = _.groupBy(data, function(task) { return task.project.name; });
        return _.map(projects, function(data, name) {
            var project = new function() {
                this.name = name;
                this.guid = data[0].project.guid;
                this.newTask = ko.observable("");
                this.newTaskDate = ko.observable("无限期");
                this.selectedTodolist = null;
                this.selectedTodolistName = ko.observable("todolist ");
                this.todolists = ko.observableArray([]);
                this.showCreateTask = ko.observable(false);
                this.taskCreating = ko.observable(false);
                this.url = "https://tower.im/projects/" + data[0].project.guid + "/";
                this.tasks = ko.observableArray(_.map(data, function(task) { return new Task(task, localTasks) })),
                this.selectTodolist = function(todolist) {
                    project.selectedTodolist = todolist;
                    project.selectedTodolistName(todolist.name + " ");
                }
            };
            return project;
        });
    }

    refreshTasks(function(data) {
        console.log("[init] fetch task list finish", new Date(), data);
        var viewModel = {
            user: user,
            theme: theme,
            themes: [
                { name: "default", url: "bootstrap.min.css" },
                { name: "green",   url: "bootstrap-green.min.css" },
                { name: "dark1",   url: "bootstrap-dark.min.css" },
                { name: "dark2",   url: "bootstrap-dark1.min.css" },
                { name: "simple",  url: "bootstrap-simple.min.css" }
            ],
            changeTheme: function(theme) {
                reloadCSS(theme);
                redraw($("body"));
                chrome.storage.sync.set({"theme": theme});
            },
            loading: ko.observable(false),
            projectUrl: "https://tower.im/teams/" + user.teams[0].team_guid + "/",
            homeUrl: "https://tower.im/members/" + user.teams[0].member_guid + "/?me=1",
            projects: ko.observableArray(dataToProjects(data, localTasks)),
            toggleCreateTask: function(project) {
                project.showCreateTask(!project.showCreateTask());
                if (project.showCreateTask()) {
                    $.ajax({
                        "url": "https://tower.im/api/v2/projects/" + project.guid + "/todolists/",
                        "type": "GET",
                        "data": { "token": token },
                        "success": function(data) {
                            project.todolists.removeAll();
                            _.each(data, function(todolist) {
                                project.todolists.push(todolist);
                            });
                        }, "error": function() {
                            showStatusText(false, "query project todolists failed");
                        }
                    });
                }
            },
            createTask: function(project) {
                if (!project.newTask()) {
                    showStatusText(false, "empty task title");
                    return;
                }
                if (!project.selectedTodolist) {
                    showStatusText(false, "no todolist selected");
                    return;
                }
                project.taskCreating(true);
                var data = {
                    "token": token,
                    "content": project.newTask(),
                    "assignee_guid": viewModel.user.teams[0].member_guid
                };
                console.log(data);
                var due = new Date(project.newTaskDate());
                if (due != "Invalid Date") {
                    data["due_at"] = due.getTime();
                }
                $.ajax({
                    "url": "https://tower.im/api/v2/todolists/" + project.selectedTodolist.guid + "/todos/",
                    "type": "POST",
                    "data": data,
                    "success": function() {
                        showStatusText(true, "create task successfully");
                        project.newTask("");
                        project.taskCreating(false);
                        viewModel.refresh();
                    },
                    "error": function() {
                        project.taskCreating(false);
                        task.commentSubmitting(false);
                        showStatusText(false, "create task failed");
                    }
                });
            },
            toggleTask: function() {
                toggleTaskStatus(this, "running", token, true);
                // 开始一个任务 需要暂停其他开始的任务
                if (this.running()) return;
                var task = this;
                _.each(viewModel.projects(), function(project) {
                    _.each(project.tasks(), function(otherTask) {
                        if (otherTask != task && otherTask.running()) {
                            toggleTaskStatus(otherTask, "running", token, false);
                        }
                    });
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
            refresh: function() {
                var projects = this.projects;
                viewModel.loading(true);
                refreshTasks(function(data) {
                    viewModel.loading(false);
                    if (!data) return;
                    _.each(projects, function(project) {
                        _.each(project.tasks(), function(task) {
                            clearInterval(task._timerId);
                        });
                        project.tasks.removeAll();
                    });
                    projects.removeAll();
                    _.each(dataToProjects(data, localTasks), function(project) {
                        projects.push(project);
                    });
                    initUI();
                });
            }
        };
        console.log(viewModel);
        ko.bindingProvider.instance = new ko.secureBindingsProvider({ attribute: "data-bind" });
        ko.applyBindings(viewModel);
        console.log("[init] view model binding finish", new Date());
        initUI();
    });

    $(document).on("mouseenter", '.list-group-item', function () {
        $(".edit-bar", this).css("display", "block");
    })
    $(document).on("mouseleave", '.list-group-item', function () {
        $(".edit-bar", this).css("display", "none");
    });

});

});
