/* jslint node: true */

'use strict';
var fs = require('fs'),
    Q = require('q'),
    _ = require('lodash'),
    Subprocess = require('./child-process');

module.exports = {
    /**
     * Clones or pulls the latest from github
     *
     * @param cwd
     * @param dirname
     * @param repo
     * @param nconf
     * @returns {Q.promise}
     */
    cloneOrPull: function cloneOrPull(cwd, dirname, repo, nconf) {
        var gitDir = cwd + "/" + dirname;
        var deferred = Q.defer();
        fs.exists(gitDir + "/.git", function (exists) {
            if (exists) {
                //console.log("directory "+gitDir+" exists, fetching...");
                new Subprocess("git fetch --all --prune ",
                    {cwd: gitDir, verbose: nconf.get('verbose')})
                    .run()
                    .then(function () {
                        return new Subprocess("git pull --rebase ",
                            {cwd: gitDir, verbose: nconf.get('verbose')})
                            .run();
                    })
                    .then(function (result) {
                        deferred.resolve(result);
                    })
                    .fail(function (err) {
                        deferred.reject(err);
                    });
            } else {
                //console.log("directory "+gitDir+" doesn't exist, cloning...");
                new Subprocess("git clone --recursive " + repo + " " + dirname,
                    {verbose: nconf.get('verbose')})
                    .run()
                    .then(function (result) {
                        deferred.resolve(result);
                    })
                    .fail(function (err) {
                        deferred.reject(err);
                    });
            }
        });
        return deferred.promise;
    },

    /**
     * takes a CWD and invokes the git commands on that directory to reset
     * the branch to the latest upstream master, returning a promise of the
     * invocation.
     *
     * @param cwd
     * @param nconf
     * @returns {Q.promise}
     */
    resetToMaster: function resetToMaster(cwd, nconf) {
        if (!cwd) {
            return Q.reject("Invalid cwd: " + cwd);
        }
        return new Subprocess("git fetch --all --prune ",
            {cwd: cwd, verbose: nconf.get('verbose')})
            .run()
            .then(function () {
                return new Subprocess("git checkout master",
                    {cwd: cwd, verbose: nconf.get('verbose')})
                    .run();
            }).then(function () {
                return new Subprocess("git reset --hard origin/master",
                    {cwd: cwd, verbose: nconf.get('verbose')})
                    .run();
            });
    },

    /**
     * takes a CWD and invokes the git commands on that directory to create
     * a branch and push that branch up to the origin remote.
     *
     * @param branchname
     * @param cwd
     * @param nconf
     * @returns {Q.promise}
     */
    createBranch: function createBranch(branchname, cwd, nconf) {
        if (!branchname || !cwd) {
            return Q.reject("Invalid args: " + branchname, cwd);
        }
        return new Subprocess("git checkout -b " + branchname,
            {cwd: cwd, verbose: nconf.get('verbose')})
            .run()
            .then(function () {
                return new Subprocess("git push origin " + branchname,
                    {cwd: cwd, verbose: nconf.get('verbose')})
                    .run();
            });

    },
    /**
     * returns a promise with resolving to {}.stdout with the git status output
     *
     * @param cwd
     * @param nconf
     * @returns {*}
     */
    branchStatus: function branchStatus(cwd, nconf) {
        if (!cwd) {
            return Q.reject("Invalid cwd: " + cwd);
        }
        return new Subprocess("git status -s ",
            {cwd: cwd, verbose: nconf.get('verbose')})
            .run()
            .then(function (statusRunResult) {
                return  statusRunResult.stdout;
            });
    },

    /**
     * returns a promise resolving to the current branch name for a git repo
     * @param cwd
     * @param nconf
     * @returns {*}
     */
    currentBranch: function currentBranch(cwd, nconf) {

        if (!cwd) {
            return Q.reject("Invalid cwd: " + cwd);
        }
        return new Subprocess("git branch --no-color | grep '^\*' | sed -e 's/^* //'", // jshint ignore:line
            {cwd: cwd, verbose: nconf.get('verbose')})
            .run()
            .then(function (branchResult) {
                return  branchResult.stdout.trim();
            });
    },

    /**
     * takes a CWD and a branch name, and updates the package.json files in all
     * workspace directories to reflect corrected/modified branches for a release branch.
     *
     * @param branchname
     * @param cwd
     * @param nconf
     * @returns {Q.promise}
     */
    updatePackageToBranch: function updatePackageToBranch(branchname, cwd, nconf) {
        if (!branchname || !cwd) {
            return Q.reject("Invalid args: " + branchname, cwd);
        }
        var filename = cwd + "/package.json";
        var repoRegex = /^(git\+https.*\/RackHD\/)([\w_\-\.]+)#*([\w_-]*)$/;

        return Q.nfcall(fs.readFile, filename, 'utf8')
            .then(function (data) {
                return JSON.parse(data);
            })
            .then(function (packagedata) {
                _.forEach(packagedata.dependencies, function (value, key, collection) {
                    var match = repoRegex.exec(value);
                    if (match) {
                        if (match[3]) {
                            console.log("["+cwd+"] WARNING: branch for " + key +
                            " already set to " + match[3] + ", not changing!");
                        } else {
                            collection[key] = match[1] + match[2] + "#" + branchname;
                            if (nconf.get('verbose')) {
                                console.log("["+cwd+"] setting dependency value for " + key +
                                " to " + collection[key]);
                            }
                        }

                    }

                });
                _.forEach(packagedata.devDependencies, function (value, key, collection) {
                    var match = repoRegex.exec(value);
                    if (match) {
                        if (match[3]) {
                            console.log("WARNING: branch for " + key +
                            " already set to " + match[3] + ", not changing!");
                        } else {
                            collection[key] = match[1] + match[2] + "#" + branchname;
                            if (nconf.get('verbose')) {
                                console.log("["+cwd+"] setting devDependency value for " + key +
                                " to " + collection[key]);
                            }
                        }
                    }
                });
                return packagedata;
            })
            .then(function (packagedata) {
                //var util = require('util');
                //console.log("Package data is " + util.inspect(packagedata.dependencies));
                return Q.nfcall(fs.writeFile,
                    filename,
                    JSON.stringify(packagedata, null, 2),
                    {encoding: 'utf8'});
            })
            .then(function() {
                return new Subprocess("git commit -a -m '"+branchname+"'",
                    {cwd: cwd, verbose: nconf.get('verbose')})
                    .run()
                    .then(function (statusRunResult) {
                        return  statusRunResult.stdout;
                    });
            })
            .then(function() {
                return new Subprocess("git push origin " + branchname,
                    {cwd: cwd, verbose: nconf.get('verbose')})
                    .run();
            });
    }
};
