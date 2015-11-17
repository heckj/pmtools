# pmtools

A helper CLI tools for interacting with multiple repositories in github
for project management tasks.

 * checkout, sync/update, and reset local enlistments from a manifest file
 * list repositories and issues for all repositories in the manifest
 * export github issue data
 * create, list, and delete labels and milestones across a set of repositories
 * make a release branch for interlocking projects, updating the package.json files appropriately

## installation

    npm install

## help

    ./pmtool --help for CLI instructions

## using workspace to get all the code

    npm install
    cp workspace.json ..
    cd ..
    ./pmtools/pmtool sync
