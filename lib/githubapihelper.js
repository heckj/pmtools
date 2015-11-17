/* jslint node: true */

'use strict';

var Q = require('q'),
    _ = require('lodash'),
    url = require('url'),
    GitHubApi = require('github');

module.exports = GithubClient;

/**
 * creates a new GithubClient instance
 *
 * @param nconf
 * @constructor
 */
function GithubClient(nconf) {
    this.nconf = nconf;
    this.github = new GitHubApi({
        version: "3.0.0",
        debug: nconf.get('debug'),
        protocol: "https",
        timeout: 5000
    });
    this.github.authenticate({
        type: "oauth",
        token: nconf.get('authtoken')
    });
}

/**
 * returns a promise with a page of issues for a given user/repo combination
 * @param user String
 * @param repo String
 * @param [perPage] int
 * @param [page] int
 * @param [labels] String list of comma separated Label names. Example: bug,ui,@high
 * @param [milestone] String
 * @param [assignee] String
 * @returns {Q.promise}
 */
GithubClient.prototype.issues = function repos(user, repo, perPage, page,
                                               labels, milestone, assignee) {
    var deferred = Q.defer();
    if (!user) {
        deferred.reject("No user specified");
    }
    if(!repo) {
        deferred.reject("No repo specified");
    }
    var options = {
        user: user,
        repo: repo,
        'per_page': perPage || 100,
        page : page || 1
    };
    if (labels) {
        options.labels = labels;
    }
    if (milestone) {
        options.milestone = milestone;
    }
    if (assignee) {
        options.assignee = assignee;
    }
    this.github.issues.repoIssues(options, function (err, data) {
        if (err) {
            deferred.reject(err);
        }
        deferred.resolve(data);
    });
    return deferred.promise;
};

/**
 * Returns a promise resolving to an array of all the repositories associated with the org
 * @param org
 * @param [perPage]
 * @param [page]
 * @returns {Q.promise<repositoryList>}
 */
GithubClient.prototype.repos = function repos(org, perPage, page) {
    var deferred = Q.defer();
    perPage = perPage || 100;
    page = page || 1;
    this.github.repos.getFromOrg(
        {
            org: org,
            'per_page': perPage,
            'page': page
        }, function (err, data) {
        if (err) {
            deferred.reject(err);
        }
        deferred.resolve(data);
    });
    return deferred.promise;
};


/**
 * Returns a promise that iterates through all available repos for the given org
 * @param org
 * @returns {Q.promise}
 */
GithubClient.prototype.allRepos = function allRepos(org) {
    // iterate through promises
    var deferred = Q.defer();
    var self = this;
    var results = [];

    self.repos(org)
        .then(function (data) {
            _.forEach(data, function (repo) {
                if (_.has(repo, 'id')) {
                    results.push(repo);
                }
            });
            var promises = [];
            if (self.github.hasLastPage(data)) {
                var parsedQuery = url.parse(self.github.hasLastPage(data), true);
                for (var i = 2; i < parseInt(parsedQuery.query.page) + 1; i+=1) {
                    promises.push(self.repos(org, parsedQuery.query.per_page, i)); // jshint ignore:line
                }
                Q.all(promises)
                    .then(function (allResults) {
                        _.forEach(allResults, function (pageOfResults) {
                            _.forEach(pageOfResults, function (repo) {
                                if (_.has(repo, 'id')) {
                                    results.push(repo);
                                }
                            });
                        });
                    })
                    .then(function () {
                        deferred.resolve(results);
                    })
                    .fail(function(err) {
                        deferred.reject(err);
                    })
                    .done();
            } else {
                deferred.resolve(results);
            }
        })
        .fail(function(err) {
            deferred.reject(err);
        })
        .done();
    return deferred.promise;
};

