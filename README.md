# distributed-service-host

The distributed service host is itself a service, but it acts alswo as a host for other services which routes messages and installs invokes new services.

## installation

npm i distributed-service-host

## build status

[![Build Status](https://travis-ci.org/eventEmitter/distributed-service-host.png?branch=master)](https://travis-ci.org/eventEmitter/distributed-service-host)


## usage

the service host can either be started using the distributed cli orit can be included into other applications.

### cli

	distributed host up


### programatically

	var   ServiceHost 				= require('distributed-service-host')
		, DistributedApplication 	= require('distributed-application');


	// bring servicehost up
	var host = new ServiceHost();



	// the application provides the configuration for the services
	// it interacts with the service host module
	var app = new DistributedApplication();

	// get config from a local configfile
	app.loadConfigFile('../config.js');




	// load discovery module (install if necessary)
	// it should be the first module added
	host.loadModule('distributed-discovery-service', 'v0.3.x');


	// load local app module, should be the second module added
	host.loadModule(app);





	// listen for laod signal (emitted when all modules that were added until now )
	host.once('load', cb);



   -1. the discovery module gets loaded and instantiated
	0. an application service is loaded and instantiated it registers itself at the discovery service
	1. the application service requests a new service instance, bundles an unique token with the request
	2. service gets installed 
	3. service gets started
	4. service registers itself at the discovery with its id, its version and the application that it was requested for. it marks itself as starting. it gets an id,
	5. the service asks its applciation for the config data it can make use of, authenticates using the token
	6. the service marks itself as ready at the discovery 
	7. the service marks itself as ready at the application



