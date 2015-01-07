
	
	var   Class 		= require('ee-class')
		, log 			= require('ee-log')
		, path 			= require('path')
		, crypto 		= require('crypto')
		, assert 		= require('assert')
		, uuid 			= require('node-uuid')
		, Config 		= require('test-config');



	var   ServiceHost 			= require('../')
		, Appplication 			= require('distributed-application')
		, DistributedService 	= require('distributed-service')
		, modulesPath 			= path.join(__dirname, '../node_modules/')
		, appId 				= uuid.v4()
		, secret 				= crypto.randomBytes(32).toString('hex')
		, app
		, sh;




	var config = new Config('config.js', {
        db: [{
              type       		 : 'postgres'
            , database   		 : 'test'
            , schema     		 : 'crud_service_test'
            , hosts: [{
                  host           : '127.0.0.1'
                , username       : 'postgres'
                , password       : ''
                , port           : 5432
                , mode           : 'readwrite'
                , maxConnections : 500
            }]
        }]
    });




	describe('HOST PREPARATIONS', function() {
		it('Staring the service host process service', function() {
			sh = new ServiceHost({
				  applicationId : appId
				, secureToken 	: secret
			});
		});






		it('registering the application service', function(done) {
			this.timeout(10000);

			sh.registerService({
				  name 		: 'distributed-application'
				, path 		: modulesPath+'distributed-application'
				, version 	: '0.1.0'
			}).then(function() {
				done();
			}).catch(done);
		});


		it('registering the relational crud service', function(done) {
			this.timeout(10000);

			sh.registerService({
				  name 		: 'distributed-relational-crud-service'
				, path 		: modulesPath+'distributed-relational-crud-service'
				, version 	: '0.1.0'
			}).then(function() {
				done();
			}).catch(done);
		});
	});
	


	describe('APPLICATION STARTUP', function() {
		it('Executing the application', function(done) {
			this.timeout(10000);

			// we need to create a token for the application service
			sh.executeService('distributed-application', '*', secret, appId, 'application').then(function(serviceInstance) {
				assert(serviceInstance instanceof DistributedService);

				app = serviceInstance;

				done();
			}).catch(done);
		});


		it('Requesting a new relational CRUD Service instance', function(done) {
			this.timeout(10000);

			app.executeService('distributed-relational-crud-service', '0.1.x', 'db', {
				  db: config.db
				, entites: ['event, venue, image']
			}).then(function(serviceConfig) {
				done();
			}).catch(done);
		});
	});