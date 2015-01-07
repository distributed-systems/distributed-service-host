!function() {

    var   Class                 = require('ee-class')
        , log                   = require('ee-log')
        , type                  = require('ee-types')
        , crypto                = require('crypto')
        , fs                    = require('fs')
        , path                  = require('path')
        , Promise               = (Promise || require('es6-promise').Promise)
        , semver                = require('semver')
        , MessageRouter         = require('./MessageRouter')
        , DistributedService    = require('distributed-service')
        , Validator             = require('object-validators')
        , MessageHandler        = require('distributed-request-message-handler');



    module.exports = new Class({
        inherits: DistributedService



        /**
         * initialize the npm installer and the router
         *
         * @param <Object> optional options. if it doesnt contain discovery 
         *                 endpoints it will load its own discover service
         */
        , init: function init(options) {
            var packageJSON;


            // set up sotrage for registered services
            this._serviceRegistry = {};

            // running services
            this._services = [];

            // local discovery nodes
            this._localDiscoveryNodes = [];

    
            // check if we got a discovery service address passed
            if (options && options.discovery) {
                throw new Error('Not yet distributed :( aka not implemented!');
            }
            else {
                // load the most recent discovery module
                //this.loadModule('distributed-discovery-service');
            }


            // need to load the package json sync to get my own information
            try {
                packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json')));
            }
            catch (err) {
                err.message = 'Failed to load package.json for the distributed-service-host: '+err.message;
                throw err;
            }


            // initialize this as service
            init.super.call(this, {
                  applicationId : options.applicationId
                , secureToken   : options.secureToken
                , id            : packageJSON.name
                , version       : packageJSON.version
                , name          : 'servicehost'
            });



            // we're routing messages
            this._router = new MessageRouter({
                signature: this.signature
            });


            // enable messaging
            this.setUpMessageHandler();


            // lets register myself as service :)
            this._router.registerService(this);
        }




        /**
         * set up the message handler
         */
        , setUpMessageHandler: function() {

            // set up message handler for this service
            this.messageHandler = new MessageHandler({
                  signature : this.signature
                , path      : path.join(__dirname, '../validators')
            });

            // register actions
            this.messageHandler.registerAction('execute_service', this._handlExecuteService.bind(this));
        }





        /**
         * handle incoming messages that tell us to execute a service
         */
        , _handlExecuteService: function(message) {
            var content = message.content;

            // try top execute the service
            this.executeService(content.serviceId, content.version, this.secureToken, this.applicationId, content.name, content.config).then(function(serviceInstance) {
                message.sendResponse(message.response.OK, serviceInstance.toJSON());
            }.bind(this)).catch(function(err) {
                message.sendError(message.response.ERROR, err.message);
            }.bind(this));
        }





        /**
         * add a local discovery node
         * 
         * @param <string> uid
         */
        , addLocalDiscoveryService: function(uid) {
            if (!type.string(uid)) throw new Error('Expected a string as the discovery service uid!');
            if (uid.length !== 36) throw new Error('The discovery uid must be 36 characters long!');

            this._localDiscoveryNodes.push(uid);
        }



        /**
         * register a new module on the service host.
         * this enables the host to start an instance of it
         * later on the service host will be able to install
         * service autonously and this method will not be of 
         * any use anymore.
         *
         * @param <Object> module definition. contains the absolute path,
         *                 the modules name and its exact version
         */
        , registerService: function(serviceDefinition) {
            if (!type.object(serviceDefinition)) return Promise.reject(new Error('The serviceDefinition passed as parameter 0 must be an object containing the name, path and version properties!'));
            if (!type.string(serviceDefinition.name)) return Promise.reject(new Error('the serviceDefinition must contain the name property!'));
            if (!type.string(serviceDefinition.path)) return Promise.reject(new Error('the serviceDefinition must contain the path property!'));
            if (!type.string(serviceDefinition.version)) return Promise.reject(new Error('the serviceDefinition must contain the version property!'));
            if (this._serviceRegistry[serviceDefinition.name] && this._serviceRegistry[serviceDefinition.name][serviceDefinition.version]) return Promise.reject(new Errro('A service with the same name and version was already installed before!'));

            // try to load the service
            try {
                serviceDefinition.executable = require(serviceDefinition.path);
            } catch (err) {
                err.message = 'Failed to load the service «'+serviceDefinition.name+'»:'+err.message;
                return Promise.reject(err);
            }

            // prepare storage
            if (!this._serviceRegistry[serviceDefinition.name]) this._serviceRegistry[serviceDefinition.name] = {};

            // store definition
            this._serviceRegistry[serviceDefinition.name][serviceDefinition.version] = serviceDefinition;

            // check
            // win!
            return Promise.resolve(this);
        }



        /**
         * mock of the install service method. it will later download services
         * using the dsm module.
         */
        , installService: function() {
            throw new Error('This is sadly not ready yet :(');
        }





        /**
         * incoming message handler for this service
         *
         * @param <DistributedRequestMessage> message instance
         */
        , handleMessage: function(message) {
            this.messageHandler.handleMessage(message);
        }






        /**
         * exeuctes a service instance, should not be called manually
         *
         * @param <String> service name
         * @param <String> semantiv version
         * @param <String> a secure token which is used to identify the service instance,
         *                 encrypt secure communications to it
         * @param <String> application id
         * @param <String> service instance name, how should the service be addressed
         * @param <Object> optional config to pass to the service
         */
        , executeService: function(serviceName, semanticServiceVersion, secureToken, applicationId, instanceName, config) {
            var comatibleVersion, Service, service;

            if (!type.string(serviceName)) return Promise.reject(new Error('Please specify the name of the service you want to run!'));
            if (!type.string(semanticServiceVersion)) return Promise.reject(new Error('Please specify the semantic version of the service you want to run!'));
            if (!type.string(secureToken)) return Promise.reject(new Error('Please specify the secure token for the service you want to run!'));
            if (!type.string(instanceName)) return Promise.reject(new Error('Please specify the service instance name for the service you want to run!'));

            if (!Object.hasOwnProperty.call(this._serviceRegistry, serviceName)) return Promise.reject(new Error('The service «'+serviceName+'» is not known!'));
            
            // check semver compatibility, starting with the newest version
            if (Object.keys(this._serviceRegistry[serviceName]).sort().reverse().some(function(version) {
                if (semver.satisfies(version, semanticServiceVersion)) {
                    comatibleVersion = version;
                    return true;
                }
                return false;
            })) {
                // got a compatible service version, lets rock!

                // load from fs
                try {
                    Service = require(this._serviceRegistry[serviceName][comatibleVersion].path);
                }
                catch (err) {
                    err.message = 'Failed to load service: '+err.message;
                    return Promise.reject(err);
                };

                // execute
                try {
                    service = new Service({
                          applicationId : applicationId
                        , secureToken   : secureToken
                        , id            : serviceName
                        , version       : comatibleVersion
                        , name          : instanceName
                        , config        : config
                    });
                }
                catch (err) {
                    err.message = 'Failed to instantiate service: '+err.message;
                    return Promise.reject(err);
                };


                // store
                this._services[service.uid] = service;

                // check if the service inherits from the distributed-service class
                if (!(service instanceof DistributedService)) return Promise.reject(new Error('Cannot use the «'+serviceName+'» service! It does not inherit from the distributed-service class!'));
                else {


                    // register @ router
                    this._router.registerService(service);

                    // we're done
                    return Promise.resolve(service);
                }
            }
            else return Promise.reject(new Error('Failed to execute the service, service «'+serviceName+'@'+semantigServiceVersion+'» has no compatible version loaded!'));
        }



        /**
         * create a random token
         *
         * @param <number> the token byte length to return
         *
         * @returns <Promise> will return an error or a hex encoded string
         */
        , createToken: function(size) {
            return new Promise(function(resolve, reject) {
                crypto.randomBytes(size || 32, function(err, data) {
                    if (err) reject(err);
                    else resolve(data.toString('hex'));
                }.bind(this));
            }.bind(this));
        }
    });
}();
