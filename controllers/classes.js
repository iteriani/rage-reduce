var mongoose = require('mongoose'),
    Class = mongoose.model('Class'),
    Schedule = mongoose.model('Schedule');

exports.getClasses = function(req,res){
	var searchQuery = {};
	if(req.params.id != null){
		searchQuery.id = req.params.id;
	}
	Class.find(searchQuery, function(err, classes){
		var returner = []
		for(var i = 0; i < classes.length; i++){
			var _class = classes[i];
			var enrolled = false;
			if(req.session.user != null){
				for(var m = 0; m < _class.enrollment.length; m++){
					if(_class.enrollment[m].pid == req.session.user.pid){
						enrolled = true;
					}
				}
			}
			var obj = {
						id : _class.id,
						name : _class.name,
						enrollment : _class.enrollment.length,
						enrolled : enrolled,
						instructor : _class.instructor,
						max_enrollment : _class.max_enrollment,
						group : _class.group
					};

			returner.push(obj);
			if(req.params.id != null){
				obj.enrollment = _class.enrollment;
				Schedule.find({}, function(err,data){
					data = JSON.parse(JSON.stringify(data));
					var realdata = data.filter(function(element){
						return parseInt(element.id) == req.params.id;
					})

					obj.info = realdata[0];
					res.end(JSON.stringify(obj, null, '\t'));
					return;
				})
			}

		}
			if(req.params.id == null){
				res.end(JSON.stringify(returner, null, '\t'));
			}
		
	})




}