GithubClient.prototype.allIssues = function allIssues(user, repo, labels, milestone, assignee) {
    // iterate through promises
    var deferred = Q.defer();
    var self = this;
    if (!user) {
        deferred.reject("No user specified");
    }
    if(!repo) {
        deferred.reject("No repo specified");
    }
    var url = require('url');
    var results = [];

    self.issues(user, repo, null, null, labels, milestone, assignee)
        .then(function (data) {
            _.forEach(data, function (issue) {
                if (_.has(issue, 'id')) {
                    results.push(issue);
                }
            });
            var promises = [];
            if (self.github.hasLastPage(data)) {
                var parsedQuery = url.parse(self.github.hasLastPage(data), true);
                for (var i = 2; i < parseInt(parsedQuery.query.page) + 1; i+=1) {
                    promises.push(self.issues(user, repo,
                        parsedQuery.query.per_page, i, labels, milestone, assignee)); //jshint ignore:line
                }
                Q.all(promises)
                    .then(function (allResults) {
                        _.forEach(allResults, function (pageOfResults) {
                            _.forEach(pageOfResults, function (issue) {
                                if (_.has(issue, 'id')) {
                                    results.push(issue);
                                }
                            });
                        });
                    })
                    .then(function () {
                        deferred.resolve(results);
                    })
                    .fail(function(err) {
                        deferred.reject(err);
                    })
                    .done();
            } else {
                deferred.resolve(results);
            }
        })
        .fail(function(err) {
            deferred.reject(err);
        })
        .done();
    return deferred.promise;

};

/**
 * list labels in repo
 * @param user
 * @param repoName
 * @param perPage
 * @param page
 * @returns {Q.promise}
 */
GithubClient.prototype.getLabelsInRepo = function getLabelsInRepo(user, repoName, perPage, page) {
    var self = this;
    perPage = perPage || 100;
    page = page || 1;
    var deferred = Q.defer();
    self.github.issues.getLabels({
        user: user,
        repo: repoName,
        'per_page': perPage,
        page: page
    }, function (err, labels) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(labels);
        }
    });
    return deferred.promise;
};

/**
 * Gets a list of all milestones in a given repo
 *
 * @param user
 * @param repoName
 * @param perPage
 * @param page
 * @returns {Q.promise}
 */
GithubClient.prototype.getMilestonesInRepo = function getMilestonesInRepo(user, repoName,
                                                                          perPage, page) {
    var self = this;
    perPage = perPage || 100;
    page = page || 1;
    var deferred = Q.defer();
    self.github.issues.getAllMilestones({
        user: user,
        repo: repoName,
        'per_page': perPage,
        page: page
    }, function (err, milestones) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(milestones);
        }
    });
    return deferred.promise;
};

/**
 * Creates a label in a repo
 *
 * @param user
 * @param repoName
 * @param label
 * @param [color]
 * @returns {Q.promise}
 */
GithubClient.prototype.createLabelInRepo = function createLabelInRepo(user, repoName,
                                                                      label, color) {
    color = color || 'ffffff';
    var self = this;
    var deferred = Q.defer();
    self.github.issues.createLabel({
        user: user,
        repo: repoName,
        name: label,
        color: color
    }, function (err) {
        if (err) {
            console.log("Unable to create " + label + " for " +
            user + "/" + repoName + " : " + err);
            deferred.reject(err);
        } else {
            console.log("Created label " + label + " for " +
            user + "/" + repoName);
            deferred.resolve(true);
        }
    });
    return deferred.promise;
};

/**
 * Deletes a label in a repo
 *
 * @param user
 * @param repoName
 * @param label
 * @returns {Q.promise}
 */
GithubClient.prototype.deleteLabelInRepo = function deleteLabelInRepo(user, repoName, label) {
    var self = this;
    var deferred = Q.defer();
    self.github.issues.deleteLabel({
        user: user,
        repo: repoName,
        name: label
    }, function (err) {
        if (err) {
            console.log("Unable to delete " + label + " for " +
            user + "/" + repoName + " : " + err.message);
            deferred.reject(err);
        } else {
            console.log("Deleted label " + label + " for " +
            user + "/" + repoName);
            deferred.resolve(true);
        }
    });
    return deferred.promise;
};

/**
 * creates a milestone in a repo
 *
 * @param user
 * @param repo
 * @param milestone
 * @returns {Q.promise}
 */
GithubClient.prototype.createMilestoneInRepo = function (user, repo, milestone) {
    var self = this;
    var deferred = Q.defer();
    self.github.issues.createMilestone({
        user: user,
        repo: repo,
        title: milestone
    }, function (err, aMilestone) {
        if (err) {
            console.log("Unable to create " + milestone + " for " +
            user + "/" + repo + " : " + err.message);
            deferred.reject(err);
        } else {
            console.log("Created " + milestone + " for " +
            user + "/" + repo);
            deferred.resolve(aMilestone);
        }
    });
    return deferred.promise;
};

