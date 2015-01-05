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
        }


        /**
         * register a new service at the message router
         */
        , registerService: function(serviceInstance) {

            // handle message coming form the service
            serviceInstance.on('message', this.handleMessage.bind(this));

            // a new route was added 
            serviceInstance.on('addRoute', this._handleRouteAdd.bind(this));

            // a route was removed
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
            if (!this._routes[service.applicationId][service.id]) this._routes[service.applicationId][service.id] = {};
            
            // name based routing
            this._routes[service.applicationId][service.id][service.version] = service;

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
            if (this._routes[service.applicationId] && this._routes[service.applicationId][service.id] && this._routes[service.applicationId][service.id][service.version]) {
                delete this._routes[service.applicationId][service.id][service.version];

                // also delete keys above if they are empty
                if (!Object.keys(this._routes[service.applicationId][service.id]).length) delete this._routes[service.applicationId][service.id];
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
            var recipient, version;

            if (!message || !message.isDistributedMessage) throw new Error('Cannot route message, message is not a proper distributed message!');

            // try uid based routing
            if (message.hasUidRecipient() && this._uidRoutes[message.getUidRecipient()]) this._uidRoutes[message.getUidRecipient()].handleMessage(message);

            // try name based routing
            else if (message.hasNamedRecipient()) {
                recipient = message.recipient;

                // check if we're hosting a service for the targeted app
                if (this._routes[recipient.applicationId]) {
                    
                    // check if we're hosting the targeted service
                    if (this._routes[recipient.applicationId][recipient.id]) {

                        // check if we're hosting a valid service version
                        if (Object.keys(this._routes[recipient.applicationId][recipient.id]).some(function(serviceVersion) {
                            if (semver.satisfies(serviceVersion, recipient.version)) {
                                version = serviceVersion;
                                return true;
                            }
                            return false;
                        })) {
                            this._routes[recipient.applicationId][recipient.id][version].handleMessage(message);
                        }
                        else message.notRoutable('Service version «'+recipient.version+'» is not compatible with any of the loaded «'+recipient.applicationId+':'+recipient.id+'» services!');
                    }
                    else message.notRoutable('Service «'+recipient.applicationId+':'+recipient.id+'» was not found!');
                }
                else message.notRoutable('Application «'+recipient.applicationId+'» was not found!');
            }

            // cannot route, dont accept message
            else message.notRoutable('Insufficient recipient information!');
        }
    });
}();
