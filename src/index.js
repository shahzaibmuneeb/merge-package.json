'use strict';

const { EOL } = require('os');
const ThreeWayMerger = require('three-way-merger');
const rfc6902 = require('rfc6902-ordered');

const dependencyKeys = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'bundledDependencies',
  'optionalDependencies'
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sortObjectKeys(obj) {
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = obj[key];
    return sorted;
  }, {});
}

function applyDependencyOperations(operations, deps) {
  operations.add.forEach(dep => deps[dep.name] = dep.version);
  operations.remove.forEach(dep => delete deps[dep.name]);
  operations.change.forEach(dep => deps[dep.name] = dep.version);
}

function mergeDependencyChanges(source, ours, theirs, finalDependencyKeys) {
  let mergeOperations = ThreeWayMerger.merge({ source, ours, theirs });

  // get a fresh copy so we don't mutate the passed in arg
  let result = clone(ours);

  finalDependencyKeys.forEach(dependencyKey => {
    // we could be missing the key and need to add to it
    if (!result[dependencyKey]) {
      result[dependencyKey] = {};
    }

    applyDependencyOperations(mergeOperations[dependencyKey], result[dependencyKey]);

    if (!Object.keys(result[dependencyKey]).length) {
      delete result[dependencyKey];
    } else {
      result[dependencyKey] = sortObjectKeys(result[dependencyKey]);
    }
  });

  return result;
}

function mergeNonDependencyChanges(source, ours, theirs) {
  let fromSourceToTheirs = rfc6902.createPatch(source, theirs);

  rfc6902.applyPatch(ours, fromSourceToTheirs, source, theirs);

  return ours;
}

function stringify(value) {
  return JSON.stringify(value, null, 2).replace(/\n/g, EOL) + EOL;
}

module.exports = function mergePackageJson(_currentPackageJson, _fromPackageJson, _toPackageJson, _dependencyKeys) {
  let currentPackageJson = JSON.parse(_currentPackageJson);
  let fromPackageJson = JSON.parse(_fromPackageJson);
  let toPackageJson = JSON.parse(_toPackageJson);
  let finalDependencyKeys = _dependencyKeys ? _dependencyKeys : dependencyKeys;

  let mergedDependenciesPackageJson = mergeDependencyChanges(fromPackageJson, currentPackageJson, toPackageJson, finalDependencyKeys);
  let mergedOtherPackageJson = mergeNonDependencyChanges(fromPackageJson, currentPackageJson, toPackageJson);

  let finalMergedPackageJson = clone(mergedOtherPackageJson);
  finalDependencyKeys.forEach(dependencyKey => {
    finalMergedPackageJson[dependencyKey] = mergedDependenciesPackageJson[dependencyKey];
  });

  return stringify(finalMergedPackageJson);
};