/**
 * returns a promise resolving to a list of milestones in a repo
 *
 * milestone.number
 * milestone.title
 *
 * @param user
 * @param repo
 * @returns {Q.promise}
 */
GithubClient.prototype.milestonesInRepo = function milestonesInRepo(user, repo) {
    var self = this;
    var deferred = Q.defer();
    self.github.issues.getAllMilestones({
        user: user,
        repo: repo
    }, function (err, milestonesData) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(milestonesData);
        }
    });
    return deferred.promise;
};

/**
 * deletes a milestone from a repo
 *
 * @param user
 * @param repo
 * @param milestone
 * @returns {Q.promise}
 */
GithubClient.prototype.deleteMilestoneInRepo = function (user, repo, milestone) {
    var self = this;
    var deferred = Q.defer();
    self.milestonesInRepo(user, repo)
        .then(function (milestonesData) {
            var nochange = true;
            _.forEach(milestonesData, function (aMilestone) {
                if (aMilestone.title === milestone) {
                    nochange = false;
                    self.github.issues.deleteMilestone({
                        user: user,
                        repo: repo,
                        number: aMilestone.number
                    }, function (err) {
                        if (err) {
                            console.log("Unable to delete " + milestone + " for " +
                            user + "/" + repo + " : " + err);
                            deferred.reject(err);
                        } else {
                            console.log("Deleted " + milestone + " for " +
                            user + "/" + repo);
                            deferred.resolve(true);
                        }
                    });
                }
            });
            if (nochange) {
                console.log("No milestone named " + milestone + " found in " + user + "/" + repo);
                deferred.reject("No milestone named " + milestone +
                    " found in " + user + "/" + repo);
            }
        });
    return deferred.promise;
};

GithubClient.prototype.listMilestones = function listMilestones(org) {
    var self = this;
    var deferred = Q.defer();
    var milestoneSet = {};
    self.allRepos(org).then(function (repoList) {
        var promises = _.map(repoList, function (repo) {
            return self.getMilestonesInRepo(org, repo.name);
        });
        Q.allSettled(promises)
            .then(function (promiseResults) {
                //console.log(promiseResults);
                var combinedResultSet = _.zipObject(_.pluck(repoList, 'name'), promiseResults);
                //console.log(combinedResultSet);
                _.forEach(combinedResultSet, function(resolvedPromise, key) {
                    if (resolvedPromise.state === 'rejected') {
                        console.error("error retrieving milestones for " + key +
                        " " + resolvedPromise.reason);
                    } else {
                        _.forEach(resolvedPromise.value, function(milestone) {
                            if (_.has(milestoneSet, milestone.title)) {
                                milestoneSet[milestone.title].push(milestone);
                            } else {
                                milestoneSet[milestone.title] = [milestone];
                            }
                        });
                    }
                });
                deferred.resolve(milestoneSet);
            })
            .done();
    });
    return deferred.promise;
};
/**
 * list labels across all repos in a given org
 *
 * @param org
 * @returns {Q.promise}
 */
GithubClient.prototype.listLabels = function listLabels(org) {
    var self = this;
    var deferred = Q.defer();
    var labelSet = {};
    self.allRepos(org).then(function (repoList) {
        var promises = _.map(repoList, function (repo) {
            return self.getLabelsInRepo(org, repo.name);
        });
        Q.all(promises)
            .then(function (promiseResults) {
                _.forEach(promiseResults, function(labelList) {
                    _.forEach(labelList, function(label) {
                        //console.log(label);
                        if (_.has(labelSet, label.name)) {
                            labelSet[label.name].push(label);
                        } else {
                            labelSet[label.name] = [label];
                        }
                    });
                });
                deferred.resolve(labelSet);
            })
            .done();
    });
    return deferred.promise;
};

/**
 * create labels across all repos in a given org
 *
 * @param org
 * @param label
 * @returns {Q.promise}
 */
GithubClient.prototype.createLabels = function createLabels(org, label) {
    var self = this;
    var deferred = Q.defer();
    self.allRepos(org).then(function (repoList) {
        var promises = _.map(repoList, function (repo) {
            return self.createLabelInRepo(org, repo.name, label);
        });
        Q.allSettled(promises)
            .then(function (promiseResults) {
                var qq = _.zipObject(repoList, promiseResults);
                deferred.resolve(qq);
            })
            .done();
    });
    return deferred.promise;
};

