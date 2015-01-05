!function() {

    var   Class         = require('ee-class')
        , log           = require('ee-log')
        , type          = require('ee-types')
        , path          = require('path')
        , semver        = require('semver')
        , EventEmitter  = require('ee-event-emitter')
        , Promise       = (Promise || require('es6-promise').Promise)
        , npm           = require('npm');




    module.exports = new Class({
        inherits: EventEmitter


        // flags if npm is ready
        , isLoaded: false


        // command queue
        , _queue: []


        // where to install services
        , _installationPath: ''




        /**
         * prepare the npm package
         */
        , init: function(options) {

            // install service modules into separate dir
            this._installationPath = path.join(__dirname, '../distributed_services');


            // load npm
            npm.load({silent: true, quiet: true}, function(err) {
                var item;

                if (err) throw err;
                else {
                    this.isLoaded = true;

                    while(this._queue.length) {
                        item = this._queue.shift();

                        // execute command
                        this._execCommand(item.resolve, item.reject, item.command, item.args, item.transformer);
                    }
                }
            }.bind(this));
        }




        /**
         * list all installed  packages
         */
        , list: function() {
            return this._queueCommand('ls', [[], true], function(resolve, reject, tree) {
                resolve(tree);
            }.bind(this));
        }




        /**
         * check if a given package is installed already
         *
         * @param <String> package
         * @param <String> package version
         */
        , isInstalled: function(packageName, version) {
            return new Promise(function(resolve, reject) {
                this.list().then(function(tree) {
                    if (tree && tree.dependencies && tree.dependencies[packageName]) {
                        if (version) {
                            if (semver.satisfies(tree.dependencies[packageName].version, version)) resolve({package: packageName, version: tree.dependencies[packageName].version});
                            else resolve();
                        }
                        else resolve({path: path.join(this._installationPath, packageName), package: packageName, version: tree.dependencies[packageName].version});
                    }
                    else resolve();
                }.bind(this)).catch(reject);
            }.bind(this));
        }




        /**
         * install a specific module
         *
         * @param <String> module to install
         * @param <String> semver
         */
        , install: function(module, version) {
            return new Promise(function(resolve, reject) {

                // first check if the module is instaleld already
                this.isInstalled(module, version).then(function(installedPackage) {
                    if (installedPackage) resolve(installedPackage);
                    else {
                        
                        // install
                        this._queueCommand('install', [this._installationPath, [module+(version ? '@'+version : '')]], function(resolve, reject, avalablePackagesList, packageTree, packageString) {
                            var match = /([^@]+)@(\S+)/gi.exec(packageString);
                            resolve({path: path.join(this._installationPath, 'node_modules', match[1]), package: match[1], version: match[2]});
                        }.bind(this)).then(resolve).catch(reject);
                    }
                }.bind(this)).catch(reject);
            }.bind(this));
        }




        /** 
         * checks if npm is loaded, executes the command if yes, queues it if no
         *
         * @param <String> command to execute
         * @param <Array> arguments to pass to the command
         * @param <Function> optional callback to call with the results of command
         */
        , _queueCommand: function(command, args, transformer) {
            return new Promise(function(resolve, reject) {
                if (this.isLoaded) {
                    // add callback to the args
                    this._execCommand(resolve, reject, command, args, transformer);
                }
                else {
                    this._queue.push({
                          resolve       : resolve
                        , reject        : reject
                        , command       : command
                        , args          : args
                        , transformer   : transformer
                    });
                }
            }.bind(this));
        }




        /**
         * executes a npm command
         *
         * @param <Function> resolve callback
         * @param <Function> reject callback
         * @param <String> command to execute
         * @param <Array> arguments to pass to the command
         * @param <Function> optional callback to call with the results of command
         *
         */
        , _execCommand: function(resolve, reject, command, args, transformer) {
            args = Array.prototype.slice.call(args);


            args.push(function(err) {
                if (err) reject(err);
                else if (transformer) {
                    var resultArgs = Array.prototype.slice.call(arguments, 1);

                    resultArgs.unshift(reject);
                    resultArgs.unshift(resolve);

                    transformer.apply(null, resultArgs);
                }
                else resolve(Array.prototype.slice.call(arguments, 1));
            }.bind(this));

            // call command
            npm.commands[command].apply(npm.command, args);
        }
    });
}();
