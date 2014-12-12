!function() {

	var   Class 			= require('ee-class')
		, log 				= require('ee-log')
		, type 				= require('ee-types')
		, Promise 			= (Promise || require('es6-promise').Promise)
		, EventEmitter 		= require('ee-event-emitter')
		, MessageRouter 	= require('./MessageRouter')
		, NPM 				= require('./NPM');



	module.exports = new Class({
		inherits: EventEmitter


		, init: function(options) {

			// we want to install npm modules
			this._npm = new NPM();

			// we're routing messages
			this._router = new MessageRouter();


			// check if we got a discovery service address passed
			if (options && options.discovery) {
				throw new Error('Not yet dristibuted :( aka not implemented!');
			}
			else {
				// load the most recent discovery module
				this.loadModule('distributed-discovery-service');
			}
		}



		/**
		 * loads a module passed to it. 
		 *
		 * @param <Mixed> object module or string module installation name
		 * @param <String> semver
		 */
		, loadModule: function(module, version) {
			if (type.string(module)) {
				// need to install via npm
				this._npm.install(module, version)
					.then(this._runModule.bind(this))
					.then(this._loadModule.bind(this))
					.catch(log);
			}
			else this._loadModule(module);
		}




		/**
		 * load service instance
		 *
		 * @param <String> module name
		 */
		, _runModule: function(moduleDescription) {
			return new Promise(function(resolve, reject) {
				var Module, instance;

				try {
					Module = require(moduleDescription.package);
				} catch (e) {
					return reject(e);
				}

				try {
					instance = new Module();
				} catch (e) {
					return reject(e);
				}


				resolve(instance);
			}.bind(this));
		}



		/**
		 * load module into host
		 *
		 * @param <Object> service module
		 */
		, _loadModule: function(module) {
			return new Promise(function(resolve, reject) {
				// check for validity
				if (!type.object(module) || !module.isService) reject(new Error('Cannot load service module, please check your input!'));
				else {

					// register at the router
					this._router.registerService(module);
				}
			}.bind(this));
		}
	});
}();