/**
 * deletes labels across all repos in a given org
 *
 * @param org
 * @param label
 * @returns {Q.promise}
 */
GithubClient.prototype.deleteLabels = function deleteLabels(org, label) {
    var self = this;
    var deferred = Q.defer();
    self.allRepos(org).then(function (repoList) {
        var promises = _.map(repoList, function (repo) {
            return self.deleteLabelInRepo(org, repo.name, label);
        });
        Q.allSettled(promises)
            .then(function (promiseResults) {
                var qq = _.zipObject(repoList, promiseResults);
                deferred.resolve(qq);
            })
            .done();
    });
    return deferred.promise;
};

/**
 * create milestones across all repos in an org
 *
 * @param org
 * @param milestone
 * @returns {Q.promise}
 */
GithubClient.prototype.createMilestones = function createMilestones(org, milestone) {
    var self = this;
    var deferred = Q.defer();
    self.allRepos(org).then(function (repoList) {
        console.log(repoList);
        var promises = _.map(repoList, function (repo) {
            return self.createMilestoneInRepo(org, repo.name, milestone);
        });
        Q.allSettled(_.compact(promises))
            .then(function (promiseResults) {
                console.log("resolving!");
                console.log(promiseResults);
                var qq = _.zipObject(repoList, promiseResults);
                deferred.resolve(qq);
            })
            .done();
    });
    return deferred.promise;
};

/**
 * delete milestones across all repos in an org
 * @param org
 * @param milestone
 * @returns {Q.promise}
 */
GithubClient.prototype.deleteMilestones = function deleteMilestones(org, milestone) {
    var self = this;
    var deferred = Q.defer();

    self.allRepos(org).then(function (repoList) {
        var promises = _.map(repoList, function (repo) {
            return self.deleteMilestoneInRepo(org, repo.name, milestone);
        });
        Q.allSettled(promises)
            .then(function (promiseResults) {
                var qq = _.zipObject(repoList, promiseResults);
                deferred.resolve(qq);
            })
            .done();
    });
    return deferred.promise;
};

GithubClient.prototype.loadAllIssues = function loadAllIssues(org) {
    var self = this;
    var deferred = Q.defer();
    var results = [];

    self.allRepos(org).then(function (repoList) {
        var promises = _.map(repoList, function (repo) {
            return self.allIssues(org, repo.name);
        });
        Q.all(promises)
            .then(function (promiseResults) {
                _.forEach(promiseResults, function(issueList) {
                    _.forEach(issueList, function(issue) {
                        results.push(issue);
                    });
                });
            })
            .then(function() {
                deferred.resolve(results);
            })
            .done();
    });
    return deferred.promise;
};

GithubClient.prototype.getUserEvents = function getUserEvents(user, page) {
    var self = this;

    page = page || 1;
    var deferred = Q.defer();
    self.github.events.getFromUser({
        user: user,
        page: page
    }, function (err, milestones) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(milestones);
        }
    });
    return deferred.promise;
};

GithubClient.prototype.getAllUserEvents = function getAllUserEvents(user) {
    var self = this;
    var deferred = Q.defer();
    var results = [];

    self.getUserEvents(user, null)
        .then(function (events) {
            _.forEach(events, function (event) {
                if (_.has(event, 'id')) {
                    results.push(event);
                }
            });
            var promises = [];
            if (self.github.hasLastPage(events)) {
                var parsedQuery = url.parse(self.github.hasLastPage(events), true);
                for (var i = 2; i < parseInt(parsedQuery.query.page) + 1; i+=1) {
                    promises.push(self.getUserEvents(user, i)); //jshint ignore:line
                }
                Q.all(promises)
                    .then(function (allResults) {
                        _.forEach(allResults, function (pageOfResults) {
                            _.forEach(pageOfResults, function (event) {
                                if (_.has(event, 'id')) {
                                    results.push(event);
                                }
                            });
                        });
                    })
                    .then(function () {
                        deferred.resolve(results);
                    })
                    .fail(function(err) {
                        deferred.reject(err);
                    })
                    .done();
            } else {
                deferred.resolve(results);
            }
        })
        .fail(function(err) {
            deferred.reject(err);
        })
        .done();
    return deferred.promise;
};
