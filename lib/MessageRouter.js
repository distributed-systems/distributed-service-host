!function() {

    var   Class         = require('ee-class')
        , log           = require('ee-log')
        , type          = require('ee-types')
        , semver        = require('semver')
        , Promise       = (Promise || require('es6-promise').Promise)
        , EventEmitter  = require('ee-event-emitter');



    module.exports = new Class({
        inherits: EventEmitter



        /**
         * the router knows wehre to send messages
         */
        , init: function(options) {
            this._routes = {};
            this._uidRoutes = {};

            this.signature = options.signature;
        }



        /**
         * register a new service at the message router
         */
        , registerService: function(serviceInstance) {

            // handle message coming form the service
            serviceInstance.on('message', this.handleMessage.bind(this));

            // add the service tou the routes
            serviceInstance.on('addRoute', this._handleRouteAdd.bind(this));

            // remove from routes
            serviceInstance.on('removeRoute', this._handleRouteRemove.bind(this));

            // tell the service that is was loaded into the message router
            serviceInstance.handleRouterAdd();
        }




        /**
         * a service publishes a new route
         */
        , _handleRouteAdd: function(service) {

            // validate input
            if (!type.string(service.applicationId) || service.applicationId.length === 0) throw new Error('Cannot add route: service does not expose a valid applicationId!');
            if (!type.string(service.id) || service.id.length === 0) throw new Error('Cannot add route: service does not expose a valid id!');
            if (!type.string(service.version) || service.version.length === 0) throw new Error('Cannot add route: service does not expose a valid version!');
            if (!type.string(service.uid) || service.uid.length === 0) throw new Error('Cannot add route: service does not expose a valid uid!');

            // make sure the storage is ready
            if (!this._routes[service.applicationId]) this._routes[service.applicationId] = {};
            if (!this._routes[service.applicationId][service.name]) this._routes[service.applicationId][service.name] = {};
            if (!this._routes[service.applicationId][service.name][service.version]) this._routes[service.applicationId][service.name][service.version] = [];
            
            // name based routing
            this._routes[service.applicationId][service.name][service.version].push(service);

            // id based routing
            this._uidRoutes[service.uid] = service;
        }




        /**
         * a service revokes an existing route
         */
        , _handleRouteRemove: function(service) {

            // validate input
            if (!type.string(service.applicationId) || service.applicationId.length === 0) throw new Error('Cannot add route: service does not expose a valid applicationId!');
            if (!type.string(service.id) || service.id.length === 0) throw new Error('Cannot add route: service does not expose a valid id!');
            if (!type.string(service.version) || service.version.length === 0) throw new Error('Cannot add route: service does not expose a valid version!');
            if (!type.string(service.uid) || service.uid.length === 0) throw new Error('Cannot add route: service does not expose a valid uid!');

            // remove name based route if it exists
            if (this._routes[service.applicationId] && this._routes[service.applicationId][service.name] && this._routes[service.applicationId][service.name][service.version]) {
                
                // remove the service instance
                this._routes[service.applicationId][service.name][service.version] = this._routes[service.applicationId][service.name][service.version].filter(function(inst) {
                    return service !== inst;
                });                

                // also delete keys above if they are empty
                if (this._routes[service.applicationId][service.name][service.version].length === 0) delete this._routes[service.applicationId][service.name][service.version]
                if (!Object.keys(this._routes[service.applicationId][service.name]).length) delete this._routes[service.applicationId][service.name];
                if (!Object.keys(this._routes[service.applicationId]).length) delete this._routes[service.applicationId];
            }

            // remove uid based route if it exists
            if (this._uidRoutes[service.uid]) delete this._uidRoutes[service.uid];
        }


        
        
        /**
         * route a message, public interface
         *
         * @param <Object> distributed message
         */
        , handleMessage: function(message) {
            var   isTemporarilyUnavailable = false
                , recipient
                , version
                , index
                , isTemporarilyUnavailable
                , onlineInstances;


            if (!message || !message.isDistributedMessage) throw new Error('Cannot route message, message is not a proper distributed message!');


            // try uid based routing
            if (message.hasUidRecipient() && this._uidRoutes[message.getUidRecipient()]) {

                // check if the serviuce is online
                if (this._uidRoutes[message.getUidRecipient()].online) this._uidRoutes[message.getUidRecipient()].handleMessage(message);
                else message.notRoutable(message.SERVICE_TEMPORARILY_UNAVAILABLE, 'The requested service is temporarily unavailable');
            }


            // try name based routing
            else if (message.hasNamedRecipient()) {
                recipient = message.recipient;

                // check if we're hosting a service for the targeted app
                if (this._routes[recipient.applicationId]) {
                    
                    // check if we're hosting the targeted service
                    if (this._routes[recipient.applicationId][recipient.name]) {

                        // check if we're hosting a valid service version
                        if (Object.keys(this._routes[recipient.applicationId][recipient.name]).some(function(serviceVersion) {
                            if (semver.satisfies(serviceVersion, recipient.version)) {

                                // check if there is a service avialabel for this version
                                if (this._routes[recipient.applicationId][recipient.name][serviceVersion].length === 0) return false;
                                else if (this._routes[recipient.applicationId][recipient.name][serviceVersion].some(function(serviceInstance) {
                                    return serviceInstance.online;
                                }.bind(this))) {
                                    version = serviceVersion;
                                    return true;
                                }
                                else {
                                    isTemporarilyUnavailable = true;
                                }                                
                            }
                            return false;
                        }.bind(this))) {
                            // get a list of online services
                            onlineInstances = this._routes[recipient.applicationId][recipient.name][version].filter(function(serviceInstance) {return serviceInstance.online;});
                            

                            // use a random instance
                            index = Math.floor(Math.random()*onlineInstances.length);
                            onlineInstances[index].handleMessage(message);
                        }
                        else {
                            // service version not avaialbe
                            if (isTemporarilyUnavailable) message.notRoutable(message.SERVICE_TEMPORARILY_UNAVAILABLE, 'The «'+recipient.applicationId+':'+recipient.name+'/'+recipient.version+'» service is temporarily unavailable!');
                            else message.notRoutable(message.SERVICE_VERSION_UNAVAILABLE, 'Service version «'+recipient.version+'» is not compatible with any of the loaded «'+recipient.applicationId+':'+recipient.name+'» services!');
                        }
                    }
                    else message.notRoutable(message.SERVICE_UNAVAILABLE, 'Service «'+recipient.applicationId+':'+recipient.name+'» was not found!');
                }
                else message.notRoutable(message.APPLICATION_UNAVAILABLE, 'Application «'+recipient.applicationId+'» was not found!');
            }

            // cannot route, dont accept message
            else message.notRoutable(message.INVALID_RECIPIENT, 'Insufficient recipient information!');
        }




        /**
         * create  menaingful error message
         */
        , createMessage: function(message) {
            var args = Array.prototype.slice.call(arguments, 1);

            args.forEach(function(arg, index) {
                message = message.replace('$$'+(index+1), '«'+arg+'»');
                message = message.replace('$'+(index+1), arg);
            });

            return message.replace(/\$ignature|\$signature/gi, this.signature);
        }
    });
}();
