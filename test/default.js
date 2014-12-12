
	
	var   Class 		= require('ee-class')
		, log 			= require('ee-log')
		, assert 		= require('assert');



	var   ServiceHost = require('../')
		, sh;



	describe('The ServiceHost', function() {
		it('should not crash when instantiated', function() {
			sh = new ServiceHost();
		});


		it('should install a module if requested to to do so', function(done) {
			this.timeout(10000);
			sh.loadModule('distributed-message', 'v0.1.x');

			//sh._npm.list();
		})
	});
	