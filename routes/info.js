var A = true;

exports.viewInfo = function(req, res){
	var sendInfo = {};
	if(req.session.user != null){
		sendInfo.loggedin = true;
		sendInfo.notloggedin = false;
	}else{
		sendInfo.loggedin = false;
		sendInfo.notloggedin = true;
	}
		res.render('info', sendInfo);

		
	
}

exports.viewInfob = function(req, res){
	var sendInfo = {};
	if(req.session.user != null){
		sendInfo.loggedin = true;
		sendInfo.notloggedin = false;
	}else{
		sendInfo.loggedin = false;
		sendInfo.notloggedin = true;
	}
	
		res.render('info', sendInfo);
	
}
