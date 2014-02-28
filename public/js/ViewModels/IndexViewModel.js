function IndexViewModel(repository, element){
	var self = this;
	self.element = element;
	self.db = new repository(self);
	var ViewModel = ko.observable({
		searchQuery : ko.observable(''),
		allClasses : ko.observableArray([]),
		currentClasses : ko.observableArray([]),
		logout : function(){
			self.logout();
		},
		getInfo : function(model){
				 location.href = "/info?id="+model.id;
		}
	});

	

	ViewModel().searchClasses = ko.computed(function() {
		var searchTerm = this().toLowerCase();
		var returnArr = [];
		return ViewModel().allClasses().filter(function(element) {
		 	console.log(element.name, searchTerm);
			return element.name.toLowerCase().indexOf(searchTerm) >= 0;
		})
		 //console.log(returnArr);
		 //return returnArr;
	}, ViewModel().searchQuery);

	self.enroll = function(model){
			var id = model.id;
			var confirm = window.confirm("Are you sure you want to enroll?");
			if(confirm){
				model.enrolled(true);
				self.db.Enroll(id, model.enrollment());
			}
	}

	self.logout = function(){
			$.post("/logout", function(){
				location.href="/";
			});		
	}

	self.drop = function(model){
			var id = model.id;
			var confirm = window.confirm("Are you sure you want to drop?");
			if(confirm){
				model.enrolled(false);
				self.db.Drop(id, model.enrollment());
			}
	}

	self.toggle = function(model){
		if (model.enrolled()) {
			self.drop(model);
		}
		else {
			self.enroll(model);
		}
	}

	ViewModel().toggleClass = function(model){
		self.toggle(model);
	}

	ko.bindingHandlers.info = {
		init : function(element, valueAccessor){
			$(element).click(function(){
				ViewModel().getInfo(valueAccessor());
			});
		}
	}

	ko.bindingHandlers.toggle = {
		init : function(element, valueAccessor){
			$(element).click(function(){
				ViewModel().toggle(valueAccessor());
			});
		}
	}

	ko.bindingHandlers.gradechart = {
		init : function(element, valueAccessor){
			GenerateChart(element);
		}
	}

	ViewModel().toggle = function(model){
		if(model.followed() == true){
			var id = model.id;
			self.db.UnFollowClass(model.id);
			var returner = [];
			var arr = ViewModel().currentClasses().filter(function(element){
				return element != model.id;
			});
			ViewModel().currentClasses(arr);
		}else{
			self.db.FollowClass(model.id);
			var arr = ViewModel().currentClasses();
			arr.push(model.id);
			ViewModel().currentClasses(arr);
			self.evaluateClass(model);
		}
	};


	self.evaluateClass = function(model){
		if(model.enrollment() >= model.max_enrollment - 49 || true){
			//toastr.info(model.name +" is reaching maximum capacity!");
		}
	}

	ViewModel().viewedClasses =  ko.computed(function(){
		var classes = this();
		return ViewModel().allClasses().filter(function(element){
			var returner = classes.indexOf(element.id) >= 0;
			return returner;
		});
	}, ViewModel().currentClasses);

	ViewModel().groupedClasses = ko.computed(function(){
		var returner = {};
		var classes = ViewModel().allClasses();
		var enrolled = this();
		classes.forEach(function(element){
			if(returner[element.group] == null){
				returner[element.group] = [];
			}

			returner[element.group].push(element);
		});
		return returner;
	},ViewModel().currentClasses);

	self.initialize = function(){
		ko.applyBindings(ViewModel, self.element);

		self.db.GetClasses(function(classes){
				self.db.GetEnrolledClasses(0, function(currclasses){
				ViewModel().currentClasses(currclasses);
				ViewModel().allClasses().forEach(function(element){
					if(element.followed()){
						self.evaluateClass(element);
					}
				});
			});

			classes.forEach(function(element, index){
				classes[index].followed = ko.computed(function(){
					var enrolled = this();
					var returner = enrolled.indexOf(element.id) >= 0;
					return returner;
				},ViewModel().currentClasses);
			});


			ViewModel().allClasses(classes);
		});
	}

	self.updateClass = function(id, count){
		ViewModel().allClasses().forEach(function(element){
			if(element.id == id){
				element.enrollment(count);
			}
		});
	}
}