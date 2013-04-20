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

//============================================================
var server_ip = '192.168.10.40';
//============================================================


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

function redirectTo(response, url) {
	//307 Temporary Redirect 
	response.writeHead(307, {
		'Location': url
	});
	response.end();
}

function showLandingPage(response, url) {
	redirectTo(response, 
		'http://' + server_ip + ':8080' + 
		'#?req=' + url + 
		'&access=http://' + server_ip + ':9615/getaccess');
}

function startServer() {
	// wait for clients to ask for access
	http.createServer(function (request, response) {
		var url = request.url;
		console.log('Request for ' + request.url);
		
		if (url.indexOf('getaccess') !== -1) {
		
			console.log('GETACCESS ' + url);
			
			var ip = request.connection.remoteAddress;
			console.log("IP added to whitelist: " + ip);
			ip_list.push(ip);
				
			function getUrlParams(url) {
				// This function is anonymous, is executed immediately and 
				// the return value is assigned to QueryString!
				var query_string = {};
				var query = url;
				var vars = query.split("&");
				for (var i=0;i<vars.length;i++) {
					var pair = vars[i].split("=");
						// If first entry with this name
					if (typeof query_string[pair[0]] === "undefined") {
						query_string[pair[0]] = pair[1];
						// If second entry with this name
					} else if (typeof query_string[pair[0]] === "string") {
						var arr = [ query_string[pair[0]], pair[1] ];
						query_string[pair[0]] = arr;
						// If third or later entry with this name
					} else {
						query_string[pair[0]].push(pair[1]);
					}
				} 
				return query_string;
			};
			
			var params = getUrlParams(url.split("?")[1]);
			var url = decodeURIComponent(params.req);
			redirectTo(response, url);
		}
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
		
		//util.puts(ip + ": " + request.method + " " + request.url);
		console.log(ip + ": " + request.method + " " + function(url) { return url; }(request.url));
		
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
			showLandingPage(response, url);
		} else {
			/*
			var options = {
				host: 'freifunk.net', //request.headers['host'],
				port: 80,
				path: '/', //request.headers['path'],
				method: request.method
			};
			
			console.log('REDIRECTING ', options);
			
			var req = http.request(options, function(proxy_response) {
				console.log('STATUS: ' + proxy_response.statusCode);
				console.log('HEADERS: ' + JSON.stringify(proxy_response.headers));
				
				proxy_response.setEncoding('utf8');
				
				proxy_response.on('data', function (chunk) {
					try {
						response.write(chunk, 'binary');
					} catch (err) {
						console.log("ERROR response.write: ", err);
					}
				});
				
				proxy_response.on('end', function (chunk) {
					response.end();
				});
			});
			*/
			
			var proxy = http.createClient(80, request.headers['host']);
			var proxy_request = proxy.request(request.method, url, request.headers);
			
			proxy_request.addListener('response', function(proxy_response) {
			
				proxy_response.addListener('data', function(chunk) {
					try {
					response.write(chunk, 'binary');
					} catch (err) {
						console.log("ERROR response.write: ", err);
					}
				});
				
				proxy_response.addListener('end', function() {
					response.end();
				});
				
				try {
				response.writeHead(proxy_response.statusCode, proxy_response.headers);
				} catch (err) {
					console.log("ERROR response.writeHead: ", err);
				}
			});
			
			request.addListener('data', function(chunk) {
				try {
				proxy_request.write(chunk, 'binary');
				} catch (err) {
					console.log("ERROR proxy_request.write: ", err);
				}
			});
			
			request.addListener('end', function() {
				proxy_request.end();
			});
			
			request.addListener('error', function(err) {
				console.log('ERROR: ' + err);
				proxy_request.end();
			});
			
		}
	  
	}).listen(8003);
}

console.log("Loading Blacklist...");
update_blacklist();

console.log("Starting Server...");
startServer();
