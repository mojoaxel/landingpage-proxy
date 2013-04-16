/*
** Peteris Krumins (peter@catonmat.net)
** http://www.catonmat.net  --  good coders code, great reuse
**
** A simple proxy server written in node.js.
**
*/

var http = require('http');
var util  = require('util');
var fs   = require('fs');

var blacklist = [];

var ip_list = [];

fs.watchFile('./blacklist', function(c,p) { update_blacklist(); });

function update_blacklist() {
  fs.stat('./blacklist', function(err, stats) {
    if (!err) {
      util.puts("Updating blacklist.");
      blacklist = fs.readFileSync('./blacklist').split('\n')
                  .filter(function(rx) { return rx.length })
                  .map(function(rx) { return RegExp(rx) });
    }
  });
}

function host_allowed(host) {
  for (i in blacklist) {
    if (blacklist[i] === host) {
      return false;
    }
  }
  return true;
}

function client_allowed(ip) {
	for (i in ip_list) {
		if (ip_list[i] === ip) {
			return true;
		}
	}
	return false;
}

function deny(response, msg) {
  response.writeHead(401);
  response.write(msg);
  response.end();
}

function showLandingPage(response, url) {
	/*
	response.writeHead(402); //402 payment required
	response.write('<html>');
	response.write("<h1>Welcome to Freifunk!</h1>");
	response.write('<p><a href="192.168.10.40/getaccess?req='+url+'">Weiter zu '+url+'</a></p>');
	response.end();
	*/
	response.writeHead(307, {
		'Location': 'http://localhost:8080' + 
					'#?req=' + url + 
					'&access=http://localhost:9615/getaccess'
	}); //307 Temporary Redirect
	response.end();
}

function startServer() {
	// wait for clients to ask for access
	http.createServer(function (req, res) {
		var ip = req.connection.remoteAddress;
		console.log("IP added to whitelist: " + ip);
		ip_list.push(ip);
			
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.write("Access granted...have fun...");
		res.end();
	}).listen(9615);
	
	http.createServer(function(request, response) {
	var ip = request.connection.remoteAddress;
	
	/*
	if (!host_allowed(request.url)) {
		console.log("ACCESS DENYED!");
		msg = "Host " + request.url + " has been denied by proxy configuration";
		deny(response, msg);
		util.puts(msg);
		return;
	}
	*/
	
	util.puts(ip + ": " + request.method + " " + request.url);
	
	var url = request.url;
	/*
	console.log("URL: ", url);
	if (url.indexOf('getaccess') !== -1) {
		console.log("IP added to whitelist: " + ip);
		ip_list.push(ip);
		var index = url.indexOf('req=');
		var newUrl = url.substr(index, url.length-index);
		request.url = newUrl;
	}
	*/
	
	if (!client_allowed(ip)) {
		showLandingPage(response, request.url);    
	} else {
	
	var proxy = http.createClient(80, request.headers['host']);
	var proxy_request = proxy.request(request.method, request.url, request.headers);
	
	  proxy_request.addListener('response', function(proxy_response) {
	    proxy_response.addListener('data', function(chunk) {
	      response.write(chunk, 'binary');
	    });
	    proxy_response.addListener('end', function() {
	      response.end();
	    });
	    response.writeHead(proxy_response.statusCode, proxy_response.headers);
	  });
	  
	  request.addListener('data', function(chunk) {
	    proxy_request.write(chunk, 'binary');
	  });
	  
	  request.addListener('end', function() {
	    proxy_request.end();
	  });
	  
	  request.addListener('error', function(err) {
	    util.puts('error: ' + err);
	    proxy_request.end();
	  });
	  
	  }
	  
	}).listen(8003);
}

update_blacklist();

startServer();