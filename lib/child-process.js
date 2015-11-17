/* jshint node: true */

'use strict';

var Q = require('q'),
    exec = require('child_process').exec;

module.exports = Subprocess;

/**
 * Creates a process running object
 *
 * @param command {string}
 * @param options
 * @constructor
 */
function Subprocess(command, options) {
    var opt = options || {};
    this.cwd = opt.cwd || process.cwd;
    this.environment = opt.environment || process.env;
    this.command = command || '';
    this.encoding = opt.encoding || 'utf8';
    this.verbose = opt.verbose;
    this.timeout = opt.timeout || 0;
    this.ignoreErrorCode = opt.ignore;
}

/**
 * Runs the command and returns a promise that resolves
 * to the result of running the command.
 *
 * @returns {Q.promise}
 */
Subprocess.prototype.run = function run() {
    var self = this,
        deferred = Q.defer();

    var commandResult = {
        stdout: '',
        stderr: '',
        code: null
    };

    if (self.verbose) {
        console.log("[running]["+self.cwd+"]: " + self.command);
    }
    var options = {
        env: self.environment,
        encoding: self.encoding,
        timeout: self.timeout
    };
    if (self.cwd) {
        options.cwd = self.cwd;
    }

    exec(self.command, options, function (error, stdout, stderr) {
        commandResult.stdout = stdout;
        commandResult.stderr = stderr;
        if (error && error.code && !self.ignoreErrorCode) {
            var err = new Error("Error running command: " + self.command +
            " : (" + error.code + ") " + commandResult.stderr);
            deferred.reject(err);
        } else {
            if (self.verbose) {
                console.log(commandResult.stdout);
                console.log(commandResult.stderr);
            }
            deferred.resolve(commandResult);
        }
    });

    return deferred.promise;
};
