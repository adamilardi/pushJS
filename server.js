/**
 * Important note: this application is not suitable for benchmarks!
 */

var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , io = require('socket.io')
  , sys = require(process.binding('natives').util ? 'util' : 'sys')
  , server;
  
 var querystring = require('querystring');
 var redis = require("redis"),
    rBlockingClient = redis.createClient(),
	rclient = redis.createClient();
    
 var queueName = "hotqueue";


server = http.createServer(function(req, res){
  // your normal server code
  var path = url.parse(req.url).pathname;
  switch (path){
    case '/':
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write('<h1>Welcome. Try the <a href="/demo.html">pushJs</a> demo.</h1>');
      res.end();
      break;
      
    case '/json.js':
    case '/demo.html':
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
        res.write(data, 'utf8');
        res.end();
      });
      break;
	  
	case '/whoison':
	   res.writeHead(200, {'Content-Type': 'text/html'});
	   res.write('<h1>Welcome. These people are on</h1>');
	   res.write('<ul>');
		for (var key in myUsers) {
			res.write('<li>'+key+'</li>');
		}

	   res.write('</ul>'); 
	   res.write(
        '<form action="/myaction" method="post" >'+
        'Enter username:<br> <input type="text" name="username"><br>'+
        'Enter javascript to send to the user: ex alert("hello"); <br> <TEXTAREA NAME="js" COLS=40 ROWS=6></TEXTAREA>'+
        '<input type="submit" value="Submit">'+
        '</form>'
       );
	   
	   res.end();
      break;
      
	  
	  
	case '/myaction':
	
	  if (req.method == 'POST') {
		console.log("[200] " + req.method + " to " + req.url);
		var fullBody = '';
		
		req.on('data', function(chunk) {
		  // append the current chunk of data to the fullBody variable
		  fullBody += chunk.toString();
		});
		
		req.on('end', function() {
		
		  // request ended -> do something with the data
		  res.writeHead(200, "OK", {'Content-Type': 'text/html'});
		  
		  // parse the received body data
		  var decodedBody = querystring.parse(fullBody);
	
		  // output the decoded data to the HTTP response
		  res.write('<html><head><title>Message sent</title></head><body><pre>');
		  for (var postkey in decodedBody){
			  res.write(postkey + ":"+ decodedBody[postkey]+'<br>');
			  
		  }
		  
		  redisMessage = {}
		  redisMessage.username = decodedBody.username;
		  redisMessage.rawjs = decodedBody.js;
		  
		  var mes = JSON.stringify(redisMessage);
		  rclient.rpush(queueName, mes);
		  
		  res.write('</pre></body></html>');
		  
		  res.end();
		});
		
	  } else {
		console.log("[405] " + req.method + " to " + req.url);
		res.writeHead(405, "Method not supported", {'Content-Type': 'text/html'});
		res.end('<html><head><title>405 - Method not supported</title></head><body><h1>Method not supported.</h1></body></html>');
	  }
	  break;

	  
    default: send404(res);
  }
}),

send404 = function(res){
  res.writeHead(404);
  res.write('404');
  res.end();
};

server.listen(8081);


var io = io.listen(server);


var myUsers = {};
var myUsersSessionToId = {};
  
io.on('connection', function(client){
					
  client.on('message', function(message){

	try {
		if( "username" in message) {
			console.log("Error " + message.username);
			myUsers[message.username] = client;
			myUsersSessionToId[client.sessionId] = message.username;
			return;
		}
	} catch (e) {
		console.log(e);
	}
  });

  client.on('disconnect', function(){
	try {
		delete myUsers[myUsersSessionToId[client.sessionId]];
	} catch (e) {
		console.log(e);
	}
  });
});



rBlockingClient.on("error", function (err) {
    console.log("Error " + err);
});

rclient.on("error", function (err) {
    console.log("Error " + err);
});


handleMessage  = function(err,d)  { 
	try{
		console.log("Got pushJS Message"+d);
		var jsonString  =  JSON.parse(d[1])
		console.log(jsonString.username);
		myUsers[jsonString.username].send({ 'rawjs': jsonString.rawjs });
	} catch (e) {
		console.log(e);
	} finally {
		rBlockingClient.blpop(queueName,0, handleMessage);
	}
 }

rBlockingClient.blpop(queueName,0, handleMessage);

