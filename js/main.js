$(document).ready(function () {

var Task = function(data) {
    this.title = data.content;
    this.emergency = !_.isEmpty(data["priority_marks"]);
    this.running = data.status == "1";
    this.guid = data.guid;
    this.project = data.project;
    this.completed = ko.observable(false);
    if (data["due_at"]) {
        this.due = calcDateDistance(new Date(data["due_at"]));
        console.log(this.due);
    }
}

chrome.storage.sync.get("user", function(data) {
    var user = data.user, token = user["access_token"];
    $.get("https://tower.im/api/v2/members/7c93bc8f591045f3b60eb8c9b073d9da/todos", {"token":token}, function(data) {
        console.log(data);
        var viewModel = {
            user: user,
            tasks: ko.observableArray(_.map(data, function(task) { return new Task(task); })),
            toggleTask: function() {
                var status = this.running ? "pause" : "running";
                $.post("https://tower.im/api/v2/todos/" + this.guid + "/" + status, function(data) {
                    console.log(data)
                })
                console.log(this);
            },
            editTask: function() {
                console.log(this);
            },
            deleteTask: function() {
                console.log(this);
            },
            finishTask: function() {
                (function(task, completed) {
                    $.ajax({
                        "url": "https://tower.im/api/v2/todos/" + task.guid + "/?token=" + token,
                        "method": "PUT",
                        "data": { "completed": completed ? 0 : 1 },
                        "success": function(res) {
                            if (res.success) task.completed(!completed);
                        }
                    })
                })(this, this.completed());
            },
            openTaskUrl: function() {
                openUrl("https://tower.im/projects/" + this.project.guid + "/todos/" + this.guid + "/");
            }
        };
        console.log(viewModel);
        ko.bindingProvider.instance = new ko.secureBindingsProvider({ attribute: "data-bind" });
        ko.applyBindings(viewModel);

        // load xhr img
        $("img[data-bind]").each(function() {
            var remoteImg = new RAL.RemoteImage({element: this});
            RAL.Queue.add(remoteImg);
        });
        RAL.Queue.setMaxConnections(4);
        RAL.Queue.start();
    });

    $(document).on("mouseenter", '.list-group-item', function () {
        $(".edit-bar", this).css("display", "block");
    })
    $(document).on("mouseleave", '.list-group-item', function () {
        $(".edit-bar", this).css("display", "none");
    });


    //$("body").html(_.template($("#list").html(), user));
});

});
