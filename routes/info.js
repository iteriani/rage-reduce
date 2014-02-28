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
	if(A==true){
		res.render('info', sendInfo);
		A=false;
	}else{
		A=true;
		res.redirect("/info/b/" + req.url.split("/info")[1]);
	}

		
	
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
