function getID(){
		var url = document.URL.split("?");
		var urlParam = url[1];
		var id = parseInt(urlParam.split("=")[1].split("&")[0]);
		return id;
}

function getView(){
		var url = document.URL.split("?");
		console.log(url);
		if(url[0].indexOf("/b")>= 0){
			return "b";
		}else{
			return "a";
		}
}

function InfoViewModel(repository, element, enrollmentService){
	var self = this;
	self.element = element;
	self.db = new repository(self);
	self.enrollmentService = enrollmentService;
	var ViewModel = ko.observable({
		_class : ko.observable({name : "Not loaded yet", enrolled : ko.observable(false)}),
		page : ko.observable(0),
		viewAlternatives : ko.observable(false),
		messages : ko.observableArray([]),
		schedule : ko.observable(),
		currentMessage : ko.observable(),
		view : getView(),
		logout : function(){
			self.enrollmentService.logout();
		},

	});
	ViewModel().toggleCapes = function(){
		ViewModel().viewAlternatives(!ViewModel().viewAlternatives())
	}
	ViewModel().decrement = function(){
		ViewModel().page(ViewModel().page()-1)
	}
	ViewModel().increment = function(){
		ViewModel().page(ViewModel().page()+1)
	}
	ko.bindingHandlers.enroll = {
		init : function(element, valueAccessor){
			$(element).click(function(){
				self.enrollmentService.toggle(valueAccessor()());
			});
		}
	}

	self.initialize = function(){
		var id = getID();

		self.db.GetClass(id, function(_class){
			_class.enrolled = ko.observable(_class.enrolled);
			var teacher = _class.instructor.split(" ");
			_class.info.cape_reviewData = _class.info.cape_review
			_class.info.cape_review = ko.computed(function(){

				var alt = this();
				return  _class.info.cape_reviewData.filter(function(element){
					if(alt == false)
						return element[0].indexOf(teacher[0])  >= 0 || element[0].indexOf(teacher[1])>=0;
					else 
						return true;
				})
			}, ViewModel().viewAlternatives);

			ViewModel()._class(_class);


		ko.bindingHandlers.gradechart = {
			init : function(element, valueAccessor){
				GenerateChart(element, _class, getView());
			}
		}

	ko.bindingHandlers.barChartYear = {
		update : function(element, valueAccessor){
			var data = valueAccessor()();

			var total = {
				Freshmen  : 0,
				Sophomore : 0,
				Junir : 0,
				Senior : 0,
				Senior_plus : 0
			}

			var x_Axis = Object.keys(total);

			for(var i = 0; i < data.length; i++){
				total[data[i].year] ++;

				if(data[i].year == "Senior+"){
					total.Senior_plus++;
				}
			}
			var returner = [];

			for(var i = 0; i < x_Axis.length; i++){
				returner.push(total[x_Axis[i]]);
			}
			x_Axis = ["Freshmen", "Sophomore", "Junior",'Senior', "Senior+"]

			generateBarChart(element, returner, "Year", x_Axis, getView());
		}
	}


	ko.bindingHandlers.barChartMajor = {
		update : function(element, valueAccessor){
			var data = valueAccessor()();
			var total = {
				CompSci : 0,
				CogSci : 0,
				Other : 0
			}
			
			var x_Axis = Object.keys(total);

			for(var i = 0; i < data.length; i++){
				total[data[i].major] ++;
			}
			var returner = [];
			for(var i = 0; i < x_Axis.length; i++){
				returner.push(total[x_Axis[i]]);
			}
			generateBarChart(element, returner, "Major", x_Axis, getView());
		}
	}

			ko.applyBindings(ViewModel, self.element);
		});

	}
}